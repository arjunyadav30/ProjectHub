import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, SkeletonCard, EmptyState, ProgressBar } from '../../components/common';
import { teamAPI } from '../../api';
import { Users, ArrowRight } from 'lucide-react';

const TeamsPage = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamAPI.getAll()
      .then(r => setTeams(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.role === 'student' ? 'My Teams' : 'Teams'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user.role === 'student' ? 'Teams you are part of' : 'Teams you manage or mentor'}
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams yet"
            description={user.role === 'student' ? 'Register for an event to join or create a team.' : 'No teams assigned to you yet.'}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => {
              const stats = team.progress_stats || { percent: 0, total: 0, completed: 0 };
              return (
                <Link key={team._id} to={`/teams/${team._id}`}
                  className="card p-5 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {team.team_name}
                    </h3>
                    <Badge variant={team.registration_status}>{team.registration_status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{team.event_id?.title}</p>
                  {team.assigned_faculty && (
                    <p className="text-xs text-blue-600 mb-3">Mentor: {team.assigned_faculty.name}</p>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <ProgressBar percent={stats.percent} className="flex-1" />
                    <span className="text-xs font-medium text-gray-600">{stats.percent}%</span>
                  </div>
                  <p className="text-xs text-gray-400">{stats.completed}/{stats.total} modules done</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex -space-x-1">
                      {team.members?.slice(0, 4).map((m, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white dark:border-gray-900 flex items-center justify-center text-blue-700 text-xs font-semibold">
                          {m.student_id?.name?.[0]}
                        </div>
                      ))}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
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

export default TeamsPage;
