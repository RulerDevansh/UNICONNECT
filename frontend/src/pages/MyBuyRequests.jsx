import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import useChatLauncher from '../hooks/useChatLauncher';

const MyBuyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const startChat = useChatLauncher();

  const loadRequests = async () => {
    try {
      const { data } = await api.get('/transactions/my-requests');
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

  const handleMarkAsPaid = async (transactionId) => {
    if (!confirm('Have you completed the payment to the seller?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'payment_sent' });
      alert('Payment marked as sent! Waiting for seller confirmation.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleWithdraw = async (transactionId) => {
    if (!confirm('Are you sure you want to withdraw this buy request?')) return;
    setUpdatingId(transactionId);
    try {
      await api.put(`/transactions/${transactionId}`, { status: 'withdrawn' });
      alert('Buy request withdrawn successfully.');
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to withdraw request');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
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

    const config = statusConfig[status] || { label: status, color: 'bg-slate-500/20 text-slate-300' };

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return <p className="p-8 text-center text-slate-400">Loading requests...</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <h1 className="mb-6 text-4xl font-bold text-white">My Buy Requests</h1>

      {requests.length === 0 ? (
        <p className="text-slate-400">You have not made any buy requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
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
                    Seller: <span className="font-medium text-slate-200">{request.seller?.name}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Requested: {new Date(request.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-3">{getStatusBadge(request.status)}</div>
                  
                  {request.status === 'pending' && (
                    <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                      <p className="text-sm text-yellow-200">
                        Waiting for seller to approve your request.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleWithdraw(request._id)}
                        disabled={updatingId === request._id}
                        className="mt-3 w-full rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                      >
                        Withdraw Request
                      </button>
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                      <p className="text-sm font-semibold text-green-200">
                        Your request has been approved! Please make the payment and contact the seller.
                      </p>
                      <p className="mt-1 text-xs text-green-300">
                        Payment details: Contact seller at {request.seller?.email}
                      </p>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(request._id)}
                          disabled={updatingId === request._id}
                          className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                        >
                          I Have Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => startChat(request.seller?._id)}
                          className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                        >
                          Chat with Seller
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleWithdraw(request._id)}
                        disabled={updatingId === request._id}
                        className="mt-3 w-full rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                      >
                        Withdraw Request
                      </button>
                    </div>
                  )}

                  {request.status === 'payment_sent' && (
                    <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                      <p className="text-sm text-blue-200">
                        Payment marked as sent! Waiting for seller to confirm receipt.
                      </p>
                      <button
                        type="button"
                        onClick={() => startChat(request.seller?._id)}
                        className="mt-3 w-full rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Chat with Seller
                      </button>
                    </div>
                  )}

                  {request.status === 'payment_received' && (
                    <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                      <p className="text-sm text-blue-200">
                        Payment confirmed! Waiting for seller to deliver and complete the transaction.
                      </p>
                      <button
                        type="button"
                        onClick={() => startChat(request.seller?._id)}
                        className="mt-3 w-full rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                      >
                        Chat with Seller
                      </button>
                    </div>
                  )}

                  {request.status === 'completed' && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-sm text-emerald-200">
                        Transaction completed successfully! Check your history for details.
                      </p>
                    </div>
                  )}

                  {request.status === 'cancelled' && (
                    <div className="mt-3 rounded-lg border border-slate-500/30 bg-slate-500/10 p-3">
                      <p className="text-sm font-semibold text-slate-200">
                        {request.cancellationReason || 'This request has been cancelled.'}
                      </p>
                      {request.paymentStatus === 'refunded' && (
                        <>
                          <p className="mt-2 text-xs text-slate-300">
                            Your payment will be returned soon. Please contact the seller if you have any concerns.
                          </p>
                          <button
                            type="button"
                            onClick={() => startChat(request.seller?._id)}
                            className="mt-3 w-full rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                          >
                            Contact Seller
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default MyBuyRequests;
