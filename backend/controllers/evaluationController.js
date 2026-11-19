const Event = require('../models/Event');
const Team = require('../models/Team');
const Student = require('../models/Student');
const Marks = require('../models/Marks');
const VivaSession = require('../models/VivaSession');
const ContributionReport = require('../models/ContributionReport');
const FinalGrade = require('../models/FinalGrade');
const Faculty = require('../models/Faculty');
const apiResponse = require('../utils/apiResponse');
const { canManageEvent, getTeamAccess } = require('../utils/teamAccess');
const { computeFinalScore, sanitizeWeights, summarizeMarks, normalizeSingleMark, COMPONENT_KEYS, DEFAULT_EVAL_WEIGHTS } = require('../utils/evaluationEngine');
const { createNotifications } = require('../utils/notifications');
const { emitToUsers } = require('../utils/realtime');

const pct = (value, outOf) => (outOf > 0 ? Math.min(100, Math.max(0, (value / outOf) * 100)) : null);
const isValidObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const stamp = (value) => (value ? new Date(value).getTime() || 0 : 0);
const weightsOf = (event) => sanitizeWeights(event.evaluation_weights?.toObject ? event.evaluation_weights.toObject() : event.evaluation_weights || DEFAULT_EVAL_WEIGHTS);

const loadEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event || event.college_id.toString() !== req.user.college_id?.toString()) { apiResponse.error(res, 'Event not found', 404); return null; }
  return event;
};
const loadManaged = async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return null;
  if (!canManageEvent(req.user, event)) { apiResponse.error(res, 'Only the event owner or an admin can do this', 403); return null; }
  return event;
};

/** Collects every component for the given teams and computes explainable final scores. */
const computeGrades = async (event, teamFilter = {}) => {
  const teams = await Team.find({ event_id: event._id, college_id: event.college_id, registration_status: 'approved', ...teamFilter })
    .populate('members.student_id', 'name enrollment_no user_id');
  const teamIds = teams.map((t) => t._id);
  const [marks, vivas, reports, grades] = await Promise.all([
    Marks.find({ event_id: event._id, team_id: { $in: teamIds } }),
    VivaSession.find({ team_id: { $in: teamIds }, status: 'completed' }).sort({ created_at: -1 }),
    ContributionReport.find({ team_id: { $in: teamIds } }).sort({ created_at: -1 }),
    FinalGrade.find({ event_id: event._id, team_id: { $in: teamIds } }),
  ]);
  const weights = weightsOf(event);
  const latestReport = new Map();
  reports.forEach((r) => { if (!latestReport.has(r.team_id.toString())) latestReport.set(r.team_id.toString(), r); });

  const rows = [];
  teams.forEach((team) => {
    team.members.filter((m) => m.status === 'accepted' && m.student_id).forEach((m) => {
      const s = m.student_id;
      const sid = s._id.toString();
      const myMarks = marks.filter((x) => x.student_id.toString() === sid);
      const scoredMarks = myMarks.filter((x) => x.marks_out_of > 0);
      const presentation = scoredMarks.length ? scoredMarks.reduce((a, x) => a + pct(x.presentation_marks, x.marks_out_of), 0) / scoredMarks.length : null;
      const marked = myMarks.filter((x) => x.attendance !== 'not_marked');
      const attendance = marked.length ? (marked.filter((x) => x.attendance === 'present').length / marked.length) * 100 : null;
      const viva = vivas.find((v) => v.student_user_id.toString() === s.user_id?.toString());
      const report = latestReport.get(team._id.toString());
      const row = report?.members.find((x) => x.student_id.toString() === sid);
      const decided = report?.guide_decision?.scores?.find((x) => x.student_id.toString() === sid);
      const stored = grades.find((g) => g.student_id.toString() === sid);

      const components = {
        presentation,
        viva: viva ? pct(viva.total_score, viva.max_score) : null,
        contribution: decided ? decided.score_100 : row ? row.suggested_score_100 : null,
        report: stored?.manual?.report_score ?? null,
        attendance,
      };
      const result = computeFinalScore(components, weights);
      const override = stored?.override?.score ?? null;
      rows.push({
        team_id: team._id, team_name: team.team_name, student_id: s._id, name: s.name, enrollment_no: s.enrollment_no,
        components, breakdown: result.breakdown, missing: result.missing, partial: result.partial,
        computed_score: result.final_score, override: stored?.override?.score != null ? stored.override : null,
        final_score: override ?? result.final_score,
        sources: { contribution: decided ? 'guide_decision' : row ? 'git_suggestion' : null, viva_method: viva?.scoring_method || null, viva_trust: viva?.trust?.level || null },
        grade_id: stored?._id || null, locked: !!stored?.locked,
      });
    });
  });
  rows.sort((a, b) => (b.final_score ?? -1) - (a.final_score ?? -1));
  return { weights, rows };
};

exports.getEventGrades = async (req, res, next) => {
  try {
    const event = await loadManaged(req, res); if (!event) return;
    return apiResponse.success(res, await computeGrades(event));
  } catch (e) { return next(e); }
};

exports.getTeamGrades = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).select('college_id event_id assigned_faculty mentor_status');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor) return apiResponse.error(res, 'Not allowed', 403);
    const event = await Event.findById(team.event_id);
    return apiResponse.success(res, await computeGrades(event, { _id: team._id }));
  } catch (e) { return next(e); }
};

exports.setWeights = async (req, res, next) => {
  try {
    const event = await loadManaged(req, res); if (!event) return;
    const incoming = req.body.weights || {};
    const clean = {};
    for (const k of COMPONENT_KEYS) {
      const v = Number(incoming[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) return apiResponse.error(res, `Weight for ${k} must be between 0 and 100`, 400);
      clean[k] = v;
    }
    if (Object.values(clean).reduce((a, b) => a + b, 0) <= 0) return apiResponse.error(res, 'At least one weight must be above 0', 400);
    event.evaluation_weights = clean;
    await event.save();
    return apiResponse.success(res, { weights: clean, note: 'Weights are applied relative to each other; missing components are re-normalized per student.' }, 'Weights updated');
  } catch (e) { return next(e); }
};

exports.setReportScore = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).populate('members.student_id', '_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor) return apiResponse.error(res, 'Only the accepted mentor or an admin can enter report scores', 403);
    const score = Number(req.body.report_score);
    if (!Number.isFinite(score) || score < 0 || score > 100) return apiResponse.error(res, 'report_score must be between 0 and 100', 400);
    const ids = team.members.filter((m) => m.status === 'accepted' && m.student_id).map((m) => m.student_id._id);
    for (const sid of ids) {
      await FinalGrade.findOneAndUpdate(
        { event_id: team.event_id, student_id: sid },
        { $set: { 'manual.report_score': score, 'manual.updated_by': req.user._id }, $setOnInsert: { college_id: team.college_id, team_id: team._id } },
        { upsert: true },
      );
    }
    return apiResponse.success(res, { report_score: score, students: ids.length }, 'Report score saved');
  } catch (e) { return next(e); }
};

exports.finalize = async (req, res, next) => {
  try {
    const event = await loadManaged(req, res); if (!event) return;
    const { weights, rows } = await computeGrades(event);
    const notes = [];
    for (const r of rows) {
      await FinalGrade.findOneAndUpdate(
        { event_id: event._id, student_id: r.student_id },
        { $set: { college_id: event.college_id, team_id: r.team_id, locked: true, components: r.components, breakdown: r.breakdown, weights_used: weights, computed_score: r.computed_score, partial: r.partial, finalized_by: req.user._id, finalized_at: new Date() } },
        { upsert: true },
      );
    }
    const students = await Student.find({ _id: { $in: rows.map((r) => r.student_id) } }).select('user_id');
    students.forEach((s) => s.user_id && notes.push({ recipient: s.user_id, type: 'grade_published', title: 'Final evaluation published', message: `Your final evaluation for "${event.title}" is available`, reference_id: event._id, reference_type: 'Event' }));
    await createNotifications(notes);
    return apiResponse.success(res, { finalized: rows.length, partial: rows.filter((r) => r.partial).length }, 'Final evaluation locked');
  } catch (e) { return next(e); }
};

exports.setOverride = async (req, res, next) => {
  try {
    const grade = await FinalGrade.findById(req.params.gradeId);
    if (!grade) return apiResponse.error(res, 'Grade not found', 404);
    const event = await Event.findById(grade.event_id);
    if (!event || !canManageEvent(req.user, event)) return apiResponse.error(res, 'Not allowed', 403);
    const score = req.body.score === null ? null : Number(req.body.score);
    const reason = String(req.body.reason || '').trim();
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) return apiResponse.error(res, 'score must be between 0 and 100', 400);
    if (score !== null && reason.length < 10) return apiResponse.error(res, 'A reason (at least 10 characters) is required for an override', 400);
    grade.override = { score, reason: score === null ? '' : reason.slice(0, 500), by: req.user._id };
    await grade.save();
    return apiResponse.success(res, grade.override, score === null ? 'Override removed' : 'Override saved');
  } catch (e) { return next(e); }
};

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

exports.exportCsv = async (req, res, next) => {
  try {
    const event = await loadManaged(req, res); if (!event) return;
    const { rows } = await computeGrades(event);
    const head = ['Team', 'Student', 'Enrollment', 'Presentation', 'Viva', 'Contribution', 'Report', 'Attendance', 'Computed', 'Override', 'Final', 'Partial'];
    const f = (n) => (n == null ? '' : Number(n).toFixed(1));
    const lines = [head.join(',')].concat(rows.map((r) => [r.team_name, r.name, r.enrollment_no, f(r.components.presentation), f(r.components.viva), f(r.components.contribution), f(r.components.report), f(r.components.attendance), f(r.computed_score), r.override ? f(r.override.score) : '', f(r.final_score), r.partial ? 'yes' : 'no'].map(csvCell).join(',')));
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="evaluation-${event._id}.csv"` });
    return res.send(`\uFEFF${lines.join('\r\n')}`);
  } catch (e) { return next(e); }
};

/** Every mark the faculty has entered for this event, with the roster so blanks can be filled in. */
exports.getEventMarks = async (req, res, next) => {
  try {
    const event = await loadEvent(req, res); if (!event) return;
    const teams = await Team.find({ event_id: event._id, college_id: event.college_id, registration_status: 'approved' })
      .select('team_name members assigned_faculty mentor_status')
      .populate('members.student_id', 'name enrollment_no');
    const teamIds = teams.map((t) => t._id);
    const marks = await Marks.find({ event_id: event._id, college_id: event.college_id, team_id: { $in: teamIds } })
      .populate('awarded_by', 'name')
      .sort({ updated_at: -1 });

    const isManager = canManageEvent(req.user, event);
    const faculty = req.user.role === 'faculty' ? await Faculty.findOne({ user_id: req.user._id }).select('_id') : null;

    const marksByStudent = new Map();
    marks.forEach((m) => {
      const key = m.student_id.toString();
      if (!marksByStudent.has(key)) marksByStudent.set(key, []);
      marksByStudent.get(key).push({
        _id: m._id, presentation_id: m.presentation_id || null, presentation_title: m.presentation_title || m.marks_label || 'Presentation',
        marks: m.presentation_marks, out_of: m.marks_out_of, percent: pct(m.presentation_marks, m.marks_out_of),
        attendance: m.attendance, awarded_by: m.awarded_by?.name || '', updated_at: m.updated_at,
      });
    });

    const roster = [];
    teams.forEach((team) => {
      const canEdit = isManager || !!(faculty && team.assigned_faculty?.toString() === faculty._id.toString() && team.mentor_status === 'accepted');
      team.members.filter((m) => m.status === 'accepted' && m.student_id).forEach((m) => {
        roster.push({
          team_id: team._id, team_name: team.team_name, student_id: m.student_id._id, name: m.student_id.name,
          enrollment_no: m.student_id.enrollment_no, can_edit: canEdit, marks: marksByStudent.get(m.student_id._id.toString()) || [],
        });
      });
    });

    const presentations = event.presentation_schedules.map((p) => ({
      _id: p._id, title: p.title,
      out_of: (p.labels || []).reduce((sum, label) => sum + Number(label.marks_out_of || 0), 0) || 100,
    }));
    return apiResponse.success(res, { presentations, roster });
  } catch (e) { return next(e); }
};

/** Upsert one student's presentation mark from the event marks editor. */
exports.saveEventMark = async (req, res, next) => {
  try {
    const event = await loadEvent(req, res); if (!event) return;
    const { student_id } = req.body;
    if (!isValidObjectId(student_id)) return apiResponse.error(res, 'student_id is invalid', 400);
    const team = await Team.findOne({
      event_id: event._id, college_id: event.college_id,
      members: { $elemMatch: { student_id, status: 'accepted' } },
    }).select('_id team_name college_id assigned_faculty mentor_status');
    if (!team) return apiResponse.error(res, 'Student is not in an accepted team for this event', 404);
    const access = await getTeamAccess(req.user, team);
    if (!access.isAdmin && !access.isMentor && !canManageEvent(req.user, event)) {
      return apiResponse.error(res, 'Only the event owner, an admin or the student\u2019s mentor can update marks', 403);
    }
    const normalized = normalizeSingleMark(req.body);
    if (normalized.error) return apiResponse.error(res, normalized.error, 400);
    const presentationId = req.body.presentation_id || null;
    if (presentationId && !event.presentation_schedules.id(presentationId)) {
      return apiResponse.error(res, 'Presentation not found in this event', 404);
    }
    const { value } = normalized;
    const record = await Marks.findOneAndUpdate(
      { college_id: event.college_id, event_id: event._id, team_id: team._id, student_id, presentation_id: presentationId },
      {
        $set: {
          presentation_title: value.label, marks_label: value.label, presentation_marks: value.marks, marks_out_of: value.out_of,
          attendance: value.attendance, awarded_by: req.user._id,
          label_marks: [{ label_id: null, label: value.label, marks: value.marks, marks_out_of: value.out_of }],
        },
        $setOnInsert: { college_id: event.college_id, event_id: event._id, team_id: team._id, student_id, presentation_id: presentationId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const student = await Student.findById(student_id).select('user_id');
    if (student?.user_id) {
      await createNotifications([{
        recipient: student.user_id, type: 'marks_added', title: 'Marks Updated',
        message: `Your marks for "${value.label}" were updated: ${value.marks}/${value.out_of}`,
        reference_id: team._id, reference_type: 'Team',
      }]);
      emitToUsers([student.user_id], { scopes: ['evaluation', 'dashboard'], eventId: event._id.toString() });
    }
    return apiResponse.success(res, record, 'Marks saved');
  } catch (e) { return next(e); }
};

/** Student view: final grades once published, plus every mark faculty has entered (live preview). */
exports.myGrades = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id }).select('_id');
    if (!student) return apiResponse.success(res, []);
    const [marks, grades] = await Promise.all([
      Marks.find({ student_id: student._id })
        .populate('event_id', 'title')
        .populate('team_id', 'team_name')
        .populate('awarded_by', 'name')
        .sort({ updated_at: -1 })
        .limit(300),
      FinalGrade.find({ student_id: student._id }).populate('event_id', 'title'),
    ]);

    const entries = new Map();
    const ensure = (eventId, title) => {
      const key = String(eventId || 'unknown');
      if (!entries.has(key)) {
        entries.set(key, {
          event_id: eventId || null, event: title || 'Event evaluation', team_name: '',
          published: false, final_score: null, computed_score: null, breakdown: [], partial: false,
          missing: [], override_reason: '', finalized_at: null, report_score: null,
          marks: [], summary: { presentation: null, attendance: null, count: 0 }, live: null, updated_at: null,
        });
      }
      return entries.get(key);
    };
    const touch = (entry, date) => { if (stamp(date) > stamp(entry.updated_at)) entry.updated_at = date; };

    grades.forEach((g) => {
      const entry = ensure(g.event_id?._id || g.event_id, g.event_id?.title);
      entry.report_score = g.manual?.report_score ?? null;
      touch(entry, g.updated_at || g.finalized_at);
      if (!g.locked) return;
      entry.published = true;
      entry.breakdown = g.breakdown || [];
      entry.partial = !!g.partial;
      entry.missing = Array.isArray(g.missing) ? g.missing : [];
      entry.computed_score = g.computed_score ?? null;
      entry.final_score = g.override?.score ?? g.computed_score ?? null;
      entry.override_reason = g.override?.score != null ? (g.override.reason || '') : '';
      entry.finalized_at = g.finalized_at || null;
    });

    marks.forEach((m) => {
      const eventId = m.event_id?._id || m.event_id;
      const entry = ensure(eventId, m.event_id?.title);
      if (!entry.team_name && m.team_id?.team_name) entry.team_name = m.team_id.team_name;
      entry.marks.push({
        id: m._id, presentation_id: m.presentation_id || null,
        presentation_title: m.presentation_title || m.marks_label || 'Presentation',
        marks: m.presentation_marks, out_of: m.marks_out_of, percent: pct(m.presentation_marks, m.marks_out_of),
        attendance: m.attendance,
        labels: (m.label_marks || []).map((l) => ({ label: l.label, marks: l.marks, out_of: l.marks_out_of })),
        awarded_by: m.awarded_by?.name || '', updated_at: m.updated_at || m.created_at || null,
      });
      touch(entry, m.updated_at || m.created_at);
    });

    const list = [...entries.values()];
    for (const entry of list) {
      entry.summary = summarizeMarks(entry.marks);
      if (entry.published || !entry.event_id || !entry.marks.length) continue;
      try {
        const event = await Event.findById(entry.event_id);
        if (!event) continue;
        const teamIds = [...new Set(marks
          .filter((m) => String(m.event_id?._id || m.event_id) === String(entry.event_id))
          .map((m) => String(m.team_id?._id || m.team_id)).filter(Boolean))];
        if (!teamIds.length) continue;
        const { rows } = await computeGrades(event, { _id: { $in: teamIds } });
        const row = rows.find((r) => String(r.student_id) === String(student._id));
        if (row) entry.live = { components: row.components, breakdown: row.breakdown, computed_score: row.computed_score, partial: row.partial, missing: row.missing };
      } catch (_) { /* live preview is best-effort */ }
    }

    list.sort((a, b) => stamp(b.updated_at) - stamp(a.updated_at));
    return apiResponse.success(res, list);
  } catch (e) { return next(e); }
};
