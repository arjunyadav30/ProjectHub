import { useCallback, useState } from 'react';
import { facultyAPI, notificationAPI, teamAPI } from '../api';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../components/common/Layout';
import { Button } from '../components/common';
import { Bell, CheckCheck, CheckCircle, Circle, ExternalLink, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data.data?.notifications || res.data.data || []);
    } catch (e) { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  }, []);

  useRefetchOnFocus(fetchNotifications, { liveScopes: ['notifications', '*'] });

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(n => n.map(notif => notif._id === id ? { ...notif, is_read: true } : notif));
    } catch (e) { toast.error('Could not mark as read'); }
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(n => n.map(notif => ({ ...notif, is_read: true })));
      toast.success('All marked as read');
    } catch (e) { toast.error('Failed'); }
  };

  const getTeamId = (notification) => notification.related_id || notification.reference_id;

  const getNotificationLink = (notification) => {
    const relatedId = notification.related_id || notification.reference_id;
    if (!relatedId) return '';
    if (notification.type === 'chat_message') return `/chat/group/${relatedId}`;
    if (notification.type === 'direct_message') return `/chat/direct/${relatedId}`;
    if (notification.type === 'presentation_schedule') return `/events/${relatedId}`;
    if (notification.type === 'submission_review') return `/review-submission/${relatedId}`;
    return `/teams/${relatedId}`;
  };

  const respondToNotification = async (notification, action) => {
    const teamId = getTeamId(notification);
    if (!teamId) {
      toast.error('Team reference missing');
      return;
    }

    setResponding(`${notification._id}-${action}`);
    try {
      if (notification.type === 'mentor_request') {
        await facultyAPI.respondMentorRequest(teamId, action === 'accept' ? 'accepted' : 'rejected');
      } else if (notification.type === 'leader_request') {
        await teamAPI.respondLeader(teamId, action);
      } else {
        await teamAPI.respondInvite(teamId, action);
      }

      const status = action === 'accept' ? 'accepted' : 'rejected';
      await notificationAPI.markRead(notification._id);
      setNotifications(items => items.map(item => {
        const sameTeam = getTeamId(item) && getTeamId(item) === teamId;
        const sameActionType = item.type === notification.type;
        if (item._id === notification._id || (sameTeam && sameActionType)) {
          return { ...item, is_read: true, action_status: status, is_actionable: false };
        }
        return item;
      }));
      toast.success(action === 'accept' ? 'Accepted successfully' : 'Rejected successfully');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to respond');
    } finally {
      setResponding('');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const typeColor = {
    team_invite: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    mentor_request: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    marks_added: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    submission_accepted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    submission_rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    submission_review: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    presentation_schedule: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    semester_promoted: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    new_suggestion: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    chat_message: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
    direct_message: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            {unreadCount > 0 && <p className="text-sm text-gray-500">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-200 dark:bg-gray-700" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card p-16 text-center text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => {
              const teamId = getTeamId(notif);
              const isActionable = notif.is_actionable === true;
              const resolvedStatus = ['accepted', 'rejected'].includes(notif.action_status)
                ? notif.action_status
                : null;
              const notificationLink = getNotificationLink(notif);

              return (
              <div
                key={notif._id}
                onClick={() => !notif.is_read && markRead(notif._id)}
                className={`card p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                  !notif.is_read ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : ''
                }`}>
                <div className="mt-1 flex-shrink-0">
                  {notif.is_read
                    ? <Circle className="w-2.5 h-2.5 text-gray-300" />
                    : <Circle className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {notif.title && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[notif.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
                        {notif.title}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                  {resolvedStatus && (
                    <p className={`text-xs font-medium mt-2 ${
                      resolvedStatus === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {resolvedStatus === 'accepted' ? '✓ You accepted this request' : '✗ You rejected this request'}
                    </p>
                  )}
                  {isActionable && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="success"
                        loading={responding === `${notif._id}-accept`}
                        disabled={!!responding}
                        onClick={(e) => {
                          e.stopPropagation();
                          respondToNotification(notif, 'accept');
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {notif.type === 'leader_request' ? 'Accept Leadership' : notif.type === 'mentor_request' ? 'Accept Mentor' : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={responding === `${notif._id}-reject`}
                        disabled={!!responding}
                        onClick={(e) => {
                          e.stopPropagation();
                          respondToNotification(notif, 'reject');
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {notificationLink && !isActionable && (
                    <Link
                      to={notificationLink}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {notif.type === 'chat_message' || notif.type === 'direct_message'
                        ? 'Open Chat'
                        : notif.type === 'presentation_schedule'
                          ? 'View Event'
                          : notif.type === 'submission_review'
                            ? 'Review Submission'
                          : 'View Team'} <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
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

export default Notifications;
