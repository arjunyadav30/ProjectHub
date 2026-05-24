const Notification = require('../models/Notification');
const Team = require('../models/Team');
const Student = require('../models/Student');
const { notifyUser } = require('./realtime');

const ACTIONABLE_TYPES = ['team_invite', 'leader_request', 'mentor_request'];

const createNotification = async ({
  recipient,
  user_id,
  type,
  title = '',
  message,
  reference_id,
  reference_type,
  related_id,
  related_model,
  action_token,
  action_status,
}) => {
  const targetUser = recipient || user_id;
  const targetReference = reference_id || related_id;
  const targetReferenceType = reference_type || related_model;

  if (!targetUser || !type || !message) return null;

  const payload = {
    user_id: targetUser,
    recipient: targetUser,
    type,
    title,
    message,
    reference_id: targetReference,
    reference_type: targetReferenceType,
    related_id: targetReference,
    related_model: targetReferenceType,
    action_token,
    action_status: action_status ?? (ACTIONABLE_TYPES.includes(type) ? 'pending' : undefined),
  };

  const filter = {
    user_id: targetUser,
    type,
    message,
  };

  if (targetReference) filter.reference_id = targetReference;
  if (action_token) filter.action_token = action_token;

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $setOnInsert: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  notifyUser(targetUser, {
    scope: 'notifications',
    scopes: ['notifications', 'dashboard'],
    teamId: targetReference?.toString(),
  });

  return notification;
};

const createNotifications = async (notifications = []) => {
  const unique = new Map();
  notifications.forEach(notification => {
    const targetUser = notification.recipient || notification.user_id;
    if (!targetUser || !notification.type || !notification.message) return;
    const targetReference = notification.reference_id || notification.related_id || '';
    const key = [
      targetUser.toString(),
      notification.type,
      targetReference.toString(),
      notification.message,
      notification.action_token || '',
    ].join('|');
    unique.set(key, notification);
  });

  return Promise.all([...unique.values()].map(createNotification));
};

const resolveActionNotifications = async ({ userId, teamId, types, status }) => {
  if (!userId || !teamId || !types?.length) return;

  await Notification.updateMany(
    {
      $and: [
        { $or: [{ user_id: userId }, { recipient: userId }] },
        { type: { $in: types } },
        { $or: [{ reference_id: teamId }, { related_id: teamId }] },
        { $or: [{ action_status: 'pending' }, { action_status: null }, { action_status: { $exists: false } }] },
      ],
    },
    { $set: { action_status: status, is_read: true } }
  );
};

const computeActionStatus = async (notification, userId) => {
  if (!ACTIONABLE_TYPES.includes(notification.type)) return notification.action_status || null;

  if (notification.action_status && notification.action_status !== 'pending') {
    return notification.action_status;
  }

  const teamId = notification.reference_id || notification.related_id;
  if (!teamId) return 'rejected';

  const team = await Team.findById(teamId).select('members team_leader leader_accepted mentor_status');
  if (!team) return 'rejected';

  if (notification.type === 'mentor_request') {
    if (team.mentor_status === 'pending') return 'pending';
    if (team.mentor_status === 'accepted') return 'accepted';
    return 'rejected';
  }

  if (notification.type === 'leader_request') {
    if (team.leader_accepted) return 'accepted';
    const student = await Student.findOne({ user_id: userId }).select('_id');
    if (!student || team.team_leader?.toString() !== student._id.toString()) return 'rejected';
    return 'pending';
  }

  if (notification.type === 'team_invite') {
    const student = await Student.findOne({ user_id: userId }).select('_id');
    if (!student) return 'rejected';
    const member = team.members.find(m => m.student_id?.toString() === student._id.toString());
    if (!member) return 'rejected';
    if (member.status === 'pending') return 'pending';
    return member.status;
  }

  return null;
};

const enrichNotifications = async (notifications, userId) => {
  const teamIds = [...new Set(
    notifications
      .filter(n => ACTIONABLE_TYPES.includes(n.type))
      .map(n => (n.reference_id || n.related_id)?.toString())
      .filter(Boolean)
  )];

  const teams = teamIds.length
    ? await Team.find({ _id: { $in: teamIds } }).select('members team_leader leader_accepted mentor_status').lean()
    : [];
  const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

  const student = await Student.findOne({ user_id: userId }).select('_id').lean();

  return Promise.all(notifications.map(async (doc) => {
    const notification = doc.toObject ? doc.toObject() : { ...doc };

    if (!ACTIONABLE_TYPES.includes(notification.type)) {
      notification.is_actionable = false;
      return notification;
    }

    let status = notification.action_status;
    if (!status || status === 'pending') {
      const teamId = (notification.reference_id || notification.related_id)?.toString();
      const team = teamId ? teamMap.get(teamId) : null;

      if (!team) {
        status = 'rejected';
      } else if (notification.type === 'mentor_request') {
        status = team.mentor_status === 'pending' ? 'pending' : team.mentor_status === 'accepted' ? 'accepted' : 'rejected';
      } else if (notification.type === 'leader_request') {
        status = team.leader_accepted
          ? 'accepted'
          : student && team.team_leader?.toString() === student._id.toString()
            ? 'pending'
            : 'rejected';
      } else if (notification.type === 'team_invite') {
        const member = student
          ? team.members?.find(m => m.student_id?.toString() === student._id.toString())
          : null;
        status = !member ? 'rejected' : member.status === 'pending' ? 'pending' : member.status;
      }

      if (status && status !== 'pending' && notification.action_status === 'pending') {
        await Notification.updateOne(
          { _id: notification._id },
          { $set: { action_status: status } }
        );
      } else if (!notification.action_status && status) {
        notification.action_status = status;
      }
    }

    notification.action_status = status || notification.action_status;
    notification.is_actionable = notification.action_status === 'pending';
    return notification;
  }));
};

module.exports = {
  createNotification,
  createNotifications,
  resolveActionNotifications,
  enrichNotifications,
  ACTIONABLE_TYPES,
};
