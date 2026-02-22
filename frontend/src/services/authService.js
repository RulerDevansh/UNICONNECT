import api from './api';

export const register = (payload) => api.post('/auth/register', payload);
export const login = (payload) => api.post('/auth/login', payload);
export const logout = (payload) => api.post('/auth/logout', payload);
export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const getProfile = () => api.get('/users/me');
export const verifyEmail = (payload) => api.post('/auth/verify-email', payload);
export const resendVerification = (payload) => api.post('/auth/resend-verification', payload);
export const forgotPassword = (payload) => api.post('/auth/forgot-password', payload);
export const resetPassword = (payload) => api.post('/auth/reset-password', payload);
