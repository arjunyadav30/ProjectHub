const Team = require('../models/Team');
const Event = require('../models/Event');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');
const { generateRandomToken } = require('../utils/generateTokens');
const { createNotification, createNotifications, resolveActionNotifications } = require('../utils/notifications');
const { notifyTeamStakeholders } = require('../utils/realtime');

const syncTeam = (teamId) => {
  if (teamId) notifyTeamStakeholders(teamId).catch(() => {});
};
const {
  sendLeaderRequestEmail,
  sendTeamInviteEmail,
  sendRegistrationStatusEmail,
  sendFacultyAssignedEmail,
} = require('../utils/sendEmail');

const normalizeRegistrationStatus = (body = {}) => body.status || body.registration_status;
const createRoomName = (teamName, teamId) => `projecthub-${String(teamName || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(teamId).slice(-6)}`;

const isEventRegistrationOpen = (event) => {
  const now = new Date();
  const startsAt = event.registration_start ? new Date(event.registration_start) : null;
  const endsAt = event.registration_end ? new Date(event.registration_end) : null;
  const hasOpenStatus = ['open', 'active'].includes(event.status);

  return hasOpenStatus && (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
};

// POST /api/teams
const createTeam = async (req, res, next) => {
  try {
    const { event_id, team_name, member_enrollment_nos, leader_enrollment_no, project } = req.body;

    const event = await Event.findById(event_id);
    if (!event) return apiResponse.error(res, 'Event not found', 404);
    if (!isEventRegistrationOpen(event)) return apiResponse.error(res, 'Event registration is closed', 400);

    const enrollmentNos = Array.isArray(member_enrollment_nos)
      ? member_enrollment_nos.map(e => String(e).trim().toUpperCase()).filter(Boolean)
      : [];
    let creatorStudent = null;

    if (req.user.role === 'student') {
      creatorStudent = await Student.findOne({ user_id: req.user._id });
      if (!creatorStudent) return apiResponse.error(res, 'Student profile not found', 404);
      enrollmentNos.push(creatorStudent.enrollment_no);
    }

    const uniqueEnrollmentNos = [...new Set(enrollmentNos)];
    if (uniqueEnrollmentNos.length === 0) {
      return apiResponse.error(res, 'At least one team member is required', 400);
    }

    // Validate members
    const memberStudents = await Student.find({
      enrollment_no: { $in: uniqueEnrollmentNos },
    }).populate('user_id', 'email name');

    if (memberStudents.length !== uniqueEnrollmentNos.length) {
      const foundEnrollmentNos = new Set(memberStudents.map(s => s.enrollment_no));
      const missingEnrollmentNos = uniqueEnrollmentNos.filter(enrollmentNo => !foundEnrollmentNos.has(enrollmentNo));
      return apiResponse.error(res, `Student not found: ${missingEnrollmentNos.join(', ')}`, 400);
    }

    if (memberStudents.length < event.min_team_size) {
      return apiResponse.error(res, `Minimum ${event.min_team_size} members required`, 400);
    }
    if (memberStudents.length > event.max_team_size) {
      return apiResponse.error(res, `Maximum ${event.max_team_size} members allowed`, 400);
    }

    const requestedLeaderEnrollmentNo = leader_enrollment_no
      ? String(leader_enrollment_no).trim().toUpperCase()
      : creatorStudent?.enrollment_no;
    const leaderStudent = memberStudents.find(s => s.enrollment_no === requestedLeaderEnrollmentNo);
    if (!leaderStudent) return apiResponse.error(res, 'Team leader must be one of the members', 400);

    if (creatorStudent && !memberStudents.some(s => s._id.toString() === creatorStudent._id.toString())) {
      return apiResponse.error(res, 'Registering student must be included in the team', 400);
    }

    // A student can only be part of one active team registration per event.
    // Pending invitations count too, otherwise the same student can be added to many teams before accepting.
    for (const student of memberStudents) {
      const existingTeam = await Team.findOne({
        event_id,
        members: {
          $elemMatch: {
            student_id: student._id,
            status: { $in: ['pending', 'accepted'] },
          },
        },
        registration_status: { $ne: 'rejected' },
      });
      if (existingTeam) {
        return apiResponse.error(res, `${student.name} (${student.enrollment_no}) is already registered for this event. You can only register once per event.`, 400);
      }
    }

    const acceptToken = generateRandomToken();
    const rejectToken = generateRandomToken();
    const creatorIsLeader = creatorStudent?._id.toString() === leaderStudent._id.toString();

    const team = await Team.create({
      event_id,
      team_name,
      members: memberStudents.map(s => ({
        student_id: s._id,
        status: creatorStudent && s._id.toString() === creatorStudent._id.toString() ? 'accepted' : 'pending',
      })),
      team_leader: leaderStudent._id,
      leader_accepted: creatorIsLeader,
      created_by: req.user._id,
      project: project || {},
    });

    if (!team.video_meeting?.room_url) {
      const roomName = createRoomName(team.team_name, team._id);
      team.video_meeting = {
        room_name: roomName,
        room_url: `https://meet.jit.si/${roomName}`,
      };
      await team.save();
    }

    if (creatorIsLeader) {
      const eventCreatorUser = await User.findById(event.created_by);
      if (eventCreatorUser) {
        await createNotification({
          recipient: eventCreatorUser._id,
          type: 'faculty_request',
          title: 'New Team Registration',
          message: `Team "${team.team_name}" registered. Awaiting your approval.`,
          related_id: team._id,
          related_model: 'Team',
        });
      }
    } else {
      // Notify selected leader via email and in-app
      const leaderUser = leaderStudent.user_id;
      await sendLeaderRequestEmail(
        leaderUser.email, leaderStudent.name, team_name, event.title, acceptToken, rejectToken
      );
      await createNotification({
        recipient: leaderUser._id,
        type: 'leader_request',
        title: 'Team Leader Request',
        message: `You have been selected as leader of team "${team_name}" for event "${event.title}"`,
        related_id: team._id,
        related_model: 'Team',
        action_token: acceptToken,
      });
    }

    // Notify other members
    for (const student of memberStudents) {
      if (student._id.toString() !== leaderStudent._id.toString()) {
        const memberUser = student.user_id;
        await sendTeamInviteEmail(memberUser.email, student.name, team_name, event.title);
        await createNotification({
          recipient: memberUser._id,
          type: 'team_invite',
          title: 'Team Invitation',
          message: `You have been added to team "${team_name}" for event "${event.title}"`,
          related_id: team._id,
          related_model: 'Team',
        });
      }
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('team_leader', 'name enrollment_no email')
      .populate('members.student_id', 'name enrollment_no email')
      .populate('event_id', 'title');

    syncTeam(team._id);

    return apiResponse.created(
      res,
      populatedTeam,
      creatorIsLeader ? 'Team created. Awaiting organizer approval.' : 'Team created. Leader request sent.'
    );
  } catch (error) { next(error); }
};

// GET /api/teams/:id
const getTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('team_leader', 'name enrollment_no email github_link')
      .populate('members.student_id', 'name enrollment_no email branch year')
      .populate('assigned_faculty', 'name faculty_id email department')
      .populate('event_id', 'title description event_end_date')
      .populate('project.modules.assigned_to', 'name enrollment_no')
      .populate('project.progress_updates.updated_by', 'name role');

    if (!team) return apiResponse.error(res, 'Team not found', 404);
    return apiResponse.success(res, team);
  } catch (error) { next(error); }
};

// GET /api/teams (my teams)
const getMyTeams = async (req, res, next) => {
  try {
    let teams = [];
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student) return apiResponse.success(res, []);
      teams = await Team.find({ 'members.student_id': student._id })
        .populate('event_id', 'title status event_end_date')
        .populate('team_leader', 'name enrollment_no')
        .populate('assigned_faculty', 'name faculty_id');
    } else if (req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ user_id: req.user._id });
      teams = await Team.find({
        $or: [{ assigned_faculty: faculty?._id }, { created_by: req.user._id }],
      })
        .populate('event_id', 'title status')
        .populate('team_leader', 'name enrollment_no');
    }

    return apiResponse.success(res, teams);
  } catch (error) { next(error); }
};

// PUT /api/teams/:id - Allow admin/mentor to update team details
const updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const student = await Student.findOne({ user_id: req.user._id });
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    
    const isTeamMember = student && team.members.some(m => m.student_id.toString() === student._id.toString());
    const isTeamLeader = team.team_leader.toString() === student?._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isAssignedMentor = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    const isEventCreator = team.event_id.created_by.toString() === req.user._id.toString();

    // Allow: team members, admin, assigned mentor, event creator
    if (req.user.role === 'student' && !isTeamMember && !isTeamLeader) {
      return apiResponse.error(res, 'Only team members can update team details', 403);
    }
    if (req.user.role === 'faculty' && !isAssignedMentor && !isEventCreator) {
      return apiResponse.error(res, 'Only assigned mentor or event creator can update team', 403);
    }

    const { project } = req.body;
    if (project) team.project = { ...team.project.toObject(), ...project };
    await team.save();
    syncTeam(team._id);

    return apiResponse.success(res, team, 'Team updated');
  } catch (error) { next(error); }
};

// POST /api/teams/:id/accept-leader
const respondLeader = async (req, res, next) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const team = await Team.findById(req.params.id)
      .populate('event_id', 'title created_by')
      .populate('team_leader', 'user_id name');

    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const student = await Student.findOne({ user_id: req.user._id });
    if (!student || team.team_leader._id.toString() !== student._id.toString()) {
      return apiResponse.error(res, 'Only the selected leader can respond', 403);
    }

    if (action === 'accept') {
      team.leader_accepted = true;
      // Set leader member status to accepted
      const leaderMember = team.members.find(m => m.student_id.toString() === student._id.toString());
      if (leaderMember) leaderMember.status = 'accepted';

      // Notify event creator faculty
      const eventCreatorUser = await User.findById(team.event_id.created_by);
      await createNotification({
        recipient: eventCreatorUser._id,
        type: 'faculty_request',
        title: 'New Team Registration',
        message: `Team "${team.team_name}" leader accepted. Awaiting your approval.`,
        related_id: team._id,
        related_model: 'Team',
      });
    } else {
      await resolveActionNotifications({
        userId: req.user._id,
        teamId: team._id,
        types: ['leader_request'],
        status: 'rejected',
      });
      syncTeam(team._id);
      await Team.findByIdAndDelete(team._id);
      return apiResponse.success(res, null, 'Team registration declined');
    }

    await team.save();

    await resolveActionNotifications({
      userId: req.user._id,
      teamId: team._id,
      types: ['leader_request'],
      status: 'accepted',
    });

    syncTeam(team._id);
    return apiResponse.success(res, team, 'You are now the team leader');
  } catch (error) { next(error); }
};

// POST /api/teams/:id/members/respond
const respondMemberInvite = async (req, res, next) => {
  try {
    const { action } = req.body;
    const team = await Team.findById(req.params.id).populate('team_leader');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const student = await Student.findOne({ user_id: req.user._id });
    const member = team.members.find(m => m.student_id.toString() === student?._id.toString());
    if (!member) return apiResponse.error(res, 'You are not a member of this team', 403);

    member.status = action === 'accept' ? 'accepted' : 'rejected';
    await team.save();

    await resolveActionNotifications({
      userId: req.user._id,
      teamId: team._id,
      types: ['team_invite'],
      status: action === 'accept' ? 'accepted' : 'rejected',
    });

    // Notify leader
    const leaderStudent = await Student.findById(team.team_leader).populate('user_id');
    await createNotification({
      recipient: leaderStudent.user_id._id,
      type: 'member_response',
      title: 'Member Response',
      message: `${student.name} has ${member.status} the team invitation for "${team.team_name}"`,
      related_id: team._id,
      related_model: 'Team',
    });

    syncTeam(team._id);
    return apiResponse.success(res, null, `You have ${member.status} the team invitation`);
  } catch (error) { next(error); }
};

// PUT /api/teams/:id/assign-faculty
const assignFaculty = async (req, res, next) => {
  try {
    const { faculty_id } = req.body;
    const team = await Team.findById(req.params.id).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    if (team.event_id.created_by.toString() !== req.user._id.toString()) {
      return apiResponse.error(res, 'Only event creator can assign faculty', 403);
    }

    const faculty = await Faculty.findById(faculty_id).populate('user_id');
    if (!faculty) return apiResponse.error(res, 'Faculty not found', 404);

    team.assigned_faculty = faculty._id;
    team.mentor_status = 'pending';
    await team.save();

    if (faculty.user_id) {
      await createNotification({
        recipient: faculty.user_id._id,
        type: 'mentor_request',
        title: 'Mentor Request',
        message: `You have been requested to mentor team "${team.team_name}"`,
        related_id: team._id,
        related_model: 'Team',
      });
    }

    // Notify leader
    const leaderStudent = await Student.findById(team.team_leader).populate('user_id');
    if (leaderStudent) {
      await sendFacultyAssignedEmail(leaderStudent.user_id.email, leaderStudent.name, team.team_name, faculty.name);
      await createNotification({
        recipient: leaderStudent.user_id._id,
        type: 'faculty_assigned',
        title: 'Mentor Faculty Assigned',
        message: `${faculty.name} has been assigned as mentor for your team "${team.team_name}"`,
        related_id: team._id,
        related_model: 'Team',
      });
    }

    syncTeam(team._id);
    return apiResponse.success(res, team, 'Faculty assigned as mentor');
  } catch (error) { next(error); }
};

// PUT /api/teams/:id/status
const updateRegistrationStatus = async (req, res, next) => {
  try {
    const { reason, faculty_id } = req.body;
    const status = normalizeRegistrationStatus(req.body);
    if (!['approved', 'rejected'].includes(status)) {
      return apiResponse.error(res, 'Status must be approved or rejected', 400);
    }

    const team = await Team.findById(req.params.id).populate('event_id').populate('team_leader');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    if (team.event_id.created_by.toString() !== req.user._id.toString()) {
      return apiResponse.error(res, 'Only event creator can approve/reject teams', 403);
    }

    team.registration_status = status;
    if (reason) team.rejection_reason = reason;

    // Assign faculty on approve
    if (status === 'approved' && faculty_id) {
      const faculty = await Faculty.findById(faculty_id).populate('user_id');
      if (!faculty) return apiResponse.error(res, 'Faculty not found', 404);
      team.assigned_faculty = faculty._id;
      team.mentor_status = 'pending';

      if (faculty.user_id) {
        await createNotification({
          recipient: faculty.user_id._id,
          type: 'mentor_request',
          title: 'Mentor Request',
          message: `You have been requested to mentor team "${team.team_name}"`,
          related_id: team._id,
          related_model: 'Team',
        });
      }
    }
    await team.save();

    // Notify leader
    const leaderStudent = await Student.findById(team.team_leader._id).populate('user_id');
    if (leaderStudent) {
      await sendRegistrationStatusEmail(leaderStudent.user_id.email, leaderStudent.name, team.team_name, status, reason);
      await createNotification({
        recipient: leaderStudent.user_id._id,
        type: status === 'approved' ? 'registration_approved' : 'registration_rejected',
        title: `Registration ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your team "${team.team_name}" registration has been ${status}${reason ? `. Reason: ${reason}` : ''}`,
        related_id: team._id,
        related_model: 'Team',
      });
    }

    syncTeam(team._id);
    return apiResponse.success(res, team, `Team registration ${status}`);
  } catch (error) { next(error); }
};

// POST /api/teams/:id/modules
const addModule = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const { module_name, description, assigned_to, due_date } = req.body;
    team.project.modules.push({ module_name, description, assigned_to, due_date });
    await team.save();
    syncTeam(team._id);

    return apiResponse.created(res, team.project.modules, 'Module added');
  } catch (error) { next(error); }
};

// PUT /api/teams/:id/modules/:moduleId
const updateModule = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const module = team.project.modules.id(req.params.moduleId);
    if (!module) return apiResponse.error(res, 'Module not found', 404);

    const { module_name, description, status, assigned_to, due_date } = req.body;
    if (module_name) module.module_name = module_name;
    if (description !== undefined) module.description = description;
    if (status) module.status = status;
    if (assigned_to !== undefined) module.assigned_to = assigned_to;
    if (due_date !== undefined) module.due_date = due_date;
    module.updated_at = new Date();

    await team.save();
    syncTeam(team._id);
    return apiResponse.success(res, module, 'Module updated');
  } catch (error) { next(error); }
};

// DELETE /api/teams/:id/modules/:moduleId
const deleteModule = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    team.project.modules.pull(req.params.moduleId);
    await team.save();
    syncTeam(team._id);
    return apiResponse.success(res, null, 'Module deleted');
  } catch (error) { next(error); }
};

// POST /api/teams/:id/progress-update
const addProgressUpdate = async (req, res, next) => {
  try {
    const { message } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    team.project.progress_updates.push({ updated_by: req.user._id, message });
    await team.save();
    syncTeam(team._id);

    return apiResponse.created(res, team.project.progress_updates, 'Progress update added');
  } catch (error) { next(error); }
};

// PUT /api/teams/:id/project (update project links/details) - Only team members can update
const updateProject = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    // Only allow team members (students) to update project
    const student = await Student.findOne({ user_id: req.user._id });
    if (req.user.role !== 'student' || !student) {
      return apiResponse.error(res, 'Only team members can update project details', 403);
    }

    const isMember = team.members.some(m => m.student_id.toString() === student._id.toString());
    if (!isMember) {
      return apiResponse.error(res, 'Only team members can update project details', 403);
    }

    const {
      title, description, technologies_used, github_link, live_link, video_link,
      documentation_file, zip_file, submission_status,
    } = req.body;
    if (title !== undefined) team.project.title = title;
    if (description !== undefined) team.project.description = description;
    if (technologies_used) team.project.technologies_used = technologies_used;
    if (github_link !== undefined) team.project.github_link = github_link;
    if (live_link !== undefined) team.project.live_link = live_link;
    if (video_link !== undefined) team.project.video_link = video_link;
    if (documentation_file !== undefined) team.project.documentation_file = documentation_file;
    if (zip_file !== undefined) team.project.zip_file = zip_file;
    if (submission_status) team.project.submission_status = submission_status;

    await team.save();

    if (submission_status === 'submitted') {
      const admins = await User.find({ role: 'admin', status: { $ne: 'inactive' } }).select('_id');
      const faculty = team.assigned_faculty
        ? await Faculty.findById(team.assigned_faculty).populate('user_id')
        : null;

      await createNotifications([
        ...(faculty?.user_id?._id ? [{
          recipient: faculty.user_id._id,
          type: 'submission_review',
          title: 'Final Submission Review',
          message: `Team "${team.team_name}" submitted final project for review.`,
          related_id: team._id,
          related_model: 'Team',
        }] : []),
        ...admins.map(admin => ({
          recipient: admin._id,
          type: 'submission_review',
          title: 'Final Submission Review',
          message: `Team "${team.team_name}" submitted final project for review.`,
          related_id: team._id,
          related_model: 'Team',
        })),
      ]);
    }

    syncTeam(team._id);
    return apiResponse.success(res, team.project, 'Project updated');
  } catch (error) { next(error); }
};

// POST /api/teams/:id/members - Add member to team
// Admin and assigned mentor can add members anytime
const addMember = async (req, res, next) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return apiResponse.error(res, 'Student ID required', 400);

    const team = await Team.findById(req.params.id).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const faculty = await Faculty.findOne({ user_id: req.user._id });
    const isAdmin = req.user.role === 'admin';
    const isAssignedMentor = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    const isEventCreator = team.event_id.created_by.toString() === req.user._id.toString();

    if (!isAdmin && !isAssignedMentor && !isEventCreator) {
      return apiResponse.error(res, 'Only admin or assigned mentor can add members', 403);
    }

    if (team.members.some(m => m.student_id.toString() === student_id)) {
      return apiResponse.error(res, 'Student is already in this team', 400);
    }

    const existingTeam = await Team.findOne({
      event_id: team.event_id._id,
      members: {
        $elemMatch: {
          student_id,
          status: { $in: ['pending', 'accepted'] },
        },
      },
      registration_status: { $ne: 'rejected' },
      _id: { $ne: team._id },
    });
    if (existingTeam) {
      return apiResponse.error(res, 'Student is already registered in another team for this event', 400);
    }

    const student = await Student.findById(student_id).populate('user_id');
    if (!student) return apiResponse.error(res, 'Student not found', 404);

    team.members.push({ student_id, status: 'accepted', user_id: student.user_id?._id });
    await team.save();

    if (student.user_id?._id) {
      await createNotification({
        recipient: student.user_id._id,
        type: 'team_invite',
        title: 'Added to Team',
        message: `You have been added to team "${team.team_name}"`,
        related_id: team._id,
        related_model: 'Team',
      });
    }

    syncTeam(team._id);
    return apiResponse.success(res, team, 'Member added successfully');
  } catch (error) { next(error); }
};

// DELETE /api/teams/:id/members/:studentId
// Team leader: can only remove before approval
// Admin/Assigned Faculty: can remove anytime
const removeMember = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    const student = await Student.findOne({ user_id: req.user._id });
    const faculty = await Faculty.findOne({ user_id: req.user._id });
    
    const isTeamLeader = student && team.team_leader.toString() === student._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isAssignedMentor = faculty && team.assigned_faculty?.toString() === faculty._id.toString();
    const isEventCreator = team.event_id.created_by.toString() === req.user._id.toString();

    // Team leader can only remove before approval
    if (isTeamLeader && !isAdmin && !isAssignedMentor && !isEventCreator) {
      if (team.registration_status === 'approved') {
        return apiResponse.error(res, 'Cannot modify approved team. Contact the assigned mentor or event organizer.', 400);
      }
    } 
    // Non-leader students cannot remove members
    else if (req.user.role === 'student' && !isTeamLeader) {
      return apiResponse.error(res, 'Only team leader can remove members', 403);
    }
    // Admins and assigned mentors can always remove
    else if (!isAdmin && !isAssignedMentor && !isEventCreator && !isTeamLeader) {
      return apiResponse.error(res, 'Not authorized to remove members', 403);
    }

    // Prevent removing team leader
    if (team.team_leader.toString() === req.params.studentId && !isAdmin) {
      return apiResponse.error(res, 'Cannot remove team leader. Assign a new leader first.', 400);
    }

    team.members = team.members.filter(m => m.student_id.toString() !== req.params.studentId);
    await team.save();
    syncTeam(team._id);
    return apiResponse.success(res, null, 'Member removed');
  } catch (error) { next(error); }
};

// POST /api/teams/:id/leave
const leaveTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    if (team.registration_status === 'approved') {
      return apiResponse.error(res, 'Cannot leave an approved team registration. Contact the team leader or event organizer.', 400);
    }
    const student = await Student.findOne({ user_id: req.user._id });
    if (team.team_leader.toString() === student._id.toString()) {
      return apiResponse.error(res, 'Team leader cannot leave the team', 400);
    }
    team.members = team.members.filter(m => m.student_id.toString() !== student._id.toString());
    await team.save();
    syncTeam(team._id);
    return apiResponse.success(res, null, 'You have left the team');
  } catch (error) { next(error); }
};

// GET /api/teams/:id/video-room
const getVideoRoom = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    if (!team.video_meeting?.room_url) {
      const roomName = createRoomName(team.team_name, team._id);
      team.video_meeting = { room_name: roomName, room_url: `https://meet.jit.si/${roomName}` };
      await team.save();
    }
    return apiResponse.success(res, team.video_meeting);
  } catch (error) { next(error); }
};

// POST /api/teams/:id/video-room/join
const joinVideoRoom = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    if (!team.video_meeting?.room_url) {
      const roomName = createRoomName(team.team_name, team._id);
      team.video_meeting = { room_name: roomName, room_url: `https://meet.jit.si/${roomName}` };
    }
    team.video_meeting.last_started_at = new Date();
    team.video_meeting.attendance.push({ user_id: req.user._id, joined_at: new Date() });
    await team.save();
    return apiResponse.success(res, team.video_meeting, 'Joined meeting');
  } catch (error) { next(error); }
};

module.exports = {
  createTeam, getTeam, getMyTeams, updateTeam, respondLeader, respondMemberInvite,
  assignFaculty, updateRegistrationStatus, addModule, updateModule, deleteModule,
  addProgressUpdate, updateProject, addMember, removeMember, leaveTeam,
  getVideoRoom, joinVideoRoom,
};
