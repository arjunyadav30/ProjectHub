import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, SkeletonCard, EmptyState } from '../../components/common';
import { Calendar, Users, Clock, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils';
import toast from 'react-hot-toast';

const FacultyEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventAPI.getAll({ limit: 50 })
      .then(res => setEvents(res.data.data?.events || res.data.data || []))
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const getStatusVariant = (ev) => {
    const now = new Date();
    if (now > new Date(ev.event_end_date)) return { label: 'Closed', variant: 'rejected' };
    if (now > new Date(ev.registration_end)) return { label: 'In Progress', variant: 'approved' };
    return { label: 'Registration Open', variant: 'open' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="text-gray-500 text-sm mt-1">View all events and registered teams</p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No events found"
            description="Events created by admin will appear here."
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(ev => {
              const status = getStatusVariant(ev);
              return (
                <Link key={ev._id} to={`/faculty/events/${ev._id}`}>
                  <div className="card p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all h-full">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white leading-tight flex-1 pr-2">
                        {ev.title}
                      </h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{ev.description}</p>

                    <div className="space-y-1.5 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Team: {ev.min_team_size}–{ev.max_team_size} members
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Reg ends: {formatDate(ev.registration_end)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Event ends: {formatDate(ev.event_end_date)}
                      </div>
                    </div>

                    {ev.allowed_semesters?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {ev.allowed_semesters.map(s => (
                          <span key={s} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            Sem {s}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end mt-4 text-blue-600 text-xs font-medium">
                      View Teams <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
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

export default FacultyEvents;
