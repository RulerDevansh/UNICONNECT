import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import BillShareCard from '../components/BillShareCard';

const BillShare = () => {
  const [shares, setShares] = useState([]);
  const [joinError, setJoinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [activeTab, setActiveTab] = useState('available');
  const { user } = useAuth();

  const loadShares = async () => {
    const { data } = await api.get('/shares');
    setShares(data);
  };

  useEffect(() => {
    loadShares();
  }, []);

  // Filter shares based on active tab
  const userId = user?.id || user?._id;
  const availableShares = shares.filter(share => {
    const hostId = typeof share.host === 'object' ? share.host._id : share.host;
    
    // Check if booking deadline has passed for cab sharing
    const isDeadlinePassed = share.shareType === 'cab' && share.bookingDeadline 
      ? new Date() > new Date(share.bookingDeadline) 
      : false;
    
    // Check if all seats are booked for cab sharing
    const isFullyBooked = share.shareType === 'cab' && share.maxPassengers 
      ? share.members.length >= share.maxPassengers
      : false;
    
    return hostId !== userId && 
      !share.members.some(m => {
        const memberId = typeof m.user === 'object' ? m.user._id : m.user;
        return memberId === userId;
      }) &&
      !share.pendingRequests.some(r => {
        const reqId = typeof r === 'object' ? r._id : r;
        return reqId === userId;
      }) &&
      !isDeadlinePassed && // Exclude shares with expired booking deadline
      !isFullyBooked; // Exclude shares with all seats booked
  });

  const myRequestsShares = shares.filter(share => {
    const hostId = typeof share.host === 'object' ? share.host._id : share.host;
    const isNotHost = hostId !== userId;
    
    // Include shares where user has pending request OR is a member (approved or cancelled)
    const hasPendingRequest = share.pendingRequests.some(r => {
      const reqId = typeof r === 'object' ? r._id : r;
      return reqId === userId;
    });
    
    const isMember = share.members.some(m => {
      const memberId = typeof m.user === 'object' ? m.user._id : m.user;
      return memberId === userId;
    });
    
    // For cab sharing, hide after departure time passes (including cancelled bookings)
    if (share.shareType === 'cab' && share.departureTime) {
      const hasDeparted = new Date() > new Date(share.departureTime);
      if (hasDeparted) return false;
    }
    
    return isNotHost && (hasPendingRequest || isMember);
  });

  const receivedRequestsShares = shares.filter(share => {
    const hostId = typeof share.host === 'object' ? share.host._id : share.host;
    if (hostId !== userId) return false;
    
    // Show shares with pending requests OR approved members (until departure time for cab sharing)
    const hasPendingRequests = share.pendingRequests.length > 0;
    const hasApprovedMembers = share.members.length > 1; // More than just the host
    
    // For cab sharing, only show if departure time hasn't passed
    if (share.shareType === 'cab' && share.departureTime) {
      const hasDeparted = new Date() > new Date(share.departureTime);
      if (hasDeparted) return false;
    }
    
    return hasPendingRequests || hasApprovedMembers;
  });

  const [cancellingId, setCancellingId] = useState('');

  const requestJoin = async (shareId) => {
    setJoinError('');
    setJoiningId(shareId);
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/join`);
      loadShares();
      setSuccessMessage('Join request submitted');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to request join');
    } finally {
      setJoiningId('');
    }
  };

  const cancelRequest = async (shareId) => {
    setJoinError('');
    setCancellingId(shareId);
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/cancel`);
      loadShares();
      setSuccessMessage('Booking cancelled successfully');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancellingId('');
    }
  };

  const approveRequest = async (shareId, userId) => {
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/approve`, { userId });
      loadShares();
      setSuccessMessage('Member approved');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to approve member');
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-white">Sharing</h1>
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-white">Browse Shares</h2>
            <div className="space-y-1 text-right text-sm">
              {joinError && <p className="text-red-300">{joinError}</p>}
              {successMessage && <p className="text-emerald-300">{successMessage}</p>}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-700">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'available'
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Available Shares
            </button>
            <button
              onClick={() => setActiveTab('myRequests')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'myRequests'
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Requests {myRequestsShares.length > 0 && (
                <span className="ml-1 rounded-full bg-brand-primary px-2 py-0.5 text-xs text-white">
                  {myRequestsShares.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('receivedRequests')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'receivedRequests'
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Received Requests {receivedRequestsShares.length > 0 && (
                <span className="ml-1 rounded-full bg-brand-primary px-2 py-0.5 text-xs text-white">
                  {receivedRequestsShares.reduce((acc, share) => acc + share.pendingRequests.length, 0)}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'available' && (
            <div className="space-y-4">
              {availableShares.map((share) => (
                <BillShareCard
                  key={share._id}
                  share={share}
                  onJoin={requestJoin}
                  onCancel={cancelRequest}
                  onApprove={approveRequest}
                  joiningId={joiningId}
                  cancellingId={cancellingId}
                  currentUserId={user?.id || user?._id}
                />
              ))}
              {!availableShares.length && (
                <p className="text-sm text-slate-400">No available shares at the moment.</p>
              )}
            </div>
          )}

          {activeTab === 'myRequests' && (
            <div className="space-y-4">
              {myRequestsShares.map((share) => (
                <BillShareCard
                  key={share._id}
                  share={share}
                  onJoin={requestJoin}
                  onCancel={cancelRequest}
                  onApprove={approveRequest}
                  joiningId={joiningId}
                  cancellingId={cancellingId}
                  currentUserId={user?.id || user?._id}
                />
              ))}
              {!myRequestsShares.length && (
                <p className="text-sm text-slate-400">You haven't sent any join requests yet.</p>
              )}
            </div>
          )}

          {activeTab === 'receivedRequests' && (
            <div className="space-y-4">
              {receivedRequestsShares.map((share) => (
                <BillShareCard
                  key={share._id}
                  share={share}
                  onJoin={requestJoin}
                  onCancel={cancelRequest}
                  onApprove={approveRequest}
                  cancellingId={cancellingId}
                  joiningId={joiningId}
                  currentUserId={user?.id || user?._id}
                />
              ))}
              {!receivedRequestsShares.length && (
                <p className="text-sm text-slate-400">No pending requests for your shares.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default BillShare;
