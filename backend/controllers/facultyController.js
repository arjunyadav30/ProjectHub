const Team = require('../models/Team');
const Event = require('../models/Event');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Marks = require('../models/Marks');
const apiResponse = require('../utils/apiResponse');
const { createNotification, resolveActionNotifications } = require('../utils/notifications');
const { notifyTeamStakeholders } = require('../utils/realtime');

const syncTeam = (teamId) => {
  if (teamId) notifyTeamStakeholders(teamId).catch(() => {});
};

const normalizeMarksPayload = (m = {}) => {
  const labelMarks = Array.isArray(m.label_marks)
    ? m.label_marks.map(label => {
      const marksOutOf = Math.max(1, Number(label.marks_out_of) || 100);
      const rawMarks = m.attendance === 'absent' ? 0 : Number(label.marks) || 0;
      return {
        label_id: label.label_id || null,
        label: String(label.label || 'Presentation').trim(),
        marks: Math.min(marksOutOf, Math.max(0, rawMarks)),
        marks_out_of: marksOutOf,
      };
    })
    : [{
      label_id: null,
      label: m.marks_label || 'Presentation',
      marks: m.attendance === 'absent' ? 0 : Math.max(0, Number(m.presentation_marks) || 0),
      marks_out_of: Math.max(1, Number(m.marks_out_of) || 100),
    }];
  const totalMarks = labelMarks.reduce((sum, label) => sum + label.marks, 0);
  const totalOutOf = labelMarks.reduce((sum, label) => sum + label.marks_out_of, 0) || 100;
  return {
    ...m,
    presentation_id: m.presentation_id || null,
    presentation_title: m.presentation_title || m.marks_label || 'Presentation',
    label_marks: labelMarks,
    presentation_marks: totalMarks,
    marks_out_of: totalOutOf,
    marks_label: m.presentation_title || m.marks_label || 'Presentation',
    attendance: m.attendance || 'not_marked',
  };
};

// GET /api/faculty/assigned-teams
exports.getAssignedTeams = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return apiResponse.error(res, 'Faculty profile not found', 404);

    const teams = await Team.find({ assigned_faculty: faculty._id })
      .populate('event_id', 'title status event_end_date presentation_schedule presentation_schedules')
      .populate('team_leader', 'name enrollment_no email profile_image')
      .populate('members.student_id', 'name enrollment_no email branch semester year profile_image')
      .populate('assigned_faculty', 'name faculty_id email profile_image')
      .sort({ created_at: -1 });

    return apiResponse.success(res, teams);
  } catch (e) { next(e); }
};

// POST /api/faculty/teams/:id/suggestion
exports.addSuggestion = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return apiResponse.error(res, 'Suggestion text required', 400);

    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    team.project.suggestions.push({
      by_user: req.user._id,
      by_name: req.user.name,
      text,
    });
    await team.save();
    syncTeam(team._id);

    // Notify team leader
    const leader = await Student.findById(team.team_leader);
    if (leader) {
      await createNotification({
        recipient: leader.user_id,
        type: 'new_suggestion', title: 'New Faculty Suggestion',
        message: `Your mentor added a suggestion for team "${team.team_name}"`,
        reference_id: team._id, reference_type: 'Team',
      });
    }

    return apiResponse.created(res, team.project.suggestions, 'Suggestion added');
  } catch (e) { next(e); }
};

// POST /api/faculty/teams/:id/marks
exports.giveMarks = async (req, res, next) => {
  try {
    const { marks_data } = req.body;
    const team = await Team.findById(req.params.id).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    const isAssignedMentor = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    if (req.user.role !== 'admin' && (!isAssignedMentor || team.mentor_status !== 'accepted')) {
      return apiResponse.error(res, 'Only the accepted assigned mentor can give presentation marks', 403);
    }

    const results = [];
    for (const m of marks_data) {
      const normalized = normalizeMarksPayload(m);
      const record = await Marks.findOneAndUpdate(
        { team_id: team._id, event_id: team.event_id._id, student_id: m.student_id, presentation_id: normalized.presentation_id, college_id: req.user.college_id },
        { ...normalized, college_id: req.user.college_id, team_id: team._id, event_id: team.event_id._id, student_id: m.student_id, awarded_by: req.user._id },
        { upsert: true, new: true }
      );
      results.push(record);

      const student = await Student.findById(m.student_id);
      if (student) {
        await createNotification({
          recipient: student.user_id,
          type: 'marks_added', title: 'Marks Published',
          message: `Your marks: ${normalized.presentation_marks}/${normalized.marks_out_of} for "${normalized.presentation_title}"`,
          reference_id: team._id, reference_type: 'Team',
        });
      }
    }
    syncTeam(team._id);
    return apiResponse.success(res, results, 'Marks saved');
  } catch (e) { next(e); }
};

// GET /api/faculty/teams/:id/marks
exports.getTeamMarks = async (req, res, next) => {
  try {
    const marks = await Marks.find({ team_id: req.params.id })
      .populate('student_id', 'name enrollment_no')
      .populate('awarded_by', 'name');
    return apiResponse.success(res, marks);
  } catch (e) { next(e); }
};

// POST /api/faculty/teams/:id/submission-review
exports.reviewSubmission = async (req, res, next) => {
  try {
    const { action, comment } = req.body; // action: 'accepted' | 'rejected'
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    if (!['accepted', 'rejected'].includes(action)) {
      return apiResponse.error(res, 'Action must be accepted or rejected', 400);
    }

    const faculty = await Faculty.findOne({ user_id: req.user._id });
    const isAdmin = req.user.role === 'admin';
    const isAssignedMentor = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    if (!isAdmin && !isAssignedMentor) {
      return apiResponse.error(res, 'Only admin or assigned mentor can review final submission', 403);
    }

    team.project.submission_status = action;
    team.project.submission_comment = comment || '';
    await team.save();

    // Notify team leader
    const leader = await Student.findById(team.team_leader);
    if (leader) {
      await createNotification({
        recipient: leader.user_id,
        type: action === 'accepted' ? 'submission_accepted' : 'submission_rejected',
        title: `Submission ${action === 'accepted' ? 'Accepted' : 'Rejected'}`,
        message: `Your team "${team.team_name}" submission was ${action}${comment ? `. Comment: ${comment}` : ''}`,
        reference_id: team._id, reference_type: 'Team',
      });
    }
    syncTeam(team._id);
    return apiResponse.success(res, team, `Submission ${action}`);
  } catch (e) { next(e); }
};

// PUT /api/faculty/mentor-requests/:id  (accept/reject mentor request)
exports.respondMentorRequest = async (req, res, next) => {
  try {
    const { action } = req.body; // 'accepted' | 'rejected'
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty || team.assigned_faculty?.toString() !== faculty._id.toString()) {
      return apiResponse.error(res, 'Not authorized', 403);
    }

    team.mentor_status = action;
    if (action === 'rejected') {
      team.assigned_faculty = null;
      team.mentor_status = 'none';
    }
    await team.save();

    await resolveActionNotifications({
      userId: req.user._id,
      teamId: team._id,
      types: ['mentor_request'],
      status: action === 'accepted' ? 'accepted' : 'rejected',
    });

    syncTeam(team._id);
    return apiResponse.success(res, team, `Mentor request ${action}`);
  } catch (e) { next(e); }
};

// GET /api/faculty/mentor-requests
exports.getMentorRequests = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    if (!faculty) return apiResponse.error(res, 'Faculty not found', 404);

    const pending = await Team.find({ assigned_faculty: faculty._id, mentor_status: 'pending' })
      .populate('event_id', 'title')
      .populate('team_leader', 'name enrollment_no');

    return apiResponse.success(res, pending);
  } catch (e) { next(e); }
};
