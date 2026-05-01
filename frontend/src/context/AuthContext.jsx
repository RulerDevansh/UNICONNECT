import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, login as loginApi, logout as logoutApi, register as registerApi, updateLocation } from '../services/authService';
import { useGeolocation } from '../hooks/useGeolocation';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getCurrentLocation } = useGeolocation();

  const bootstrap = async () => {
    try {
      if (!localStorage.getItem('accessToken')) {
        setLoading(false);
        return;
      }
      const { data } = await getProfile();
      if (data?.suspended) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data);
    } catch {
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

    // Collect a high-confidence browser location after login without blocking navigation.
    (async () => {
      try {
        const { data: profile } = await getProfile();
        setUser(profile);

        // A manually pinned location is more trustworthy than a browser estimate.
        if (profile?.location?.source === 'manual') return;

        const locationData = await getCurrentLocation({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          watchForAccuracy: true,
          desiredAccuracy: 200,
          maxAcceptableAccuracy: 5000,
          watchTimeout: 12000,
        });
        if (!locationData) return;

        await updateLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address,
          accuracy: locationData.accuracy,
          source: locationData.source,
        });

        try {
          const { data: updatedProfile } = await getProfile();
          setUser(updatedProfile);
        } catch (err) {
          console.warn('Failed to refresh profile after location update:', err.message);
          setUser((prev) => ({
            ...prev,
            location: {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              address: locationData.address,
              accuracy: locationData.accuracy,
              source: locationData.source,
            },
          }));
        }
      } catch (err) {
        console.log('Location collection failed:', err.message);
      }
    })();

    return data.user;
  }, [getCurrentLocation]);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await getProfile();
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await registerApi(payload);
    // Email verification is required before login; do NOT auto-login here.
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi({ refreshToken: localStorage.getItem('refreshToken') });
    } catch {
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
      refreshProfile,
      logout,
    }),
    [user, loading, login, register, refreshProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
