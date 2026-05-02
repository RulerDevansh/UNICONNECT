import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getProfile,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  updateLocation,
} from '../services/authService';
import { tokenStorage } from '../services/storage';
import { useGeolocation } from '../hooks/useGeolocation';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getCurrentLocation } = useGeolocation();

  const bootstrap = useCallback(async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await getProfile();
      if (data?.suspended) {
        await tokenStorage.clear();
        setUser(null);
        return;
      }
      setUser(data);
    } catch {
      await tokenStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (credentials) => {
      const { data } = await loginApi(credentials);
      await tokenStorage.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      setUser(data.user);

      (async () => {
        try {
          const { data: profile } = await getProfile();
          setUser(profile);
          if (profile?.location?.source === 'manual') return;
          const loc = await getCurrentLocation();
          if (!loc) return;
          await updateLocation(loc);
          const { data: updated } = await getProfile();
          setUser(updated);
        } catch {
          // Location refresh is opportunistic and should not block login.
        }
      })();

      return data.user;
    },
    [getCurrentLocation]
  );

  const register = useCallback(async (payload) => {
    const { data } = await registerApi(payload);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await getProfile();
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      await logoutApi({ refreshToken });
    } catch {
      // Expired sessions can still be cleared locally.
    }
    await tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      register,
      refreshProfile,
      setUser,
    }),
    [user, loading, login, logout, register, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

