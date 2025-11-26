import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import useChatLauncher from '../hooks/useChatLauncher';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  
  // New states for tabs and requests
  const [activeTab, setActiveTab] = useState('available'); // available, buyRequests, myRequests
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
      setToast(location.state.toast);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

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
      setToast('Buy request approved! Waiting for buyer payment.');
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
      setToast('Buy request rejected.');
      await loadBuyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setUpdatingId('');
    }
  };

  const handleMarkAsPaid = async (transactionId) => {
    if (!confirm('Have you completed the payment to the seller?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'payment_sent' });
      setToast('Payment marked as sent! Waiting for seller confirmation.');
      await loadMyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setUpdatingId('');
    }
  };

  const handleWithdraw = async (transactionId) => {
    if (!confirm('Are you sure you want to withdraw this buy request?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'withdrawn' });
      setToast('Buy request withdrawn successfully.');
      await loadMyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to withdraw request');
    } finally {
      setUpdatingId('');
    }
  };

  const handleConfirmPayment = async (transactionId) => {
    if (!confirm('Have you received the payment from the buyer?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'payment_received' });
      setToast('Payment confirmed! Now deliver the product and mark as completed.');
      await loadBuyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm payment');
    } finally {
      setUpdatingId('');
    }
  };

  const handleComplete = async (transactionId) => {
    if (!confirm('Has the product been delivered to the buyer?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'completed' });
      setToast('Transaction completed! The listing has been marked as sold.');
      await loadBuyRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete transaction');
    } finally {
      setUpdatingId('');
    }
  };

  const deleteListing = async () => {
    if (!pendingDelete) return;
    setUpdatingId(pendingDelete._id);
    setError('');
    try {
      await api.delete(`/listings/${pendingDelete._id}`);
      await load();
      setToast('Listing and related chats deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete listing');
    } finally {
      setUpdatingId('');
      setPendingDelete(null);
    }
  };

  return (
    <main className="mx-auto max-w-full px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-white">My Listings</h1>
      
      {/* Messages */}
      {(error || toast) && (
        <div className="mb-4 space-y-2">
          {error && <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {toast && (
            <div className="flex items-start justify-between gap-4 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <p>{toast}</p>
              <button type="button" onClick={() => setToast('')} className="text-xs uppercase tracking-wide text-emerald-200/80">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Two Column Layout - Equal Half Split */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Column - My Listings */}
        <div>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">My Listings</h2>
              <button
                type="button"
                onClick={() => navigate('/listings/new')}
                className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
              >
                + Create
              </button>
            </div>
            
            <div className="space-y-3">
              {listings.length > 0 ? (
                listings.map((listing) => (
                  <div key={listing._id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow shadow-black/40">
                    <ListingCard listing={listing} />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/listings/${listing._id}/edit`)}
                        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60"
                      >
                        Edit
                      </button>
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
                <p className="text-slate-400">No listings yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Requests */}
        <div>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Requests</h2>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-700">
              <button
                onClick={() => setActiveTab('buyRequests')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'buyRequests'
                    ? 'border-b-2 border-brand-primary text-brand-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Buy Requests {buyRequests.length > 0 && <span className="ml-1 rounded-full bg-brand-primary px-2 py-0.5 text-xs text-white">{buyRequests.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('myRequests')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'myRequests'
                    ? 'border-b-2 border-brand-primary text-brand-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Requests
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-3">

              {activeTab === 'buyRequests' && (
                <div className="space-y-3">
                  {loadingRequests ? (
                    <p className="text-sm text-slate-400">Loading...</p>
                  ) : buyRequests.length > 0 ? (
                    buyRequests.map((request) => {
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
                              src={request.listing?.images?.[0]?.url || 'https://placehold.co/100x100'}
                              alt={request.listing?.title}
                              className="h-24 w-24 rounded-lg border border-slate-800 object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white">{request.listing?.title}</h3>
                              <p className="mt-1 text-xl font-bold text-brand-primary">{formatCurrency(request.amount)}</p>
                              <p className="mt-2 text-sm text-slate-400">
                                Buyer: <span className="font-medium text-slate-200">{request.buyer?.name}</span> ({request.buyer?.email})
                              </p>
                              <p className="text-xs text-slate-500">
                                Requested: {new Date(request.createdAt).toLocaleString()}
                              </p>
                              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusBadgeConfig[request.status] || 'bg-slate-500/20 text-slate-300'}`}>
                                {request.status.replace('_', ' ')}
                              </span>
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

                          {request.status === 'payment_sent' && (
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

                          {request.status === 'payment_received' && (
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
                              <p className="text-sm font-semibold text-emerald-200">🎉 Transaction completed successfully!</p>
                              <p className="mt-2 text-sm text-emerald-300">
                                Sold <span className="font-semibold">{request.listing?.title}</span> to {request.buyer?.name} for {formatCurrency(request.amount)}
                              </p>
                            </div>
                          )}

                          {/* Chat Button - Available after approval but not when completed */}
                          {['approved', 'payment_sent', 'payment_received'].includes(request.status) && (
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
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">No buy requests yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'myRequests' && (
                <div className="space-y-3">
                  {myRequests.length > 0 ? (
                    myRequests.map((request) => {
                      const getStatusConfig = (status) => {
                        const configs = {
                          pending: { label: 'Pending Approval', color: 'bg-yellow-500/20 text-yellow-300' },
                          approved: { label: 'Approved - Pay Now', color: 'bg-green-500/20 text-green-300' },
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
                              src={request.listing?.images?.[0]?.url || 'https://placehold.co/100x100'}
                              alt={request.listing?.title}
                              className="h-24 w-24 rounded-lg border border-slate-800 object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white">{request.listing?.title}</h3>
                              <p className="mt-1 text-sm text-slate-400">
                                Seller: <span className="text-slate-300">{request.seller?.name}</span>
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                Requested: <span className="text-slate-300">{new Date(request.createdAt).toLocaleString()}</span>
                              </p>
                              <div className="mt-2 flex items-center gap-3">
                                <p className="text-xl font-bold text-emerald-400">{formatCurrency(request.listing?.price)}</p>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusConfig.color}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
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
                              <p className="text-sm text-green-200">✅ Request approved! Please complete the payment to proceed.</p>
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
                              <p className="text-sm font-semibold text-emerald-200">🎉 Transaction completed successfully!</p>
                              <p className="mt-2 text-sm text-emerald-300">
                                You purchased <span className="font-semibold">{request.listing?.title}</span> for {formatCurrency(request.amount)}
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
                              <button
                                onClick={() => handleMarkAsPaid(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 hover:bg-brand-primary/90 disabled:opacity-50"
                              >
                                Mark as Paid
                              </button>
                            )}
                            {(request.status === 'pending' || request.status === 'approved') && (
                              <button
                                onClick={() => handleWithdraw(request._id)}
                                disabled={updatingId === request._id}
                                className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:border-red-300 disabled:opacity-50"
                              >
                                Withdraw Request
                              </button>
                            )}
                            {['approved', 'payment_sent', 'payment_received'].includes(request.status) && (
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
                    <p className="text-sm text-slate-400">You have not made any buy requests yet.</p>
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
            <h2 className="mt-2 text-2xl font-semibold text-white">Remove “{pendingDelete.title}”?</h2>
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
    </main>
  );
};

export default MyListings;
