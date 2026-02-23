import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import BillShareCard from '../components/BillShareCard';

const BillShare = () => {
  const [shares, setShares] = useState([]);
  const [myShares, setMyShares] = useState([]);
  const [joinError, setJoinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [activeTab, setActiveTab] = useState('available');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateShareId, setUpdateShareId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    shareType: 'cab',
    fromCity: '',
    toCity: '',
    departureTime: '',
    arrivalTime: '',
    bookingDeadline: '',
    maxPassengers: 4,
    vehicleType: '',
    foodItems: '',
    quantity: 1,
    minPersons: 2,
    maxPersons: 10,
    deadlineTime: '',
    category: '',
    otherMinPersons: 2,
    otherMaxPersons: 10,
    otherDeadline: '',
    totalAmount: 0,
    splitType: 'equal',
    hostContribution: 0
  });
  const { user } = useAuth();

  const loadShares = async () => {
    const { data } = await api.get('/shares');
    setShares(data);
    
    // Filter my shares (where user is host)
    const userId = user?.id || user?._id;
    const now = new Date();
    const hostShares = data.filter(share => {
      const hostId = typeof share.host === 'object' ? share.host._id : share.host;
      const isHost = hostId === userId;
      
      if (isHost && (share.status === 'closed' || share.status === 'cancelled')) {
        const deadlineTime = share.shareType === 'cab' ? share.departureTime : 
                             share.shareType === 'food' ? share.deadlineTime : 
                             share.otherDeadline;
        if (deadlineTime) {
          const timeSinceDeadline = now - new Date(deadlineTime);
          const hoursSinceDeadline = timeSinceDeadline / (1000 * 60 * 60);
          if (hoursSinceDeadline > 24) return false;
        }
      }
      
      if (isHost && share.status === 'open') {
        if (share.shareType === 'cab' && share.departureTime) {
          const hasDeparted = new Date(share.departureTime) < now;
          if (hasDeparted) return false;
        }
        if (share.shareType === 'food' && share.deadlineTime) {
          const isPastDeadline = new Date(share.deadlineTime) < now;
          if (isPastDeadline) return false;
        }
        if (share.shareType === 'other' && share.otherDeadline) {
          const isPastDeadline = new Date(share.otherDeadline) < now;
          if (isPastDeadline) return false;
        }
      }
      
      return isHost;
    });
    setMyShares(hostShares);
  };

  useEffect(() => {
    loadShares();
  }, [user?.id, user?._id]);

  // Filter shares based on active tab
  const userId = user?.id || user?._id;
  const availableShares = shares.filter(share => {
    const hostId = typeof share.host === 'object' ? share.host._id : share.host;
    
    // Check deadlines based on share type
    let isDeadlinePassed = false;
    let isFullyBooked = false;
    const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
    
    if (share.shareType === 'cab') {
      // Check if booking deadline has passed for cab sharing
      isDeadlinePassed = share.bookingDeadline 
        ? new Date() > new Date(share.bookingDeadline) 
        : false;
      
      // Check if all seats are booked for cab sharing
      isFullyBooked = share.maxPassengers 
        ? joinedMembersCount >= share.maxPassengers
        : false;
    } else if (share.shareType === 'food') {
      // Check if order deadline has passed for food sharing
      isDeadlinePassed = share.deadlineTime 
        ? new Date() > new Date(share.deadlineTime) 
        : false;
      
      // Check if max persons reached for food sharing
      isFullyBooked = share.maxPersons 
        ? joinedMembersCount >= share.maxPersons
        : false;
    } else if (share.shareType === 'other') {
      // Check if deadline has passed for other sharing
      isDeadlinePassed = share.otherDeadline 
        ? new Date() > new Date(share.otherDeadline) 
        : false;
      
      // Check if max persons reached for other sharing
      isFullyBooked = share.otherMaxPersons 
        ? joinedMembersCount >= share.otherMaxPersons
        : false;
    }
    
    return hostId !== userId && 
      !share.members.some(m => {
        const memberId = typeof m.user === 'object' ? m.user._id : m.user;
        return memberId === userId;
      }) &&
      !share.pendingRequests.some(r => {
        const reqId = typeof r === 'object' ? r._id : r;
        return reqId === userId;
      }) &&
      !isDeadlinePassed && // Exclude shares with expired deadline
      !isFullyBooked; // Exclude shares that are fully booked
  });

  const myRequestsShares = shares.filter(share => {
    const hostId = typeof share.host === 'object' ? share.host._id : share.host;
    const isNotHost = hostId !== userId;
    
    // Include shares where user has pending request OR is a member (approved or cancelled) OR has rejected request
    const hasPendingRequest = share.pendingRequests.some(r => {
      const reqId = typeof r === 'object' ? r._id : r;
      return reqId === userId;
    });
    
    const isMember = share.members.some(m => {
      const memberId = typeof m.user === 'object' ? m.user._id : m.user;
      return memberId === userId;
    });
    
    // Check if user has a rejected request
    const hasRejectedRequest = share.rejectedRequests?.some(r => {
      const rejectedUserId = typeof r.user === 'object' ? r.user._id : r.user;
      return rejectedUserId === userId;
    });
    
    // For cab sharing, hide after departure time passes (including cancelled bookings and rejected requests)
    if (share.shareType === 'cab' && share.departureTime) {
      const hasDeparted = new Date() > new Date(share.departureTime);
      if (hasDeparted) return false;
    }
    
    // For food sharing, hide after deadline time passes (including cancelled orders and rejected requests)
    if (share.shareType === 'food' && share.deadlineTime) {
      const isPastDeadline = new Date() > new Date(share.deadlineTime);
      if (isPastDeadline) return false;
    }
    
    // For other sharing, hide after deadline time passes
    if (share.shareType === 'other' && share.otherDeadline) {
      const isPastDeadline = new Date() > new Date(share.otherDeadline);
      if (isPastDeadline) return false;
    }
    
    return isNotHost && (hasPendingRequest || isMember || hasRejectedRequest);
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
    
    // For food sharing, only show if deadline time hasn't passed
    if (share.shareType === 'food' && share.deadlineTime) {
      const isPastDeadline = new Date() > new Date(share.deadlineTime);
      if (isPastDeadline) return false;
    }
    
    // For other sharing, only show if deadline time hasn't passed
    if (share.shareType === 'other' && share.otherDeadline) {
      const isPastDeadline = new Date() > new Date(share.otherDeadline);
      if (isPastDeadline) return false;
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

  const rejectRequest = async (shareId, userId) => {
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/reject`, { userId });
      loadShares();
      setSuccessMessage('Request rejected');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to reject request');
    }
  };

  const createShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/shares', form);
      setForm({
        name: '',
        description: '',
        shareType: 'cab',
        fromCity: '',
        toCity: '',
        departureTime: '',
        arrivalTime: '',
        bookingDeadline: '',
        maxPassengers: 4,
        vehicleType: '',
        foodItems: '',
        quantity: 1,
        minPersons: 2,
        maxPersons: 10,
        deadlineTime: '',
        category: '',
        otherMinPersons: 2,
        otherMaxPersons: 10,
        otherDeadline: '',
        totalAmount: 0,
        splitType: 'equal',
        hostContribution: 0
      });
      setShowCreateForm(false);
      loadShares();
      setSuccessMessage('Share created successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create share');
    }
  };

  const handleUpdate = (shareId) => {
    const shareToUpdate = myShares.find(s => s._id === shareId);
    if (shareToUpdate) {
      // Calculate current number of joined members
      const currentJoinedMembers = shareToUpdate.members?.filter(m => m.status === 'approved').length || 0;
      
      setForm({
        name: shareToUpdate.name || '',
        description: shareToUpdate.description || '',
        shareType: shareToUpdate.shareType || 'cab',
        fromCity: shareToUpdate.fromCity || '',
        toCity: shareToUpdate.toCity || '',
        departureTime: shareToUpdate.departureTime ? new Date(new Date(shareToUpdate.departureTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        arrivalTime: shareToUpdate.arrivalTime ? new Date(new Date(shareToUpdate.arrivalTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        bookingDeadline: shareToUpdate.bookingDeadline ? new Date(new Date(shareToUpdate.bookingDeadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        maxPassengers: shareToUpdate.maxPassengers || 4,
        vehicleType: shareToUpdate.vehicleType || '',
        foodItems: shareToUpdate.foodItems || '',
        quantity: shareToUpdate.quantity || 1,
        minPersons: shareToUpdate.minPersons || 2,
        maxPersons: shareToUpdate.maxPersons || 10,
        deadlineTime: shareToUpdate.deadlineTime ? new Date(new Date(shareToUpdate.deadlineTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        category: shareToUpdate.category || '',
        otherMinPersons: shareToUpdate.otherMinPersons || 2,
        otherMaxPersons: shareToUpdate.otherMaxPersons || 10,
        otherDeadline: shareToUpdate.otherDeadline ? new Date(new Date(shareToUpdate.otherDeadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        totalAmount: shareToUpdate.totalAmount || 0,
        splitType: shareToUpdate.splitType || 'equal',
        hostContribution: shareToUpdate.hostContribution || 0,
        currentJoinedMembers // Store for validation
      });
      setUpdateShareId(shareId);
      setShowUpdateForm(true);
    }
  };

  const updateShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      await api.put(`/shares/${updateShareId}`, form);
      setForm({
        name: '',
        description: '',
        shareType: 'cab',
        fromCity: '',
        toCity: '',
        departureTime: '',
        arrivalTime: '',
        bookingDeadline: '',
        maxPassengers: 4,
        vehicleType: '',
        foodItems: '',
        quantity: 1,
        minPersons: 2,
        maxPersons: 10,
        deadlineTime: '',
        category: '',
        otherMinPersons: 2,
        otherMaxPersons: 10,
        otherDeadline: '',
        totalAmount: 0,
        splitType: 'equal',
        hostContribution: 0
      });
      setUpdateShareId(null);
      setShowUpdateForm(false);
      loadShares();
      setSuccessMessage('Share updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update share');
    }
  };

  const handleDelete = async (shareId) => {
    if (!confirm('Are you sure you want to delete this share? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/shares/${shareId}`);
      loadShares();
      setSuccessMessage('Share deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete share');
    }
  };

  const handleFinalize = async (shareId) => {
    setError('');
    try {
      await api.put(`/shares/${shareId}/finalize`);
      loadShares();
      setSuccessMessage('Share marked as complete');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete share');
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <main className="mx-auto max-w-full px-4 py-4 sm:py-8">
      <h1 className="mb-4 sm:mb-6 text-2xl sm:text-3xl font-bold text-white">Sharing</h1>
      
      {/* Messages */}
      {(joinError || successMessage || error) && (
        <div className="mb-4 space-y-2">
          {joinError && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{joinError}</p>}
          {successMessage && <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{successMessage}</p>}
          {error && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </div>
      )}
      
      {/* Two Column Layout - Equal Half Split */}
      <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-2">
        {/* Left Column - My Sharing */}
        <div>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">My Sharing</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
              >
                + Create
              </button>
            </div>
            
            <div className="space-y-3">
              {myShares.length > 0 ? (
                myShares.map((share) => (
                  <BillShareCard
                    key={share._id}
                    share={share}
                    onApprove={approveRequest}
                    onReject={rejectRequest}
                    onUpdate={handleUpdate}
                    onFinalize={handleFinalize}
                    onDelete={handleDelete}
                    joiningId={joiningId}
                    currentUserId={user?.id || user?._id}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-400">You haven't created any shares yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Browse Shares */}
        <div>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Browse Shares</h2>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-700 -mx-1 px-1">
              <button
                onClick={() => setActiveTab('available')}
                className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                  activeTab === 'available'
                    ? 'border-b-2 border-brand-primary text-brand-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Available Shares
              </button>
              <button
                onClick={() => setActiveTab('myRequests')}
                className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
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
                className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
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
                    onReject={rejectRequest}
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
                    onReject={rejectRequest}
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
                    onReject={rejectRequest}
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
      </div>

      {/* Create Share Modal - Copy full modal from MySharing.jsx */}
      {showCreateForm && (
        <>
          {error && (
            <p className="fixed left-1/2 top-8 z-[9999] w-full max-w-lg -translate-x-1/2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300 shadow-lg">{error}</p>
          )}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">Create Share</h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setError('');
                  }}
                  className="text-2xl text-slate-400 hover:text-white"
                >
                  Ã—
                </button>
              </div>
              <form onSubmit={createShare} className="space-y-3">
                {/* Full form from MySharing - same structure */}
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Type of Sharing</label>
                  <select
                    value={form.shareType}
                    onChange={(e) => setForm((prev) => ({ ...prev, shareType: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                  >
                    <option value="cab">Cab Sharing</option>
                    <option value="food">Food Sharing</option>
                    <option value="other">Other Sharing</option>
                  </select>
                </div>
                <input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  required
                />
                <textarea
                  placeholder="Description"
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                />
                {/* Rest of form fields will be added similarly */}
                {form.shareType === 'cab' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        placeholder="From City"
                        value={form.fromCity}
                        onChange={(e) => setForm((prev) => ({ ...prev, fromCity: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                        required
                      />
                      <input
                        placeholder="To City"
                        value={form.toCity}
                        onChange={(e) => setForm((prev) => ({ ...prev, toCity: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Departure Time</label>
                        <input
                          type="datetime-local"
                          value={form.departureTime}
                          onChange={(e) => setForm((prev) => ({ ...prev, departureTime: e.target.value }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Arrival Time</label>
                        <input
                          type="datetime-local"
                          value={form.arrivalTime}
                          onChange={(e) => setForm((prev) => ({ ...prev, arrivalTime: e.target.value }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Booking Deadline</label>
                      <input
                        type="datetime-local"
                        value={form.bookingDeadline}
                        onChange={(e) => setForm((prev) => ({ ...prev, bookingDeadline: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Max Passengers</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={form.maxPassengers}
                          onChange={(e) => setForm((prev) => ({ ...prev, maxPassengers: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Vehicle Type</label>
                        <input
                          placeholder="Vehicle Type"
                          value={form.vehicleType}
                          onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </>
                )}
                {form.shareType === 'food' && (
                  <>
                    <input
                      placeholder="Food Items"
                      value={form.foodItems}
                      onChange={(e) => setForm((prev) => ({ ...prev, foodItems: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                      required
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                        <input
                          type="number"
                          min="2"
                          value={form.minPersons}
                          onChange={(e) => setForm((prev) => ({ ...prev, minPersons: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Max Persons</label>
                        <input
                          type="number"
                          min={form.minPersons || 2}
                          value={form.maxPersons}
                          onChange={(e) => setForm((prev) => ({ ...prev, maxPersons: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={form.quantity}
                          onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Delivery Time</label>
                      <input
                        type="datetime-local"
                        value={form.deadlineTime}
                        onChange={(e) => setForm((prev) => ({ ...prev, deadlineTime: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                  </>
                )}
                {form.shareType === 'other' && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="Physical">Physical</option>
                        <option value="Digital">Digital</option>
                        <option value="Ticket">Ticket</option>
                        <option value="Merch">Merch</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                        <input
                          type="number"
                          min="2"
                          value={form.otherMinPersons}
                          onChange={(e) => setForm((prev) => ({ ...prev, otherMinPersons: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Max Persons</label>
                        <input
                          type="number"
                          min="2"
                          value={form.otherMaxPersons}
                          onChange={(e) => setForm((prev) => ({ ...prev, otherMaxPersons: Number(e.target.value) }))}
                          className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Deadline</label>
                      <input
                        type="datetime-local"
                        value={form.otherDeadline}
                        onChange={(e) => setForm((prev) => ({ ...prev, otherDeadline: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Total Amount</label>
                  <input
                    placeholder="Total Amount"
                    type="number"
                    min="1"
                    value={form.totalAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: Number(e.target.value) }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                    required
                  />
                </div>
                <select
                  value={form.splitType}
                  onChange={(e) => setForm((prev) => ({ ...prev, splitType: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                >
                  <option value="equal">Equal</option>
                  <option value="custom">Custom</option>
                </select>
                {form.splitType === 'custom' && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Host Willing to Pay</label>
                    <input
                      placeholder="Host Contribution"
                      type="number"
                      min="0"
                      max={form.totalAmount}
                      value={form.hostContribution}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value <= form.totalAmount) {
                          setForm((prev) => ({ ...prev, hostContribution: value }));
                        }
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                    />
                    {form.hostContribution > form.totalAmount && (
                      <p className="mt-1 text-xs text-red-400">Host contribution cannot exceed total amount!</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Remaining â‚¹{Math.max(0, form.totalAmount - form.hostContribution).toFixed(2)} will be split equally among others
                    </p>
                  </div>
                )}
                <button type="submit" className="w-full rounded-full bg-brand-primary py-3 text-sm font-semibold text-white shadow shadow-brand-primary/40">
                  Create Share
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Update Share Modal - Complete form with all fields */}
      {showUpdateForm && (
        <>
          {error && (
            <p className="fixed left-1/2 top-8 z-[9999] w-full max-w-lg -translate-x-1/2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300 shadow-lg">{error}</p>
          )}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">Update Share</h2>
                <button
                  onClick={() => {
                    setShowUpdateForm(false);
                    setUpdateShareId(null);
                    setError('');
                  }}
                  className="text-2xl text-slate-400 hover:text-white"
                >
                  Ã—
                </button>
              </div>
            <form onSubmit={updateShare} className="space-y-3">
              {/* Type of Sharing */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">Type of Sharing</label>
                <select
                  value={form.shareType}
                  onChange={(e) => setForm((prev) => ({ ...prev, shareType: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                >
                  <option value="cab">Cab Sharing</option>
                  <option value="food">Food Sharing</option>
                  <option value="other">Other Sharing</option>
                </select>
              </div>
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                required
              />
              <textarea
                placeholder="Description"
                rows="3"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
              />

              {/* Cab Sharing Fields */}
              {form.shareType === 'cab' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      placeholder="From City"
                      value={form.fromCity}
                      onChange={(e) => setForm((prev) => ({ ...prev, fromCity: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                      required
                    />
                    <input
                      placeholder="To City"
                      value={form.toCity}
                      onChange={(e) => setForm((prev) => ({ ...prev, toCity: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Departure Time</label>
                      <input
                        type="datetime-local"
                        value={form.departureTime}
                        onChange={(e) => setForm((prev) => ({ ...prev, departureTime: e.target.value }))}
                        min={form.bookingDeadline || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Arrival Time</label>
                      <input
                        type="datetime-local"
                        value={form.arrivalTime}
                        onChange={(e) => setForm((prev) => ({ ...prev, arrivalTime: e.target.value }))}
                        min={form.departureTime || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Booking Deadline</label>
                    <input
                      type="datetime-local"
                      value={form.bookingDeadline}
                      onChange={(e) => setForm((prev) => ({ ...prev, bookingDeadline: e.target.value }))}
                      min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Max Passengers</label>
                      <input
                        type="number"
                        min={form.currentJoinedMembers || 1}
                        max="10"
                        value={form.maxPassengers}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxPassengers: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                      {form.currentJoinedMembers > 0 && (
                        <p className="mt-1 text-xs text-slate-400">Minimum: {form.currentJoinedMembers} (current members)</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Vehicle Type</label>
                      <input
                        placeholder="Vehicle Type"
                        value={form.vehicleType}
                        onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Food Sharing Fields */}
              {form.shareType === 'food' && (
                <>
                  <input
                    placeholder="Food Items"
                    value={form.foodItems}
                    onChange={(e) => setForm((prev) => ({ ...prev, foodItems: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                    required
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                      <input
                        type="number"
                        min="2"
                        value={form.minPersons}
                        onChange={(e) => setForm((prev) => ({ ...prev, minPersons: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Max Persons</label>
                      <input
                        type="number"
                        min={Math.max(form.minPersons || 2, form.currentJoinedMembers || 0)}
                        value={form.maxPersons}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxPersons: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                      {form.currentJoinedMembers > 0 && (
                        <p className="mt-1 text-xs text-slate-400">Minimum: {form.currentJoinedMembers} (current members)</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Delivery Time</label>
                    <input
                      type="datetime-local"
                      value={form.deadlineTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, deadlineTime: e.target.value }))}
                      min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
                </>
              )}

              {/* Other Sharing Fields */}
              {form.shareType === 'other' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    >
                      <option value="">Select Category</option>
                      <option value="Physical">Physical</option>
                      <option value="Digital">Digital</option>
                      <option value="Ticket">Ticket</option>
                      <option value="Merch">Merch</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                      <input
                        type="number"
                        min="2"
                        value={form.otherMinPersons}
                        onChange={(e) => setForm((prev) => ({ ...prev, otherMinPersons: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Max Persons</label>
                      <input
                        type="number"
                        min={Math.max(2, form.currentJoinedMembers || 0)}
                        value={form.otherMaxPersons}
                        onChange={(e) => setForm((prev) => ({ ...prev, otherMaxPersons: Number(e.target.value) }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                        required
                      />
                      {form.currentJoinedMembers > 0 && (
                        <p className="mt-1 text-xs text-slate-400">Minimum: {form.currentJoinedMembers} (current members)</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Deadline</label>
                    <input
                      type="datetime-local"
                      value={form.otherDeadline}
                      onChange={(e) => setForm((prev) => ({ ...prev, otherDeadline: e.target.value }))}
                      min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
                </>
              )}

              {/* Total Amount */}
              <div>
                <label className="mb-1 block text-xs text-slate-400">Total Amount</label>
                <input
                  placeholder="Total Amount"
                  type="number"
                  min="1"
                  value={form.totalAmount}
                  onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: Number(e.target.value) }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  required
                />
              </div>

              {/* Split Type */}
              <select
                value={form.splitType}
                onChange={(e) => setForm((prev) => ({ ...prev, splitType: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              >
                <option value="equal">Equal</option>
                <option value="custom">Custom</option>
              </select>

              {/* Host Contribution for Custom Split */}
              {form.splitType === 'custom' && (
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Host Willing to Pay</label>
                  <input
                    placeholder="Host Contribution"
                    type="number"
                    min="0"
                    max={form.totalAmount}
                    value={form.hostContribution}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value <= form.totalAmount) {
                        setForm((prev) => ({ ...prev, hostContribution: value }));
                      }
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  />
                  {form.hostContribution > form.totalAmount && (
                    <p className="mt-1 text-xs text-red-400">Host contribution cannot exceed total amount!</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Remaining â‚¹{Math.max(0, form.totalAmount - form.hostContribution).toFixed(2)} will be split equally among others
                  </p>
                </div>
              )}

              <button type="submit" className="w-full rounded-full bg-brand-primary py-3 text-sm font-semibold text-white shadow shadow-brand-primary/40">
                Update Share
              </button>
            </form>
          </div>
        </div>
        </>
      )}
    </main>
  );
};

export default BillShare;
