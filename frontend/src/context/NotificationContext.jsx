import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!socket || !user) return undefined;
    const handleNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };
    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, user]);

  const markAllReadLocal = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const decrementUnread = useCallback(() => {
    setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, markAllReadLocal, decrementUnread, setUnreadCount }),
    [unreadCount, refreshUnreadCount, markAllReadLocal, decrementUnread]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
