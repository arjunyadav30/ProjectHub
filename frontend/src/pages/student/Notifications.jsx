import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, EmptyState } from '../../components/common';
import { useNotifications } from '../../hooks/useNotifications';
import { teamAPI } from '../../api';
import { Bell, CheckCheck } from 'lucide-react';
import { timeAgo } from '../../utils';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  team_invite: '🤝',
  leader_request: '👑',
  member_response: '💬',
  faculty_assigned: '👨‍🏫',
  project_update: '📋',
  registration_approved: '✅',
  registration_rejected: '❌',
  faculty_request: '📬',
};

const NotificationsPage = () => {
  const { notifications, loading, markRead, markAllRead, fetch } = useNotifications();

  const handleRespond = async (notification, action) => {
    try {
      await teamAPI.respondLeader(notification.related_id, action);
      toast.success(action === 'accept' ? 'You are now team leader!' : 'Request declined');
      await markRead(notification._id);
      fetch();
    } catch (err) {
      toast.error('Failed to respond');
    }
  };

  const handleMemberRespond = async (notification, action) => {
    try {
      await teamAPI.respondInvite(notification.related_id, action);
      toast.success(action === 'accept' ? 'Joined the team!' : 'Invitation declined');
      await markRead(notification._id);
      fetch();
    } catch {
      toast.error('Failed to respond');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-sm text-gray-500">{notifications.filter(n => !n.is_read).length} unread</p>
          </div>
          {notifications.some(n => !n.is_read) && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card p-4 animate-pulse h-16" />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n._id}
                onClick={() => !n.is_read && markRead(n._id)}
                className={`card p-4 cursor-pointer transition-all ${!n.is_read ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>

                    {/* Action Buttons */}
                    {n.type === 'leader_request' && !n.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="success" onClick={e => { e.stopPropagation(); handleRespond(n, 'accept'); }}>
                          ✅ Accept Leadership
                        </Button>
                        <Button size="sm" variant="danger" onClick={e => { e.stopPropagation(); handleRespond(n, 'reject'); }}>
                          ❌ Decline
                        </Button>
                      </div>
                    )}

                    {n.type === 'team_invite' && !n.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="success" onClick={e => { e.stopPropagation(); handleMemberRespond(n, 'accept'); }}>
                          ✅ Join Team
                        </Button>
                        <Button size="sm" variant="danger" onClick={e => { e.stopPropagation(); handleMemberRespond(n, 'reject'); }}>
                          ❌ Decline
                        </Button>
                      </div>
                    )}

                    {n.related_id && (n.type === 'registration_approved' || n.type === 'faculty_assigned' || n.type === 'faculty_request') && (
                      <Link
                        to={`/teams/${n.related_id}`}
                        className="inline-block mt-2 text-xs text-blue-600 hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        View Team →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
