const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');

const TRENDING = [
  { title: 'AI Attendance Assistant', branch: 'CSE', difficulty: 'medium', stack: ['Node.js', 'React', 'MongoDB', 'Face Recognition'] },
  { title: 'Smart Energy Monitor', branch: 'EE', difficulty: 'hard', stack: ['IoT', 'Python', 'React'] },
  { title: 'Campus AR Navigation', branch: 'IT', difficulty: 'hard', stack: ['Unity', 'Node.js', 'Maps API'] },
  { title: 'Microservice Library Portal', branch: 'CSE', difficulty: 'medium', stack: ['Express', 'Redis', 'MongoDB'] },
];

const makeAbstract = ({ title, stack, branch, interests = [] }) => {
  const interestText = interests.length ? `with a focus on ${interests.join(', ')}` : 'focused on real-world impact';
  return `${title} is a ${branch} aligned project ${interestText}. It uses ${stack.join(', ')} to build a scalable solution with measurable outcomes and deployment-ready architecture.`;
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const { difficulty = 'all' } = req.query;
    const student = await Student.findOne({ user_id: req.user._id }).lean();
    if (!student) return apiResponse.error(res, 'Student profile not found', 404);

    const interests = (student.skills || []).slice(0, 5);
    const branch = student.branch || 'CSE';

    const suggestions = TRENDING
      .filter((item) => item.branch === branch || item.branch === 'CSE')
      .filter((item) => difficulty === 'all' || item.difficulty === difficulty)
      .map((item) => ({
        ...item,
        abstract: makeAbstract({ ...item, branch, interests }),
        suggested_for: { branch, interests },
      }));

    return apiResponse.success(res, {
      recommended: suggestions,
      trending: TRENDING.slice(0, 6),
    });
  } catch (error) { return next(error); }
};
