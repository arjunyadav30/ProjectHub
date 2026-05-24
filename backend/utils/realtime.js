const Team = require('../models/Team');
const Event = require('../models/Event');

let syncNs = null;

const initRealtime = (io, socketAuth) => {
  const sync = io.of('/sync');
  sync.use(socketAuth);

  sync.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);
  });

  syncNs = sync;
  return sync;
};

const emitPayload = (payload) => ({
  ...payload,
  at: Date.now(),
});

const emitToUsers = (userIds, payload) => {
  if (!syncNs || !userIds?.length) return;
  const data = emitPayload(payload);
  [...new Set(userIds.map(id => id?.toString()).filter(Boolean))].forEach((userId) => {
    syncNs.to(`user:${userId}`).emit('data_changed', data);
  });
};

const emitToRole = (role, payload) => {
  if (!syncNs || !role) return;
  syncNs.to(`role:${role}`).emit('data_changed', emitPayload(payload));
};

const emitToRoles = (roles, payload) => {
  roles.forEach((role) => emitToRole(role, payload));
};

const notifyUser = (userId, payload = {}) => {
  emitToUsers([userId], { scopes: ['notifications', 'dashboard', '*'], ...payload });
};

const notifyTeamStakeholders = async (teamId, payload = {}) => {
  if (!teamId) return;

  const team = await Team.findById(teamId)
    .populate({ path: 'members.student_id', select: 'user_id' })
    .populate({ path: 'team_leader', select: 'user_id' })
    .populate({ path: 'assigned_faculty', select: 'user_id' })
    .populate({ path: 'event_id', select: 'created_by' })
    .lean();

  if (!team) return;

  const userIds = new Set();
  team.members?.forEach((m) => {
    if (m.student_id?.user_id) userIds.add(m.student_id.user_id.toString());
  });
  if (team.team_leader?.user_id) userIds.add(team.team_leader.user_id.toString());
  if (team.assigned_faculty?.user_id) userIds.add(team.assigned_faculty.user_id.toString());
  if (team.event_id?.created_by) userIds.add(team.event_id.created_by.toString());

  const eventId = team.event_id?._id?.toString() || team.event_id?.toString();
  const tid = teamId.toString();

  emitToUsers([...userIds], {
    scopes: ['teams', 'team', 'notifications', 'dashboard'],
    scope: 'team',
    teamId: tid,
    eventId,
    ...payload,
  });
};

const notifyEventUpdate = async (eventId, payload = {}) => {
  if (!eventId) return;

  const event = await Event.findById(eventId).select('created_by').lean();
  const userIds = new Set();
  if (event?.created_by) userIds.add(event.created_by.toString());

  const teams = await Team.find({ event_id: eventId })
    .populate({ path: 'members.student_id', select: 'user_id' })
    .populate({ path: 'team_leader', select: 'user_id' })
    .populate({ path: 'assigned_faculty', select: 'user_id' })
    .lean();

  teams.forEach((team) => {
    team.members?.forEach((m) => {
      if (m.student_id?.user_id) userIds.add(m.student_id.user_id.toString());
    });
    if (team.team_leader?.user_id) userIds.add(team.team_leader.user_id.toString());
    if (team.assigned_faculty?.user_id) userIds.add(team.assigned_faculty.user_id.toString());
  });

  const eid = eventId.toString();
  emitToUsers([...userIds], {
    scopes: ['events', 'event', 'teams', 'dashboard'],
    scope: 'event',
    eventId: eid,
    ...payload,
  });

  emitToRoles(['student', 'faculty', 'admin'], {
    scopes: ['events'],
    scope: 'events',
    eventId: eid,
    ...payload,
  });
};

module.exports = {
  initRealtime,
  notifyUser,
  notifyTeamStakeholders,
  notifyEventUpdate,
  emitToUsers,
  emitToRoles,
};
