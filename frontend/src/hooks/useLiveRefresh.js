import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext';

export const matchesLiveScope = (payload, scopes = ['*']) => {
  if (!payload || scopes.includes('*')) return true;

  const payloadScopes = payload.scopes || (payload.scope ? [payload.scope] : []);

  if (payloadScopes.some((s) => scopes.includes(s))) return true;
  if (payload.teamId && scopes.includes(`team:${payload.teamId}`)) return true;
  if (payload.eventId && scopes.includes(`event:${payload.eventId}`)) return true;

  return false;
};

export function useLiveRefresh(refetch, scopes = ['*']) {
  const { subscribe } = useRealtime();
  const refetchRef = useRef(refetch);
  const scopesRef = useRef(scopes);

  refetchRef.current = refetch;
  scopesRef.current = scopes;

  useEffect(() => subscribe((payload) => {
    if (matchesLiveScope(payload, scopesRef.current)) {
      refetchRef.current();
    }
  }), [subscribe]);
}
