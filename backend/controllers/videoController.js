const Team = require('../models/Team');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const apiResponse = require('../utils/apiResponse');
const { createNotification } = require('../utils/notifications');

const canAccessTeamVideo = async (team, user) => {
  if (!team || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'faculty') {
    const faculty = await Faculty.findOne({ user_id: user._id }).select('_id');
    if (!faculty) return false;
    return team.assigned_faculty?.toString() === faculty._id.toString() || team.created_by?.toString() === user._id.toString();
  }
  const student = await Student.findOne({ user_id: user._id }).select('_id');
  if (!student) return false;
  return team.members?.some((m) => m.student_id?.toString() === student._id.toString() && m.status === 'accepted');
};

exports.scheduleTeamMeeting = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const allowed = await canAccessTeamVideo(team, req.user);
    if (!allowed) return apiResponse.error(res, 'Not allowed', 403);

    const { scheduled_at } = req.body;
    if (!scheduled_at) return apiResponse.error(res, 'scheduled_at is required', 400);

    team.video_meeting.scheduled_at = new Date(scheduled_at);
    await team.save();

    return apiResponse.success(res, team.video_meeting, 'Meeting scheduled');
  } catch (error) { return next(error); }
};

exports.getTeamMeetingAttendance = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('video_meeting.attendance.user_id', 'name email role')
      .select('team_name video_meeting');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const allowed = await canAccessTeamVideo(team, req.user);
    if (!allowed) return apiResponse.error(res, 'Not allowed', 403);

    return apiResponse.success(res, {
      team_name: team.team_name,
      room_url: team.video_meeting?.room_url || '',
      scheduled_at: team.video_meeting?.scheduled_at || null,
      last_started_at: team.video_meeting?.last_started_at || null,
      attendance: team.video_meeting?.attendance || [],
    });
  } catch (error) { return next(error); }
};

exports.sendTeamMeetingReminder = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('members.student_id', 'user_id')
      .populate('assigned_faculty', 'user_id')
      .select('team_name video_meeting members assigned_faculty');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const allowed = await canAccessTeamVideo(team, req.user);
    if (!allowed) return apiResponse.error(res, 'Not allowed', 403);

    const recipients = new Set();
    (team.members || []).forEach((m) => {
      const uid = m.student_id?.user_id?.toString();
      if (uid) recipients.add(uid);
    });
    if (team.assigned_faculty?.user_id) recipients.add(team.assigned_faculty.user_id.toString());
    recipients.delete(req.user._id.toString());

    const when = team.video_meeting?.scheduled_at ? new Date(team.video_meeting.scheduled_at).toLocaleString() : 'soon';
    for (const uid of recipients) {
      await createNotification({
        recipient: uid,
        type: 'meeting_reminder',
        title: `Meeting Reminder: ${team.team_name}`,
        message: `Team video meeting is scheduled ${when}.`,
        related_id: team._id,
        related_model: 'Team',
      });
    }

    return apiResponse.success(res, { sent_to: recipients.size }, 'Meeting reminder sent');
  } catch (error) { return next(error); }
};
