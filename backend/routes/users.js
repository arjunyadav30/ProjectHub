const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { getMe, updateMe, uploadAvatar, searchStudents, searchPeople, getPublicProfile, getAllFaculty } = require('../controllers/userController');
const Marks = require('../models/Marks');
const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');

router.use(protect);

router.get('/me', getMe);
router.put('/me', updateMe);
router.post('/me/avatar', upload?.single('avatar') || ((req, res, next) => next()), uploadAvatar);
router.get('/search', searchPeople);
router.get('/:id/public-profile', getPublicProfile);
router.get('/students/search', searchStudents);
router.get('/faculty/all', getAllFaculty);

// GET /api/users/student/marks — student's own marks across all events
router.get('/student/marks', async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return apiResponse.error(res, 'Student not found', 404);
    const marks = await Marks.find({ student_id: student._id })
      .populate('event_id', 'title')
      .populate('team_id', 'team_name')
      .populate('awarded_by', 'name')
      .sort({ created_at: -1 });
    return apiResponse.success(res, marks);
  } catch (e) { next(e); }
});

module.exports = router;
