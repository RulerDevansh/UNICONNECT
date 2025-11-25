import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import BillShareCard from '../components/BillShareCard';

const defaultForm = {
  name: '',
  description: '',
  // Sharing type
  shareType: 'cab',
  // Cab sharing
  fromCity: '',
  toCity: '',
  departureTime: '',
  arrivalTime: '',
  bookingDeadline: '',
  maxPassengers: 4,
  vehicleType: '',
  // Food sharing
  foodItems: '',
  quantity: 1,
  minPersons: 2,
  maxPersons: 10,
  deadlineTime: '',
  // Other sharing
  category: '',
  otherMinPersons: 2,
  otherMaxPersons: 10,
  otherDeadline: '',
  // Common fields
  totalAmount: 0,
  splitType: 'equal',
  hostContribution: 0
};

const MySharing = () => {
  const { user } = useAuth();
  const [myShares, setMyShares] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateShareId, setUpdateShareId] = useState(null);

  const loadMyShares = async () => {
    try {
      const { data } = await api.get('/shares');
      // Filter to only show shares where user is the host
      const userId = user?.id || user?._id;
      const now = new Date();
      const hostShares = data.filter(share => {
        const hostId = typeof share.host === 'object' ? share.host._id : share.host;
        const isHost = hostId === userId;
        
        // Keep all host shares including completed/cancelled ones
        // Only exclude if status is closed or cancelled AND deadline has passed by more than 24 hours
        if (isHost && (share.status === 'closed' || share.status === 'cancelled')) {
          const deadlineTime = share.shareType === 'cab' ? share.departureTime : 
                               share.shareType === 'food' ? share.deadlineTime : 
                               share.otherDeadline;
          if (deadlineTime) {
            const timeSinceDeadline = now - new Date(deadlineTime);
            const hoursSinceDeadline = timeSinceDeadline / (1000 * 60 * 60);
            // Keep showing for 24 hours after completion/cancellation
            if (hoursSinceDeadline > 24) return false;
          }
        }
        
        // For open shares, exclude if deadline has passed (auto-cleanup)
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
    } catch (err) {
      console.error('Failed to load shares:', err);
    }
  };

  useEffect(() => {
    if (user?.id || user?._id) {
      loadMyShares();
    }
  }, [user?.id, user?._id]);

  const createShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/shares', form);
      setForm(defaultForm);
      loadMyShares();
      setSuccessMessage('Share created successfully');
      setShowCreateForm(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create share');
    }
  };

  const approveRequest = async (shareId, userId) => {
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/approve`, { userId });
      loadMyShares();
      setSuccessMessage('Member approved');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve');
    }
  };

  const rejectRequest = async (shareId, userId) => {
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/reject`, { userId });
      loadMyShares();
      setSuccessMessage('Request rejected');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject');
    }
  };

  const handleFinalize = async (shareId) => {
    setSuccessMessage('');
    setError('');
    try {
      await api.post(`/shares/${shareId}/finalize`);
      loadMyShares();
      setSuccessMessage('Share completed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete share');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Helper function to convert UTC date to local datetime-local format
  const toLocalDatetimeString = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Get local time offset
    const offset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  };

  const handleUpdate = (shareId) => {
    const shareToUpdate = myShares.find(s => s._id === shareId);
    if (shareToUpdate) {
      // Pre-fill form with existing data
      setForm({
        name: shareToUpdate.name || '',
        description: shareToUpdate.description || '',
        shareType: shareToUpdate.shareType || 'cab',
        // Cab sharing
        fromCity: shareToUpdate.fromCity || '',
        toCity: shareToUpdate.toCity || '',
        departureTime: toLocalDatetimeString(shareToUpdate.departureTime),
        arrivalTime: toLocalDatetimeString(shareToUpdate.arrivalTime),
        bookingDeadline: toLocalDatetimeString(shareToUpdate.bookingDeadline),
        maxPassengers: shareToUpdate.maxPassengers || 4,
        vehicleType: shareToUpdate.vehicleType || '',
        // Food sharing
        foodItems: shareToUpdate.foodItems || '',
        quantity: shareToUpdate.quantity || 1,
        minPersons: shareToUpdate.minPersons || 2,
        maxPersons: shareToUpdate.maxPersons || 10,
        deadlineTime: toLocalDatetimeString(shareToUpdate.deadlineTime),
        // Product sharing
        productName: shareToUpdate.productName || '',
        productCategory: shareToUpdate.productCategory || '',
        bulkQuantity: shareToUpdate.bulkQuantity || 1,
        pricePerUnit: shareToUpdate.pricePerUnit || 0,
        // Other sharing
        category: shareToUpdate.category || '',
        otherMinPersons: shareToUpdate.otherMinPersons || 2,
        otherMaxPersons: shareToUpdate.otherMaxPersons || 10,
        otherDeadline: toLocalDatetimeString(shareToUpdate.otherDeadline),
        // Common fields
        totalAmount: shareToUpdate.totalAmount || 0,
        splitType: shareToUpdate.splitType || 'equal',
        hostContribution: shareToUpdate.hostContribution || 0
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
      setForm(defaultForm);
      setUpdateShareId(null);
      setShowUpdateForm(false);
      loadMyShares();
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
      loadMyShares();
      setSuccessMessage('Share deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete share');
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">My Sharing</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
        >
          + Create Share
        </button>
      </div>

      {/* Error message above dialog/modal */}
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
                  ×
                </button>
              </div>
              <form onSubmit={createShare} className="space-y-3">
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
                    <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                  />
                  <p className="mt-1 text-xs text-slate-500">Users cannot join after this time</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={form.deadlineTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, deadlineTime: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                  />
                </div>
              </>
            )}

            {/* Product Sharing Fields */}
            {form.shareType === 'product' && (
              <>
                <input
                  placeholder="Product Name"
                  value={form.productName}
                  onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  required
                />
                <input
                  placeholder="Product Category"
                  value={form.productCategory}
                  onChange={(e) => setForm((prev) => ({ ...prev, productCategory: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Bulk Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={form.bulkQuantity}
                      onChange={(e) => setForm((prev) => ({ ...prev, bulkQuantity: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Price Per Unit</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pricePerUnit}
                      onChange={(e) => setForm((prev) => ({ ...prev, pricePerUnit: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                    <input
                      type="number"
                      min="2"
                      max="50"
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
                      max="50"
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
              <label className="mb-1 block text-xs text-slate-400">Total Estimated Cost</label>
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
                  onChange={(e) => setForm((prev) => ({ ...prev, hostContribution: Number(e.target.value) }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Remaining ₹{(form.totalAmount - form.hostContribution).toFixed(2)} will be split equally among others
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

      {/* Update Share Modal */}
      {showUpdateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Update Share</h2>
              <button
                onClick={() => {
                  setShowUpdateForm(false);
                  setUpdateShareId(null);
                  setForm(defaultForm);
                  setError('');
                }}
                className="text-2xl text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <form onSubmit={updateShare} className="space-y-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                  />
                  <p className="mt-1 text-xs text-slate-500">Users cannot join after this time</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={form.deadlineTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, deadlineTime: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                  />
                </div>
              </>
            )}

            {/* Product Sharing Fields */}
            {form.shareType === 'product' && (
              <>
                <input
                  placeholder="Product Name"
                  value={form.productName}
                  onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  required
                />
                <input
                  placeholder="Product Category"
                  value={form.productCategory}
                  onChange={(e) => setForm((prev) => ({ ...prev, productCategory: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Bulk Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={form.bulkQuantity}
                      onChange={(e) => setForm((prev) => ({ ...prev, bulkQuantity: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Price Per Unit</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pricePerUnit}
                      onChange={(e) => setForm((prev) => ({ ...prev, pricePerUnit: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                      required
                    />
                  </div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Min Persons</label>
                    <input
                      type="number"
                      min="2"
                      max="50"
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
                      max="50"
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
              <label className="mb-1 block text-xs text-slate-400">Total Estimated Cost</label>
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
                  onChange={(e) => setForm((prev) => ({ ...prev, hostContribution: Number(e.target.value) }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Remaining ₹{(form.totalAmount - form.hostContribution).toFixed(2)} will be split equally among others
                </p>
              </div>
            )}
            <button type="submit" className="w-full rounded-full bg-brand-primary py-3 text-sm font-semibold text-white shadow shadow-brand-primary/40">
              Update Share
            </button>
          </form>
          </div>
        </div>
      )}

      {/* My Shares List */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">My Active Shares</h2>
        {myShares.length > 0 ? (
          <div className="space-y-4">
            {myShares.map((share) => (
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
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">You haven't created any shares yet.</p>
        )}
      </section>
    </main>
  );
};

export default MySharing;
