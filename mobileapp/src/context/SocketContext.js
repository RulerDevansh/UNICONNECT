import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, refreshAccessToken } from '../services/api';
import { tokenStorage } from '../services/storage';
import { useAuth } from './AuthContext';
import { getId } from '../utils/id';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    let instance;
    let active = true;
    let authRefreshAttempted = false;

    const connect = async () => {
      if (!user) {
        setSocket((prev) => {
          prev?.disconnect();
          return null;
        });
        socketRef.current = null;
        setIsConnected(false);
        setConnectionError('');
        setHasNewMessage(false);
        return;
      }

      setIsConnected(false);
      setConnectionError('');
      const token = await tokenStorage.getAccessToken();
      if (!active) return;

      instance = io(SOCKET_URL, {
        autoConnect: true,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true,
        multiplex: false,
        path: '/socket.io',
        auth: { token: token || '' },
      });

      const handleConnect = () => {
        if (!active) return;
        authRefreshAttempted = false;
        setIsConnected(true);
        setConnectionError('');
      };

      const handleDisconnect = (reason) => {
        if (!active) return;
        setIsConnected(false);
        if (reason && !reason.includes('ping timeout') && !reason.includes('transport close')) {
          setConnectionError(`Chat disconnected: ${reason}`);
        }
      };

      const handleConnectError = async (err) => {
        if (!active) return;
        const message = err?.message || err?.data?.message || 'Unable to connect chat socket.';
        setIsConnected(false);

        if (/auth|jwt|token/i.test(message)) {
          if (authRefreshAttempted) {
            setConnectionError('Chat session expired. Please log in again.');
            return;
          }

          authRefreshAttempted = true;
          try {
            const refreshedToken = await refreshAccessToken();
            if (!active) return;
            instance.auth = { token: refreshedToken };
            instance.connect();
          } catch {
            if (active) setConnectionError('Chat session expired. Please log in again.');
          }
          return;
        }

        setConnectionError(
          /websocket|transport/i.test(message)
            ? 'Chat socket unreachable. Check deployed backend WebSockets setting.'
            : message
        );
      };

      instance.on('connect', handleConnect);
      instance.on('disconnect', handleDisconnect);
      instance.on('connect_error', handleConnectError);
      socketRef.current = instance;
      
      if (!active) {
        instance.disconnect();
        return;
      }
      setSocket(instance);
    };

    connect();
    return () => {
      active = false;
      socketRef.current = null;
      instance?.disconnect();
    };
  }, [user]);

  const reconnectSocket = useCallback(async () => {
    const current = socketRef.current;
    if (!current) return;
    current.auth = { token: (await tokenStorage.getAccessToken()) || '' };
    current.connect();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = (message) => {
      if (getId(message?.sender) === getId(user)) return;
      setHasNewMessage(true);
    };
    socket.on('message', handleMessage);
    return () => socket.off('message', handleMessage);
  }, [socket, user]);

  const clearNewMessage = useCallback(() => setHasNewMessage(false), []);

  const value = useMemo(
    () => ({ socket, isConnected, connectionError, reconnectSocket, hasNewMessage, clearNewMessage }),
    [socket, isConnected, connectionError, reconnectSocket, hasNewMessage, clearNewMessage]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
