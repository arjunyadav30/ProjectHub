const Event = require('../models/Event');
const Team = require('../models/Team');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const PresentationPanel = require('../models/PresentationPanel');
const PresentationSlot = require('../models/PresentationSlot');
const apiResponse = require('../utils/apiResponse');
const { createNotifications } = require('../utils/notifications');
const { emitToUsers } = require('../utils/realtime');
const { canManageEvent, getTeamAccess } = require('../utils/teamAccess');
const { generateSlots } = require('../utils/slotAllocator');
const { buildIcs } = require('../utils/ics');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const fmtWhen = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

const loadEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event || event.college_id.toString() !== req.user.college_id?.toString()) {
    apiResponse.error(res, 'Event not found', 404);
    return null;
  }
  return event;
};

const loadManagedEvent = async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return null;
  if (!canManageEvent(req.user, event)) { apiResponse.error(res, 'Only the event owner or an admin can manage the schedule', 403); return null; }
  return event;
};

/** Everyone who should hear about a slot: team members, mentor, panel examiners, event owner. */
const slotAudience = async (slot, event) => {
  const [team, panel] = await Promise.all([
    Team.findById(slot.team_id).populate('members.student_id', 'user_id').populate('assigned_faculty', 'user_id'),
    PresentationPanel.findById(slot.panel_id).populate('examiners', 'user_id'),
  ]);
  const ids = new Set();
  team?.members.filter((m) => m.status === 'accepted').forEach((m) => m.student_id?.user_id && ids.add(m.student_id.user_id.toString()));
  if (team?.assigned_faculty?.user_id) ids.add(team.assigned_faculty.user_id.toString());
  panel?.examiners.forEach((f) => f.user_id && ids.add(f.user_id.toString()));
  if (event?.created_by) ids.add(event.created_by.toString());
  return { team, panel, userIds: [...ids] };
};

/** Conflict check for manual edits: same panel, shared examiner, or mentor examining elsewhere. */
const findConflict = async ({ slot, panelId, start, end }) => {
  const overlapping = await PresentationSlot.find({
    event_id: slot.event_id, presentation_id: slot.presentation_id, _id: { $ne: slot._id },
    status: { $ne: 'cancelled' }, start_at: { $lt: end }, end_at: { $gt: start },
  }).select('panel_id team_id');
  if (!overlapping.length) return null;
  const panel = await PresentationPanel.findById(panelId).select('examiners');
  const team = await Team.findById(slot.team_id).select('assigned_faculty');
  const mine = new Set((panel?.examiners || []).map(String));
  const panels = await PresentationPanel.find({ _id: { $in: overlapping.map((s) => s.panel_id) } }).select('examiners');
  const byId = new Map(panels.map((p) => [p._id.toString(), p]));
  for (const o of overlapping) {
    if (o.panel_id.toString() === panelId.toString()) return 'Another team is already scheduled on this panel at that time';
    const other = byId.get(o.panel_id.toString());
    if (other?.examiners.some((e) => mine.has(String(e)))) return 'A panel examiner is already booked at that time';
  }
  if (team?.assigned_faculty && overlapping.length) {
    if (panels.some((p) => p.examiners.some((e) => String(e) === String(team.assigned_faculty)))) return "This team's mentor is examining another panel at that time";
  }
  return null;
};

// ───────────── Panels ─────────────
exports.listPanels = async (req, res, next) => {
  try {
    const event = await loadEvent(req, res); if (!event) return;
    const panels = await PresentationPanel.find({ event_id: event._id }).populate('examiners', 'name faculty_id department').sort({ name: 1 });
    return apiResponse.success(res, panels);
  } catch (e) { return next(e); }
};

exports.createPanel = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const { name, room = '', examiners = [] } = req.body;
    if (!name?.trim()) return apiResponse.error(res, 'Panel name is required', 400);
    const valid = await Faculty.countDocuments({ _id: { $in: examiners }, college_id: req.user.college_id });
    if (valid !== examiners.length) return apiResponse.error(res, 'One or more examiners are invalid', 400);
    const panel = await PresentationPanel.create({ college_id: req.user.college_id, event_id: event._id, name: name.trim(), room, examiners, created_by: req.user._id });
    return apiResponse.created(res, panel, 'Panel created');
  } catch (e) {
    if (e.code === 11000) return apiResponse.error(res, 'A panel with this name already exists', 409);
    return next(e);
  }
};

exports.updatePanel = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const panel = await PresentationPanel.findOne({ _id: req.params.panelId, event_id: event._id });
    if (!panel) return apiResponse.error(res, 'Panel not found', 404);
    const { name, room, examiners } = req.body;
    if (name !== undefined) panel.name = String(name).trim();
    if (room !== undefined) panel.room = room;
    if (examiners !== undefined) {
      const valid = await Faculty.countDocuments({ _id: { $in: examiners }, college_id: req.user.college_id });
      if (valid !== examiners.length) return apiResponse.error(res, 'One or more examiners are invalid', 400);
      panel.examiners = examiners;
    }
    await panel.save();
    return apiResponse.success(res, panel, 'Panel updated');
  } catch (e) { return next(e); }
};

exports.deletePanel = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    if (await PresentationSlot.exists({ panel_id: req.params.panelId, status: { $ne: 'cancelled' } })) {
      return apiResponse.error(res, 'This panel has scheduled slots. Reschedule them first.', 409);
    }
    await PresentationPanel.deleteOne({ _id: req.params.panelId, event_id: event._id });
    return apiResponse.success(res, null, 'Panel deleted');
  } catch (e) { return next(e); }
};

// ───────────── Scheduling ─────────────
exports.autoSchedule = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const presentation = event.presentation_schedules.id(req.params.presentationId);
    if (!presentation) return apiResponse.error(res, 'Presentation not found in this event', 404);

    const {
      days = [], day_start = '09:30', day_end = '16:30', slot_minutes = 15, buffer_minutes = 5,
      breaks = [{ start: '13:00', end: '14:00' }], avoid_mentor_on_panel = true, dry_run = false,
    } = req.body;
    if (!Array.isArray(days) || !days.length || days.length > 14 || !days.every((d) => DAY_RE.test(d))) return apiResponse.error(res, 'days must be 1-14 dates in YYYY-MM-DD format', 400);
    if (![day_start, day_end, ...breaks.flatMap((b) => [b.start, b.end])].every((t) => TIME_RE.test(t || ''))) return apiResponse.error(res, 'Times must be HH:MM', 400);
    if (!(slot_minutes >= 5 && slot_minutes <= 120) || !(buffer_minutes >= 0 && buffer_minutes <= 60)) return apiResponse.error(res, 'slot_minutes must be 5-120 and buffer_minutes 0-60', 400);

    const [panels, teams, done] = await Promise.all([
      PresentationPanel.find({ event_id: event._id }),
      Team.find({ event_id: event._id, college_id: req.user.college_id, registration_status: 'approved' }).select('team_name assigned_faculty mentor_status'),
      PresentationSlot.find({ event_id: event._id, presentation_id: presentation._id, status: { $in: ['in_progress', 'completed'] } }).select('team_id'),
    ]);
    if (!panels.length) return apiResponse.error(res, 'Create at least one panel first', 400);
    const doneTeams = new Set(done.map((s) => s.team_id.toString()));
    const todo = teams.filter((t) => !doneTeams.has(t._id.toString()));

    let result;
    try {
      result = generateSlots({
        teams: todo.map((t) => ({ id: t._id.toString(), mentor_id: t.mentor_status === 'accepted' && t.assigned_faculty ? t.assigned_faculty.toString() : null })),
        panels: panels.map((p) => ({ id: p._id.toString(), examiner_ids: p.examiners.map(String) })),
        days: [...days].sort(), dayStart: day_start, dayEnd: day_end, slotMinutes: slot_minutes, bufferMinutes: buffer_minutes, breaks, avoidMentorOnPanel: avoid_mentor_on_panel,
      });
    } catch (err) { return apiResponse.error(res, err.message, 400); }

    const nameOf = new Map(teams.map((t) => [t._id.toString(), t.team_name]));
    const preview = result.assignments.map((a) => ({ ...a, team_name: nameOf.get(a.team_id) }));
    const unscheduled = result.unscheduled.map((u) => ({ ...u, team_name: nameOf.get(u.team_id) }));
    if (dry_run) return apiResponse.success(res, { dry_run: true, assignments: preview, unscheduled }, 'Preview generated');

    await PresentationSlot.deleteMany({ event_id: event._id, presentation_id: presentation._id, status: 'scheduled' });
    const docs = await PresentationSlot.insertMany(result.assignments.map((a) => ({
      college_id: event.college_id, event_id: event._id, presentation_id: presentation._id, panel_id: a.panel_id, team_id: a.team_id, start_at: a.start_at, end_at: a.end_at,
    })));
    return apiResponse.created(res, { scheduled: docs.length, unscheduled }, 'Schedule generated. Review it, then publish to notify everyone.');
  } catch (e) { return next(e); }
};

exports.getSlots = async (req, res, next) => {
  try {
    const event = await loadEvent(req, res); if (!event) return;
    const manager = canManageEvent(req.user, event);
    const filter = { event_id: event._id, presentation_id: req.params.presentationId, status: { $ne: 'cancelled' } };
    if (!manager) {
      if (req.user.role !== 'faculty') return apiResponse.error(res, 'Not allowed', 403);
      filter.published = true;
    }
    const slots = await PresentationSlot.find(filter).sort({ start_at: 1 }).populate('team_id', 'team_name').populate('panel_id', 'name room');
    return apiResponse.success(res, slots);
  } catch (e) { return next(e); }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const slot = await PresentationSlot.findById(req.params.slotId);
    if (!slot) return apiResponse.error(res, 'Slot not found', 404);
    const event = await Event.findById(slot.event_id);
    if (!event || !canManageEvent(req.user, event)) return apiResponse.error(res, 'Not allowed', 403);
    if (['in_progress', 'completed'].includes(slot.status)) return apiResponse.error(res, 'Started or completed slots cannot be moved', 409);

    const start = req.body.start_at ? new Date(req.body.start_at) : slot.start_at;
    const end = req.body.end_at ? new Date(req.body.end_at) : new Date(start.getTime() + (slot.end_at - slot.start_at));
    const panelId = req.body.panel_id || slot.panel_id;
    if ([start, end].some((d) => Number.isNaN(d.getTime())) || end <= start) return apiResponse.error(res, 'Invalid start/end time', 400);
    if (req.body.panel_id && !(await PresentationPanel.exists({ _id: panelId, event_id: event._id }))) return apiResponse.error(res, 'Panel not found', 404);

    const conflict = await findConflict({ slot, panelId, start, end });
    if (conflict) return apiResponse.error(res, conflict, 409);

    slot.start_at = start; slot.end_at = end; slot.panel_id = panelId;
    await slot.save();
    if (slot.published) {
      const { team, userIds } = await slotAudience(slot, event);
      await createNotifications(userIds.map((u) => ({ recipient: u, type: 'presentation_rescheduled', title: 'Presentation time changed', message: `${team?.team_name}: new time ${fmtWhen(start)}`, reference_id: slot.team_id, reference_type: 'Team' })));
      emitToUsers(userIds, { scopes: ['schedule', 'dashboard'], eventId: event._id.toString() });
    }
    return apiResponse.success(res, slot, 'Slot updated');
  } catch (e) { return next(e); }
};

exports.publish = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const slots = await PresentationSlot.find({ event_id: event._id, presentation_id: req.params.presentationId, status: 'scheduled', published: false });
    if (!slots.length) return apiResponse.error(res, 'Nothing new to publish', 400);
    const title = event.presentation_schedules.id(req.params.presentationId)?.title || 'Presentation';

    const notes = [];
    const audience = new Set();
    for (const slot of slots) {
      const { team, panel, userIds } = await slotAudience(slot, event);
      userIds.forEach((u) => audience.add(u));
      userIds.forEach((u) => notes.push({ recipient: u, type: 'presentation_scheduled', title: `${title} scheduled`, message: `${team?.team_name}: ${fmtWhen(slot.start_at)}${panel?.room ? `, ${panel.room}` : ''} (${panel?.name || 'panel'})`, reference_id: slot.team_id, reference_type: 'Team' }));
    }
    await PresentationSlot.updateMany({ _id: { $in: slots.map((s) => s._id) } }, { $set: { published: true } });
    await createNotifications(notes);
    emitToUsers([...audience], { scopes: ['schedule', 'dashboard'], eventId: event._id.toString() });
    return apiResponse.success(res, { published: slots.length }, 'Schedule published and everyone notified');
  } catch (e) { return next(e); }
};

// ───────────── Reschedule requests ─────────────
exports.requestReschedule = async (req, res, next) => {
  try {
    const slot = await PresentationSlot.findById(req.params.slotId);
    if (!slot || !slot.published) return apiResponse.error(res, 'Slot not found', 404);
    const team = await Team.findById(slot.team_id).select('college_id members team_name');
    const access = await getTeamAccess(req.user, team);
    if (!access.isMember) return apiResponse.error(res, 'Only team members can request a change', 403);
    if (slot.status !== 'scheduled' || slot.start_at < new Date()) return apiResponse.error(res, 'This slot can no longer be changed', 409);
    if (slot.reschedule_request?.status === 'pending') return apiResponse.error(res, 'A request is already pending', 409);
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 10) return apiResponse.error(res, 'Please give a reason (at least 10 characters)', 400);

    slot.reschedule_request = { status: 'pending', requested_by: req.user._id, reason: reason.slice(0, 500), preferred_start: req.body.preferred_start || null };
    await slot.save();
    const event = await Event.findById(slot.event_id).select('created_by');
    await createNotifications([{ recipient: event.created_by, type: 'reschedule_request', title: 'Reschedule requested', message: `${team.team_name} asked to change their presentation slot`, reference_id: slot.team_id, reference_type: 'Team' }]);
    emitToUsers([event.created_by], { scopes: ['schedule', 'dashboard'], eventId: slot.event_id.toString() });
    return apiResponse.success(res, slot.reschedule_request, 'Request sent');
  } catch (e) { return next(e); }
};

exports.decideReschedule = async (req, res, next) => {
  try {
    const slot = await PresentationSlot.findById(req.params.slotId);
    if (!slot || slot.reschedule_request?.status !== 'pending') return apiResponse.error(res, 'No pending request', 404);
    const event = await Event.findById(slot.event_id);
    if (!canManageEvent(req.user, event)) return apiResponse.error(res, 'Not allowed', 403);
    const { decision, note = '', new_start_at } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return apiResponse.error(res, 'decision must be approved or rejected', 400);

    if (decision === 'approved' && new_start_at) {
      const start = new Date(new_start_at);
      const end = new Date(start.getTime() + (slot.end_at - slot.start_at));
      if (Number.isNaN(start.getTime())) return apiResponse.error(res, 'Invalid new_start_at', 400);
      const conflict = await findConflict({ slot, panelId: slot.panel_id, start, end });
      if (conflict) return apiResponse.error(res, conflict, 409);
      slot.start_at = start; slot.end_at = end;
    }
    slot.reschedule_request.status = decision;
    slot.reschedule_request.decided_by = req.user._id;
    slot.reschedule_request.decision_note = String(note).slice(0, 500);
    await slot.save();

    const { team, userIds } = await slotAudience(slot, event);
    const requester = slot.reschedule_request.requested_by;
    const targets = decision === 'approved' ? userIds : [requester.toString()];
    await createNotifications(targets.map((u) => ({ recipient: u, type: 'reschedule_decision', title: `Reschedule ${decision}`, message: `${team?.team_name}: ${decision === 'approved' ? `now ${fmtWhen(slot.start_at)}` : 'request declined'}${note ? ` (${note})` : ''}`, reference_id: slot.team_id, reference_type: 'Team' })));
    emitToUsers(targets, { scopes: ['schedule', 'dashboard'], eventId: slot.event_id.toString() });
    return apiResponse.success(res, slot, `Request ${decision}`);
  } catch (e) { return next(e); }
};

// ───────────── My schedule + calendar export ─────────────
const slotsForUser = async (user, extra = {}) => {
  const teamIds = [];
  const panelIds = [];
  if (user.role === 'student') {
    const student = await Student.findOne({ user_id: user._id }).select('_id');
    if (student) teamIds.push(...(await Team.find({ college_id: user.college_id, members: { $elemMatch: { student_id: student._id, status: 'accepted' } } }).distinct('_id')));
  } else if (user.role === 'faculty') {
    const faculty = await Faculty.findOne({ user_id: user._id }).select('_id');
    if (faculty) {
      teamIds.push(...(await Team.find({ college_id: user.college_id, assigned_faculty: faculty._id, mentor_status: 'accepted' }).distinct('_id')));
      panelIds.push(...(await PresentationPanel.find({ college_id: user.college_id, examiners: faculty._id }).distinct('_id')));
    }
  } else return [];
  return PresentationSlot.find({ college_id: user.college_id, published: true, status: { $ne: 'cancelled' }, $or: [{ team_id: { $in: teamIds } }, { panel_id: { $in: panelIds } }], ...extra })
    .sort({ start_at: 1 }).populate('team_id', 'team_name').populate('panel_id', 'name room');
};

const toIcsEvent = (s) => ({ uid: s._id.toString(), start: s.start_at, end: s.end_at, summary: `Presentation: ${s.team_id?.team_name || 'Team'}`, description: `Panel: ${s.panel_id?.name || ''}`, location: s.panel_id?.room || '' });

exports.mySlots = async (req, res, next) => {
  try { return apiResponse.success(res, await slotsForUser(req.user)); } catch (e) { return next(e); }
};

exports.myCalendar = async (req, res, next) => {
  try {
    const slots = await slotsForUser(req.user, { end_at: { $gte: new Date() } });
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="presentations.ics"' });
    return res.send(buildIcs(slots.map(toIcsEvent)));
  } catch (e) { return next(e); }
};

exports.slotCalendar = async (req, res, next) => {
  try {
    const mine = await slotsForUser(req.user, { _id: req.params.slotId });
    if (!mine.length) return apiResponse.error(res, 'Slot not found', 404);
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="presentation.ics"' });
    return res.send(buildIcs(mine.map(toIcsEvent)));
  } catch (e) { return next(e); }
};
