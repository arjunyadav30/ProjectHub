const Team = require('../models/Team');
const VivaSession = require('../models/VivaSession');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const apiResponse = require('../utils/apiResponse');

const makeQuestions = (team) => {
  const moduleNames = (team.project?.modules || []).map((m) => m.module_name).slice(0, 3);
  const technologies = (team.project?.technologies_used || []).slice(0, 3);
  const focus = [...moduleNames, ...technologies].filter(Boolean);
  const seed = focus.length ? focus : ['project architecture', 'database design', 'testing strategy'];

  return seed.slice(0, 5).map((item, index) => ({
    question: `Q${index + 1}: Explain your approach for ${item} in this project.`,
    expected_points: ['clear concept explanation', 'implementation detail', 'tradeoff analysis'],
  }));
};

const scoreAnswer = (answer = '') => {
  const text = String(answer).trim();
  if (!text) return { score: 0, feedback: 'No answer provided.' };
  if (text.length < 40) return { score: 6, feedback: 'Answer is too short. Add implementation detail.' };
  if (text.length < 120) return { score: 12, feedback: 'Good start, but add tradeoffs and examples.' };
  return { score: 18, feedback: 'Strong explanation with good depth.' };
};

exports.startVivaSession = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    if (!team_id) return apiResponse.error(res, 'team_id is required', 400);

    const team = await Team.findById(team_id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const student = await Student.findOne({ user_id: req.user._id });
    if (!student || !team.members.some((m) => m.student_id?.toString() === student._id.toString() && m.status === 'accepted')) {
      return apiResponse.error(res, 'Only accepted team students can start viva', 403);
    }

    const session = await VivaSession.create({
      team_id: team._id,
      student_user_id: req.user._id,
      project_title: team.project?.title || team.team_name,
      questions: makeQuestions(team),
      max_score: 100,
    });

    return apiResponse.created(res, session, 'Viva session started');
  } catch (error) { return next(error); }
};

exports.submitVivaAnswers = async (req, res, next) => {
  try {
    const { session_id, answers = [] } = req.body;
    const session = await VivaSession.findById(session_id);
    if (!session) return apiResponse.error(res, 'Session not found', 404);
    if (session.student_user_id.toString() !== req.user._id.toString()) return apiResponse.error(res, 'Not allowed', 403);

    let total = 0;
    session.questions = session.questions.map((q, i) => {
      const answer = answers[i] || '';
      const scored = scoreAnswer(answer);
      total += scored.score;
      return { ...q.toObject(), answer, score: scored.score, feedback: scored.feedback };
    });

    session.total_score = Math.min(session.max_score, total);
    session.status = 'completed';
    session.overall_feedback = session.total_score >= 70
      ? 'Great viva performance with strong technical articulation.'
      : 'Needs improvement. Focus on architecture clarity and implementation reasoning.';

    await session.save();

    return apiResponse.success(res, {
      session_id: session._id,
      total_score: session.total_score,
      max_score: session.max_score,
      overall_feedback: session.overall_feedback,
      question_feedback: session.questions,
    }, 'Viva evaluated');
  } catch (error) { return next(error); }
};

exports.addFacultyVivaReview = async (req, res, next) => {
  try {
    const { session_id, comment } = req.body;
    const session = await VivaSession.findById(session_id).populate('team_id', 'assigned_faculty created_by');
    if (!session) return apiResponse.error(res, 'Session not found', 404);

    const team = session.team_id;
    let allowed = req.user.role === 'admin' || team.created_by?.toString() === req.user._id.toString();
    if (!allowed && req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ user_id: req.user._id }).select('_id');
      allowed = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    }
    if (!allowed) return apiResponse.error(res, 'Not allowed', 403);

    session.faculty_review = {
      reviewer_id: req.user._id,
      comment: comment || '',
      reviewed_at: new Date(),
    };
    await session.save();
    return apiResponse.success(res, session, 'Faculty review added');
  } catch (error) { return next(error); }
};

exports.getMyVivaSessions = async (req, res, next) => {
  try {
    const sessions = await VivaSession.find({ student_user_id: req.user._id }).sort({ created_at: -1 }).limit(20);
    return apiResponse.success(res, sessions);
  } catch (error) { return next(error); }
};

exports.getTeamVivaSessions = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).select('assigned_faculty created_by team_name');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    let allowed = req.user.role === 'admin' || team.created_by?.toString() === req.user._id.toString();
    if (!allowed && req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ user_id: req.user._id }).select('_id');
      allowed = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    }
    if (!allowed) return apiResponse.error(res, 'Not allowed', 403);

    const sessions = await VivaSession.find({ team_id: req.params.teamId })
      .populate('student_user_id', 'name email')
      .populate('faculty_review.reviewer_id', 'name role')
      .sort({ created_at: -1 });

    return apiResponse.success(res, { team_name: team.team_name, sessions });
  } catch (error) { return next(error); }
};

exports.getVivaSessionReport = async (req, res, next) => {
  try {
    const session = await VivaSession.findById(req.params.sessionId)
      .populate('student_user_id', 'name email')
      .populate('team_id', 'team_name created_by assigned_faculty')
      .populate('faculty_review.reviewer_id', 'name role');
    if (!session) return apiResponse.error(res, 'Session not found', 404);

    const isStudentOwner = session.student_user_id?._id?.toString() === req.user._id.toString();
    const isTeamCreator = session.team_id?.created_by?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isStudentOwner && !isTeamCreator && !isAdmin) return apiResponse.error(res, 'Not allowed', 403);

    return apiResponse.success(res, {
      session_id: session._id,
      student: session.student_user_id,
      team: session.team_id?.team_name || '',
      project_title: session.project_title,
      total_score: session.total_score,
      max_score: session.max_score,
      overall_feedback: session.overall_feedback,
      questions: session.questions,
      faculty_review: session.faculty_review,
      created_at: session.created_at,
    });
  } catch (error) { return next(error); }
};
