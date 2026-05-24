const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const apiResponse = require('../utils/apiResponse');
const { upload, uploadToCloudinary } = require('../config/cloudinary');

// GET /api/users/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password_hash -refresh_token');
    if (!user) return apiResponse.error(res, 'User not found', 404);

    let profile = null;
    if (user.role === 'student') profile = await Student.findOne({ user_id: user._id });
    else if (user.role === 'faculty') profile = await Faculty.findOne({ user_id: user._id });
    else if (user.role === 'admin') profile = await Admin.findOne({ user_id: user._id });

    return apiResponse.success(res, { user: user.toSafeObject(), profile });
  } catch (error) { next(error); }
};

// PUT /api/users/me
const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, phone, ...profileData } = req.body;

    if (name) { user.name = name; }
    if (phone) { user.phone = phone; }
    await user.save({ validateBeforeSave: false });

    let profile = null;
    if (user.role === 'student') {
      profile = await Student.findOneAndUpdate(
        { user_id: user._id },
        { ...profileData, name: name || undefined },
        { new: true, runValidators: false }
      );
    } else if (user.role === 'faculty') {
      profile = await Faculty.findOneAndUpdate(
        { user_id: user._id },
        { ...profileData, name: name || undefined },
        { new: true, runValidators: false }
      );
    } else if (user.role === 'admin') {
      profile = await Admin.findOneAndUpdate(
        { user_id: user._id },
        { ...profileData, name: name || undefined },
        { new: true, runValidators: false }
      );
    }

    return apiResponse.success(res, { user: user.toSafeObject(), profile }, 'Profile updated');
  } catch (error) { next(error); }
};

// POST /api/users/me/avatar
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return apiResponse.error(res, 'No file uploaded', 400);
    const imageUrl = req.file.path || req.file.secure_url || req.file.location;
    await User.findByIdAndUpdate(req.user._id, { profile_image: imageUrl });

    // Also update role profile
    if (req.user.role === 'student') {
      await Student.findOneAndUpdate({ user_id: req.user._id }, { profile_image: imageUrl });
    } else if (req.user.role === 'faculty') {
      await Faculty.findOneAndUpdate({ user_id: req.user._id }, { profile_image: imageUrl });
    } else if (req.user.role === 'admin') {
      await Admin.findOneAndUpdate({ user_id: req.user._id }, { profile_image: imageUrl });
    }

    return apiResponse.success(res, { profile_image: imageUrl }, 'Avatar updated');
  } catch (error) { next(error); }
};

// GET /api/users/students/search?q=
const searchStudents = async (req, res, next) => {
  try {
    const { q, event_id } = req.query;
    if (!q || q.length < 2) return apiResponse.success(res, []);

    const students = await Student.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { enrollment_no: { $regex: q.toUpperCase(), $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
      status: 'active',
    })
      .select('name enrollment_no email branch semester year profile_image user_id')
      .limit(10);

    return apiResponse.success(res, students);
  } catch (error) { next(error); }
};

const getPublicProfileForUser = async (user) => {
  if (!user) return null;
  const safeUser = user.toSafeObject ? user.toSafeObject() : user;
  let profile = null;

  if (user.role === 'student') {
    profile = await Student.findOne({ user_id: user._id })
      .select('name enrollment_no email github_link linkedin_link skills branch semester year session profile_image status created_at');
  } else if (user.role === 'faculty') {
    profile = await Faculty.findOne({ user_id: user._id })
      .select('name faculty_id email department designation qualification github_link linkedin_link experience_years subjects profile_image status created_at');
  } else if (user.role === 'admin') {
    profile = await Admin.findOne({ user_id: user._id })
      .select('name employee_id email department profile_image created_at');
  }

  return {
    user: {
      _id: safeUser._id,
      name: safeUser.name,
      email: safeUser.email,
      role: safeUser.role,
      profile_image: safeUser.profile_image,
      status: safeUser.status,
      created_at: safeUser.created_at,
    },
    profile,
  };
};

// GET /api/users/search?q=
const searchPeople = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return apiResponse.success(res, []);

    const query = q.trim();
    const [users, students, faculty, admins] = await Promise.all([
      User.find({
        status: 'active',
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      }).select('name email role profile_image status created_at').limit(20),
      Student.find({
        status: 'active',
        $or: [
          { enrollment_no: { $regex: query.toUpperCase(), $options: 'i' } },
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      }).select('user_id').limit(20),
      Faculty.find({
        status: 'active',
        $or: [
          { faculty_id: { $regex: query.toUpperCase(), $options: 'i' } },
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      }).select('user_id').limit(20),
      Admin.find({
        $or: [
          { employee_id: { $regex: query, $options: 'i' } },
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      }).select('user_id').limit(20),
    ]);

    const profileUserIds = [
      ...students.map(item => item.user_id),
      ...faculty.map(item => item.user_id),
      ...admins.map(item => item.user_id),
    ].filter(Boolean);

    const profileUsers = profileUserIds.length
      ? await User.find({ _id: { $in: profileUserIds }, status: 'active' })
        .select('name email role profile_image status created_at')
      : [];

    const userMap = new Map();
    [...users, ...profileUsers].forEach(user => userMap.set(user._id.toString(), user));

    return apiResponse.success(res, [...userMap.values()].slice(0, 20).map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile_image: user.profile_image,
      status: user.status,
    })));
  } catch (error) { next(error); }
};

// GET /api/users/:id/public-profile
const getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash -refresh_token');
    if (!user || user.status !== 'active') return apiResponse.error(res, 'User not found', 404);

    const publicProfile = await getPublicProfileForUser(user);
    return apiResponse.success(res, publicProfile);
  } catch (error) { next(error); }
};

// GET /api/users/faculty/all
const getAllFaculty = async (req, res, next) => {
  try {
    const faculty = await Faculty.find({ status: 'active' })
      .select('name faculty_id email department designation profile_image')
      .limit(100);
    return apiResponse.success(res, faculty);
  } catch (error) { next(error); }
};

module.exports = { getMe, updateMe, uploadAvatar, searchStudents, searchPeople, getPublicProfile, getAllFaculty };
