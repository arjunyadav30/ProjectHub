import { useEffect, useState } from 'react';
import { Badge } from '../../components/common';

export const formatIST = (date) => date
  ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const statusClasses = {
  up: 'approved', slow: 'pending', down: 'rejected', unknown: 'closed', no_link: 'closed',
  scheduled: 'open', in_progress: 'pending', completed: 'completed', cancelled: 'rejected',
};

export const StatusPill = ({ status }) => (
  <Badge variant={statusClasses[status] || 'default'}>{String(status || 'unknown').replace(/_/g, ' ')}</Badge>
);

export const useCountdown = (targetDate) => {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!targetDate) { setRemaining(''); return undefined; }
    const update = () => {
      const seconds = Math.max(0, Math.floor((new Date(targetDate).getTime() - Date.now()) / 1000));
      setRemaining(seconds ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m` : 'Starting now');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);
  return remaining;
};

export const ScoreBar = ({ value = 0 }) => (
  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
    <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} />
  </div>
);

export const getData = response => response?.data?.data ?? response?.data ?? {};
export const errorMessage = error => error?.response?.status === 429
  ? 'Cooldown active. Please try again in a minute.'
  : error?.response?.data?.message || error?.message || 'Something went wrong.';
