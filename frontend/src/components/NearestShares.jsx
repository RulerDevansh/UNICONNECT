import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SharePreviewCard from './SharePreviewCard';
import { hasCoordinates } from '../utils/locationUtils';

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return value._id || value.id || value.toString?.() || '';
  }
  return '';
};

const getShareJoinState = (share, currentUserId) => {
  const members = share.members || [];
  const joinedMembersCount = members.filter((member) => member.status === 'joined').length;
  const hostId = normalizeId(share.host);
  const isHost = hostId === currentUserId;
  const isMember = members.some((member) => normalizeId(member.user) === currentUserId);
  const isPending = (share.pendingRequests || []).some((request) => normalizeId(request) === currentUserId);
  const isRejected = (share.rejectedRequests || []).some((request) => normalizeId(request.user) === currentUserId);

  let isDeadlinePassed = false;
  let isFull = false;
  if (share.shareType === 'cab') {
    isDeadlinePassed = share.bookingDeadline ? new Date() > new Date(share.bookingDeadline) : false;
    isFull = share.maxPassengers ? joinedMembersCount >= share.maxPassengers : false;
  } else if (share.shareType === 'food') {
    isDeadlinePassed = share.deadlineTime ? new Date() > new Date(share.deadlineTime) : false;
    isFull = share.maxPersons ? joinedMembersCount >= share.maxPersons : false;
  } else {
    isDeadlinePassed = share.otherDeadline ? new Date() > new Date(share.otherDeadline) : false;
    isFull = share.otherMaxPersons ? joinedMembersCount >= share.otherMaxPersons : false;
  }

  if (isHost) return { disabled: true, label: 'You are hosting' };
  if (isMember) return { disabled: true, label: 'Already Joined' };
  if (isPending) return { disabled: true, label: 'Request Pending' };
  if (isRejected) return { disabled: true, label: 'Request Rejected' };
  if (isFull) return { disabled: true, label: 'Fully Booked' };
  if (isDeadlinePassed) return { disabled: true, label: 'Booking Closed' };
  return { disabled: false, label: 'Request to Join' };
};

const NearestShares = ({ radiusKm = 10 }) => {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [joiningId, setJoiningId] = useState('');
  const currentUserId = user?.id || user?._id || '';

  const fetchNearestShares = useCallback(async () => {
    if (!hasCoordinates(user?.location)) {
      return;
    }

    try {
      setLoading(true);
      setAvailable(true);

      const response = await api.get('/recommendations/nearby', {
        params: {
          maxDistanceKm: radiusKm,
          limit: 6,
        },
      });

      if (response.data?.success && response.data?.data?.shares) {
        setShares(response.data.data.shares);
      } else {
        setShares([]);
      }
    } catch {
      // Silent failure - nearby service unavailable (graceful degradation)
      setAvailable(false);
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [radiusKm, user?.location]);

  useEffect(() => {
    fetchNearestShares();
  }, [fetchNearestShares]);

  const requestJoin = async (shareId) => {
    setJoiningId(shareId);
    try {
      await api.post(`/shares/${shareId}/join`);
      pushToast('Join request submitted.', { type: 'success' });
      await fetchNearestShares();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to request join.', { type: 'error' });
    } finally {
      setJoiningId('');
    }
  };

  if (!hasCoordinates(user?.location) || !available) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Nearest Shares</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Loading nearby shares…</p>
      ) : shares.length === 0 ? (
        <p className="text-sm text-slate-400">No shares within {radiusKm} km yet.</p>
      ) : (
        <div className="space-y-4">
          {shares.map((share) => {
            const joinState = getShareJoinState(share, currentUserId);
            const isJoining = joiningId === share._id;
            return (
              <div key={share._id}>
                <SharePreviewCard share={share} />
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => requestJoin(share._id)}
                    disabled={joinState.disabled || isJoining}
                    className="inline-flex w-full items-center justify-center rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {isJoining ? 'Requesting…' : joinState.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NearestShares;
