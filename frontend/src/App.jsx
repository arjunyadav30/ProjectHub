import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Public
import HomePage from './pages/public/HomePage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import { VerifyEmailPage } from './pages/auth/ForgotReset';

// Student setup
import ChangePassword from './pages/auth/ChangePassword';
import CompleteProfile from './pages/auth/CompleteProfile';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminFaculty from './pages/admin/Faculty';
import AdminEvents from './pages/admin/Events';
import AdminEventDetail from './pages/admin/EventDetail';
import AdminWebsite from './pages/admin/Website';
import AdminSubscription from './pages/admin/Subscription';

// Faculty
import FacultyDashboard from './pages/faculty/Dashboard';
import FacultyTeams from './pages/faculty/Teams';
import FacultyTeamDetail from './pages/faculty/TeamDetail';
import FacultyEvents from './pages/faculty/Events';
import FacultyEventDetail from './pages/faculty/EventDetail';

// Student
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentEvents from './pages/student/Events';
import StudentProjects from './pages/student/Projects';
import StudentViva from './pages/student/Viva';
import StudentTemplateLockReport from './pages/student/TemplateLockReport';
import EventDetailPage from './pages/student/EventDetail';
import TeamDetail from './pages/student/TeamDetail';
import ReportPreview from './pages/student/ReportPreview';

// Chat
import ChatPage from './pages/chat/ChatPage';

// Notifications
import Notifications from './pages/Notifications';
import People from './pages/People';
import PublicProfile from './pages/PublicProfile';
import ReviewSubmission from './pages/ReviewSubmission';
import Leaderboard from './pages/Leaderboard';
import Badges from './pages/Badges';
import TrophyWall from './pages/admin/TrophyWall';
import CertificateGenerator from './pages/admin/CertificateGenerator';

// ── Auth guard ────────────────────────────────────────────
const getStudentSetupPath = (user, profile) => {
  if (user?.role !== 'student') return null;
  if (!user.password_changed_at) return '/setup/change-password';
  if (!profile?.is_profile_complete) return '/setup/complete-profile';
  return null;
};

const ProtectedRoute = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  const setupPath = getStudentSetupPath(user, profile);
  if (setupPath && window.location.pathname !== setupPath) {
    return <Navigate to={setupPath} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
  if (user) {
    const setupPath = getStudentSetupPath(user, profile);
    if (setupPath) return <Navigate to={setupPath} replace />;
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }
  return children;
};

// ── App ───────────────────────────────────────────────────
function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontSize: '14px' },
        }}
      />
      <Routes>
        {/* ── Report Preview — NO auth, new tab mein khulta hai ── */}
        <Route path="/report-preview" element={<ReportPreview />} />

        {/* ── Public ── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/projecthub" element={<HomePage />} />
        <Route path="/projecthub/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/projecthub/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/login" element={<Navigate to="/projecthub/login" replace />} />
        <Route path="/signup" element={<Navigate to="/projecthub/signup" replace />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
        <Route path="/projecthub/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/projecthub/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />

        {/* ── Student Setup ── */}
        <Route path="/setup/change-password" element={<ProtectedRoute roles={['student']}><ChangePassword /></ProtectedRoute>} />
        <Route path="/setup/complete-profile" element={<ProtectedRoute roles={['student']}><CompleteProfile /></ProtectedRoute>} />

        {/* ── Admin ── */}
        <Route path="/admin/dashboard"    element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/students"     element={<ProtectedRoute roles={['admin']}><AdminStudents /></ProtectedRoute>} />
        <Route path="/admin/faculty"      element={<ProtectedRoute roles={['admin']}><AdminFaculty /></ProtectedRoute>} />
        <Route path="/admin/events"       element={<ProtectedRoute roles={['admin']}><AdminEvents /></ProtectedRoute>} />
        <Route path="/admin/events/:id"   element={<ProtectedRoute roles={['admin']}><AdminEventDetail /></ProtectedRoute>} />
        <Route path="/admin/website"      element={<ProtectedRoute roles={['admin']}><AdminWebsite /></ProtectedRoute>} />
        <Route path="/subscription"       element={<ProtectedRoute roles={['admin']}><AdminSubscription /></ProtectedRoute>} />
        <Route path="/admin/trophies"     element={<ProtectedRoute roles={['admin']}><TrophyWall /></ProtectedRoute>} />
        <Route path="/admin/certificates/generate" element={<ProtectedRoute roles={['admin', 'faculty']}><CertificateGenerator /></ProtectedRoute>} />

        {/* ── Faculty ── */}
        <Route path="/faculty/dashboard"      element={<ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/teams"          element={<ProtectedRoute roles={['faculty']}><FacultyTeams /></ProtectedRoute>} />
        <Route path="/faculty/teams/:id"      element={<ProtectedRoute roles={['faculty']}><FacultyTeamDetail /></ProtectedRoute>} />
        <Route path="/faculty/events"         element={<ProtectedRoute roles={['faculty']}><FacultyEvents /></ProtectedRoute>} />
        <Route path="/faculty/events/:id"     element={<ProtectedRoute roles={['faculty']}><FacultyEventDetail /></ProtectedRoute>} />

        {/* ── Student ── */}
        <Route path="/student/dashboard"  element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/profile"    element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />
        <Route path="/student/events"     element={<ProtectedRoute roles={['student']}><StudentEvents /></ProtectedRoute>} />
        <Route path="/student/projects"   element={<ProtectedRoute roles={['student']}><StudentProjects /></ProtectedRoute>} />
        <Route path="/student/viva"       element={<ProtectedRoute roles={['student']}><StudentViva /></ProtectedRoute>} />
        <Route path="/student/report-template-lock" element={<ProtectedRoute roles={['student']}><StudentTemplateLockReport /></ProtectedRoute>} />

        {/* ── Shared Event Detail ── */}
        <Route path="/events/:id" element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />

        {/* ── Team Detail ── */}
        <Route path="/teams/:id" element={<ProtectedRoute><TeamDetail /></ProtectedRoute>} />

        {/* ── Chat ── */}
        <Route path="/chat"             element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:type/:id"   element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/badges" element={<ProtectedRoute><Badges /></ProtectedRoute>} />

        {/* ── Notifications ── */}
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/review-submission/:id" element={<ProtectedRoute roles={['admin', 'faculty']}><ReviewSubmission /></ProtectedRoute>} />
        <Route path="/people" element={<ProtectedRoute><People /></ProtectedRoute>} />
        <Route path="/people/:id" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />

        {/* ── Shared Profile ── */}
        <Route path="/profile" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />

        {/* ── Redirects ── */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const DashboardRedirect = () => {
  const { user, profile } = useAuth();
  const setupPath = getStudentSetupPath(user, profile);
  if (setupPath) return <Navigate to={setupPath} replace />;
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
};

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <h1 className="text-7xl font-bold text-gray-200 dark:text-gray-700">404</h1>
      <p className="text-gray-500 mt-4 mb-6 text-lg">Page not found</p>
      <a href="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors font-medium">
        Go Home
      </a>
    </div>
  </div>
);

export default App;
