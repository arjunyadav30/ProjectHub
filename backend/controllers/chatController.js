const Message = require('../models/Message');
const User = require('../models/User');
const Team = require('../models/Team');
const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');
const { createNotification } = require('../utils/notifications');

const messagePreview = ({ content, image_url }) => {
  if (content) return content.length > 80 ? `${content.slice(0, 77)}...` : content;
  return image_url ? 'Sent an image' : 'Sent a message';
};

const markMessagesRead = async (filter, userId) => {
  await Message.updateMany(
    { ...filter, sender_id: { $ne: userId }, read_by: { $not: { $elemMatch: { user_id: userId } } } },
    { $push: { read_by: { user_id: userId, read_at: new Date() } } }
  );
};

const getTeamAccessForUser = async (user, teamId) => {
  const team = await Team.findById(teamId).select('_id team_name members assigned_faculty created_by');
  if (!team) return null;
  if (user.role !== 'student') return null;
  const student = await Student.findOne({ user_id: user._id }).select('_id');
  if (!student) return null;
  const isAccepted = team.members?.some((m) => m.student_id?.toString() === student._id.toString() && m.status === 'accepted');
  return isAccepted ? { student, team } : null;
};

const validateDirectTarget = async (userBId) => {
  const userB = await User.findById(userBId).select('_id status name');
  if (!userB || userB.status !== 'active') return { ok: false, message: 'User not found or inactive' };
  return { ok: true, userB };
};

// GET /api/chat/group/:teamId
exports.getGroupMessages = async (req, res, next) => {
  try {
    const access = await getTeamAccessForUser(req.user, req.params.teamId);
    if (!access) return apiResponse.error(res, 'Not allowed to access this team chat', 403);

    const messages = await Message.find({ team_id: req.params.teamId, chat_type: 'group', college_id: req.user.college_id })
      .populate('sender_id', 'name profile_image role')
      .sort({ created_at: 1 })
      .limit(100);
    return apiResponse.success(res, messages);
  } catch (e) { next(e); }
};

// GET /api/chat/direct/:userId
exports.getDirectMessages = async (req, res, next) => {
  try {
    const pair = await validateDirectTarget(req.params.userId);
    if (!pair.ok) return apiResponse.error(res, pair.message, 403);

    const myId = req.user._id.toString();
    const otherId = req.params.userId;
    const messages = await Message.find({
      chat_type: 'individual',
      $or: [
        { sender_id: myId, receiver_id: otherId },
        { sender_id: otherId, receiver_id: myId },
      ],
    })
      .populate('sender_id', 'name profile_image role')
      .sort({ created_at: 1 })
      .limit(100);
    return apiResponse.success(res, messages);
  } catch (e) { next(e); }
};

// POST /api/chat/group/:teamId
exports.sendGroupMessage = async (req, res, next) => {
  try {
    const { content, image_url, file_url, file_name, file_type } = req.body;
    if (!content && !image_url && !file_url) return apiResponse.error(res, 'Message, image, or file required', 400);
    const access = await getTeamAccessForUser(req.user, req.params.teamId);
    if (!access) return apiResponse.error(res, 'Not allowed to access this team chat', 403);

    const msg = await Message.create({
      college_id: req.user.college_id,
      sender_id: req.user._id,
      team_id: req.params.teamId,
      chat_type: 'group',
      content: content || '',
      image_url: image_url || '',
      file_url: file_url || '',
      file_name: file_name || '',
      file_type: file_type || '',
      read_by: [{ user_id: req.user._id }],
    });
    const populated = await Message.findById(msg._id).populate('sender_id', 'name profile_image role');

    if (access.team?.members?.length) {
      const memberIds = access.team.members
        .map((member) => member.user_id)
        .filter((id) => id && id.toString() !== req.user._id.toString());
      for (const memberId of memberIds) {
        await createNotification({
          recipient: memberId,
          type: 'new_message',
          title: `New message in ${access.team.team_name}`,
          message: `${req.user.name}: ${messagePreview(populated)}`,
          related_id: access.team._id,
          related_model: 'Team',
        });
      }
    }

    return apiResponse.created(res, populated, 'Message sent');
  } catch (e) { next(e); }
};

// POST /api/chat/direct/:userId
exports.sendDirectMessage = async (req, res, next) => {
  try {
    const pair = await validateDirectTarget(req.params.userId);
    if (!pair.ok) return apiResponse.error(res, pair.message, 403);
    const { content, image_url, file_url, file_name, file_type } = req.body;
    if (!content && !image_url && !file_url) return apiResponse.error(res, 'Message, image, or file required', 400);

    const msg = await Message.create({
      college_id: req.user.college_id,
      sender_id: req.user._id,
      receiver_id: req.params.userId,
      chat_type: 'individual',
      content: content || '',
      image_url: image_url || '',
      file_url: file_url || '',
      file_name: file_name || '',
      file_type: file_type || '',
      read_by: [{ user_id: req.user._id }],
    });
    const populated = await Message.findById(msg._id).populate('sender_id', 'name profile_image role');

    await createNotification({
      recipient: pair.userB._id,
      type: 'new_message',
      title: `New message from ${req.user.name}`,
      message: messagePreview(populated),
      related_id: populated._id,
      related_model: 'Message',
    });

    return apiResponse.created(res, populated, 'Message sent');
  } catch (e) { next(e); }
};

// DELETE /api/chat/message/:id
exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return apiResponse.error(res, 'Message not found', 404);
    if (msg.sender_id.toString() !== req.user._id.toString()) {
      return apiResponse.error(res, 'Can only delete your own messages', 403);
    }
    msg.is_deleted = true;
    msg.content = '';
    await msg.save();
    return apiResponse.success(res, null, 'Message deleted');
  } catch (e) { next(e); }
};

// GET /api/chat/contacts
exports.getChatContacts = async (req, res, next) => {
  try {
    const myId = req.user._id.toString();

    const directMessages = await Message.find({
        chat_type: 'individual',
        $or: [{ sender_id: req.user._id }, { receiver_id: req.user._id }],
      }).sort({ created_at: -1 }).limit(200);

    const latestDirectByUser = new Map();
    directMessages.forEach(message => {
      const senderId = message.sender_id?.toString();
      const receiverId = message.receiver_id?.toString();
      const otherId = senderId === myId ? receiverId : senderId;
      if (otherId && !latestDirectByUser.has(otherId)) latestDirectByUser.set(otherId, message);
    });

    const users = await User.find({ _id: { $in: [...latestDirectByUser.keys()] }, status: 'active' })
      .select('name role profile_image email');

    const directThreads = users.map(user => {
      const lastMessage = latestDirectByUser.get(user._id.toString());
      return {
        _id: user._id,
        thread_type: 'direct',
        name: user.name,
        role: user.role,
        profile_image: user.profile_image,
        email: user.email,
        last_message: lastMessage ? messagePreview(lastMessage) : '',
        last_message_at: lastMessage?.created_at || null,
        unread_count: directMessages.filter(message => {
          const senderId = message.sender_id?.toString();
          const receiverId = message.receiver_id?.toString();
          const otherId = senderId === myId ? receiverId : senderId;
          const isRead = message.read_by?.some(read => read.user_id?.toString() === myId);
          return otherId === user._id.toString() && senderId !== myId && !isRead;
        }).length,
      };
    });

    let teamFilter = {};
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user_id: req.user._id });
      teamFilter = student
        ? { members: { $elemMatch: { student_id: student._id, status: 'accepted' } } }
        : { _id: null };
    } else {
      teamFilter = { _id: null };
    }

    const teams = await Team.find(teamFilter)
      .select('team_name members assigned_faculty registration_status')
      .sort({ updated_at: -1 })
      .limit(50);
    const teamIds = teams.map(team => team._id);
    const groupMessages = await Message.find({ team_id: { $in: teamIds }, chat_type: 'group' })
      .sort({ created_at: -1 })
      .limit(200);
    const latestGroupByTeam = new Map();
    groupMessages.forEach(message => {
      const teamId = message.team_id?.toString();
      if (teamId && !latestGroupByTeam.has(teamId)) latestGroupByTeam.set(teamId, message);
    });

    const groupThreads = teams.map(team => {
      const lastMessage = latestGroupByTeam.get(team._id.toString());
      return {
        _id: team._id,
        thread_type: 'group',
        name: team.team_name,
        role: 'team',
        profile_image: '',
        last_message: lastMessage ? messagePreview(lastMessage) : '',
        last_message_at: lastMessage?.created_at || null,
        unread_count: groupMessages.filter(message => {
          const isRead = message.read_by?.some(read => read.user_id?.toString() === myId);
          return message.team_id?.toString() === team._id.toString()
            && message.sender_id?.toString() !== myId
            && !isRead;
        }).length,
      };
    });

    const threads = [...groupThreads, ...directThreads].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });

    return apiResponse.success(res, threads);
  } catch (e) { next(e); }
};

// GET /api/chat/search-users?q=
exports.searchUsers = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    if (q.trim().length < 2) return apiResponse.success(res, []);
    const users = await User.find({
      _id: { $ne: req.user._id },
      status: 'active',
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { role: { $regex: q, $options: 'i' } },
      ],
    })
      .select('name role profile_image email')
      .limit(20);
    return apiResponse.success(res, users);
  } catch (e) { next(e); }
};

// PUT /api/chat/:type/:id/read
exports.markThreadRead = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const userId = req.user._id;

    if (type === 'group') {
      const access = await getTeamAccessForUser(req.user, id);
      if (!access) return apiResponse.error(res, 'Not allowed to access this team chat', 403);
      await markMessagesRead({ team_id: id, chat_type: 'group' }, userId);
      return apiResponse.success(res, null, 'Chat marked as read');
    }

    if (type === 'direct') {
      await markMessagesRead({
        chat_type: 'individual',
        $or: [
          { sender_id: userId, receiver_id: id },
          { sender_id: id, receiver_id: userId },
        ],
      }, userId);
      return apiResponse.success(res, null, 'Chat marked as read');
    }

    return apiResponse.error(res, 'Invalid chat type', 400);
  } catch (e) { next(e); }
};
