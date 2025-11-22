import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

const UserHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [activeTab, setActiveTab] = useState('buying');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/users/me/history');
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, []);

  if (!history) {
    return <p className="p-8 text-center text-slate-400">Loading history...</p>;
  }

  const renderBuyingHistory = () => (
    <div className="space-y-3">
      {history.buyingHistory.length === 0 ? (
        <p className="text-slate-400">No buying history yet.</p>
      ) : (
        history.buyingHistory.map((transaction) => (
          <div
            key={transaction._id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700"
          >
            <div className="flex gap-4">
              <img
                src={transaction.listing?.images?.[0]?.url || 'https://placehold.co/100x100'}
                alt={transaction.listing?.title}
                className="h-20 w-20 rounded-lg border border-slate-800 object-cover"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-white">{transaction.listing?.title}</h4>
                <p className="text-sm text-slate-400">
                  Seller: {transaction.seller?.name} ({transaction.seller?.email})
                </p>
                <p className="mt-1 text-lg font-bold text-brand-primary">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-slate-500">
                  Status: <span className="capitalize">{transaction.status}</span> •{' '}
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSellingHistory = () => (
    <div className="space-y-3">
      {history.sellingHistory.length === 0 ? (
        <p className="text-slate-400">No selling history yet.</p>
      ) : (
        history.sellingHistory.map((transaction) => (
          <div
            key={transaction._id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700"
          >
            <div className="flex gap-4">
              <img
                src={transaction.listing?.images?.[0]?.url || 'https://placehold.co/100x100'}
                alt={transaction.listing?.title}
                className="h-20 w-20 rounded-lg border border-slate-800 object-cover"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-white">{transaction.listing?.title}</h4>
                <p className="text-sm text-slate-400">
                  Buyer: {transaction.buyer?.name} ({transaction.buyer?.email})
                </p>
                <p className="mt-1 text-lg font-bold text-green-400">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-slate-500">
                  Status: <span className="capitalize">{transaction.status}</span> •{' '}
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderCabHistory = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">As Host</h3>
        <div className="space-y-3">
          {history.cabSharing.asHost.length === 0 ? (
            <p className="text-slate-400">No sharing history as host.</p>
          ) : (
            history.cabSharing.asHost.map((share) => (
              <div
                key={share._id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white">{share.name}</h4>
                  {share.shareType === 'cab' && (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                      🚗 Cab
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{share.description}</p>
                
                {/* Cab Sharing Details */}
                {share.shareType === 'cab' && (
                  <div className="mt-3 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-medium text-white">📍 Route:</span>
                      <span>{share.fromCity || 'N/A'} → {share.toCity || 'N/A'}</span>
                    </div>
                    {share.departureTime && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">🕒 Departed:</span>
                        <span>{new Date(share.departureTime).toLocaleString()}</span>
                      </div>
                    )}
                    {share.arrivalTime && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">🏁 Arrived:</span>
                        <span>{new Date(share.arrivalTime).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-slate-300">
                      {share.maxPassengers && (
                        <span>👥 Passengers: {share.members.length}/{share.maxPassengers}</span>
                      )}
                      {share.vehicleType && (
                        <span>🚙 {share.vehicleType}</span>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="mt-2 text-lg font-bold text-brand-primary">{formatCurrency(share.totalAmount)}</p>
                <p className="text-xs text-slate-500">
                  Split: <span className="capitalize">{share.splitType}</span> • Status:{' '}
                  <span className="capitalize">{share.status}</span>
                </p>
                <div className="mt-2 text-xs text-slate-400">
                  <p>Passengers: {share.members.filter(m => m.status === 'joined').length} active{share.members.filter(m => m.status === 'cancelled').length > 0 ? `, ${share.members.filter(m => m.status === 'cancelled').length} cancelled` : ''}</p>
                  <ul className="ml-4 mt-1 list-disc">
                    {share.members.map((member) => (
                      <li key={member.user?._id} className={member.status === 'cancelled' ? 'text-red-400 line-through' : ''}>
                        {member.user?.name} - {formatCurrency(member.share)} {member.status === 'cancelled' && '(Cancelled)'}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Completed: {new Date(share.departureTime || share.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">As Passenger</h3>
        <div className="space-y-3">
          {(() => {
            const currentUserId = user?.id || user?._id;
            const passengerTrips = history.cabSharing.asMember.filter((share) => {
              // Don't show trips where user is the host (those appear in "As Host" section)
              const hostId = share.host?._id || share.host;
              return hostId !== currentUserId;
            });
            
            if (passengerTrips.length === 0) {
              return <p className="text-slate-400">No sharing history as passenger.</p>;
            }
            
            return passengerTrips.map((share) => {
              const currentUserId = user?.id || user?._id;
              const userMembership = share.members.find((m) => {
                const memberId = m.user?._id || m.user;
                return memberId === currentUserId;
              });
              const isCancelled = userMembership?.status === 'cancelled';
              return (
                <div
                  key={share._id}
                  className={`rounded-2xl border p-4 transition ${
                    isCancelled 
                      ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50' 
                      : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-white">{share.name}</h4>
                    {share.shareType === 'cab' && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isCancelled 
                          ? 'bg-red-500/20 text-red-300' 
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {isCancelled ? '❌ Cancelled' : '✅ Completed Trip'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{share.description}</p>
                  
                  {/* Cab Trip Details */}
                  {share.shareType === 'cab' && (
                    <div className={`mt-3 space-y-1.5 rounded-lg border p-3 text-sm ${
                      isCancelled
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/10'
                    }`}>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">📍 Boarding:</span>
                        <span>{share.fromCity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">📍 Dropping:</span>
                        <span>{share.toCity}</span>
                      </div>
                      {share.departureTime && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">🕒 {isCancelled ? 'Was scheduled:' : 'Departed:'}</span>
                          <span>{new Date(share.departureTime).toLocaleString()}</span>
                        </div>
                      )}
                      {!isCancelled && share.arrivalTime && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">🏁 Arrived:</span>
                          <span>{new Date(share.arrivalTime).toLocaleString()}</span>
                        </div>
                      )}
                      <div className={`mt-2 flex items-center gap-2 rounded px-3 py-2 ${
                        isCancelled 
                          ? 'bg-red-500/20' 
                          : 'bg-emerald-500/20'
                      }`}>
                        <span className="font-medium text-white">💰 You Paid:</span>
                        <span className={`text-lg font-bold ${
                          isCancelled 
                            ? 'text-red-300 line-through' 
                            : 'text-emerald-300'
                        }`}>
                          {formatCurrency(userMembership?.share || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <p className="mt-3 text-sm text-slate-400">
                    Host: {share.host?.name} ({share.host?.email})
                  </p>
                  <p className="text-xs text-slate-500">
                    Total: {formatCurrency(share.totalAmount)} • Split: <span className="capitalize">{share.splitType}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Completed: {new Date(share.departureTime || share.createdAt).toLocaleDateString()}
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <h1 className="mb-6 text-4xl font-bold text-white">My History</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('buying')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'buying'
              ? 'border-b-2 border-brand-primary text-brand-primary'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Buying History
        </button>
        <button
          onClick={() => setActiveTab('selling')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'selling'
              ? 'border-b-2 border-brand-primary text-brand-primary'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Selling History
        </button>
        <button
          onClick={() => setActiveTab('cab')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'cab'
              ? 'border-b-2 border-brand-primary text-brand-primary'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sharing
        </button>
      </div>

      <div>
        {activeTab === 'buying' && renderBuyingHistory()}
        {activeTab === 'selling' && renderSellingHistory()}
        {activeTab === 'cab' && renderCabHistory()}
      </div>
    </main>
  );
};

export default UserHistory;
