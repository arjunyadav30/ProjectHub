const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Team = require('../models/Team');
const Marks = require('../models/Marks');
const WebsiteConfig = require('../models/WebsiteConfig');
const apiResponse = require('../utils/apiResponse');
const { sendCredentialsEmail } = require('../utils/sendEmail');
const { createNotification } = require('../utils/notifications');
const { notifyTeamStakeholders, notifyEventUpdate } = require('../utils/realtime');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const normalizeMarksPayload = (m = {}) => {
  const labelMarks = Array.isArray(m.label_marks)
    ? m.label_marks.map(label => {
      const marksOutOf = Math.max(1, Number(label.marks_out_of) || 100);
      const rawMarks = m.attendance === 'absent' ? 0 : Number(label.marks) || 0;
      return {
        label_id: label.label_id || null,
        label: String(label.label || 'Presentation').trim(),
        marks: Math.min(marksOutOf, Math.max(0, rawMarks)),
        marks_out_of: marksOutOf,
        weight_percent: Math.min(100, Math.max(0, Number(label.weight_percent) || 0)),
        feedback: String(label.feedback || '').trim(),
      };
    })
    : [{
      label_id: null,
      label: m.marks_label || 'Presentation',
      marks: m.attendance === 'absent' ? 0 : Math.max(0, Number(m.presentation_marks) || 0),
      marks_out_of: Math.max(1, Number(m.marks_out_of) || 100),
    }];
  const totalMarks = labelMarks.reduce((sum, label) => sum + label.marks, 0);
  const totalOutOf = labelMarks.reduce((sum, label) => sum + label.marks_out_of, 0) || 100;
  return {
    ...m,
    presentation_id: m.presentation_id || null,
    presentation_title: m.presentation_title || m.marks_label || 'Presentation',
    label_marks: labelMarks,
    presentation_marks: totalMarks,
    marks_out_of: totalOutOf,
    marks_label: m.presentation_title || m.marks_label || 'Presentation',
    attendance: m.attendance || 'not_marked',
  };
};

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
};

const createProjectHubUserPayload = (payload) => ({
  ...payload,
  auth_scope: 'projecthub',
});

const normalizeImportRow = (row = {}) => {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const cleanKey = String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
    normalized[cleanKey] = typeof value === 'string' ? value.trim() : value;
  });

  return {
    name: normalized.name || normalized.full_name || '',
    email: String(normalized.email || normalized.email_id || normalized.mail || '').trim().toLowerCase(),
    enrollment_no: String(normalized.enrollment_no || normalized.enrollment || normalized.enrollment_number || '').trim().toUpperCase(),
    faculty_id: String(normalized.faculty_id || normalized.employee_id || normalized.faculty_code || '').trim().toUpperCase(),
    branch: normalized.branch || '',
    semester: normalized.semester || '',
    year: normalized.year || '',
    session: normalized.session || '',
    department: normalized.department || '',
    designation: normalized.designation || '',
    phone: normalized.phone || normalized.mobile || '',
  };
};

const sendCredentialsAndTrack = async (results, email, name, tempPassword) => {
  const attempts = 2;
  let lastError = null;

  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await sendCredentialsEmail(email, name, email, tempPassword);
        if (results) results.emailsSent++;
        return { sent: true };
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    throw lastError;
  } catch (err) {
    console.error(`Failed to send credentials email to ${email}:`, err.message);
    if (results) {
      results.emailsFailed++;
      results.emailErrors.push({ email, reason: err.message });
    }
    return { sent: false, reason: err.message };
  }
};

// --- STUDENT MANAGEMENT ------------------------------------------------

// GET /api/admin/students
exports.getStudents = async (req, res, next) => {
  try {
    const { branch, semester, year, status, search, page = 1, limit = 10 } = req.query;
    const filter = { college_id: req.user.college_id };
    if (branch) filter.branch = branch;
    if (semester) filter.semester = parseInt(semester);
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { enrollment_no: { $regex: search.toUpperCase(), $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      Student.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)),
      Student.countDocuments(filter),
    ]);
    return apiResponse.success(res, {
      students,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (e) { next(e); }
};

// POST /api/admin/students
exports.addStudent = async (req, res, next) => {
  try {
    const { name, email, enrollment_no, branch, semester, year, session, phone } = req.body;
    const existing = await User.findOne({ email, auth_scope: 'projecthub' });
    if (existing) return apiResponse.error(res, 'Email already registered', 409);

    if (!name || !email) {
      return apiResponse.error(res, 'Name and email are required', 400);
    }

    if (enrollment_no) {
      const existingEnroll = await Student.findOne({ enrollment_no: enrollment_no.toUpperCase(), college_id: req.user.college_id });
      if (existingEnroll) return apiResponse.error(res, 'Enrollment number already exists', 409);
    }

    const tempPassword = generateTempPassword();
    const user = await User.create(createProjectHubUserPayload({ name, email, password_hash: tempPassword, role: 'student', phone: phone || '', college_id: req.user.college_id }));
    const finalEnrollment = enrollment_no || `TEMP${Date.now()}${Math.floor(Math.random() * 100)}`;
    const student = await Student.create({
      college_id: req.user.college_id,
      user_id: user._id, enrollment_no: finalEnrollment.toUpperCase(),
      name, email, branch: branch || '', semester: semester || null,
      year: year || null, session: session || '', phone: phone || '',
    });

    const emailStatus = await sendCredentialsAndTrack(null, email, name, tempPassword);

    return apiResponse.created(res, { user: user.toSafeObject(), student, emailStatus }, 'Student added successfully');
  } catch (e) { next(e); }
};

// POST /api/admin/students/bulk-import
exports.bulkImportStudents = async (req, res, next) => {
  try {
    const { students } = req.body; // Array of { name, email, enrollment_no?, branch?, semester? }
    if (!Array.isArray(students) || students.length === 0) {
      return apiResponse.error(res, 'No student data provided', 400);
    }

    const results = { created: 0, failed: [], total: students.length, emailsSent: 0, emailsFailed: 0, emailErrors: [] };

    for (const row of students) {
      let session;
      try {
        const { name, email, enrollment_no, branch, semester, year, session: academicSession, phone } = normalizeImportRow(row);
        if (!name || !email) { results.failed.push({ email, reason: 'Name and email required' }); continue; }

        const existingUser = await User.findOne({ email, auth_scope: 'projecthub' });
        if (existingUser) { results.failed.push({ email, reason: 'Email exists' }); continue; }

        session = await mongoose.startSession();
        session.startTransaction();

        const tempPassword = generateTempPassword();
        const user = await User.create([createProjectHubUserPayload({
          name, email, password_hash: tempPassword, role: 'student', college_id: req.user.college_id,
        })], { session });

        const finalEnrollment = enrollment_no || `TEMP${Date.now()}${Math.floor(Math.random() * 100)}`;
        await Student.create([{
          college_id: req.user.college_id,
          user_id: user[0]._id, enrollment_no: finalEnrollment.toUpperCase(),
          name, email, branch: branch || '', semester: semester || null,
          year: year || null, session: academicSession || '', phone: phone || '',
        }], { session });

        await session.commitTransaction();
        results.created++;

        await sendCredentialsAndTrack(results, email, name, tempPassword);
      } catch (err) {
        results.failed.push({ email: row.email, reason: err.message });
        if (session?.inTransaction()) await session.abortTransaction();
      } finally {
        if (session) await session.endSession();
      }
    }

    return apiResponse.success(res, results, `${results.created} students created`);
  } catch (e) { next(e); }
};

// PUT /api/admin/students/:id
exports.updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findOneAndUpdate({ _id: req.params.id, college_id: req.user.college_id }, req.body, { new: true, runValidators: true });
    if (!student) return apiResponse.error(res, 'Student not found', 404);
    return apiResponse.success(res, student, 'Student updated');
  } catch (e) { next(e); }
};

// DELETE /api/admin/students/:id (soft delete)
exports.deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findOneAndUpdate({ _id: req.params.id, college_id: req.user.college_id }, { status: 'inactive' }, { new: true });
    if (!student) return apiResponse.error(res, 'Student not found', 404);
    await User.findByIdAndUpdate(student.user_id, { status: 'inactive' });
    return apiResponse.success(res, null, 'Student deactivated');
  } catch (e) { next(e); }
};

// PUT /api/admin/students/promote
exports.promoteStudents = async (req, res, next) => {
  try {
    const { from_semester, to_semester } = req.body;
    if (!from_semester || !to_semester) return apiResponse.error(res, 'from_semester and to_semester required', 400);
    const result = await Student.updateMany(
      { semester: parseInt(from_semester), status: 'active', college_id: req.user.college_id },
      { semester: parseInt(to_semester), year: Math.ceil(parseInt(to_semester) / 2) }
    );

    // Send notifications
    const students = await Student.find({ semester: parseInt(to_semester), status: 'active', college_id: req.user.college_id });
    for (const s of students.slice(0, 50)) { // limit batch
      await createNotification({
        recipient: s.user_id, type: 'semester_promoted',
        title: 'Semester Promoted',
        message: `You have been promoted from Semester ${from_semester} to Semester ${to_semester}`,
      });
    }

    return apiResponse.success(res, { modified: result.modifiedCount }, `${result.modifiedCount} students promoted`);
  } catch (e) { next(e); }
};

// GET /api/admin/students/export
exports.exportStudents = async (req, res, next) => {
  try {
    const { branch, semester, year } = req.query;
    const filter = { college_id: req.user.college_id };
    if (branch) filter.branch = branch;
    if (semester) filter.semester = parseInt(semester);
    if (year) filter.year = parseInt(year);

    const students = await Student.find(filter).sort({ enrollment_no: 1 });
    let csv = 'Enrollment No,Name,Email,Branch,Semester,Year,Session,Phone,Status\n';
    students.forEach(s => {
      csv += `"${s.enrollment_no}","${s.name}","${s.email}","${s.branch}","${s.semester || ''}","${s.year || ''}","${s.session || ''}","${s.phone}","${s.status}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    return res.send(csv);
  } catch (e) { next(e); }
};

// --- FACULTY MANAGEMENT ------------------------------------------------

exports.getFaculty = async (req, res, next) => {
  try {
    const { department, status, search, page = 1, limit = 10 } = req.query;
    const filter = { college_id: req.user.college_id };
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { faculty_id: { $regex: search.toUpperCase(), $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [faculty, total] = await Promise.all([
      Faculty.find(filter).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit)),
      Faculty.countDocuments(filter),
    ]);
    return apiResponse.success(res, { faculty, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e) { next(e); }
};

exports.addFaculty = async (req, res, next) => {
  try {
    const { name, email, faculty_id, department, designation, phone } = req.body;
    const existing = await User.findOne({ email, auth_scope: 'projecthub' });
    if (existing) return apiResponse.error(res, 'Email already registered', 409);

    const tempPassword = generateTempPassword();
    const user = await User.create(createProjectHubUserPayload({ name, email, password_hash: tempPassword, role: 'faculty', phone: phone || '', college_id: req.user.college_id }));
    const faculty = await Faculty.create({
      college_id: req.user.college_id,
      user_id: user._id, faculty_id: (faculty_id || `FAC${Date.now()}`).toUpperCase(),
      name, email, department: department || '', designation: designation || '', phone: phone || '',
    });

    const emailStatus = await sendCredentialsAndTrack(null, email, name, tempPassword);
    return apiResponse.created(res, { user: user.toSafeObject(), faculty, emailStatus }, 'Faculty added');
  } catch (e) { next(e); }
};

exports.bulkImportFaculty = async (req, res, next) => {
  try {
    const { faculty: facultyList } = req.body;
    if (!Array.isArray(facultyList) || facultyList.length === 0) return apiResponse.error(res, 'No data provided', 400);

    const results = { created: 0, failed: [], total: facultyList.length, emailsSent: 0, emailsFailed: 0, emailErrors: [] };
    for (const row of facultyList) {
      let session;
      try {
        const { name, email, faculty_id, department, designation, phone } = normalizeImportRow(row);
        if (!name || !email) { results.failed.push({ email, reason: 'Name/email required' }); continue; }
        const exists = await User.findOne({ email, auth_scope: 'projecthub' });
        if (exists) { results.failed.push({ email, reason: 'Email exists' }); continue; }

        session = await mongoose.startSession();
        session.startTransaction();

        const tempPassword = generateTempPassword();
        const user = await User.create([createProjectHubUserPayload({
          name, email, password_hash: tempPassword, role: 'faculty', phone: phone || '', college_id: req.user.college_id,
        })], { session });
        await Faculty.create([{
          college_id: req.user.college_id,
          user_id: user[0]._id, faculty_id: (faculty_id || `FAC${Date.now()}${Math.floor(Math.random()*100)}`).toUpperCase(),
          name, email, department: department || '', designation: designation || '', phone: phone || '',
        }], { session });

        await session.commitTransaction();
        results.created++;

        await sendCredentialsAndTrack(results, email, name, tempPassword);
      } catch (err) {
        results.failed.push({ email: row.email, reason: err.message });
        if (session?.inTransaction()) await session.abortTransaction();
      } finally {
        if (session) await session.endSession();
      }
    }
    return apiResponse.success(res, results, `${results.created} faculty created`);
  } catch (e) { next(e); }
};

exports.updateFaculty = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOneAndUpdate({ _id: req.params.id, college_id: req.user.college_id }, req.body, { new: true });
    if (!faculty) return apiResponse.error(res, 'Faculty not found', 404);
    return apiResponse.success(res, faculty, 'Faculty updated');
  } catch (e) { next(e); }
};

exports.deleteFaculty = async (req, res, next) => {
  try {
    const faculty = await Faculty.findOneAndUpdate({ _id: req.params.id, college_id: req.user.college_id }, { status: 'inactive' }, { new: true });
    if (!faculty) return apiResponse.error(res, 'Faculty not found', 404);
    await User.findByIdAndUpdate(faculty.user_id, { status: 'inactive' });
    return apiResponse.success(res, null, 'Faculty deactivated');
  } catch (e) { next(e); }
};

// --- DASHBOARD STATS ---------------------------------------------------

exports.getDashboardStats = async (req, res, next) => {
  try {
    const [totalStudents, totalFaculty, totalEvents, activeTeams] = await Promise.all([
      Student.countDocuments({ status: 'active', college_id: req.user.college_id }),
      Faculty.countDocuments({ status: 'active', college_id: req.user.college_id }),
      Event.countDocuments({ college_id: req.user.college_id }),
      Team.countDocuments({ registration_status: 'approved', college_id: req.user.college_id }),
    ]);
    return apiResponse.success(res, { totalStudents, totalFaculty, totalEvents, activeTeams });
  } catch (e) { next(e); }
};

// --- WEBSITE CONFIG ----------------------------------------------------

exports.getWebsiteConfig = async (req, res, next) => {
  try {
    let config = await WebsiteConfig.findOne({ college_id: req.user.college_id });
    if (!config) config = await WebsiteConfig.create({ college_id: req.user.college_id, site_name: 'ProjectHub' });
    return apiResponse.success(res, config);
  } catch (e) { next(e); }
};

exports.updateWebsiteConfig = async (req, res, next) => {
  try {
    const { logo_url, hero_image_url, site_name } = req.body;
    let config = await WebsiteConfig.findOne({ college_id: req.user.college_id });
    if (!config) config = new WebsiteConfig({ college_id: req.user.college_id });
    if (logo_url !== undefined) config.logo_url = logo_url;
    if (hero_image_url !== undefined) config.hero_image_url = hero_image_url;
    if (site_name) config.site_name = site_name;
    config.updated_by = req.user._id;
    await config.save();
    return apiResponse.success(res, config, 'Website config updated');
  } catch (e) { next(e); }
};

exports.updateCollege = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();

    if (!name) return apiResponse.error(res, 'College name is required', 400);
    if (!code) return apiResponse.error(res, 'College code is required', 400);

    const existing = await College.findOne({ code, _id: { $ne: req.user.college_id } });
    if (existing) return apiResponse.error(res, 'College code already exists', 409);

    const college = await College.findByIdAndUpdate(
      req.user.college_id,
      { name, code },
      { new: true, runValidators: true }
    ).select('name code logo');

    if (!college) return apiResponse.error(res, 'College not found', 404);
    return apiResponse.success(res, college, 'College updated');
  } catch (e) { next(e); }
};

// --- FEATURED PROJECTS -------------------------------------------------

exports.featureProject = async (req, res, next) => {
  try {
    const { team_id, deployed_link } = req.body;
    const team = await Team.findOne({ _id: team_id, college_id: req.user.college_id }).populate('event_id');
    if (!team) return apiResponse.error(res, 'Team not found', 404);

    let config = await WebsiteConfig.findOne({ college_id: req.user.college_id });
    if (!config) config = new WebsiteConfig({ college_id: req.user.college_id });

    // Remove if already featured
    config.featured_projects = config.featured_projects.filter(fp => fp.project_id?.toString() !== team_id);
    config.featured_projects.push({
      project_id: team._id,
      deployed_link: deployed_link || team.project?.live_link || '',
      title: team.project?.title || team.team_name,
    });
    await config.save();

    // Also add to event's featured list
    await Event.findOneAndUpdate({ _id: team.event_id._id, college_id: req.user.college_id }, {
      $push: { featured_projects: { project_id: team._id, deployed_link: deployed_link || '', title: team.project?.title || team.team_name } },
    });

    notifyTeamStakeholders(team_id).catch(() => {});
    notifyEventUpdate(team.event_id._id).catch(() => {});

    return apiResponse.success(res, config, 'Project featured on homepage');
  } catch (e) { next(e); }
};

exports.unfeatureProject = async (req, res, next) => {
  try {
    const { team_id } = req.params;
    const config = await WebsiteConfig.findOne({ college_id: req.user.college_id });
    if (config) {
      config.featured_projects = config.featured_projects.filter(fp => fp.project_id?.toString() !== team_id);
      await config.save();
    }
    return apiResponse.success(res, null, 'Project removed from featured');
  } catch (e) { next(e); }
};

// --- MARKS MANAGEMENT --------------------------------------------------

exports.getTeamMarks = async (req, res, next) => {
  try {
    const marks = await Marks.find({ team_id: req.params.teamId, college_id: req.user.college_id })
      .populate('student_id', 'name enrollment_no')
      .populate('awarded_by', 'name');
    return apiResponse.success(res, marks);
  } catch (e) { next(e); }
};

exports.giveMarks = async (req, res, next) => {
  try {
    const { team_id, event_id, marks_data } = req.body;
    const results = [];
    for (const m of marks_data) {
      const normalized = normalizeMarksPayload(m);
      const existing = await Marks.findOneAndUpdate(
        { team_id, event_id, student_id: m.student_id, presentation_id: normalized.presentation_id, college_id: req.user.college_id },
        { ...normalized, college_id: req.user.college_id, team_id, event_id, student_id: m.student_id, awarded_by: req.user._id },
        { upsert: true, new: true }
      );
      results.push(existing);

      // Notify student
      const student = await require('../models/Student').findOne({ _id: m.student_id, college_id: req.user.college_id });
      if (student) {
        await createNotification({
          recipient: student.user_id,
          type: 'marks_added', title: 'Marks Published',
          message: `Your marks have been updated: ${normalized.presentation_marks}/${normalized.marks_out_of}`,
          reference_id: team_id, reference_type: 'Team',
        });
      }
    }
    notifyTeamStakeholders(team_id).catch(() => {});
    return apiResponse.success(res, results, 'Marks saved');
  } catch (e) { next(e); }
};

// --- UNREGISTERED STUDENTS FOR EVENT ----------------------------------

exports.getUnregisteredStudents = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);

    // Get all teams in this event
    const teams = await Team.find({ event_id: event._id, college_id: req.user.college_id });
    const registeredStudentIds = new Set();
    teams.forEach(team => {
      team.members.forEach(m => registeredStudentIds.add(m.student_id.toString()));
    });

    // Build filter for eligible students
    const filter = { status: 'active', college_id: req.user.college_id };
    if (event.allowed_semesters?.length > 0) filter.semester = { $in: event.allowed_semesters };
    if (event.allowed_branches?.length > 0) filter.branch = { $in: event.allowed_branches };

    const allEligible = await Student.find(filter);
    const unregistered = allEligible.filter(s => !registeredStudentIds.has(s._id.toString()));

    return apiResponse.success(res, unregistered);
  } catch (e) { next(e); }
};

exports.exportUnregisteredStudents = async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, college_id: req.user.college_id });
    if (!event) return apiResponse.error(res, 'Event not found', 404);

    const teams = await Team.find({ event_id: event._id, college_id: req.user.college_id });
    const registeredStudentIds = new Set();
    teams.forEach(t => t.members.forEach(m => registeredStudentIds.add(m.student_id.toString())));

    const filter = { status: 'active', college_id: req.user.college_id };
    if (event.allowed_semesters?.length > 0) filter.semester = { $in: event.allowed_semesters };

    const allEligible = await Student.find(filter);
    const unregistered = allEligible.filter(s => !registeredStudentIds.has(s._id.toString()));

    let csv = 'Enrollment No,Name,Email,Branch,Semester,Year,Phone\n';
    unregistered.forEach(s => {
      csv += `"${s.enrollment_no}","${s.name}","${s.email}","${s.branch}","${s.semester || ''}","${s.year || ''}","${s.phone}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="unregistered-${event.title}.csv"`);
    return res.send(csv);
  } catch (e) { next(e); }
};

// --- CSV TEMPLATE DOWNLOAD --------------------------------------------

exports.downloadStudentTemplate = (req, res) => {
  const csv = 'name,email,enrollment_no,branch,semester,year,session,phone\nJohn Doe,john@example.com,0201CS21001,CSE,3,2,2021-25,9876543210\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.csv"');
  return res.send(csv);
};

exports.downloadFacultyTemplate = (req, res) => {
  const csv = 'name,email,faculty_id,department,designation,phone\nProf. Jane,jane@example.com,FAC001,Computer Science,Assistant Professor,9876543210\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="faculty-import-template.csv"');
  return res.send(csv);
};
