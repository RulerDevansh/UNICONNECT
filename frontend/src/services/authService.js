import api from './api';

export const register = (payload) => api.post('/auth/register', payload);
export const login = (payload) => api.post('/auth/login', payload);
export const logout = (payload) => api.post('/auth/logout', payload);
export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const getProfile = () => api.get('/users/me');
