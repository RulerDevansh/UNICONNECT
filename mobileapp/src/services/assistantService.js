import api from './api';

export const chatWithAssistant = (payload) => api.post('/ai/chat', payload);

