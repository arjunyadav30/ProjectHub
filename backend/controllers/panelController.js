const Event = require('../models/Event');
const Team = require('../models/Team');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Marks = require('../models/Marks');
const PresentationPanel = require('../models/PresentationPanel');
const PresentationSlot = require('../models/PresentationSlot');
const JudgeScore = require('../models/JudgeScore');
const apiResponse = require('../utils/apiResponse');
const { emitToUsers } = require('../utils/realtime');
const { createNotifications } = require('../utils/notifications');
const { canManageEvent } = require('../utils/teamAccess');
const { buildCriteria, scoreSubmission } = require('../utils/judging');
const { normalizeExaminerScores } = require('../utils/normalizeScores');

const round = (n, d = 2) => Number(Number(n).toFixed(d));

const loadSlotContext = async (req, res) => {
  const slot = await PresentationSlot.findById(req.params.slotId);
  if (!slot || slot.college_id.toString() !== req.user.college_id?.toString()) { apiResponse.error(res, 'Slot not found', 404); return null; }
  const [event, panel, team] = await Promise.all([
    Event.findById(slot.event_id),
    PresentationPanel.findById(slot.panel_id),
    Team.findById(slot.team_id).select('team_name assigned_faculty mentor_status project.title'),
  ]);
  const faculty = req.user.role === 'faculty' ? await Faculty.findOne({ user_id: req.user._id }).select('_id') : null;
  const isExaminer = !!(faculty && panel.examiners.some((e) => e.toString() === faculty._id.toString()));
  const isManager = canManageEvent(req.user, event);
  const mentorsThisTeam = !!(faculty && team.assigned_faculty?.toString() === faculty._id.toString());
  return { slot, event, panel, team, isExaminer, isManager, mentorsThisTeam };
};

const presentationOf = (event, id) => event.presentation_schedules.id(id);

const panelAudience = async (ctx) => {
  const examiners = await Faculty.find({ _id: { $in: ctx.panel.examiners } }).select('user_id');
  return [...examiners.map((f) => f.user_id), ctx.event.created_by];
};

// ───────────── Live session control ─────────────
exports.getScoresheet = async (req, res, next) => {
  try {
    const ctx = await loadSlotContext(req, res); if (!ctx) return;
    if (!ctx.isExaminer && !ctx.isManager) return apiResponse.error(res, 'Not allowed', 403);
    const presentation = presentationOf(ctx.event, ctx.slot.presentation_id);
    const sheet = buildCriteria(ctx.event, presentation);
    const mine = await JudgeScore.findOne({ slot_id: ctx.slot._id, examiner_user_id: req.user._id });
    const submitted = await JudgeScore.countDocuments({ slot_id: ctx.slot._id });
    return apiResponse.success(res, {
      slot: { _id: ctx.slot._id, status: ctx.slot.status, started_at: ctx.slot.started_at, ended_at: ctx.slot.ended_at, start_at: ctx.slot.start_at, end_at: ctx.slot.end_at, scores_locked: ctx.slot.scores_locked },
      team: { _id: ctx.team._id, team_name: ctx.team.team_name, project_title: ctx.team.project?.title || '' },
      presentation_title: presentation?.title || '',
      sheet,
      time_limit_minutes: Math.round((ctx.slot.end_at - ctx.slot.start_at) / 60000),
      my_score: mine,
      judges_submitted: submitted,
      judges_expected: ctx.panel.examiners.length,
      can_score: ctx.isExaminer && !ctx.mentorsThisTeam,
      conflict_of_interest: ctx.mentorsThisTeam,
    });
  } catch (e) { return next(e); }
};

const setSlotState = (status) => async (req, res, next) => {
  try {
    const ctx = await loadSlotContext(req, res); if (!ctx) return;
    if (!ctx.isExaminer && !ctx.isManager) return apiResponse.error(res, 'Not allowed', 403);
    if (ctx.slot.scores_locked) return apiResponse.error(res, 'Scores are finalized for this slot', 409);
    if (status === 'in_progress' && ctx.slot.status !== 'scheduled') return apiResponse.error(res, 'Only a scheduled slot can be started', 409);
    if (status === 'completed' && ctx.slot.status !== 'in_progress') return apiResponse.error(res, 'Only a running slot can be completed', 409);
    ctx.slot.status = status;
    if (status === 'in_progress') ctx.slot.started_at = new Date(); else ctx.slot.ended_at = new Date();
    await ctx.slot.save();
    emitToUsers(await panelAudience(ctx), { scopes: ['panel', 'schedule'], eventId: ctx.event._id.toString(), teamId: ctx.team._id.toString() });
    return apiResponse.success(res, ctx.slot, status === 'in_progress' ? 'Presentation started' : 'Presentation completed');
  } catch (e) { return next(e); }
};
exports.startSlot = setSlotState('in_progress');
exports.completeSlot = setSlotState('completed');

exports.submitScore = async (req, res, next) => {
  try {
    const ctx = await loadSlotContext(req, res); if (!ctx) return;
    if (!ctx.isExaminer) return apiResponse.error(res, 'Only panel examiners can score', 403);
    if (ctx.mentorsThisTeam) return apiResponse.error(res, 'You mentor this team and cannot score it (conflict of interest)', 403);
    if (ctx.slot.scores_locked) return apiResponse.error(res, 'Scores are finalized for this slot', 409);
    if (!['in_progress', 'completed'].includes(ctx.slot.status)) return apiResponse.error(res, 'Scoring opens when the presentation starts', 409);

    const sheet = buildCriteria(ctx.event, presentationOf(ctx.event, ctx.slot.presentation_id));
    const result = scoreSubmission(sheet, req.body.criteria);
    if (result.error) return apiResponse.error(res, result.error, 400);

    const doc = await JudgeScore.findOneAndUpdate(
      { presentation_id: ctx.slot.presentation_id, team_id: ctx.slot.team_id, examiner_user_id: req.user._id },
      { $set: { college_id: ctx.slot.college_id, event_id: ctx.slot.event_id, slot_id: ctx.slot._id, panel_id: ctx.slot.panel_id, criteria: result.criteria, total_percent: result.total_percent, comment: String(req.body.comment || '').slice(0, 1000), submitted_at: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // Signal only (no scores) so examiners cannot anchor on each other; managers refetch the leaderboard.
    emitToUsers([ctx.event.created_by], { scopes: ['panel'], eventId: ctx.event._id.toString() });
    return apiResponse.success(res, doc, 'Score saved');
  } catch (e) { return next(e); }
};

// ───────────── Results (managers only) ─────────────
const computeResults = async (event, presentationId) => {
  const scores = await JudgeScore.find({ event_id: event._id, presentation_id: presentationId });
  const result = normalizeExaminerScores(scores.map((s) => ({ examinerId: s.examiner_user_id.toString(), teamId: s.team_id.toString(), groupId: s.panel_id.toString(), value: s.total_percent })));
  const users = await User.find({ _id: { $in: [...new Set(scores.map((s) => s.examiner_user_id.toString()))] } }).select('name');
  const nameOf = new Map(users.map((u) => [u._id.toString(), u.name]));
  result.examiner_stats.forEach((e) => { e.name = nameOf.get(e.examinerId) || ''; });
  result.teams.forEach((t) => t.raw_scores.forEach((r) => { r.examiner_name = nameOf.get(r.examinerId) || ''; }));
  return result;
};

const loadManagedEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event || event.college_id.toString() !== req.user.college_id?.toString()) { apiResponse.error(res, 'Event not found', 404); return null; }
  if (!canManageEvent(req.user, event)) { apiResponse.error(res, 'Only the event owner or an admin can view live results', 403); return null; }
  return event;
};

exports.leaderboard = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const results = await computeResults(event, req.params.presentationId);
    const teams = await Team.find({ _id: { $in: results.teams.map((t) => t.teamId) } }).select('team_name');
    const nameOf = new Map(teams.map((t) => [t._id.toString(), t.team_name]));
    results.teams.forEach((t) => { t.team_name = nameOf.get(t.teamId) || ''; });
    return apiResponse.success(res, results);
  } catch (e) { return next(e); }
};

exports.dashboard = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const presentationId = req.query.presentation_id || event.presentation_schedules[0]?._id;
    if (!presentationId) return apiResponse.success(res, { presentations: [], rows: [] });
    const presentation = presentationOf(event, presentationId);
    if (!presentation) return apiResponse.error(res, 'Presentation not found', 404);

    const [slots, results, marks, panels] = await Promise.all([
      PresentationSlot.find({ event_id: event._id, presentation_id: presentationId, status: { $ne: 'cancelled' } }).sort({ start_at: 1 }).populate('team_id', 'team_name').populate('panel_id', 'name room examiners'),
      computeResults(event, presentationId),
      Marks.find({ event_id: event._id, presentation_id: presentationId }).populate('student_id', 'name enrollment_no'),
      PresentationPanel.find({ event_id: event._id }).select('name'),
    ]);
    const byTeam = new Map(results.teams.map((t) => [t.teamId, t]));
    const marksByTeam = new Map();
    marks.forEach((m) => { const k = m.team_id.toString(); if (!marksByTeam.has(k)) marksByTeam.set(k, []); marksByTeam.get(k).push(m); });

    const rows = slots.map((s) => {
      const tid = s.team_id._id.toString();
      const r = byTeam.get(tid);
      const m = marksByTeam.get(tid) || [];
      return {
        slot_id: s._id, team_id: tid, team_name: s.team_id.team_name, panel: s.panel_id?.name, room: s.panel_id?.room, start_at: s.start_at, end_at: s.end_at,
        status: s.status, published: s.published, locked: s.scores_locked, reschedule_request: s.reschedule_request?.status || 'none',
        judges_submitted: r?.examiners || 0, judges_expected: s.panel_id?.examiners?.length || 0,
        raw_mean: r?.raw_mean ?? null, normalized_mean: r?.normalized_mean ?? null, raw_rank: r?.raw_rank ?? null, normalized_rank: r?.normalized_rank ?? null,
        students: m.map((x) => ({ student_id: x.student_id?._id, name: x.student_id?.name, enrollment_no: x.student_id?.enrollment_no, marks: x.presentation_marks, out_of: x.marks_out_of, attendance: x.attendance })),
      };
    });
    const summary = {
      total: rows.length, completed: rows.filter((r) => r.status === 'completed').length, in_progress: rows.filter((r) => r.status === 'in_progress').length,
      pending_reschedule: rows.filter((r) => r.reschedule_request === 'pending').length, finalized: rows.filter((r) => r.locked).length,
    };
    return apiResponse.success(res, {
      presentation: { _id: presentation._id, title: presentation.title },
      presentations: event.presentation_schedules.map((p) => ({ _id: p._id, title: p.title })),
      panels, summary, rows, examiner_stats: results.examiner_stats,
    });
  } catch (e) { return next(e); }
};

exports.finalize = async (req, res, next) => {
  try {
    const event = await loadManagedEvent(req, res); if (!event) return;
    const presentation = presentationOf(event, req.params.presentationId);
    if (!presentation) return apiResponse.error(res, 'Presentation not found', 404);

    const slots = await PresentationSlot.find({ event_id: event._id, presentation_id: presentation._id, status: { $ne: 'cancelled' } });
    const results = await computeResults(event, presentation._id);
    const scored = new Set(results.teams.map((t) => t.teamId));
    const missing = slots.filter((s) => !scored.has(s.team_id.toString()));
    if (missing.length && !req.body.force) {
      return apiResponse.error(res, `${missing.length} team(s) have no scores yet. Pass force=true to finalize anyway.`, 409, { missing_team_ids: missing.map((s) => s.team_id) });
    }

    const sheet = buildCriteria(event, presentation);
    const outOf = sheet.total_out_of;
    const teams = await Team.find({ _id: { $in: results.teams.map((t) => t.teamId) } }).populate('members.student_id', 'user_id');
    const notes = [];
    let written = 0;
    for (const t of results.teams) {
      const team = teams.find((x) => x._id.toString() === t.teamId);
      if (!team) continue;
      const value = round((t.normalized_mean / 100) * outOf);
      for (const m of team.members.filter((x) => x.status === 'accepted' && x.student_id)) {
        await Marks.findOneAndUpdate(
          { college_id: event.college_id, event_id: event._id, team_id: team._id, student_id: m.student_id._id, presentation_id: presentation._id },
          { $set: { presentation_title: presentation.title, presentation_marks: value, marks_out_of: outOf, marks_label: presentation.title, awarded_by: req.user._id }, $setOnInsert: { attendance: 'not_marked' } },
          { upsert: true },
        );
        written += 1;
        if (m.student_id.user_id) notes.push({ recipient: m.student_id.user_id, type: 'marks_added', title: 'Marks Published', message: `Your marks: ${value}/${outOf} for "${presentation.title}"`, reference_id: team._id, reference_type: 'Team' });
      }
    }
    await PresentationSlot.updateMany({ _id: { $in: slots.map((s) => s._id) } }, { $set: { scores_locked: true } });
    await createNotifications(notes);
    emitToUsers(notes.map((n) => n.recipient), { scopes: ['dashboard', 'notifications'], eventId: event._id.toString() });
    return apiResponse.success(res, { teams_finalized: results.teams.length, marks_written: written, out_of: outOf, examiner_stats: results.examiner_stats }, 'Normalized marks finalized and published');
  } catch (e) { return next(e); }
};

exports.computeResults = computeResults;
