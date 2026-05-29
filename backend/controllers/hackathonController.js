const Hackathon = require('../models/Hackathon');
const HackathonSubmission = require('../models/HackathonSubmission');
const HackathonScore = require('../models/HackathonScore');
const Team = require('../models/Team');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const apiResponse = require('../utils/apiResponse');

const scoreTotal = (scores = {}) => ['innovation', 'execution', 'ui_ux', 'impact']
  .reduce((sum, key) => sum + (Number(scores[key]) || 0), 0);

const isOwner = (hackathon, userId) => hackathon.organizer?.toString() === userId.toString();

const ensureOwner = (hackathon, req, res) => {
  if (!isOwner(hackathon, req.user._id)) {
    apiResponse.error(res, 'Only hackathon creator can manage this hackathon', 403);
    return false;
  }
  return true;
};

const userCanUseTeam = async (team, user) => {
  if (team.created_by?.toString() === user._id.toString()) return true;
  if (user.role !== 'student') return false;
  const student = await Student.findOne({ user_id: user._id });
  if (!student) return false;
  return team.members.some((m) => m.student_id?.toString() === student._id.toString() && m.status === 'accepted');
};

const adminCreateHackathon = async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      college_id: req.user.college_id,
      organizer: req.user._id,
      organizer_role: req.user.role,
      tracks: req.body.tracks || [],
      prizes: req.body.prizes || [],
      faqs: req.body.faqs || [],
      scope_type: req.body.scope_type || 'inter_college',
      team_college_rule: req.body.team_college_rule || 'same_college',
    };

    const hackathon = await Hackathon.create(data);
    return apiResponse.created(res, hackathon, 'Hackathon created successfully');
  } catch (error) { next(error); }
};

const getMyHackathons = async (req, res, next) => {
  try {
    const hackathons = await Hackathon.find({ organizer: req.user._id }).sort({ createdAt: -1 });
    return apiResponse.success(res, hackathons);
  } catch (error) { next(error); }
};

const adminUpdateHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);
    if (!ensureOwner(hackathon, req, res)) return;

    const allowed = [
      'title', 'description', 'banner_image_url', 'registration_start', 'registration_end',
      'submission_deadline', 'max_team_size', 'tracks', 'prizes', 'rules', 'faqs',
      'status', 'is_results_published', 'scope_type', 'team_college_rule',
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) hackathon[key] = req.body[key];
    });

    await hackathon.save();
    return apiResponse.success(res, hackathon, 'Hackathon updated');
  } catch (error) { next(error); }
};

const adminDeleteHackathon = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);
    if (!ensureOwner(hackathon, req, res)) return;

    await Promise.all([
      Hackathon.findByIdAndDelete(req.params.id),
      HackathonSubmission.deleteMany({ hackathon_id: req.params.id }),
      HackathonScore.deleteMany({ hackathon_id: req.params.id }),
    ]);

    return apiResponse.success(res, null, 'Hackathon deleted');
  } catch (error) { next(error); }
};

const adminAssignJudges = async (req, res, next) => {
  try {
    const { judge_ids = [] } = req.body;
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);
    if (!ensureOwner(hackathon, req, res)) return;

    const validJudges = await Faculty.find({ _id: { $in: judge_ids } }).select('_id');
    hackathon.judges = validJudges.map((j) => j._id);
    await hackathon.save();

    return apiResponse.success(res, hackathon, 'Judges assigned');
  } catch (error) { next(error); }
};

const adminPublishResults = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);
    if (!ensureOwner(hackathon, req, res)) return;

    hackathon.is_results_published = true;
    if (hackathon.status !== 'ended') hackathon.status = 'ended';
    await hackathon.save();

    return apiResponse.success(res, hackathon, 'Results published successfully');
  } catch (error) { next(error); }
};

const getAllHackathons = async (req, res, next) => {
  try {
    const { status, limit, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.title = { $regex: q, $options: 'i' };

    let query = Hackathon.find(filter).populate('organizer', 'name email role').sort({ createdAt: -1 });
    if (limit) query = query.limit(parseInt(limit, 10));
    const hackathons = await query;

    return apiResponse.success(res, hackathons);
  } catch (error) { next(error); }
};

const getHackathonById = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id)
      .populate('organizer', 'name email role')
      .populate('judges', 'name email department');
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);

    return apiResponse.success(res, hackathon);
  } catch (error) { next(error); }
};

const studentRegister = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);

    const team = await Team.findById(team_id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const canUseTeam = await userCanUseTeam(team, req.user);
    if (!canUseTeam) return apiResponse.error(res, 'Not authorized to register this team', 403);

    if (hackathon.team_college_rule === 'same_college' && team.college_id?.toString() !== hackathon.college_id?.toString()) {
      return apiResponse.error(res, 'Only same-college teams are allowed for this hackathon', 400);
    }

    if (team.members.filter((m) => m.status === 'accepted').length > hackathon.max_team_size) {
      return apiResponse.error(res, `Team exceeds max size of ${hackathon.max_team_size}`, 400);
    }

    if (!hackathon.registered_teams.some((id) => id.toString() === team._id.toString())) {
      hackathon.registered_teams.push(team._id);
      await hackathon.save();
    }

    return apiResponse.success(res, { hackathon_id: hackathon._id, team_id: team._id }, 'Team registered successfully');
  } catch (error) { next(error); }
};

const studentSubmit = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);

    const team = await Team.findById(req.body.team_id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const canUseTeam = await userCanUseTeam(team, req.user);
    if (!canUseTeam) return apiResponse.error(res, 'Not authorized to submit for this team', 403);

    const isRegistered = hackathon.registered_teams.some((id) => id.toString() === team._id.toString());
    if (!isRegistered) return apiResponse.error(res, 'Team is not registered for this hackathon', 400);

    const payload = {
      college_id: team.college_id,
      hackathon_id: hackathon._id,
      team_id: team._id,
      project_title: req.body.project_title,
      description: req.body.description || '',
      github_link: req.body.github_link || '',
      demo_video_url: req.body.demo_video_url || '',
      tech_stack: req.body.tech_stack || [],
      file_url: req.body.file_url || '',
      submitted_at: new Date(),
    };

    const submission = await HackathonSubmission.findOneAndUpdate(
      { hackathon_id: hackathon._id, team_id: team._id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return apiResponse.success(res, submission, 'Submission saved successfully');
  } catch (error) { next(error); }
};

const judgeGetAssigned = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return apiResponse.error(res, 'Faculty profile not found', 404);

    const hackathons = await Hackathon.find({ judges: faculty._id }).sort({ createdAt: -1 });
    return apiResponse.success(res, hackathons);
  } catch (error) { next(error); }
};

const judgeGetSubmissions = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return apiResponse.error(res, 'Faculty profile not found', 404);

    const hackathon = await Hackathon.findOne({ _id: req.params.id, judges: faculty._id });
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found or not assigned', 404);

    const submissions = await HackathonSubmission.find({ hackathon_id: hackathon._id })
      .populate('team_id', 'team_name members')
      .sort({ submitted_at: -1 });

    return apiResponse.success(res, submissions);
  } catch (error) { next(error); }
};

const judgeScoreSubmission = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return apiResponse.error(res, 'Faculty profile not found', 404);

    const hackathon = await Hackathon.findOne({ _id: req.params.id, judges: faculty._id });
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found or not assigned', 404);
    if (hackathon.is_results_published) return apiResponse.error(res, 'Scoring is closed after publishing results', 400);

    const submission = await HackathonSubmission.findOne({ _id: req.params.submissionId, hackathon_id: hackathon._id });
    if (!submission) return apiResponse.error(res, 'Submission not found', 404);

    const scores = req.body.scores || {};
    const fields = ['innovation', 'execution', 'ui_ux', 'impact'];
    for (const field of fields) {
      const value = Number(scores[field]);
      if (Number.isNaN(value) || value < 0 || value > 10) return apiResponse.error(res, `Invalid ${field} score. Must be between 0 and 10`, 400);
    }

    const scoreDoc = await HackathonScore.findOneAndUpdate(
      { hackathon_id: hackathon._id, submission_id: submission._id, judge_id: faculty._id },
      {
        college_id: submission.college_id,
        hackathon_id: hackathon._id,
        submission_id: submission._id,
        judge_id: faculty._id,
        scores,
        total: scoreTotal(scores),
        comment: req.body.comment || '',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return apiResponse.success(res, scoreDoc, 'Score saved');
  } catch (error) { next(error); }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const hackathon = await Hackathon.findById(req.params.id);
    if (!hackathon) return apiResponse.error(res, 'Hackathon not found', 404);
    if (!hackathon.is_results_published) return apiResponse.error(res, 'Results are not published yet', 403);

    const rows = await HackathonScore.aggregate([
      { $match: { hackathon_id: hackathon._id } },
      { $group: { _id: '$submission_id', averageScore: { $avg: '$total' }, judgesCount: { $sum: 1 } } },
      { $sort: { averageScore: -1 } },
    ]);

    const submissionIds = rows.map((r) => r._id);
    const submissions = await HackathonSubmission.find({ _id: { $in: submissionIds } }).populate('team_id', 'team_name');
    const subMap = new Map(submissions.map((s) => [s._id.toString(), s]));

    const leaderboard = rows.map((row, idx) => {
      const sub = subMap.get(row._id.toString());
      return {
        rank: idx + 1,
        submission_id: row._id,
        team_name: sub?.team_id?.team_name || 'Unknown Team',
        project_title: sub?.project_title || '',
        average_score: Number((row.averageScore || 0).toFixed(2)),
        judges_count: row.judgesCount,
      };
    });

    return apiResponse.success(res, leaderboard);
  } catch (error) { next(error); }
};

module.exports = {
  adminCreateHackathon,
  adminUpdateHackathon,
  adminDeleteHackathon,
  adminAssignJudges,
  adminPublishResults,
  getAllHackathons,
  getHackathonById,
  getMyHackathons,
  studentRegister,
  studentSubmit,
  judgeGetAssigned,
  judgeGetSubmissions,
  judgeScoreSubmission,
  getLeaderboard,
};
