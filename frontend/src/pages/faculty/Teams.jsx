import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { facultyAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, Button } from '../../components/common';
import { Eye, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const FacultyTeams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadTeams = useCallback(() => {
    setLoading(true);
    facultyAPI.getAssignedTeams()
      .then(res => setTeams(res.data.data || []))
      .catch(() => toast.error('Failed to load teams'))
      .finally(() => setLoading(false));
  }, []);

  useRefetchOnFocus(loadTeams);

  const filtered = teams.filter(t =>
    t.team_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.event_id?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Assigned Teams</h1>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search teams or events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-200 dark:bg-gray-700" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{search ? 'No matching teams.' : 'No teams assigned yet.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(team => {
              const modules = team.project?.modules || [];
              const completed = modules.filter(m => m.status === 'completed').length;
              const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;
              const needsReview = team.project?.submission_status === 'submitted';

              return (
                <div key={team._id} className={`card p-5 hover:shadow-md transition-all ${needsReview ? 'border-amber-400 dark:border-amber-600' : ''}`}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{team.team_name}</h3>
                          {needsReview && <Badge variant="pending">Needs Review</Badge>}
                          <Badge variant={
                            team.project?.submission_status === 'accepted' ? 'approved' :
                            team.project?.submission_status === 'rejected' ? 'rejected' : 'default'
                          }>{team.project?.submission_status || 'In Progress'}</Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{team.event_id?.title}</p>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>{team.members?.filter(m => m.status === 'accepted').length || 0} members</span>
                          <span>{modules.length} modules</span>
                        </div>
                      </div>
                      {modules.length > 0 && (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span><span className="font-medium text-blue-600">{percent}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Link to={`/faculty/teams/${team._id}`}>
                          <Button size="sm" variant="secondary">
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                        </Link>
                        {needsReview && (
                          <Link to={`/review-submission/${team._id}`}>
                            <Button size="sm" variant="warning">
                              Review Submission
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FacultyTeams;
