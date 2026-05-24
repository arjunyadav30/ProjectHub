import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveRefresh } from './useLiveRefresh';

/**
 * Refetch on tab focus, navigation, optional polling, and realtime socket updates.
 */
export function useRefetchOnFocus(refetch, { pollMs = 30000, liveScopes = ['*'] } = {}) {
  useLiveRefresh(refetch, liveScopes);
  const location = useLocation();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    refetchRef.current();
  }, [location.key]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!pollMs) return undefined;
    const id = setInterval(() => refetchRef.current(), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);
}
