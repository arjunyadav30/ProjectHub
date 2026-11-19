const Team = require('../models/Team');
const Student = require('../models/Student');
const VivaSession = require('../models/VivaSession');
const ContributionReport = require('../models/ContributionReport');
const apiResponse = require('../utils/apiResponse');
const { callAI, parseJsonResponse } = require('../utils/aiProvider');
const { getTeamAccess } = require('../utils/teamAccess');
const { parseRepo, listCommits, getCommitDetail, mapWithConcurrency } = require('../utils/githubClient');
const { buildIdentityIndex, resolveAuthor, isMergeCommit } = require('../utils/contributionScore');
const { buildMembers } = require('./contributionController');
const { buildTrustSignal } = require('../utils/trustSignal');
const {
  PER_QUESTION_MAX, selectCommitsForViva, buildCommitContext, buildQuestionPrompt, parseQuestions,
  fallbackQuestions, heuristicScoreAnswer, buildScoringPrompt, parseScores,
} = require('../utils/commitViva');

const MIN_OWN_COMMITS = 3;
const QUESTION_COUNT = 5;
const aiConfigured = () => !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);

/** What a student is allowed to see: never expected points, code context or the trust signal. */
const studentView = (session) => ({
  session_id: session._id,
  status: session.status,
  generation_method: session.generation_method,
  total_score: session.status === 'completed' ? session.total_score : undefined,
  questions: session.questions.map((q, i) => ({
    index: i,
    question: q.question,
    commit_sha: (q.commit_sha || '').slice(0, 7),
    commit_message: q.commit_message,
    files: q.files,
    difficulty: q.difficulty,
    ...(session.status === 'completed' ? { score: q.score, feedback: q.feedback } : {}),
  })),
});

exports.startCommitViva = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    if (!team_id) return apiResponse.error(res, 'team_id is required', 400);
    const team = await Team.findById(team_id).populate('members.student_id', 'name email github_link');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isMember) return apiResponse.error(res, 'Only accepted team students can start a viva', 403);

    // Resume instead of regenerating, so questions cannot be re-rolled until an easy set appears.
    const open = await VivaSession.findOne({ team_id: team._id, student_user_id: req.user._id, source: 'commit_ai', status: 'in_progress' });
    if (open) return apiResponse.success(res, studentView(open), 'Resuming your open viva');

    const fullName = team.project?.github?.repo_full_name || parseRepo(team.project?.github_link);
    if (!fullName) return apiResponse.error(res, 'Your team has not linked a GitHub repository yet', 400);

    const members = buildMembers(team);
    const index = buildIdentityIndex(members);
    const me = members.find((m) => String(m.student_id) === String(access.student._id));
    const { commits } = await listCommits(fullName, { maxCommits: 200 });
    const own = commits.filter((c) => !isMergeCommit(c) && resolveAuthor(c, index) === String(access.student._id));
    if (own.length < MIN_OWN_COMMITS) {
      return apiResponse.error(res, `Only ${own.length} commit(s) could be matched to you. At least ${MIN_OWN_COMMITS} are needed. Check your GitHub username/email mapping with your mentor.`, 400);
    }

    const details = await mapWithConcurrency(own.slice(0, 20), 5, (c) => getCommitDetail(fullName, c.sha));
    const detailed = details.filter((d) => d && !d.__error);
    const picked = selectCommitsForViva(detailed, QUESTION_COUNT);
    if (!picked.length) return apiResponse.error(res, 'Your commits are too small or only touch generated files, so no meaningful questions could be created', 400);
    const contexts = picked.map(buildCommitContext);

    let questions = [];
    let method = 'fallback';
    if (aiConfigured()) {
      try {
        const { system, prompt } = buildQuestionPrompt({ studentName: me?.name || 'Student', projectTitle: team.project?.title || team.team_name, contexts });
        const ai = await callAI({ system, prompt, json: true });
        const parsed = ai ? parseJsonResponse(ai.text, () => null) : null;
        questions = parseQuestions(parsed, contexts);
        if (questions.length) method = 'ai';
      } catch (_) { questions = []; }
    }
    // Top up any commit the AI skipped so the student always gets a full set.
    const covered = new Set(questions.map((q) => q.commit_sha));
    questions.push(...fallbackQuestions(contexts.filter((c) => !covered.has(c.sha))));

    const session = await VivaSession.create({
      team_id: team._id,
      student_user_id: req.user._id,
      project_title: team.project?.title || team.team_name,
      source: 'commit_ai',
      generation_method: method,
      questions,
      max_score: 100,
    });
    return apiResponse.created(res, studentView(session), 'Commit-based viva started');
  } catch (error) {
    if (/GitHub|Repository/.test(error.message)) return apiResponse.error(res, error.message, 502);
    return next(error);
  }
};

exports.submitCommitViva = async (req, res, next) => {
  try {
    const { session_id, answers = [] } = req.body;
    const session = await VivaSession.findById(session_id);
    if (!session || session.source !== 'commit_ai') return apiResponse.error(res, 'Session not found', 404);
    if (session.student_user_id.toString() !== req.user._id.toString()) return apiResponse.error(res, 'Not allowed', 403);
    if (session.status === 'completed') return apiResponse.error(res, 'This viva was already submitted', 409);
    if (!Array.isArray(answers)) return apiResponse.error(res, 'answers must be an array', 400);

    const items = session.questions.map((q, i) => ({
      question: q.question, expected_points: q.expected_points, files: q.files, context_excerpt: q.context_excerpt,
      answer: String(answers[i] || '').slice(0, 3000),
    }));

    let aiScores = new Array(items.length).fill(null);
    let usedAi = false;
    if (aiConfigured() && items.some((it) => it.answer.trim())) {
      try {
        const { system, prompt } = buildScoringPrompt(items);
        const ai = await callAI({ system, prompt, json: true });
        const parsed = ai ? parseJsonResponse(ai.text, () => null) : null;
        aiScores = parseScores(parsed, items.length);
        usedAi = aiScores.some(Boolean);
      } catch (_) { aiScores = new Array(items.length).fill(null); }
    }

    let fallbackUsed = false;
    let sum = 0;
    session.questions = session.questions.map((q, i) => {
      let scored = items[i].answer.trim() ? aiScores[i] : { score: 0, feedback: 'No answer provided.' };
      if (!scored) { scored = heuristicScoreAnswer(items[i].answer, q); fallbackUsed = true; }
      sum += scored.score;
      return { ...q.toObject(), answer: items[i].answer, score: scored.score, feedback: scored.feedback };
    });

    session.total_score = Math.round((sum / (items.length * PER_QUESTION_MAX)) * 100);
    session.status = 'completed';
    session.scoring_method = usedAi ? (fallbackUsed ? 'ai_fallback' : 'ai') : 'heuristic';
    session.overall_feedback = session.total_score >= 70 ? 'Strong understanding of your own commits.' : 'Review the commits you wrote and be ready to explain how and why they work.';

    // Cross-check with Git contribution. Visible to the guide only.
    const student = await Student.findOne({ user_id: req.user._id }).select('_id');
    const report = await ContributionReport.findOne({ team_id: session.team_id }).sort({ created_at: -1 });
    const row = report?.members.find((m) => String(m.student_id) === String(student?._id));
    const decided = report?.guide_decision?.scores?.find((s) => String(s.student_id) === String(student?._id));
    const gitScore = decided ? decided.score_100 : row ? row.suggested_score_100 : null;
    const signal = buildTrustSignal({ gitScore, vivaScore: session.total_score });
    session.trust = { git_score_100: gitScore, viva_score_100: session.total_score, level: signal.level, gap: signal.gap, message: signal.message };

    await session.save();
    return apiResponse.success(res, studentView(session), 'Viva evaluated');
  } catch (error) { return next(error); }
};

exports.studentView = studentView;
