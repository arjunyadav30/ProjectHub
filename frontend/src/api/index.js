import axios from 'axios';
import toast from 'react-hot-toast';

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/+$/, '');
const API_BASE_URL = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];
const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isRefreshCall = requestUrl.includes('/auth/refresh-token');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshCall) {
        localStorage.removeItem('accessToken');
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(token => { originalRequest.headers.Authorization = `Bearer ${token}`; return api(originalRequest); });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await api.post('/auth/refresh-token', {});
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        return Promise.reject(refreshError);
      } finally { isRefreshing = false; }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  signupProjectHub: (data) => api.post('/auth/projecthub/signup', data),
  loginProjectHub: (data) => api.post('/auth/projecthub/login', data),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.post('/auth/change-password', data),
  completeProfile: (data) => api.post('/auth/complete-profile', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
};

// ─── Users ───────────────────────────────────────────────────────
export const userAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  uploadAvatar: (formData) => api.post('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  searchPeople: (q) => api.get('/users/search', { params: { q } }),
  getPublicProfile: (id) => api.get(`/users/${id}/public-profile`),
  searchStudents: (q) => api.get(`/users/students/search?q=${q}`),
  getAllFaculty: () => api.get('/users/faculty/all'),
};

// ─── Events ──────────────────────────────────────────────────────
export const eventAPI = {
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  getTeams: (id, params) => api.get(`/events/${id}/teams`, { params }),
  exportTeams: (id) => api.get(`/events/${id}/teams/export`, { responseType: 'blob' }),
  updatePresentationSchedule: (id, data) => api.put(`/events/${id}/presentation-schedule`, data),
};

// ─── Teams ───────────────────────────────────────────────────
export const teamAPI = {
  create: (data) => api.post('/teams', data),
  getAll: () => api.get('/teams'),
  getById: (id) => api.get(`/teams/${id}`),
  update: (id, data) => api.put(`/teams/${id}`, data),
  respondLeader: (id, action) => api.post(`/teams/${id}/accept-leader`, { action }),
  respondInvite: (id, action) => api.post(`/teams/${id}/members/respond`, { action }),
  addMember: (id, student_id) => api.post(`/teams/${id}/members`, { student_id }),
  removeMember: (id, studentId) => api.delete(`/teams/${id}/members/${studentId}`),
  leaveTeam: (id) => api.post(`/teams/${id}/leave`),
  assignFaculty: (id, faculty_id) => api.put(`/teams/${id}/assign-faculty`, { faculty_id }),
  updateStatus: (id, data) => api.put(`/teams/${id}/status`, data),
  updateProject: (id, data) => api.put(`/teams/${id}/project`, data),
  addModule: (id, data) => api.post(`/teams/${id}/modules`, data),
  updateModule: (id, moduleId, data) => api.put(`/teams/${id}/modules/${moduleId}`, data),
  deleteModule: (id, moduleId) => api.delete(`/teams/${id}/modules/${moduleId}`),
  addProgressUpdate: (id, message) => api.post(`/teams/${id}/progress-update`, { message }),
  getVideoRoom: (id) => api.get(`/teams/${id}/video-room`),
  joinVideoRoom: (id) => api.post(`/teams/${id}/video-room/join`),
};

// ─── Admin ───────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  // Students
  getStudents: (params) => api.get('/admin/students', { params }),
  addStudent: (data) => api.post('/admin/students', data),
  updateStudent: (id, data) => api.put(`/admin/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/admin/students/${id}`),
  bulkImportStudents: (data) => api.post('/admin/students/bulk-import', data),
  promoteStudents: (data) => api.put('/admin/students/promote', data),
  exportStudents: (params) => api.get('/admin/students/export', { params, responseType: 'blob' }),
  downloadStudentTemplate: () => api.get('/admin/students/template', { responseType: 'blob' }),
  // Faculty
  getFaculty: (params) => api.get('/admin/faculty', { params }),
  addFaculty: (data) => api.post('/admin/faculty', data),
  updateFaculty: (id, data) => api.put(`/admin/faculty/${id}`, data),
  deleteFaculty: (id) => api.delete(`/admin/faculty/${id}`),
  bulkImportFaculty: (data) => api.post('/admin/faculty/bulk-import', data),
  downloadFacultyTemplate: () => api.get('/admin/faculty/template', { responseType: 'blob' }),
  // Website
  getWebsiteConfig: () => api.get('/admin/website-config'),
  updateWebsiteConfig: (data) => api.put('/admin/website-config', data),
  updateCollege: (data) => api.put('/admin/college', data),
  featureProject: (data) => api.post('/admin/feature-project', data),
  unfeatureProject: (teamId) => api.delete(`/admin/feature-project/${teamId}`),
  // Marks
  getTeamMarks: (teamId) => api.get(`/admin/teams/${teamId}/marks`),
  giveMarks: (data) => api.post('/admin/marks', data),
  // Events
  getUnregisteredStudents: (eventId) => api.get(`/admin/events/${eventId}/unregistered`),
  exportUnregisteredStudents: (eventId) => api.get(`/admin/events/${eventId}/unregistered/export`, { responseType: 'blob' }),
};

// ─── Faculty ─────────────────────────────────────────────────────
export const facultyAPI = {
  getAssignedTeams: () => api.get('/faculty/assigned-teams'),
  getMentorRequests: () => api.get('/faculty/mentor-requests'),
  respondMentorRequest: (id, action) => api.put(`/faculty/mentor-requests/${id}`, { action }),
  addSuggestion: (teamId, text) => api.post(`/faculty/teams/${teamId}/suggestion`, { text }),
  giveMarks: (teamId, marks_data) => api.post(`/faculty/teams/${teamId}/marks`, { marks_data }),
  getTeamMarks: (teamId) => api.get(`/faculty/teams/${teamId}/marks`),
  reviewSubmission: (teamId, data) => api.post(`/faculty/teams/${teamId}/submission-review`, data),
};

// ─── Chat ────────────────────────────────────────────────────────
export const chatAPI = {
  getContacts: () => api.get('/chat/contacts'),
  searchUsers: (q) => api.get('/chat/search-users', { params: { q } }),
  getGroupMessages: (teamId) => api.get(`/chat/group/${teamId}`),
  sendGroupMessage: (teamId, data) => api.post(`/chat/group/${teamId}`, data),
  getDirectMessages: (userId) => api.get(`/chat/direct/${userId}`),
  sendDirectMessage: (userId, data) => api.post(`/chat/direct/${userId}`, data),
  markRead: (type, id) => api.put(`/chat/${type}/${id}/read`),
  deleteMessage: (id) => api.delete(`/chat/message/${id}`),
};

// ─── Notifications ───────────────────────────────────────────────
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ─── Public ──────────────────────────────────────────────────────
export const publicAPI = {
  getWebsiteConfig: () => api.get('/public/website-config'),
  getFeaturedProjects: () => api.get('/public/featured-projects'),
};

export const projectAPI = {
  globalSearch: (q) => api.get('/projects/search/global', { params: { q } }),
  getBoard: (teamId) => api.get(`/projects/teams/${teamId}/board`),
  createTask: (teamId, data) => api.post(`/projects/teams/${teamId}/tasks`, data),
  bulkUpdateTasks: (teamId, data) => api.put(`/projects/teams/${teamId}/tasks/bulk`, data),
  addTaskComment: (teamId, moduleId, data) => api.post(`/projects/teams/${teamId}/tasks/${moduleId}/comments`, data),
  startTaskTimer: (teamId, moduleId) => api.post(`/projects/teams/${teamId}/tasks/${moduleId}/timer/start`),
  stopTaskTimer: (teamId, moduleId) => api.post(`/projects/teams/${teamId}/tasks/${moduleId}/timer/stop`),
  getWorkload: (teamId) => api.get(`/projects/teams/${teamId}/workload`),
  getSprintAnalytics: (teamId) => api.get(`/projects/teams/${teamId}/sprint-analytics`),
  getDashboard: (teamId) => api.get(`/projects/teams/${teamId}/dashboard`),
  createSavedView: (teamId, data) => api.post(`/projects/teams/${teamId}/saved-views`, data),
};

export const aiAPI = {
  getRecommendations: (difficulty = 'all') => api.get('/ai/recommendations', { params: { difficulty } }),
  generateProjectSummary: (teamId) => api.post(`/ai/teams/${teamId}/summary`),
  reviewProjectCode: (teamId, data) => api.post(`/ai/teams/${teamId}/code-review`, data),
};

export const integrationAPI = {
  connectGithubRepo: (teamId, repo_url) => api.post(`/integrations/github/teams/${teamId}/connect`, { repo_url }),
  syncGithubRepo: (teamId) => api.post(`/integrations/github/teams/${teamId}/sync`),
  getGithubRepo: (teamId) => api.get(`/integrations/github/teams/${teamId}`),
};

export const analyticsAPI = {
  getAdvanced: () => api.get('/analytics/advanced'),
};

export const videoAPI = {
  scheduleTeamMeeting: (teamId, scheduled_at) => api.put(`/video/teams/${teamId}/schedule`, { scheduled_at }),
  getTeamAttendance: (teamId) => api.get(`/video/teams/${teamId}/attendance`),
  sendReminder: (teamId) => api.post(`/video/teams/${teamId}/reminder`),
};

export const vivaAPI = {
  getMySessions: () => api.get('/viva/my-sessions'),
  getTeamSessions: (teamId) => api.get(`/viva/team/${teamId}`),
  getReport: (sessionId) => api.get(`/viva/report/${sessionId}`),
  start: (team_id) => api.post('/viva/start', { team_id }),
  submit: (session_id, answers) => api.post('/viva/submit', { session_id, answers }),
  facultyReview: (session_id, comment) => api.post('/viva/faculty-review', { session_id, comment }),
  startCommit: (team_id) => api.post('/viva/commit/start', { team_id }),
  submitCommit: (session_id, answers) => api.post('/viva/commit/submit', { session_id, answers }),
};

export const contributionAPI = {
  generate: (teamId, body = {}) => api.post(`/contributions/teams/${teamId}/generate`, body),
  latest: (teamId) => api.get(`/contributions/teams/${teamId}/latest`),
  setAuthorMap: (teamId, mappings) => api.put(`/contributions/teams/${teamId}/author-map`, { mappings }),
  saveDecision: (reportId, scores, comment = '') => api.put(`/contributions/reports/${reportId}/decision`, { scores, comment }),
  eventSummary: (eventId) => api.get(`/contributions/events/${eventId}/summary`),
  previewRepo: (body) => api.post('/contributions/repo/preview', body),
  setRepo: (teamId, body) => api.put(`/contributions/teams/${teamId}/repo`, body),
  onboarding: (teamId) => api.get(`/contributions/teams/${teamId}/onboarding`),
  eventOnboarding: (eventId) => api.get(`/contributions/events/${eventId}/onboarding`),
  remindOnboarding: (eventId, body = {}) => api.post(`/contributions/events/${eventId}/onboarding/remind`, body),
  analyzeAll: (eventId, body = {}) => api.post(`/contributions/events/${eventId}/analyze-all`, body),
  analyzeAllStatus: (eventId, jobId) => api.get(`/contributions/events/${eventId}/analyze-all/${jobId}`),
};

export const scheduleAPI = {
  listPanels: (eventId) => api.get(`/schedule/events/${eventId}/panels`),
  createPanel: (eventId, data) => api.post(`/schedule/events/${eventId}/panels`, data),
  updatePanel: (eventId, panelId, data) => api.put(`/schedule/events/${eventId}/panels/${panelId}`, data),
  deletePanel: (eventId, panelId) => api.delete(`/schedule/events/${eventId}/panels/${panelId}`),
  auto: (eventId, presentationId, config) => api.post(`/schedule/events/${eventId}/presentations/${presentationId}/auto`, config),
  slots: (eventId, presentationId) => api.get(`/schedule/events/${eventId}/presentations/${presentationId}/slots`),
  publish: (eventId, presentationId) => api.post(`/schedule/events/${eventId}/presentations/${presentationId}/publish`),
  updateSlot: (slotId, data) => api.patch(`/schedule/slots/${slotId}`, data),
  requestReschedule: (slotId, data) => api.post(`/schedule/slots/${slotId}/reschedule-request`, data),
  decideReschedule: (slotId, data) => api.patch(`/schedule/slots/${slotId}/reschedule-request`, data),
  mine: () => api.get('/schedule/my'),
  myCalendar: () => api.get('/schedule/my/calendar.ics', { responseType: 'blob' }),
  slotCalendar: (slotId) => api.get(`/schedule/slots/${slotId}/calendar.ics`, { responseType: 'blob' }),
};

export const panelAPI = {
  scoresheet: (slotId) => api.get(`/panel/slots/${slotId}/scoresheet`),
  start: (slotId) => api.post(`/panel/slots/${slotId}/start`),
  complete: (slotId) => api.post(`/panel/slots/${slotId}/complete`),
  submitScore: (slotId, criteria, comment = '') => api.put(`/panel/slots/${slotId}/score`, { criteria, comment }),
  leaderboard: (eventId, presentationId) => api.get(`/panel/events/${eventId}/presentations/${presentationId}/leaderboard`),
  finalize: (eventId, presentationId, force = false) => api.post(`/panel/events/${eventId}/presentations/${presentationId}/finalize`, { force }),
  dashboard: (eventId, presentationId) => api.get(`/panel/events/${eventId}/dashboard`, { params: { presentation_id: presentationId } }),
};

export const evaluationAPI = {
  eventGrades: (eventId) => api.get(`/evaluation/events/${eventId}/grades`),
  teamGrades: (teamId) => api.get(`/evaluation/teams/${teamId}/grades`),
  exportCsv: (eventId) => api.get(`/evaluation/events/${eventId}/grades.csv`, { responseType: 'blob' }),
  setWeights: (eventId, weights) => api.put(`/evaluation/events/${eventId}/weights`, { weights }),
  setReportScore: (teamId, report_score) => api.put(`/evaluation/teams/${teamId}/report-score`, { report_score }),
  finalize: (eventId) => api.post(`/evaluation/events/${eventId}/finalize`),
  override: (gradeId, score, reason) => api.put(`/evaluation/grades/${gradeId}/override`, { score, reason }),
  mine: () => api.get('/evaluation/my'),
};

export const healthMonitorAPI = {
  event: (eventId) => api.get(`/health-monitor/events/${eventId}`),
  team: (teamId) => api.get(`/health-monitor/teams/${teamId}`),
  checkNow: (teamId) => api.post(`/health-monitor/teams/${teamId}/check`),
};

export const portfolioAPI = {
  getResumeData: () => api.get('/portfolio/resume'),
  downloadPortfolioHtml: () => api.get('/portfolio/portfolio-html', { responseType: 'blob' }),
};

export const reportAPI = {
  getMinorProjectReport: () => api.get('/reports/student/minor-project'),
  saveMinorProjectReport: (data) => api.put('/reports/student/minor-project', data),
  getTemplateLock: () => api.get('/reports/student/minor-project/template-lock'),
  saveTemplateLock: (data) => api.put('/reports/student/minor-project/template-lock', data),
  downloadTemplateLockDocx: () => api.get('/reports/student/minor-project/template-lock/download', { responseType: 'blob' }),
};

export const subscriptionAPI = {
  getStatus: () => api.get('/subscription/status'),
  activate: (plan) => api.post('/subscription/activate', { plan }),
};

export const superAdminAPI = {
  getDashboard: () => api.get('/super-admin/dashboard'),
  updateSubscription: (collegeId, data) => api.put(`/super-admin/colleges/${collegeId}/subscription`, data),
};

// ─── Achievements / Leaderboard ─────────────────────────────────
export const achievementsAPI = {
  // Badges
  listBadges: () => api.get('/badges'),
  createBadge: (data) => api.post('/badges', data),
  awardBadge: (data) => api.post('/badges/award', data),
  getUserBadges: (userId) => api.get(`/badges/user/${userId}`),
  // Leaderboard
  getTopTeams: (params) => api.get('/leaderboard/teams', { params }),
  getTopStudents: (params) => api.get('/leaderboard/students', { params }),
  // Certificates
  createCertificate: (data) => api.post('/certificates', data),
  getUserCertificates: (userId) => api.get(`/certificates/user/${userId}`),
  getCertificate: (id) => api.get(`/certificates/${id}`),
};

export default api;
