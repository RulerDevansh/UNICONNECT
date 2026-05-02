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
  const heartbeatRef = useRef(null);

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
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        return;
      }

      setIsConnected(false);
      setConnectionError('');
      
      instance = io(SOCKET_URL, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: false,
        multiplex: true,
        rejectUnauthorized: false, // For self-signed certs in dev
        auth: async (callback) => {
          try {
            const token = await tokenStorage.getAccessToken();
            callback({ token });
          } catch (err) {
            callback({ token: '' });
          }
        },
      });

      const handleConnect = () => {
        if (!active) return;
        authRefreshAttempted = false;
        setIsConnected(true);
        setConnectionError('');
        
        // Start heartbeat to detect dead connections
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (instance?.connected) {
            instance.emit('ping', () => {});
          }
        }, 25000); // Ping every 25 seconds
      };

      const handleDisconnect = (reason) => {
        if (!active) return;
        setIsConnected(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        
        // Don't show error on normal disconnect, only on auth errors or network issues
        if (reason && (reason.includes('auth') || reason.includes('ECONNREFUSED'))) {
          setConnectionError('Chat disconnected. Reconnecting...');
        }
      };

      const handleConnectError = async (err) => {
        if (!active) return;
        const message = err?.message || 'Unable to connect chat socket.';
        setIsConnected(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);

        if (authRefreshAttempted || !/auth|jwt|token/i.test(message)) {
          // Only show error on auth issues, other errors will trigger reconnection
          if (/auth|jwt|token/i.test(message)) {
            setConnectionError(message);
          }
          return;
        }

        authRefreshAttempted = true;
        try {
          const token = await refreshAccessToken();
          if (!active) return;
          instance.auth = { token };
          instance.connect();
        } catch {
          if (active) setConnectionError('Chat session expired. Please log in again.');
        }
      };

      instance.on('connect', handleConnect);
      instance.on('disconnect', handleDisconnect);
      instance.on('connect_error', handleConnectError);
      socketRef.current = instance;
      
      if (!active) {
        instance.disconnect();
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        return;
      }
      setSocket(instance);
    };

    connect();
    return () => {
      active = false;
      socketRef.current = null;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      instance?.disconnect();
    };
  }, [user]);

  const reconnectSocket = useCallback(async () => {
    const current = socketRef.current;
    if (!current) return;
    current.auth = { token: await tokenStorage.getAccessToken() };
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
