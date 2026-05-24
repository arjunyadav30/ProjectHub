import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import {
  LayoutDashboard, Calendar, Users, Bell, User, LogOut,
  FolderOpen, Moon, Sun, Menu, X, GraduationCap, Globe,
  MessageSquare, BookOpen, Search, Mic, FileEdit,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn, timeAgo } from '../../utils';
import toast from 'react-hot-toast';

const studentLinks = [
  { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/student/events', icon: Calendar, label: 'Events' },
  { to: '/student/projects', icon: FolderOpen, label: 'My Projects' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/student/viva', icon: Mic, label: 'AI Viva' },
  { to: '/student/report-template-lock', icon: FileEdit, label: 'Report (Same Format)' },
  { to: '/people', icon: Search, label: 'People' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/profile', icon: User, label: 'Profile' },
];

const facultyLinks = [
  { to: '/faculty/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/faculty/teams', icon: Users, label: 'My Teams' },
  { to: '/faculty/events', icon: Calendar, label: 'Events' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/people', icon: Search, label: 'People' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/profile', icon: User, label: 'Profile' },
];

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/faculty', icon: BookOpen, label: 'Faculty' },
  { to: '/admin/events', icon: Calendar, label: 'Events' },
  { to: '/admin/website', icon: Globe, label: 'Website' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/people', icon: Search, label: 'People' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const Sidebar = ({ onClose }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const links =
    user?.role === 'admin' ? adminLinks :
    user?.role === 'faculty' ? facultyLinks :
    studentLinks;

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">ProjectHub</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 text-sm flex-shrink-0 overflow-hidden">
            {user?.profile_image
              ? <img src={user.profile_image} className="w-full h-full object-cover" alt="" />
              : user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
};

// Dark mode toggle hook
const useDarkMode = () => {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, setDark];
};

export const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useDarkMode();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setDark(d => !d)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
            {dark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
