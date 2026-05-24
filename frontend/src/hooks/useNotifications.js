import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../api';
import { useLiveRefresh } from './useLiveRefresh';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationAPI.getAll({ limit: 50 });
      const list = data.data.notifications || [];
      setNotifications(list);
      setUnreadCount(data.data.unreadCount ?? list.filter(n => !n.is_read).length);
    } catch {}
    setLoading(false);
  }, []);

  useLiveRefresh(fetch, ['notifications', 'dashboard', '*']);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  const markRead = async (id) => {
    await notificationAPI.markRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, loading, fetch, markRead, markAllRead };
};
