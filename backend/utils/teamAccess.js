const Faculty = require('../models/Faculty');
const Student = require('../models/Student');

/**
 * Resolves what the current user is allowed to do for a team.
 * Always scoped to the user's college.
 */
const getTeamAccess = async (user, team) => {
  const sameCollege = team.college_id?.toString() === user.college_id?.toString();
  const base = { sameCollege, isAdmin: false, isMentor: false, isMember: false, faculty: null, student: null };
  if (!sameCollege) return base;

  const isAdmin = user.role === 'admin';
  let faculty = null;
  let student = null;
  if (user.role === 'faculty') faculty = await Faculty.findOne({ user_id: user._id }).select('_id');
  if (user.role === 'student') student = await Student.findOne({ user_id: user._id }).select('_id');

  const isMentor = !!(faculty && team.assigned_faculty?.toString() === faculty._id.toString() && team.mentor_status === 'accepted');
  const isMember = !!(student && team.members?.some((m) => (m.student_id?._id || m.student_id)?.toString() === student._id.toString() && m.status === 'accepted'));
  return { sameCollege, isAdmin, isMentor, isMember, faculty, student };
};

const canManageEvent = (user, event) => (
  event.college_id?.toString() === user.college_id?.toString()
  && (user.role === 'admin' || (user.role === 'faculty' && event.created_by?.toString() === user._id.toString()))
);

module.exports = { getTeamAccess, canManageEvent };
