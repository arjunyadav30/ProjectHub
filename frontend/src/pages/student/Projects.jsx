import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectAPI, teamAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, ProgressBar, EmptyState } from '../../components/common';
import { FolderOpen, Calendar, Users, ExternalLink, Github, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const StudentProjects = () => {
  const [teams, setTeams] = useState([]);
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTeams = useCallback(() => {
    setLoading(true);
    teamAPI.getAll()
      .then(r => setTeams(r.data.data || []))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return setSearchResult(null);
    try {
      const response = await projectAPI.globalSearch(q);
      setSearchResult(response.data?.data || null);
    } catch (_) {
      toast.error('Search failed');
    }
  }, [query]);

  const stats = useMemo(() => {
    const modules = teams.flatMap((t) => t.project?.modules || []);
    const total = modules.length;
    const completed = modules.filter((m) => m.status === 'completed').length;
    const overdue = modules.filter((m) => m.due_date && new Date(m.due_date) < new Date() && m.status !== 'completed').length;
    return { total, completed, overdue };
  }, [teams]);

  useRefetchOnFocus(loadTeams);

  const getStatusVariant = (status) => {
    if (status === 'accepted') return 'approved';
    if (status === 'rejected') return 'rejected';
    if (status === 'submitted') return 'pending';
    return 'default';
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Projects</h1>
          <p className="text-gray-500 text-sm mt-1">All teams and projects you're part of</p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="card p-4"><p className="text-xs text-gray-500">Total Tasks</p><p className="text-2xl font-bold">{stats.total}</p></div>
          <div className="card p-4"><p className="text-xs text-gray-500">Completed</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></div>
          <div className="card p-4"><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-600">{stats.overdue}</p></div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, teams, people"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
            <button
              onClick={runSearch}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
            >
              Search
            </button>
          </div>
          {searchResult && (
            <p className="text-xs text-gray-500">
              Results: {searchResult.teams?.length || 0} teams, {searchResult.tasks?.length || 0} tasks, {searchResult.users?.length || 0} users
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No Projects Yet"
            description="You haven't joined any project teams. Register for an event to get started."
            action={
              <Link to="/student/events"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors text-sm font-medium">
                Browse Events <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {teams.map(team => {
              const modules = team.project?.modules || [];
              const completed = modules.filter(m => m.status === 'completed').length;
              const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;
              const acceptedMembers = team.members?.filter(m => m.status === 'accepted') || [];

              return (
                <Link key={team._id} to={`/teams/${team._id}`}>
                  <div className="card p-5 hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-700 h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{team.team_name}</h3>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5">{team.event_id?.title}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end ml-2">
                        <Badge variant={team.registration_status === 'approved' ? 'approved' : team.registration_status === 'rejected' ? 'rejected' : 'pending'}>
                          {team.registration_status}
                        </Badge>
                        {team.project?.submission_status !== 'not_submitted' && (
                          <Badge variant={getStatusVariant(team.project?.submission_status)}>
                            {team.project?.submission_status}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {team.project?.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{team.project.description}</p>
                    )}

                    {/* Tech stack */}
                    {team.project?.technologies_used?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {team.project.technologies_used.slice(0, 4).map(t => (
                          <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                        {team.project.technologies_used.length > 4 && (
                          <span className="text-xs text-gray-400">+{team.project.technologies_used.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    {modules.length > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress ({completed}/{modules.length} modules)</span>
                          <span className="font-medium text-blue-600">{percent}%</span>
                        </div>
                        <ProgressBar percent={percent} />
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{acceptedMembers.length} members</span>
                      </div>
                      {team.assigned_faculty && (
                        <span>Mentor: {team.assigned_faculty.name}</span>
                      )}
                      <div className="flex gap-2">
                        {team.project?.github_link && (
                          <span onClick={e => { e.preventDefault(); window.open(team.project.github_link, '_blank'); }}>
                            <Github className="w-4 h-4 hover:text-blue-600 transition-colors" />
                          </span>
                        )}
                        {team.project?.live_link && (
                          <span onClick={e => { e.preventDefault(); window.open(team.project.live_link, '_blank'); }}>
                            <ExternalLink className="w-4 h-4 hover:text-blue-600 transition-colors" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentProjects;
