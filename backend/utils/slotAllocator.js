/**
 * Presentation slot allocation (pure, deterministic greedy allocator).
 *
 * teams:  [{ id, mentor_id }]               mentor_id = Faculty _id (string) or null
 * panels: [{ id, examiner_ids: [facultyId] }]
 * Constraints honoured:
 *  - a panel's examiners are never double-booked at the same time
 *  - a team's mentor is not an examiner on the team's own panel (optional)
 *  - a team's mentor is not examining another panel while their team presents
 */
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};

// Default offset +330 = IST. Slot times are wall-clock times in that zone.
const buildDate = (dayStr, minutes, tzOffsetMinutes) => {
  const [y, mo, d] = dayStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes - tzOffsetMinutes));
};

const buildTimeGrid = ({ dayStart, dayEnd, slotMinutes, bufferMinutes = 0, breaks = [] }) => {
  const start = toMinutes(dayStart);
  const end = toMinutes(dayEnd);
  const brk = breaks.map((b) => ({ s: toMinutes(b.start), e: toMinutes(b.end) }));
  const grid = [];
  let t = start;
  while (t + slotMinutes <= end) {
    const clash = brk.find((b) => t < b.e && t + slotMinutes > b.s);
    if (clash) { t = clash.e; continue; }
    grid.push(t);
    t += slotMinutes + bufferMinutes;
  }
  return grid;
};

const generateSlots = ({
  teams = [],
  panels = [],
  days = [],
  dayStart = '09:30',
  dayEnd = '16:30',
  slotMinutes = 15,
  bufferMinutes = 5,
  breaks = [{ start: '13:00', end: '14:00' }],
  avoidMentorOnPanel = true,
  tzOffsetMinutes = 330,
}) => {
  if (!panels.length) throw new Error('At least one panel is required');
  if (!days.length) throw new Error('At least one day is required');
  if (slotMinutes < 5) throw new Error('slotMinutes must be at least 5');

  const grid = buildTimeGrid({ dayStart, dayEnd, slotMinutes, bufferMinutes, breaks });
  const busyExaminers = new Map(); // key -> Set(facultyId)
  const busyMentors = new Map();   // key -> Set(mentorId) of teams presenting at key
  const pending = teams.map((t) => ({ ...t }));
  const assignments = [];
  const reasons = new Map();

  const setFor = (map, key) => { if (!map.has(key)) map.set(key, new Set()); return map.get(key); };

  for (const day of days) {
    for (const t of grid) {
      const key = `${day}|${t}`;
      for (const panel of panels) {
        if (!pending.length) break;
        const examiners = (panel.examiner_ids || []).map(String);
        const exBusy = setFor(busyExaminers, key);
        const mBusy = setFor(busyMentors, key);
        if (examiners.some((e) => exBusy.has(e) || mBusy.has(e))) continue;

        const idx = pending.findIndex((team) => {
          const mentor = team.mentor_id ? String(team.mentor_id) : null;
          if (mentor && avoidMentorOnPanel && examiners.includes(mentor)) { reasons.set(String(team.id), 'mentor_on_every_available_panel'); return false; }
          if (mentor && exBusy.has(mentor)) { reasons.set(String(team.id), 'mentor_busy_examining'); return false; }
          return true;
        });
        if (idx === -1) continue;

        const [team] = pending.splice(idx, 1);
        examiners.forEach((e) => exBusy.add(e));
        if (team.mentor_id) mBusy.add(String(team.mentor_id));
        assignments.push({
          team_id: team.id,
          panel_id: panel.id,
          start_at: buildDate(day, t, tzOffsetMinutes),
          end_at: buildDate(day, t + slotMinutes, tzOffsetMinutes),
        });
      }
    }
  }

  const unscheduled = pending.map((team) => ({
    team_id: team.id,
    reason: reasons.get(String(team.id)) || 'not_enough_slots',
  }));
  return { assignments, unscheduled, slots_per_day: grid.length * panels.length };
};

/** Two slots overlap if they share any time and either the panel or an examiner is the same. */
const slotsConflict = (a, b) => a.start_at < b.end_at && b.start_at < a.end_at;

module.exports = { generateSlots, buildTimeGrid, toMinutes, buildDate, slotsConflict };
