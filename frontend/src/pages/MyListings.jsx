import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import useChatLauncher from '../hooks/useChatLauncher';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', description: '', tone: 'primary', onConfirm: null });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);
  const { pushToast } = useToast();
  
  // New states for tabs and requests
  const [activeTab, setActiveTab] = useState('buyRequests'); // buyRequests, myRequests
  const [buyRequests, setBuyRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const startChat = useChatLauncher();

  const load = async () => {
    const { data } = await api.get('/listings/me');
    setListings(data);
  };

  useEffect(() => {
    load();
    loadBuyRequests();
    loadMyRequests();
  }, []);

  useEffect(() => {
    if (location.state?.toast) {
      pushToast(location.state.toast, { type: 'success' });
      navigate(`${location.pathname}${location.search}`, { replace: true });
    }
  }, [location.state, location.pathname, location.search, navigate, pushToast]);

  const openConfirm = ({ title, description, tone = 'primary', onConfirm }) => {
    setConfirmModal({ open: true, title, description, tone, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal({ open: false, title: '', description: '', tone: 'primary', onConfirm: null });
  };

  const loadBuyRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data } = await api.get('/transactions/requests');
      setBuyRequests(data);
    } catch (err) {
      console.error('Failed to load buy requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadMyRequests = async () => {
    try {
      const { data } = await api.get('/transactions/my-requests');
      setMyRequests(data);
    } catch (err) {
      console.error('Failed to load my requests:', err);
    }
  };

  const handleApprove = async (transactionId) => {
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'approved' });
      pushToast('Buy request approved. Waiting for buyer payment.', { type: 'success' });
      await loadBuyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setUpdatingId('');
    }
  };

  const handleReject = async (transactionId) => {
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'rejected' });
      pushToast('Buy request rejected.', { type: 'success' });
      await loadBuyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setUpdatingId('');
    }
  };

  const handleMarkAsPaid = async (transactionId) => {
    openConfirm({
      title: 'Mark payment as sent?',
      description: 'Confirm you have completed the payment to the seller.',
      onConfirm: async () => {
        closeConfirm();
        setUpdatingId(transactionId);
        try {
          await api.put(`/transactions/${transactionId}`, { status: 'payment_sent' });
          pushToast('Payment marked as sent. Waiting for seller confirmation.', { type: 'success' });
          await loadMyRequests();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to update payment status');
        } finally {
          setUpdatingId('');
        }
      },
    });
  };

  const handleWithdraw = async (transactionId) => {
    openConfirm({
      title: 'Withdraw this request?',
      description: 'This will cancel your buy request to the seller.',
      tone: 'warning',
      onConfirm: async () => {
        closeConfirm();
        setUpdatingId(transactionId);
        try {
          await api.put(`/transactions/${transactionId}`, { status: 'withdrawn' });
          pushToast('Buy request withdrawn.', { type: 'success' });
          await loadMyRequests();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to withdraw request');
        } finally {
          setUpdatingId('');
        }
      },
    });
  };

  const handleConfirmPayment = async (transactionId) => {
    openConfirm({
      title: 'Confirm payment received?',
      description: 'Confirm you have received the payment from the buyer.',
      onConfirm: async () => {
        closeConfirm();
        setUpdatingId(transactionId);
        try {
          await api.put(`/transactions/${transactionId}`, { status: 'payment_received' });
          pushToast('Payment confirmed. Deliver the product and mark as completed.', { type: 'success' });
          await loadBuyRequests();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to confirm payment');
        } finally {
          setUpdatingId('');
        }
      },
    });
  };

  const handleComplete = async (transactionId) => {
    openConfirm({
      title: 'Mark transaction completed?',
      description: 'Confirm the product has been delivered to the buyer.',
      onConfirm: async () => {
        closeConfirm();
        setUpdatingId(transactionId);
        try {
          await api.put(`/transactions/${transactionId}`, { status: 'completed' });
          pushToast('Transaction completed. The listing is marked as sold.', { type: 'success' });
          await loadBuyRequests();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to complete transaction');
        } finally {
          setUpdatingId('');
        }
      },
    });
  };

  const handleRentalAction = async (transactionId, rentalAction, successMessage) => {
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { rentalAction });
      pushToast(successMessage, { type: 'success' });
      await loadBuyRequests();
      await loadMyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update rental status');
    } finally {
      setUpdatingId('');
    }
  };

  const handleRaiseRentalDispute = async (transactionId) => {
    openConfirm({
      title: 'Raise dispute?',
      description: 'This will flag the rental for admin review.',
      tone: 'warning',
      onConfirm: async () => {
        closeConfirm();
        setUpdatingId(transactionId);
        try {
          await api.put(`/transactions/${transactionId}`, { rentalAction: 'raise_dispute' });
          pushToast('Dispute raised successfully.', { type: 'success' });
          await loadBuyRequests();
          await loadMyRequests();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to raise dispute');
        } finally {
          setUpdatingId('');
        }
      },
    });
  };

  const deleteListing = async () => {
    if (!pendingDelete) return;
    setUpdatingId(pendingDelete._id);
    setError('');
    try {
      await api.delete(`/listings/${pendingDelete._id}`);
      await load();
      pushToast('Listing and related chats deleted.', { type: 'success' });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete listing');
    } finally {
      setUpdatingId('');
      setPendingDelete(null);
    }
  };

  const requestReview = async (listing) => {
    setReviewTarget(listing);
    setReviewNote('');
    setReviewModalOpen(true);
  };

  // Badge counts: exclude cancelled, rejected, completed, withdrawn
  const isActiveTx = (s) => !['cancelled', 'rejected', 'completed', 'withdrawn'].includes(s);
  const filteredListings = listings;
  const displayedBuyRequests = buyRequests;
  const displayedMyRequests = myRequests;
  const buyActiveCount = displayedBuyRequests.filter((r) => isActiveTx(r.status)).length;
  const myActiveCount = displayedMyRequests.filter((r) => isActiveTx(r.status)).length;

  return (
    <main className="mx-auto max-w-full px-4 py-4 sm:py-8">
      <h1 className="mb-4 sm:mb-6 text-2xl sm:text-3xl font-bold text-white">My Listings</h1>
      
      {/* Messages */}
      {error && (
        <div className="mb-4 space-y-2">
          {error && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </div>
      )}
      
      {/* Two Column Layout - Equal Half Split */}
      <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-2">
        {/* Left Column - My Listings */}
        <div>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">My Listings</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/listings/new')}
                  className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
                >
                  + Listing
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/rentals/new')}
                  className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-violet-900/40 transition hover:bg-violet-500"
                >
                  + Rental
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Product & Rental Listings
              </h3>
              {filteredListings.length > 0 ? (
                filteredListings.map((listing) => (
                  <div
                    key={listing._id}
                    className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow shadow-black/40"
                  >
                    <ListingCard listing={listing} hideBuyNowBadge />
                    {listing.status === 'blocked' && listing.moderation?.action === 'ban' && (
                      <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                        Permanently banned by admin
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/listings/${listing._id}/edit`)}
                        disabled={listing.moderation?.action === 'ban'}
                        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                      >
                        Edit
                      </button>
                      {listing.status === 'blocked' && listing.moderation?.action !== 'ban' && (
                        <button
                          type="button"
                          onClick={() => requestReview(listing)}
                          disabled={updatingId === listing._id || listing.moderation?.flagged}
                          className="flex-1 rounded-full border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:border-amber-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                        >
                          {listing.moderation?.flagged ? 'Review Pending' : 'Request Review'}
                        </button>
                      )}
                      {listing.status !== 'sold' && listing.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(listing)}
                          disabled={updatingId === listing._id}
                          className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                        >
                          Delete
                        </button>
                      )}
                      {(listing.status === 'sold' || listing.status === 'archived') && (
                        <span className="flex-1 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-center text-sm font-semibold text-slate-400">
                          {listing.status === 'sold' ? 'Sold' : 'Archived'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No listings or rentals yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Requests */}
        <div>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Requests</h2>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-700">
              <button
                onClick={() => setActiveTab('buyRequests')}
                className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                  activeTab === 'buyRequests'
                    ? 'border-b-2 border-brand-primary text-brand-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Received Requests {buyActiveCount > 0 && (
                  <span className="ml-1 rounded-full bg-brand-primary px-2 py-0.5 text-xs text-white">{buyActiveCount}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('myRequests')}
                className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                  activeTab === 'myRequests'
                    ? 'border-b-2 border-brand-primary text-brand-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Requests {myActiveCount > 0 && (
                  <span className="ml-1 rounded-full bg-brand-primary px-2 py-0.5 text-xs text-white">{myActiveCount}</span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-3">

              {activeTab === 'buyRequests' && (
                <div className="space-y-3">
                  {loadingRequests ? (
                    <p className="text-sm text-slate-400">Loading...</p>
                  ) : displayedBuyRequests.length > 0 ? (
                    displayedBuyRequests.map((request) => {
                      const isRentalRequest = request.transactionType === 'rental_booking';
                      const showSellerPaymentActions = !isRentalRequest;
                      const rentalStatus = request.rentalStatus || 'requested';
                      const statusBadgeConfig = {
                        pending: 'bg-yellow-500/20 text-yellow-300',
                        approved: 'bg-green-500/20 text-green-300',
                        payment_sent: 'bg-blue-500/20 text-blue-300',
                        payment_received: 'bg-blue-500/20 text-blue-300',
                        completed: 'bg-emerald-500/20 text-emerald-300',
                        rejected: 'bg-red-500/20 text-red-300',
                        withdrawn: 'bg-gray-500/20 text-gray-300',
                        cancelled: 'bg-slate-500/20 text-slate-300',
                      };

                      return (
                        <div key={request._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700">
                          <div className="flex gap-4">
                            <img
                              src={request.listing?.images?.[0]?.url || request.listingSnapshot?.images?.[0]?.url || 'https://placehold.co/100x100'}
                              alt={request.listing?.title || request.listingSnapshot?.title}
                              className="h-16 w-16 sm:h-24 sm:w-24 rounded-lg border border-slate-800 object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white">{request.listing?.title || request.listingSnapshot?.title}</h3>
                              <p className="mt-1 text-xl font-bold text-brand-primary">{formatCurrency(request.amount)}</p>
                              {isRentalRequest && request.rentalStartDate && request.rentalEndDate && (
                                <p className="mt-1 text-xs text-orange-200">
                                  Rental: {new Date(request.rentalStartDate).toLocaleDateString()} to {new Date(request.rentalEndDate).toLocaleDateString()} ({request.rentalDays || '-'} day(s))
                                </p>
                              )}
                              {isRentalRequest && (
                                <p className="mt-1 text-xs text-orange-200">
                                  Deposit: {formatCurrency(request.depositAmount || 0)} ({request.depositStatus || 'not_required'})
                                </p>
                              )}
                              <p className="mt-2 text-sm text-slate-400">
                                Buyer: <span className="font-medium text-slate-200">{request.buyer?.name}</span> ({request.buyer?.email})
                              </p>
                              <p className="text-xs text-slate-500">
                                Requested: {new Date(request.createdAt).toLocaleString()}
                              </p>
                              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusBadgeConfig[request.status] || 'bg-slate-500/20 text-slate-300'}`}>
                                {request.status.replace('_', ' ')}
                              </span>
                              {isRentalRequest && (
                                <span className="ml-2 mt-2 inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
                                  rental request
                                </span>
                              )}
                              {isRentalRequest && (
                                <span className="ml-2 mt-2 inline-block rounded-full bg-slate-700/60 px-3 py-1 text-xs font-semibold uppercase text-slate-200">
                                  {rentalStatus}
                                </span>
                              )}
                                  {isRentalRequest && request.disputeStatus === 'open' && (
                                    <span className="ml-2 mt-2 inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
                                      dispute open
                                    </span>
                                  )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {request.status === 'pending' && (
                            <div className="mt-4 flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleApprove(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {showSellerPaymentActions && request.status === 'payment_sent' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="mb-3 text-sm text-blue-200">💳 Buyer has marked payment as sent. Confirm if you received it.</p>
                              <button
                                type="button"
                                onClick={() => handleConfirmPayment(request._id)}
                                disabled={updatingId === request._id}
                                className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Confirm Payment Received
                              </button>
                            </div>
                          )}

                          {showSellerPaymentActions && request.status === 'payment_received' && (
                            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                              <p className="mb-3 text-sm text-green-200">✅ Payment confirmed. Deliver the product and mark as completed.</p>
                              <button
                                type="button"
                                onClick={() => handleComplete(request._id)}
                                disabled={updatingId === request._id}
                                className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Mark as Completed
                              </button>
                            </div>
                          )}

                          {request.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                              <p className="text-sm font-semibold text-emerald-200">
                                {isRentalRequest ? '🎉 Rental completed successfully!' : '🎉 Transaction completed successfully!'}
                              </p>
                              <p className="mt-2 text-sm text-emerald-300">
                                {isRentalRequest
                                  ? (
                                    <>
                                      Rental for <span className="font-semibold">{request.listing?.title}</span> completed with {request.buyer?.name} ({formatCurrency(request.amount)}).
                                    </>
                                  )
                                  : (
                                    <>
                                      Sold <span className="font-semibold">{request.listing?.title}</span> to {request.buyer?.name} for {formatCurrency(request.amount)}
                                    </>
                                  )}
                              </p>
                            </div>
                          )}

                          {/* Chat Button - Available after approval but not when completed */}
                          {(
                            isRentalRequest
                              ? ['approved'].includes(request.status)
                              : ['approved', 'payment_sent', 'payment_received'].includes(request.status)
                          ) && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  const buyerId = request.buyer?._id || request.buyer;
                                  const listingId = request.listing?._id || request.listing;
                                  startChat(buyerId, { listingId });
                                }}
                                className="w-full rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-600"
                              >
                                Chat with Buyer
                              </button>
                            </div>
                          )}

                          {isRentalRequest && request.status === 'approved' && request.rentalStatus === 'approved' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => handleRentalAction(request._id, 'mark_active', 'Rental marked as active.')}
                                disabled={updatingId === request._id}
                                className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Mark Rental Started
                              </button>
                            </div>
                          )}

                          {isRentalRequest && request.rentalStatus === 'active' && request.disputeStatus !== 'open' && (
                            <div className="mt-3 flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleRentalAction(request._id, 'confirm_return', 'Rental return confirmed.')}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Confirm Return
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRaiseRentalDispute(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full border border-orange-500/60 px-4 py-2 text-sm font-semibold text-orange-200 hover:border-orange-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                              >
                                Raise Dispute
                              </button>
                            </div>
                          )}

                          {isRentalRequest && request.disputeStatus === 'open' && (
                            <div className="mt-3 space-y-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                              <p className="text-sm text-orange-200">Dispute is open. Resolve with an outcome:</p>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleRentalAction(request._id, 'resolve_dispute_release', 'Dispute resolved and deposit released.')}
                                  disabled={updatingId === request._id}
                                  className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                                >
                                  Resolve + Release Deposit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRentalAction(request._id, 'resolve_dispute_forfeit', 'Dispute resolved and deposit forfeited.')}
                                  disabled={updatingId === request._id}
                                  className="flex-1 rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                                >
                                  Resolve + Forfeit Deposit
                                </button>
                              </div>
                            </div>
                          )}

                          {isRentalRequest && request.rentalStatus === 'returned' && request.depositStatus === 'held' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => handleRentalAction(request._id, 'release_deposit', 'Security deposit released.')}
                                disabled={updatingId === request._id}
                                className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                              >
                                Release Deposit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">No received requests yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'myRequests' && (
                <div className="space-y-3">
                  {displayedMyRequests.length > 0 ? (
                    displayedMyRequests.map((request) => {
                      const isRentalRequest = request.transactionType === 'rental_booking';
                      const rentalStatus = request.rentalStatus || 'requested';
                      const getStatusConfig = (status) => {
                        const configs = {
                          pending: { label: isRentalRequest ? 'Rental Pending Approval' : 'Pending Approval', color: 'bg-yellow-500/20 text-yellow-300' },
                          approved: { label: isRentalRequest ? 'Rental Approved' : 'Approved - Pay Now', color: 'bg-green-500/20 text-green-300' },
                          payment_sent: { label: 'Payment Sent', color: 'bg-blue-500/20 text-blue-300' },
                          payment_received: { label: 'Payment Received', color: 'bg-blue-500/20 text-blue-300' },
                          completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-300' },
                          rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300' },
                          withdrawn: { label: 'Withdrawn', color: 'bg-gray-500/20 text-gray-300' },
                          cancelled: { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-300' },
                          disputed: { label: 'Disputed', color: 'bg-orange-500/20 text-orange-300' },
                        };
                        return configs[status] || { label: status, color: 'bg-slate-500/20 text-slate-300' };
                      };

                      const statusConfig = getStatusConfig(request.status);

                      return (
                        <div key={request._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700">
                          <div className="flex gap-4">
                            <img
                              src={request.listing?.images?.[0]?.url || request.listingSnapshot?.images?.[0]?.url || 'https://placehold.co/100x100'}
                              alt={request.listing?.title || request.listingSnapshot?.title}
                              className="h-16 w-16 sm:h-24 sm:w-24 rounded-lg border border-slate-800 object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white">{request.listing?.title || request.listingSnapshot?.title}</h3>
                              <p className="mt-1 text-sm text-slate-400">
                                Seller: <span className="text-slate-300">{request.seller?.name}</span>
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                Requested: <span className="text-slate-300">{new Date(request.createdAt).toLocaleString()}</span>
                              </p>
                              {isRentalRequest && request.rentalStartDate && request.rentalEndDate && (
                                <p className="mt-1 text-xs text-orange-200">
                                  Rental: {new Date(request.rentalStartDate).toLocaleDateString()} to {new Date(request.rentalEndDate).toLocaleDateString()} ({request.rentalDays || '-'} day(s))
                                </p>
                              )}
                              {isRentalRequest && (
                                <p className="mt-1 text-xs text-orange-200">
                                  Deposit: {formatCurrency(request.depositAmount || 0)} ({request.depositStatus || 'not_required'})
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-3">
                                <p className="text-xl font-bold text-emerald-400">{formatCurrency(request.amount ?? request.listing?.price)}</p>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusConfig.color}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
                              {isRentalRequest && (
                                <span className="mt-2 inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
                                  rental request
                                </span>
                              )}
                              {isRentalRequest && (
                                <span className="ml-2 mt-2 inline-block rounded-full bg-slate-700/60 px-3 py-1 text-xs font-semibold uppercase text-slate-200">
                                  {rentalStatus}
                                </span>
                              )}
                              {isRentalRequest && request.disputeStatus === 'open' && (
                                <span className="ml-2 mt-2 inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
                                  dispute open
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status-specific messages */}
                          {request.status === 'pending' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="text-sm text-blue-200">⏳ Waiting for seller approval...</p>
                            </div>
                          )}
                          {request.status === 'approved' && (
                            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                              <p className="text-sm text-green-200">
                                {isRentalRequest
                                  ? '✅ Rental request approved! Coordinate pickup and return with the owner via chat.'
                                  : '✅ Request approved! Please complete the payment to proceed.'}
                              </p>
                            </div>
                          )}
                          {isRentalRequest && request.rentalStatus === 'active' && (
                            <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                              <p className="text-sm text-indigo-200">🛵 Rental is active currently.</p>
                            </div>
                          )}
                          {isRentalRequest && request.rentalStatus === 'returned' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="text-sm text-blue-200">✅ Return confirmed by owner. Waiting for deposit release.</p>
                            </div>
                          )}
                          {isRentalRequest && request.rentalStatus === 'closed' && (
                            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                              <p className="text-sm text-emerald-200">🎉 Rental closed successfully.</p>
                            </div>
                          )}
                          {isRentalRequest && request.disputeStatus === 'open' && (
                            <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                              <p className="text-sm text-orange-200">⚠️ Dispute is currently under review by the owner.</p>
                            </div>
                          )}
                          {isRentalRequest && request.disputeStatus === 'resolved' && request.depositStatus === 'forfeited' && (
                            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                              <p className="text-sm text-red-200">❗ Dispute resolved: security deposit was forfeited.</p>
                            </div>
                          )}
                          {isRentalRequest && request.disputeStatus === 'resolved' && request.depositStatus === 'released' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="text-sm text-blue-200">✅ Dispute resolved: security deposit was released to you.</p>
                            </div>
                          )}
                          {request.status === 'payment_sent' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="text-sm text-blue-200">💳 Payment sent! Waiting for seller confirmation...</p>
                            </div>
                          )}
                          {request.status === 'payment_received' && (
                            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                              <p className="text-sm text-blue-200">✅ Payment confirmed! Waiting for seller to deliver and complete the transaction.</p>
                            </div>
                          )}
                          {request.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                              <p className="text-sm font-semibold text-emerald-200">
                                {isRentalRequest ? '🎉 Rental completed successfully!' : '🎉 Transaction completed successfully!'}
                              </p>
                              <p className="mt-2 text-sm text-emerald-300">
                                {isRentalRequest
                                  ? (
                                    <>
                                      You successfully completed rental for <span className="font-semibold">{request.listing?.title}</span> ({formatCurrency(request.amount)}).
                                    </>
                                  )
                                  : (
                                    <>
                                      You purchased <span className="font-semibold">{request.listing?.title}</span> for {formatCurrency(request.amount)}
                                    </>
                                  )}
                              </p>
                            </div>
                          )}
                          {request.status === 'rejected' && (
                            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                              <p className="text-sm text-red-200">❌ Request was rejected by the seller.</p>
                            </div>
                          )}
                          {request.status === 'cancelled' && (
                            <div className="mt-4 rounded-lg border border-slate-500/30 bg-slate-500/10 p-3">
                              <p className="text-sm text-slate-300">🚫 Product sold to another buyer</p>
                            </div>
                          )}
                          {request.status === 'withdrawn' && (
                            <div className="mt-4 rounded-lg border border-gray-500/30 bg-gray-500/10 p-3">
                              <p className="text-sm text-gray-300">↩️ You withdrew this request.</p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {request.status === 'approved' && (
                              !isRentalRequest && (
                              <button
                                onClick={() => handleMarkAsPaid(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 hover:bg-brand-primary/90 disabled:opacity-50"
                              >
                                Mark as Paid
                              </button>
                              )
                            )}
                            {(request.status === 'pending' || request.status === 'approved') && request.listing?.listingType !== 'auction' && request.transactionType !== 'auction' && (
                              <button
                                onClick={() => handleWithdraw(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:border-red-300 disabled:opacity-50"
                              >
                                Withdraw Request
                              </button>
                            )}
                            {isRentalRequest && ['approved', 'active'].includes(request.rentalStatus) && request.disputeStatus !== 'open' && (
                              <button
                                onClick={() => handleRaiseRentalDispute(request._id)}
                                disabled={updatingId === request._id}
                                className="rounded-full border border-orange-500/40 px-4 py-2 text-sm font-semibold text-orange-300 hover:border-orange-300 disabled:opacity-50"
                              >
                                Raise Dispute
                              </button>
                            )}
                            {(
                              isRentalRequest
                                ? ['approved'].includes(request.status)
                                : ['approved', 'payment_sent', 'payment_received'].includes(request.status)
                            ) && (
                              <button
                                onClick={() => {
                                  const sellerId = request.seller?._id || request.seller;
                                  const listingId = request.listing?._id || request.listing;
                                  startChat(sellerId, { listingId });
                                }}
                                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-600"
                              >
                                Chat with Seller
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">You have not made any requests yet.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60">
            <p className="text-xs uppercase tracking-[0.3em] text-red-300">Confirm delete</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Remove &quot;{pendingDelete.title}&quot;?</h2>
            <p className="mt-3 text-sm text-slate-400">
              This permanently deletes the listing and any chats started from it. Buyers will lose access to the conversation history.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/60"
              >
                Keep Listing
              </button>
              <button
                type="button"
                onClick={deleteListing}
                disabled={updatingId === pendingDelete._id}
                className="flex-1 rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.tone === 'warning' ? 'Withdraw' : 'Confirm'}
        tone={confirmModal.tone}
        onCancel={closeConfirm}
        onConfirm={() => confirmModal.onConfirm?.()}
      />
    </main>
  );
};

export default MyListings;
