const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Student = require('./models/Student');
const Team = require('./models/Team');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const teamRoutes = require('./routes/teams');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const chatRoutes = require('./routes/chat');
const publicRoutes = require('./routes/public');
const projectRoutes = require('./routes/projects');
const aiRoutes = require('./routes/ai');
const integrationRoutes = require('./routes/integrations');
const analyticsRoutes = require('./routes/analytics');
const videoRoutes = require('./routes/video');
const vivaRoutes = require('./routes/viva');
const portfolioRoutes = require('./routes/portfolio');
const reportRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');
const hackathonRoutes = require('./routes/hackathons');
const { errorHandler } = require('./middleware/errorHandler');
const { initRealtime } = require('./utils/realtime');

const app = express();
const server = http.createServer(app);
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

// Render/NGINX proxy ke peeche real client IP trust karna zaroori hai (rate-limit ke liye)
app.set('trust proxy', 1);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available to routes
app.set('io', io);

// Socket.io namespaces
const groupChat = io.of('/group-chat');
const directChat = io.of('/direct-chat');

const getSocketToken = (socket) => {
  if (socket.handshake.auth?.token) return socket.handshake.auth.token;
  const cookieHeader = socket.handshake.headers?.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const socketAuth = async (socket, next) => {
  try {
    const token = getSocketToken(socket);
    if (!token) return next(new Error('Not authenticated'));
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('_id name role status');
    if (!user || user.status === 'inactive' || user.status === 'suspended') {
      return next(new Error('Not authorized'));
    }
    socket.user = user;
    return next();
  } catch (_) {
    return next(new Error('Not authenticated'));
  }
};

const canJoinTeamRoom = async (userId, teamId) => {
  const user = await User.findById(userId).select('_id role');
  if (!user) return false;
  if (user.role !== 'student') return false;
  const student = await Student.findOne({ user_id: userId });
  if (!student) return false;
  return Boolean(await Team.exists({
    _id: teamId,
    members: { $elemMatch: { student_id: student._id, status: 'accepted' } },
  }));
};

groupChat.use(socketAuth);
directChat.use(socketAuth);

initRealtime(io, socketAuth);

groupChat.on('connection', (socket) => {
  socket.on('join_room', async (teamId) => {
    if (await canJoinTeamRoom(socket.user._id, teamId)) socket.join(teamId);
  });
  socket.on('send_message', async (data) => {
    if (await canJoinTeamRoom(socket.user._id, data.team_id)) {
      groupChat.to(data.team_id).emit('receive_message', data);
    }
  });
  socket.on('delete_message', async (data) => {
    if (await canJoinTeamRoom(socket.user._id, data.team_id)) {
      groupChat.to(data.team_id).emit('message_deleted', data);
    }
  });
  socket.on('typing', async (data) => {
    if (await canJoinTeamRoom(socket.user._id, data.team_id)) {
      socket.to(data.team_id).emit('typing', {
        ...data,
        userId: socket.user._id,
        userName: data.userName || socket.user.name,
      });
    }
  });
  socket.on('stop_typing', async (data) => {
    if (await canJoinTeamRoom(socket.user._id, data.team_id)) {
      socket.to(data.team_id).emit('stop_typing', {
        ...data,
        userId: socket.user._id,
      });
    }
  });
});

directChat.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    if (String(roomId).split('_').includes(socket.user._id.toString())) socket.join(roomId);
  });
  socket.on('send_message', (data) => {
    if (String(data.room_id).split('_').includes(socket.user._id.toString())) {
      directChat.to(data.room_id).emit('receive_message', data);
    }
  });
  socket.on('delete_message', (data) => {
    if (String(data.room_id).split('_').includes(socket.user._id.toString())) {
      directChat.to(data.room_id).emit('message_deleted', data);
    }
  });
  socket.on('typing', (data) => {
    if (String(data.room_id).split('_').includes(socket.user._id.toString())) {
      socket.to(data.room_id).emit('typing', {
        ...data,
        userId: socket.user._id,
        userName: data.userName || socket.user.name,
      });
    }
  });
  socket.on('stop_typing', (data) => {
    if (String(data.room_id).split('_').includes(socket.user._id.toString())) {
      socket.to(data.room_id).emit('stop_typing', {
        ...data,
        userId: socket.user._id,
      });
    }
  });
});

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(mongoSanitize());

// CORS
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Rate limit
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/viva', vivaRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/hackathons', hackathonRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ success: true, message: 'ProjectHub API running', timestamp: new Date() }));

const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, () => console.log(`🚀 ProjectHub server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
