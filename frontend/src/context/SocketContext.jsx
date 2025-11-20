import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setHasNewMessage(false);
      return;
    }
    const instance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      autoConnect: true,
      auth: {
        token: localStorage.getItem('accessToken'),
      },
    });
    setSocket(instance);
    return () => {
      instance.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = (message) => {
      const sender = message?.sender;
      const rawSender = sender?._id ?? sender;
      const senderId = typeof rawSender === 'string' ? rawSender : rawSender?.toString?.();
      if (senderId && senderId === user?.id) return;
      setHasNewMessage(true);
    };
    socket.on('message', handleMessage);
    return () => {
      socket.off('message', handleMessage);
    };
  }, [socket, user?.id]);

  const clearNewMessage = useCallback(() => {
    setHasNewMessage(false);
  }, []);

  const value = useMemo(() => ({ socket, hasNewMessage, clearNewMessage }), [socket, hasNewMessage, clearNewMessage]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
