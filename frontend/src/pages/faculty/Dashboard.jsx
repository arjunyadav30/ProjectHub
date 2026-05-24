import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { facultyAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, Button } from '../../components/common';
import { Users, Clock, Bell, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const FacultyDashboard = () => {
  const [teams, setTeams] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState('');

  const loadDashboard = useCallback(() => {
    setLoading(true);
    Promise.all([
      facultyAPI.getAssignedTeams(),
      facultyAPI.getMentorRequests(),
    ]).then(([teamsRes, reqRes]) => {
      setTeams(teamsRes.data.data || []);
      setPendingRequests(reqRes.data.data || []);
    }).catch(() => toast.error('Failed to refresh dashboard')).finally(() => setLoading(false));
  }, []);

  useRefetchOnFocus(loadDashboard, { liveScopes: ['teams', 'events', 'notifications', 'dashboard'] });

  const handleRespond = async (teamId, action) => {
    setResponding(teamId + action);
    try {
      await facultyAPI.respondMentorRequest(teamId, action);
      toast.success(`Request ${action}`);
      setPendingRequests(r => r.filter(t => t._id !== teamId));
      if (action === 'accepted') {
        const res = await facultyAPI.getAssignedTeams();
        setTeams(res.data.data || []);
      }
    } catch (e) { toast.error('Failed'); }
    finally { setResponding(''); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Assigned Teams', value: teams.length, icon: Users, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
            { label: 'Pending Reviews', value: teams.filter(t => t.project?.submission_status === 'submitted').length, icon: Clock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
            { label: 'Mentor Requests', value: pendingRequests.length, icon: Bell, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '...' : s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-500" /> Pending Mentor Requests
            </h2>
            <div className="space-y-3">
              {pendingRequests.map(req => (
                <div key={req._id} className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div>
                    <p className="font-medium">{req.team_name}</p>
                    <p className="text-sm text-gray-500">{req.event_id?.title}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(req._id, 'accepted')}>
                      <CheckCircle className="w-3.5 h-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleRespond(req._id, 'rejected')}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Teams */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> My Assigned Teams</h2>
            <Link to="/faculty/teams"><Button size="sm" variant="secondary">View All</Button></Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}</div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No teams assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.slice(0, 5).map(team => {
                const modules = team.project?.modules || [];
                const completed = modules.filter(m => m.status === 'completed').length;
                const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;
                return (
                  <Link key={team._id} to={`/faculty/teams/${team._id}`}>
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{team.team_name}</p>
                          <p className="text-xs text-gray-500">{team.event_id?.title}</p>
                        </div>
                        <Badge variant={team.project?.submission_status === 'submitted' ? 'pending' : 'default'}>
                          {team.project?.submission_status || 'active'}
                        </Badge>
                      </div>
                      {modules.length > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span><span>{percent}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FacultyDashboard;
