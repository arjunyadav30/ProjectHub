import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);
const SOCKET_URL = window.location.origin;

export const RealtimeProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const listenersRef = useRef(new Set());

  const subscribe = useCallback((handler) => {
    listenersRef.current.add(handler);
    return () => listenersRef.current.delete(handler);
  }, []);

  useEffect(() => {
    if (!user?._id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    const socket = io(`${SOCKET_URL}/sync`, {
      withCredentials: true,
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('data_changed', (payload) => {
      listenersRef.current.forEach((handler) => {
        try { handler(payload); } catch (_) { /* ignore listener errors */ }
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) return { subscribe: () => () => {} };
  return ctx;
};
