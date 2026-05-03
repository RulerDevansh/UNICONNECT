import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const useChatLauncher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { pushToast } = useToast();

  return useCallback(
    async (targetUserId, options = {}) => {
      const { listingId } = options;
      if (!listingId && !targetUserId) return;
      if (!user) {
        navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
        return;
      }
      try {
        const payload = {};
        if (listingId) payload.listingId = listingId;
        if (targetUserId) payload.userId = targetUserId;
        const { data } = await api.post('/chats', payload);
        navigate(`/chat?chatId=${data._id}`);
      } catch (err) {
        console.error('Failed to start chat', err);
        pushToast(err.response?.data?.message || 'Unable to open chat right now.', { type: 'error' });
      }
    },
    [location.pathname, location.search, navigate, pushToast, user]
  );
};

export default useChatLauncher;
