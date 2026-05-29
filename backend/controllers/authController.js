const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const College = require('../models/College');
const Subscription = require('../models/Subscription');
const apiResponse = require('../utils/apiResponse');
const {
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/generateTokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');

const getCollegeSummary = async (collegeId) => {
  if (!collegeId) return null;
  return College.findById(collegeId).select('name code logo');
};

// POST /api/auth/signup
const signup = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, enrollment_no, branch, faculty_id, department, college_name, college_code } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return apiResponse.error(res, 'Email already registered', 409);

    let collegeId = null;
    let normalizedCode = college_code ? String(college_code).trim().toUpperCase() : '';

    if (role === 'admin') {
      if (!college_name) return apiResponse.error(res, 'College name is required for admin signup', 400);
      if (!normalizedCode) normalizedCode = `CLG${Date.now().toString().slice(-6)}`;
      const existingCollege = await College.findOne({ code: normalizedCode });
      if (existingCollege) return apiResponse.error(res, 'College code already exists', 409);
      const college = await College.create({ name: college_name, code: normalizedCode });
      collegeId = college._id;
    } else if (role === 'student' || role === 'faculty') {
      if (!normalizedCode) return apiResponse.error(res, 'College code is required', 400);
      const college = await College.findOne({ code: normalizedCode });
      if (!college) return apiResponse.error(res, 'Invalid college code', 404);
      collegeId = college._id;
    } else if (role === 'hackathon_admin' || role === 'hackathon_user') {
      collegeId = null;
    }

    const user = await User.create({
      name, email, password_hash: password, role: role || 'student',
      phone: phone || '',
      college_id: collegeId,
    });

    if (role === 'student') {
      if (!enrollment_no) { await User.findByIdAndDelete(user._id); return apiResponse.error(res, 'Enrollment number required', 400); }
      const existingEnroll = await Student.findOne({ enrollment_no: enrollment_no.toUpperCase(), college_id: collegeId });
      if (existingEnroll) { await User.findByIdAndDelete(user._id); return apiResponse.error(res, 'Enrollment number already registered', 409); }
      await Student.create({ user_id: user._id, college_id: collegeId, enrollment_no: enrollment_no.toUpperCase(), name, email, branch: branch || '' });
    } else if (role === 'faculty') {
      if (!faculty_id) { await User.findByIdAndDelete(user._id); return apiResponse.error(res, 'Faculty ID required', 400); }
      const existingFaculty = await Faculty.findOne({ faculty_id: faculty_id.toUpperCase(), college_id: collegeId });
      if (existingFaculty) { await User.findByIdAndDelete(user._id); return apiResponse.error(res, 'Faculty ID already registered', 409); }
      await Faculty.create({ user_id: user._id, college_id: collegeId, faculty_id: faculty_id.toUpperCase(), name, email, department: department || '' });
    } else if (role === 'admin') {
      await Admin.create({ user_id: user._id, college_id: collegeId, name, email, phone: phone || '' });
      await Subscription.create({
        college_id: collegeId,
        admin_id: user._id,
        status: 'trial',
        plan: 'monthly',
        started_at: new Date(),
        expires_at: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)),
        amount_paid: 0,
      });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refresh_token = refreshToken;
    await user.save({ validateBeforeSave: false });
    setRefreshTokenCookie(res, refreshToken);

    let profile = null;
    if (role === 'student') profile = await Student.findOne({ user_id: user._id });
    else if (role === 'faculty') profile = await Faculty.findOne({ user_id: user._id });
    else if (role === 'admin') profile = await Admin.findOne({ user_id: user._id });

    const college = await getCollegeSummary(user.college_id);

    return apiResponse.created(res, { user: user.toSafeObject(), profile, college, accessToken }, 'Registration successful');
  } catch (error) { next(error); }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, enrollment_no, password } = req.body;

    let user;
    if (enrollment_no) {
      // Student login with enrollment number
      const student = await Student.findOne({ enrollment_no: enrollment_no.toUpperCase() });
      if (!student) return apiResponse.error(res, 'Invalid credentials', 401);
      user = await User.findById(student.user_id);
    } else {
      user = await User.findOne({ email });
    }

    if (!user) return apiResponse.error(res, 'Invalid credentials', 401);
    if (user.status === 'suspended') return apiResponse.error(res, 'Account suspended. Contact admin.', 403);
    if (user.status === 'inactive') return apiResponse.error(res, 'Account inactive. Contact admin.', 403);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return apiResponse.error(res, 'Invalid credentials', 401);

    user.last_login = new Date();
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    user.refresh_token = refreshToken;
    await user.save({ validateBeforeSave: false });
    setRefreshTokenCookie(res, refreshToken);

    let profile = null;
    if (user.role === 'student') profile = await Student.findOne({ user_id: user._id });
    else if (user.role === 'faculty') profile = await Faculty.findOne({ user_id: user._id });
    else if (user.role === 'admin') profile = await Admin.findOne({ user_id: user._id });

    let needs_verification = false;
    if (user.role === 'student') {
      const isPasswordChanged = !!user.password_changed_at;
      const isProfileComplete = profile?.is_profile_complete || false;
      needs_verification = !isPasswordChanged || !isProfileComplete;
    }

    const college = await getCollegeSummary(user.college_id);

    return apiResponse.success(res, { user: user.toSafeObject(), profile, college, accessToken, needs_verification }, 'Login successful');
  } catch (error) { next(error); }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) { user.refresh_token = null; await user.save({ validateBeforeSave: false }); }
    clearRefreshTokenCookie(res);
    return apiResponse.success(res, null, 'Logged out successfully');
  } catch (error) { next(error); }
};

// POST /api/auth/change-password (student 2-step step 1)
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) return apiResponse.error(res, 'Current password is incorrect', 400);
    user.password_hash = new_password;
    user.password_changed_at = new Date();
    await user.save();
    return apiResponse.success(res, null, 'Password changed successfully');
  } catch (error) { next(error); }
};

// POST /api/auth/complete-profile (student 2-step step 2)
const completeProfile = async (req, res, next) => {
  try {
    const { semester, year, branch, session, enrollment_no, phone, dob, gender, address, guardian_name, guardian_phone, skills } = req.body;
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return apiResponse.error(res, 'Student not found', 404);

    Object.assign(student, {
      semester: semester || student.semester,
      year: year || student.year,
      branch: branch || student.branch,
      session: session || student.session,
      enrollment_no: enrollment_no ? enrollment_no.toUpperCase() : student.enrollment_no,
      phone: phone || student.phone,
      dob: dob || student.dob,
      gender: gender || student.gender,
      address: address || student.address,
      guardian_name: guardian_name || student.guardian_name,
      guardian_phone: guardian_phone || student.guardian_phone,
      skills: skills || student.skills,
      is_profile_complete: true,
    });
    await student.save();

    // Mark user as verified
    await User.findByIdAndUpdate(req.user._id, { is_verified: true });

    return apiResponse.success(res, student, 'Profile completed');
  } catch (error) { next(error); }
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return apiResponse.error(res, 'No refresh token', 401);
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refresh_token !== token) return apiResponse.error(res, 'Invalid refresh token', 401);
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refresh_token = newRefreshToken;
    await user.save({ validateBeforeSave: false });
    setRefreshTokenCookie(res, newRefreshToken);
    return apiResponse.success(res, { accessToken: newAccessToken }, 'Token refreshed');
  } catch (error) { return apiResponse.error(res, 'Invalid or expired refresh token', 401); }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return apiResponse.success(res, null, 'If this email exists, a reset link has been sent.');
    const resetToken = generateRandomToken();
    user.reset_password_token = resetToken;
    user.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    try { await sendPasswordResetEmail(email, user.name, resetToken); } catch (_) {}
    return apiResponse.success(res, null, 'Password reset email sent.');
  } catch (error) { next(error); }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      $or: [
        { reset_password_token: token, reset_password_expires: { $gt: Date.now() } },
        { password_reset_token: token, password_reset_expires: { $gt: Date.now() } },
      ],
    });
    if (!user) return apiResponse.error(res, 'Invalid or expired reset token', 400);
    user.password_hash = password;
    user.reset_password_token = undefined;
    user.reset_password_expires = undefined;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    user.refresh_token = null;
    await user.save();
    clearRefreshTokenCookie(res);
    return apiResponse.success(res, null, 'Password reset successful. Please login.');
  } catch (error) { next(error); }
};

module.exports = { signup, login, logout, refreshToken, forgotPassword, resetPassword, changePassword, completeProfile };
