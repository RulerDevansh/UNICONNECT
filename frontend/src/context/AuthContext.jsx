import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, login as loginApi, logout as logoutApi, register as registerApi } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    try {
      if (!localStorage.getItem('accessToken')) {
        setLoading(false);
        return;
      }
      const { data } = await getProfile();
      setUser(data);
    } catch (err) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await loginApi(credentials);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await registerApi(payload);
    // Email verification is required before login; do NOT auto-login here.
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi({ refreshToken: localStorage.getItem('refreshToken') });
    } catch (err) {
      // ignore client-side logouts failing due to expired session
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
