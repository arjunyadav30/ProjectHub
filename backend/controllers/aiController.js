const Student = require('../models/Student');
const Team = require('../models/Team');
const apiResponse = require('../utils/apiResponse');
const { callAI, parseJsonResponse } = require('../utils/aiProvider');

const TRENDING = [
  { title: 'AI Attendance Assistant', branch: 'CSE', difficulty: 'medium', stack: ['Node.js', 'React', 'MongoDB', 'Face Recognition'] },
  { title: 'Smart Energy Monitor', branch: 'EE', difficulty: 'hard', stack: ['IoT', 'Python', 'React'] },
  { title: 'Campus AR Navigation', branch: 'IT', difficulty: 'hard', stack: ['Unity', 'Node.js', 'Maps API'] },
  { title: 'Microservice Library Portal', branch: 'CSE', difficulty: 'medium', stack: ['Express', 'Redis', 'MongoDB'] },
];

const makeAbstract = ({ title, stack, branch, interests = [] }) => {
  const interestText = interests.length ? `with a focus on ${interests.join(', ')}` : 'focused on real-world impact';
  return `${title} is a ${branch} aligned project ${interestText}. It uses ${stack.join(', ')} to build a scalable solution with measurable outcomes and deployment-ready architecture.`;
};

const sanitizeSuggestions = (items, branch, interests, difficulty) => (
  Array.isArray(items) ? items : []
).slice(0, 6).map((item, index) => ({
  title: String(item.title || `Project Idea ${index + 1}`).slice(0, 120),
  branch: String(item.branch || branch).slice(0, 40),
  difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : (difficulty === 'all' ? 'medium' : difficulty),
  stack: Array.isArray(item.stack) ? item.stack.map(String).slice(0, 6) : [],
  abstract: String(item.abstract || '').slice(0, 500),
  suggested_for: { branch, interests },
}));

const fallbackRecommendations = ({ branch, interests, difficulty }) => TRENDING
  .filter((item) => item.branch === branch || item.branch === 'CSE')
  .filter((item) => difficulty === 'all' || item.difficulty === difficulty)
  .map((item) => ({
    ...item,
    abstract: makeAbstract({ ...item, branch, interests }),
    suggested_for: { branch, interests },
  }));

const buildProjectContext = (team) => {
  const modules = team.project?.modules || [];
  return {
    team_name: team.team_name,
    event: team.event_id?.title || '',
    title: team.project?.title || '',
    description: team.project?.description || '',
    technologies_used: team.project?.technologies_used || [],
    github_link: team.project?.github_link || '',
    live_link: team.project?.live_link || '',
    submission_status: team.project?.submission_status || 'not_submitted',
    modules: modules.map((mod) => ({
      name: mod.module_name,
      description: mod.description,
      status: mod.status,
      priority: mod.priority,
      due_date: mod.due_date,
    })),
    progress_updates: (team.project?.progress_updates || []).slice(-8).map((item) => item.message),
  };
};

const getAccessibleTeam = async (req, teamId) => {
  const team = await Team.findById(teamId)
    .populate('event_id', 'title')
    .populate('assigned_faculty', 'user_id')
    .lean();
  if (!team) return { error: 'Team not found', status: 404 };
  if (req.user.role === 'admin') return { team };
  if (req.user.role === 'faculty' && team.assigned_faculty?.user_id?.toString() === req.user._id.toString()) return { team };
  if (req.user.role === 'student') {
    const student = await Student.findOne({ user_id: req.user._id }).select('_id').lean();
    const isMember = student && team.members?.some((m) => m.student_id.toString() === student._id.toString());
    if (isMember) return { team };
  }
  return { error: 'Not authorized to access this team', status: 403 };
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const { difficulty = 'all' } = req.query;
    const student = await Student.findOne({ user_id: req.user._id }).lean();
    if (!student) return apiResponse.error(res, 'Student profile not found', 404);

    const interests = (student.skills || []).slice(0, 5);
    const branch = student.branch || 'CSE';

    let source = 'fallback';
    let suggestions = fallbackRecommendations({ branch, interests, difficulty });

    const aiResponse = await callAI({
      json: true,
      system: 'You recommend practical college software and engineering projects. Return compact valid JSON only.',
      prompt: JSON.stringify({
        task: 'Generate personalized project recommendations.',
        required_schema: {
          recommended: [{
            title: 'string',
            branch: 'string',
            difficulty: 'easy|medium|hard',
            stack: ['string'],
            abstract: 'string under 80 words',
          }],
        },
        student: { branch, interests, semester: student.semester, year: student.year },
        difficulty,
      }),
    }).catch(() => null);

    if (aiResponse?.text) {
      const parsed = parseJsonResponse(aiResponse.text, () => ({}));
      const aiSuggestions = sanitizeSuggestions(parsed.recommended, branch, interests, difficulty);
      if (aiSuggestions.length) {
        suggestions = aiSuggestions;
        source = aiResponse.provider;
      }
    }

    return apiResponse.success(res, {
      recommended: suggestions,
      trending: TRENDING.slice(0, 6),
      source,
    });
  } catch (error) { return next(error); }
};

exports.generateProjectSummary = async (req, res, next) => {
  try {
    const { team, error, status } = await getAccessibleTeam(req, req.params.teamId);
    if (error) return apiResponse.error(res, error, status);

    const context = buildProjectContext(team);
    const fallback = `${context.title || context.team_name} is a ${context.event ? `${context.event} ` : ''}project using ${(context.technologies_used || []).join(', ') || 'the selected technology stack'}. The team has ${context.modules.length} planned modules with ${context.modules.filter(m => m.status === 'completed').length} completed.`;
    let result = {
      summary: fallback,
      highlights: context.modules.slice(0, 3).map((m) => `${m.name}: ${m.status}`),
      next_steps: context.modules.filter((m) => m.status !== 'completed').slice(0, 3).map((m) => m.name),
      source: 'fallback',
    };

    const aiResponse = await callAI({
      json: true,
      system: 'You write concise academic project summaries for college project dashboards. Return valid JSON only.',
      prompt: JSON.stringify({
        task: 'Create a project summary, key highlights, and next steps.',
        required_schema: { summary: 'string under 120 words', highlights: ['string'], next_steps: ['string'] },
        project: context,
      }),
    }).catch(() => null);

    if (aiResponse?.text) {
      const parsed = parseJsonResponse(aiResponse.text, () => ({}));
      result = {
        summary: String(parsed.summary || result.summary).slice(0, 900),
        highlights: (Array.isArray(parsed.highlights) ? parsed.highlights : result.highlights).map(String).slice(0, 5),
        next_steps: (Array.isArray(parsed.next_steps) ? parsed.next_steps : result.next_steps).map(String).slice(0, 5),
        source: aiResponse.provider,
      };
    }

    return apiResponse.success(res, result);
  } catch (error) { return next(error); }
};

exports.reviewProjectCode = async (req, res, next) => {
  try {
    const { team, error, status } = await getAccessibleTeam(req, req.params.teamId);
    if (error) return apiResponse.error(res, error, status);

    const context = buildProjectContext(team);
    const code = String(req.body.code || '').slice(0, 18000);
    const notes = String(req.body.notes || '').slice(0, 2000);
    if (!code && !context.github_link) {
      return apiResponse.error(res, 'Paste code or add a GitHub link before requesting review', 400);
    }

    let result = {
      verdict: 'Manual review recommended',
      issues: code ? [] : ['GitHub link is available, but repository contents are not fetched automatically. Paste a relevant file for deeper review.'],
      suggestions: ['Check validation, error handling, authentication boundaries, and deployment configuration.'],
      source: 'fallback',
    };

    const aiResponse = await callAI({
      json: true,
      system: 'You are a senior code reviewer for college project submissions. Be specific, constructive, and concise. Return valid JSON only.',
      prompt: JSON.stringify({
        task: 'Review this project/code for bugs, security risks, maintainability, and missing tests.',
        required_schema: { verdict: 'string', issues: ['string'], suggestions: ['string'] },
        project: context,
        notes,
        code,
      }),
    }).catch(() => null);

    if (aiResponse?.text) {
      const parsed = parseJsonResponse(aiResponse.text, () => ({}));
      result = {
        verdict: String(parsed.verdict || result.verdict).slice(0, 300),
        issues: (Array.isArray(parsed.issues) ? parsed.issues : result.issues).map(String).slice(0, 8),
        suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : result.suggestions).map(String).slice(0, 8),
        source: aiResponse.provider,
      };
    }

    return apiResponse.success(res, result);
  } catch (error) { return next(error); }
};
