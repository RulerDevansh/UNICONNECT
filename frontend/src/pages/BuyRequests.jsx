import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import useChatLauncher from '../hooks/useChatLauncher';

const BuyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const startChat = useChatLauncher();

  const loadRequests = async () => {
    try {
      // Get all transactions where current user is the seller
      const { data } = await api.get('/transactions/requests');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (transactionId) => {
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'approved' });
      alert('Buy request approved! Waiting for buyer payment.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (transactionId) => {
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'rejected' });
      alert('Buy request rejected.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmPayment = async (transactionId) => {
    if (!confirm('Have you received the payment from the buyer?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'payment_received' });
      alert('Payment confirmed! Now deliver the product and mark as completed.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm payment');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleComplete = async (transactionId) => {
    if (!confirm('Has the product been delivered to the buyer?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'completed' });
      alert('Transaction completed! The listing has been marked as sold.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete transaction');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-slate-400">Loading requests...</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <h1 className="mb-6 text-4xl font-bold text-white">Buy Requests</h1>

      {requests.length === 0 ? (
        <p className="text-slate-400">No buy requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
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
              <div
                key={request._id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700"
              >
                <div className="flex gap-4">
                  <img
                    src={request.listing?.images?.[0]?.url || 'https://placehold.co/100x100'}
                    alt={request.listing?.title}
                    className="h-24 w-24 rounded-lg border border-slate-800 object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">{request.listing?.title}</h3>
                    <p className="text-lg font-bold text-brand-primary">{formatCurrency(request.amount)}</p>
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

                {request.status === 'approved' && (
                  <div className="mt-4">
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 mb-3">
                      <p className="text-sm text-green-200">
                        Request approved! Waiting for buyer to make payment.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => startChat(request.buyer?._id)}
                        className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Chat with Buyer
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
                  </div>
                )}

                {request.status === 'payment_sent' && (
                  <div className="mt-4">
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 mb-3">
                      <p className="text-sm text-blue-200">
                        Buyer has marked payment as sent. Please verify and confirm.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleConfirmPayment(request._id)}
                        disabled={updatingId === request._id}
                        className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                      >
                        Confirm Payment Received
                      </button>
                      <button
                        type="button"
                        onClick={() => startChat(request.buyer?._id)}
                        className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Chat with Buyer
                      </button>
                    </div>
                  </div>
                )}

                {request.status === 'payment_received' && (
                  <div className="mt-4">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 mb-3">
                      <p className="text-sm text-emerald-200">
                        Payment confirmed. Please deliver the product and mark as completed.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleComplete(request._id)}
                        disabled={updatingId === request._id}
                        className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                      >
                        Mark as Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => startChat(request.buyer?._id)}
                        className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Chat with Buyer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default BuyRequests;
