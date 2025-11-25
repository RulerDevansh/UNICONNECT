import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const useChatLauncher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return useCallback(
    async (listingId, targetUserId) => {
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
        alert(err.response?.data?.message || 'Unable to open chat right now.');
      }
    },
    [location.pathname, location.search, navigate, user]
  );
};

export default useChatLauncher;
