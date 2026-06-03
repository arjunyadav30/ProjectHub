import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, analyticsAPI, subscriptionAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { StatsCard } from '../../components/common';
import { Users, BookOpen, Calendar, Users2, Building2, Trophy, Medal, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const { college } = useAuth();
  const [stats, setStats] = useState({ totalStudents: 0, totalFaculty: 0, totalEvents: 0, activeTeams: 0 });
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [subscription, setSubscription] = useState(null);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminAPI.getDashboard(),
      analyticsAPI.getAdvanced().catch(() => ({ data: { data: null } })),
      subscriptionAPI.getStatus().catch(() => ({ data: { data: null } })),
    ])
      .then(([dashRes, analyticsRes, subscriptionRes]) => {
        setStats(dashRes.data.data);
        setAnalytics(analyticsRes.data.data);
        setSubscription(subscriptionRes.data.data?.subscription || null);
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
        {subscription?.status === 'expired' && (
          <div className="card p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-3">Your subscription has expired. Please renew to continue.</h2>
            <div className="flex items-center justify-center gap-3">
              <Link to="/subscription" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500">Monthly / Yearly Plans</Link>
            </div>
          </div>
        )}
        {subscription?.status === 'trial' && subscription?.expires_at && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
            You are on a free trial. {Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining.
            <Link to="/subscription" className="ml-2 text-amber-100 underline">Upgrade Now</Link>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">System overview and quick actions</p>
        </div>

        {college && (
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{college.name}</p>
                <p className="text-xs text-gray-500">College Code: {college.code}</p>
              </div>
            </div>
            <Link to="/admin/website" className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap">Edit</Link>
          </div>
        )}

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

        {analytics?.gamification && (
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Trophy Wall</h2>
                </div>
                <span className="text-xs text-gray-500">Top teams by progress, submission, and GitHub activity</span>
              </div>

              {analytics.gamification.trophy_wall?.length ? (
                <div className="space-y-3">
                  {analytics.gamification.trophy_wall.map((team, index) => (
                    <div key={team.team_id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        <Medal className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{team.team_name}</p>
                        <p className="text-xs text-gray-500 truncate">{team.event_title || 'General event'}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {team.badges.map((badge) => (
                            <span key={badge.key} className="text-[11px] rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{team.score}</p>
                        <p className="text-xs text-gray-500">{team.progress.percent}% done</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No trophy wall entries yet. Teams will appear after modules, submissions, or GitHub sync activity.</p>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Badge Summary</h2>
              </div>
              <div className="space-y-3">
                {(analytics.gamification.badge_counts || []).map((badge) => (
                  <div key={badge.key} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{badge.label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{badge.count}</span>
                  </div>
                ))}
                {(!analytics.gamification.badge_counts || analytics.gamification.badge_counts.length === 0) && (
                  <p className="text-sm text-gray-500">Badges will unlock automatically from team activity.</p>
                )}
              </div>
              {analytics.gamification.student_achievements?.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top Student Achievements</p>
                  <div className="space-y-2">
                    {analytics.gamification.student_achievements.slice(0, 5).map((student) => (
                      <div key={student.student_id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{student.name}</p>
                          <p className="text-xs text-gray-500 truncate">{student.badges.map((badge) => badge.label).join(', ')}</p>
                        </div>
                        <span className="text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1">
                          {student.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
