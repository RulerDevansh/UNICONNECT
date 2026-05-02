import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { tokenStorage } from './storage';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

const getExpoHostApiUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;
  const host = hostUri?.split(':')?.[0];
  if (!host) return '';
  return `http://${host}:5000/api`;
};

const normalizeBaseUrl = (url) => (url ? url.replace(/\/+$/, '') : '');

export const API_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiUrl ||
  getExpoHostApiUrl() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api')
);

export const SOCKET_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  extra.socketUrl ||
  API_URL.replace(/\/api$/, '') ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000')
);

export const refreshAccessToken = async () => {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('Missing refresh token');
  const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  await tokenStorage.setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data.accessToken;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve(token);
  });
  queue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      refreshing = true;
      try {
        const accessToken = await refreshAccessToken();
        processQueue(null, accessToken);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await tokenStorage.clear();
        return Promise.reject(refreshErr);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
