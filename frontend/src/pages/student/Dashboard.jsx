import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/common/Layout';
import { StatsCard, Badge, SkeletonCard, EmptyState, ProgressBar } from '../../components/common';
import { teamAPI, eventAPI, aiAPI } from '../../api';
import { Calendar, Users, Bell, ArrowRight, Clock, FolderOpen } from 'lucide-react';
import { formatDate, timeAgo, profileCompletion } from '../../utils';
import { useNotifications } from '../../hooks/useNotifications';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import toast from 'react-hot-toast';

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiIdeas, setAiIdeas] = useState([]);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    Promise.all([
      teamAPI.getAll(),
      eventAPI.getAll({ limit: 5 }),
      aiAPI.getRecommendations('all').catch(() => ({ data: { data: { recommended: [] } } })),
    ])
      .then(([teamsRes, eventsRes, aiRes]) => {
        setTeams(teamsRes.data.data || []);
        setEvents(eventsRes.data.data?.events || eventsRes.data.data || []);
        setAiIdeas(aiRes.data?.data?.recommended || []);
      })
      .catch(() => toast.error('Failed to refresh dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useRefetchOnFocus(loadDashboard, { liveScopes: ['teams', 'events', 'notifications', 'dashboard'] });

  const completion = profileCompletion(profile, 'student');
  const pendingInvites = notifications.filter(n =>
    (n.type === 'team_invite' || n.type === 'leader_request') &&
    (n.is_actionable === true || n.action_status === 'pending')
  );

  // Find upcoming presentations
  const upcomingPresentations = teams.flatMap(t => {
    const ps = t.event_id?.presentation_schedule;
    if (!ps?.start_date) return [];
    const start = new Date(ps.start_date);
    const now = new Date();
    if (start > now) {
      const daysLeft = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return [{ team: t, daysLeft, startDate: start }];
    }
    return [];
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your projects.</p>
        </div>

        {/* Profile Completion Warning */}
        {completion < 70 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Complete your profile ({completion}%)</p>
              <p className="text-xs text-amber-600 mt-0.5">Add more details so faculty can identify you easily</p>
            </div>
            <Link to="/student/profile" className="text-sm font-medium text-amber-700 hover:underline flex items-center gap-1">
              Update <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Presentation Countdown */}
        {upcomingPresentations.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">⏰ Upcoming Presentations</h3>
            <div className="space-y-2">
              {upcomingPresentations.map(({ team, daysLeft, startDate }) => (
                <div key={team._id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{team.team_name}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{startDate.toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {daysLeft}d left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="My Teams" value={loading ? '...' : teams.length} icon={Users} color="blue" />
          <StatsCard label="Open Events" value={loading ? '...' : events.length} icon={Calendar} color="green" />
          <StatsCard label="Pending Invites" value={loading ? '...' : pendingInvites.length} icon={Bell} color="amber" />
          <StatsCard label="Notifications" value={unreadCount} icon={Bell} color="red" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Teams */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">My Projects</h2>
              <Link to="/student/projects" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <SkeletonCard key={i} />)}</div>
            ) : teams.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No projects yet"
                description="Register for an event to create a team."
                action={
                  <Link to="/student/events" className="text-sm text-blue-600 hover:underline">Browse Events →</Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {teams.slice(0, 3).map(team => {
                  const modules = team.project?.modules || [];
                  const completed = modules.filter(m => m.status === 'completed').length;
                  const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;
                  return (
                    <Link key={team._id} to={`/teams/${team._id}`}
                      className="block p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{team.team_name}</p>
                        <Badge variant={team.registration_status === 'approved' ? 'approved' : 'pending'}>
                          {team.registration_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{team.event_id?.title}</p>
                      {modules.length > 0 && (
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={percent} className="flex-1" />
                          <span className="text-xs font-medium text-gray-600">{percent}%</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open Events */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Available Events</h2>
              <Link to="/student/events" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <SkeletonCard key={i} />)}</div>
            ) : events.length === 0 ? (
              <EmptyState icon={Calendar} title="No events available" description="Check back later for new events." />
            ) : (
              <div className="space-y-3">
                {events.slice(0, 4).map(event => (
                  <Link key={event._id} to={`/student/events`}
                    className="block p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{event.title}</p>
                      <Badge variant="open">Open</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Closes {formatDate(event.registration_end)}
                      </span>
                      {event.allowed_semesters?.length > 0 && (
                        <span>Sem {event.allowed_semesters.join(', ')}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">⚠️ Pending Actions</h2>
            <div className="space-y-3">
              {pendingInvites.map(n => (
                <div key={n._id} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                    <p className="text-xs text-gray-500">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <Link to="/notifications" className="text-xs text-blue-600 hover:underline whitespace-nowrap">Respond</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">AI Project Recommendations</h2>
          {aiIdeas.length === 0 ? (
            <p className="text-sm text-gray-500">No suggestions yet. Add skills in profile for better ideas.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {aiIdeas.slice(0, 4).map((idea) => (
                <div key={idea.title} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{idea.title}</p>
                  <p className="text-xs text-gray-500 mt-1">Difficulty: {idea.difficulty}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{idea.abstract}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
