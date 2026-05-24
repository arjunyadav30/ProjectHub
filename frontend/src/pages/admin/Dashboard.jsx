import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, analyticsAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { StatsCard } from '../../components/common';
import { Users, BookOpen, Calendar, Users2 } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalStudents: 0, totalFaculty: 0, totalEvents: 0, activeTeams: 0 });
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminAPI.getDashboard(),
      analyticsAPI.getAdvanced().catch(() => ({ data: { data: null } })),
    ])
      .then(([dashRes, analyticsRes]) => {
        setStats(dashRes.data.data);
        setAnalytics(analyticsRes.data.data);
      })
      .catch(() => toast.error('Failed to refresh dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useRefetchOnFocus(loadDashboard);

  const cards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'blue', to: '/admin/students' },
    { label: 'Total Faculty', value: stats.totalFaculty, icon: BookOpen, color: 'purple', to: '/admin/faculty' },
    { label: 'Total Events', value: stats.totalEvents, icon: Calendar, color: 'green', to: '/admin/events' },
    { label: 'Active Teams', value: stats.activeTeams, icon: Users2, color: 'amber', to: '/admin/events' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">System overview and quick actions</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(card => (
            <Link key={card.label} to={card.to}>
              <StatsCard
                label={card.label}
                value={loading ? '...' : card.value}
                icon={card.icon}
                color={card.color}
              />
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Manage Students', desc: 'Add, import, promote students', to: '/admin/students', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
            { title: 'Manage Faculty', desc: 'Add and manage faculty members', to: '/admin/faculty', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
            { title: 'Manage Events', desc: 'Create and oversee events', to: '/admin/events', color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
            { title: 'Website Settings', desc: 'Update logo, hero image', to: '/admin/website', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
            { title: 'View All Teams', desc: 'Browse registered teams', to: '/teams', color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' },
            { title: 'Notifications', desc: 'System notifications', to: '/notifications', color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
          ].map(action => (
            <Link key={action.title} to={action.to}
              className={`p-4 rounded-xl border ${action.color} hover:shadow-md transition-all`}>
              <h3 className="font-semibold text-gray-900 dark:text-white">{action.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{action.desc}</p>
            </Link>
          ))}
        </div>

        {analytics?.summary && (
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Advanced Analytics Snapshot</h2>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500">Teams</p>
                <p className="font-semibold">{analytics.summary.total_teams}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500">Active Students</p>
                <p className="font-semibold">{analytics.summary.active_students}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500">Active Faculty</p>
                <p className="font-semibold">{analytics.summary.active_faculty}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
