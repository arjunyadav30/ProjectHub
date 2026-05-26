const Event = require('../models/Event');
const Team = require('../models/Team');
const Faculty = require('../models/Faculty');
const apiResponse = require('../utils/apiResponse');
const Student = require('../models/Student');
const { createNotifications } = require('../utils/notifications');
const { notifyEventUpdate } = require('../utils/realtime');

const normalizePresentationSchedules = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => ({
      _id: item._id,
      title: String(item.title || '').trim(),
      due_date: item.due_date,
      labels: Array.isArray(item.labels)
        ? item.labels
            .map(label => ({
              _id: label._id,
              label: String(label.label || '').trim(),
              marks_out_of: Math.max(1, Number(label.marks_out_of) || 0),
            }))
            .filter(label => label.label && label.marks_out_of > 0)
        : [],
    }))
    .filter(item => item.title && item.due_date && item.labels.length > 0);
};

// GET /api/events
const getEvents = async (req, res, next) => {
  try {
    const { status, semester, branch, year, page = 1, limit = 10 } = req.query;
    const filter = { college_id: req.user.college_id };

    if (status) filter.status = status;
    if (branch) { filter.$or = [{ allowed_branches: { $size: 0 } }, { allowed_branches: branch }]; }
    if (semester) { filter.$or = [{ allowed_semesters: { $size: 0 } }, { allowed_semesters: parseInt(semester) }]; }

    // For students: auto-filter by their semester
    if (req.user?.role === 'student') {
      const studentProfile = await Student.findOne({ user_id: req.user._id, college_id: req.user.college_id });
      if (studentProfile?.semester) {
        filter.$or = [
          { allowed_semesters: { $size: 0 } },
          { allowed_semesters: studentProfile.semester },
        ];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('created_by', 'name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);

    return apiResponse.success(res, {
      events,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) { next(error); }
};

// GET /api/events/:id
const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id }).populate('created_by', 'name email');
    if (!event) return apiResponse.error(res, 'Event not found', 404);
    
    let studentRegistration = null;
    if (req.user?.role === 'student') {
      const student = await Student.findOne({ user_id: req.user._id, college_id: req.user.college_id });
      if (student) {
        studentRegistration = await Team.findOne({
          event_id: req.params.id, college_id: req.user.college_id,
          members: {
            $elemMatch: {
              student_id: student._id,
              status: { $in: ['pending', 'accepted'] },
            },
          },
          registration_status: { $ne: 'rejected' },
        }).select('_id team_name registration_status');
      }
    }
    
    return apiResponse.success(res, { event, studentRegistration });
  } catch (error) { next(error); }
};

// POST /api/events
const createEvent = async (req, res, next) => {
  try {
    const {
      title, description, allowed_semesters, allowed_years, allowed_branches,
      min_team_size, max_team_size, registration_start, registration_end, event_end_date,
      presentation_schedule, presentation_schedules,
    } = req.body;

    if (max_team_size < min_team_size) {
      return apiResponse.error(res, 'Max team size must be >= min team size', 400);
    }

    const event = await Event.create({
      college_id: req.user.college_id,
      title, description,
      allowed_semesters: allowed_semesters || [],
      allowed_years: allowed_years || [],
      allowed_branches: allowed_branches || [],
      min_team_size, max_team_size,
      registration_start: registration_start || new Date(),
      registration_end, event_end_date,
      created_by: req.user._id,
      presentation_schedule: presentation_schedule || {},
      presentation_schedules: normalizePresentationSchedules(presentation_schedules),
    });

    notifyEventUpdate(event._id).catch(() => {});

    return apiResponse.created(res, event, 'Event created successfully');
  } catch (error) { next(error); }
};

// PUT /api/events/:id
const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);

    const allowedFields = [
      'title', 'description', 'allowed_semesters', 'allowed_years', 'allowed_branches',
      'min_team_size', 'max_team_size', 'registration_start',
      'registration_end', 'event_end_date', 'status', 'presentation_schedule', 'presentation_schedules',
    ];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = field === 'presentation_schedules'
          ? normalizePresentationSchedules(req.body[field])
          : req.body[field];
      }
    });
    await event.save();

    notifyEventUpdate(event._id).catch(() => {});

    return apiResponse.success(res, event, 'Event updated');
  } catch (error) { next(error); }
};

// DELETE /api/events/:id
const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);
    await Event.findByIdAndDelete(req.params.id);
    await Team.deleteMany({ event_id: req.params.id, college_id: req.user.college_id });
    return apiResponse.success(res, null, 'Event deleted');
  } catch (error) { next(error); }
};

// GET /api/events/:id/teams
const getEventTeams = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { event_id: req.params.id, college_id: req.user.college_id };
    if (status) filter.registration_status = status;
    if (req.user?.role === 'faculty') {
      const faculty = await Faculty.findOne({ user_id: req.user._id, college_id: req.user.college_id });
      const isEventCreator = event.created_by?.toString() === req.user._id.toString();
      if (!isEventCreator) {
        filter.assigned_faculty = faculty?._id || null;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [teams, total] = await Promise.all([
      Team.find(filter)
        .populate('team_leader', 'name enrollment_no email profile_image')
        .populate('members.student_id', 'name enrollment_no email branch semester profile_image')
        .populate('assigned_faculty', 'name faculty_id email profile_image')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Team.countDocuments(filter),
    ]);

    return apiResponse.success(res, {
      teams,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) { next(error); }
};

// GET /api/events/:id/teams/export (CSV)
const exportTeamsCSV = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);

    const teams = await Team.find({ event_id: req.params.id, college_id: req.user.college_id })
      .populate('team_leader', 'name enrollment_no email')
      .populate('members.student_id', 'name enrollment_no email')
      .populate('assigned_faculty', 'name faculty_id');

    let csv = 'Team Name,Leader,Leader Enrollment,Members,Assigned Faculty,Status,Project Title,Progress\n';
    teams.forEach(team => {
      const members = team.members
        .filter(m => m.status === 'accepted')
        .map(m => `${m.student_id?.name}(${m.student_id?.enrollment_no})`)
        .join('; ');
      const stats = team.progress_stats;
      csv += `"${team.team_name}","${team.team_leader?.name || ''}","${team.team_leader?.enrollment_no || ''}","${members}","${team.assigned_faculty?.name || 'Not Assigned'}","${team.registration_status}","${team.project?.title || ''}","${stats?.percent || 0}%"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${event.title}-teams.csv"`);
    return res.send(csv);
  } catch (error) { next(error); }
};

// PUT /api/events/:id/presentation-schedule
const updatePresentationSchedule = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);
    let nextSchedules = null;
    if (Array.isArray(req.body.presentation_schedules)) {
      nextSchedules = normalizePresentationSchedules(req.body.presentation_schedules);
      event.presentation_schedules = nextSchedules;
    } else if (Array.isArray(req.body)) {
      nextSchedules = normalizePresentationSchedules(req.body);
      event.presentation_schedules = nextSchedules;
    } else {
      event.presentation_schedule = { ...event.presentation_schedule, ...req.body };
    }
    await event.save();

    const scheduledItems = nextSchedules || event.presentation_schedules || [];
    if (scheduledItems.length > 0) {
      const scheduleTitles = scheduledItems.map(item => item.title).filter(Boolean).join(', ');
      const message = `Presentation schedule updated for "${event.title}"${scheduleTitles ? `: ${scheduleTitles}` : ''}.`;
      const teams = await Team.find({
        college_id: req.user.college_id,
        event_id: event._id,
        registration_status: { $ne: 'rejected' },
      })
        .populate('members.student_id', 'user_id')
        .populate('assigned_faculty', 'user_id');

      const notifications = [];
      teams.forEach(team => {
        team.members.forEach(member => {
          const userId = member.student_id?.user_id || member.user_id;
          if (userId) {
            notifications.push({
              recipient: userId,
              type: 'presentation_schedule',
              title: 'Presentation Schedule Updated',
              message,
              related_id: event._id,
              related_model: 'Event',
            });
          }
        });
        if (team.assigned_faculty?.user_id) {
          notifications.push({
            recipient: team.assigned_faculty.user_id,
            type: 'presentation_schedule',
            title: 'Presentation Schedule Updated',
            message,
            related_id: event._id,
            related_model: 'Event',
          });
        }
      });

      await createNotifications(notifications);
    }

    return apiResponse.success(res, event, 'Presentation schedule updated');
  } catch (error) { next(error); }
};

module.exports = { getEvents, getEvent, createEvent, updateEvent, deleteEvent, getEventTeams, exportTeamsCSV, updatePresentationSchedule };
