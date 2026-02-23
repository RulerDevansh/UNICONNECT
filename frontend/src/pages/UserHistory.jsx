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
                className="h-14 w-14 sm:h-20 sm:w-20 rounded-lg border border-slate-800 object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white">{transaction.listing?.title}</h4>
                  {transaction.transactionType === 'auction' && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                      ðŸŽ‰ AUCTION
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  Seller: {transaction.seller?.name} ({transaction.seller?.email})
                </p>
                <p className="mt-1 text-lg font-bold text-brand-primary">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-slate-500">
                  Status: <span className="capitalize">{transaction.status}</span> â€¢{' '}
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
                className="h-14 w-14 sm:h-20 sm:w-20 rounded-lg border border-slate-800 object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white">{transaction.listing?.title}</h4>
                  {transaction.transactionType === 'auction' && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                      ðŸŽ‰ AUCTION
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  Buyer: {transaction.buyer?.name} ({transaction.buyer?.email})
                </p>
                <p className="mt-1 text-lg font-bold text-green-400">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-slate-500">
                  Status: <span className="capitalize">{transaction.status}</span> â€¢{' '}
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSharingHistory = () => {
    // Combine cab, food, and other sharing history
    const allHostShares = [
      ...(history.cabSharing?.asHost || []),
      ...(history.foodSharing?.asHost || []),
      ...(history.otherSharing?.asHost || [])
    ].sort((a, b) => {
      const dateA = new Date(a.departureTime || a.deadlineTime || a.otherDeadline || a.createdAt);
      const dateB = new Date(b.departureTime || b.deadlineTime || b.otherDeadline || b.createdAt);
      return dateB - dateA;
    });

    const allMemberShares = [
      ...(history.cabSharing?.asMember || []),
      ...(history.foodSharing?.asMember || []),
      ...(history.otherSharing?.asMember || [])
    ].sort((a, b) => {
      const dateA = new Date(a.departureTime || a.deadlineTime || a.otherDeadline || a.createdAt);
      const dateB = new Date(b.departureTime || b.deadlineTime || b.otherDeadline || b.createdAt);
      return dateB - dateA;
    });

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white">As Host</h3>
          <div className="space-y-3">
            {allHostShares.length === 0 ? (
              <p className="text-slate-400">No sharing history as host.</p>
            ) : (
              allHostShares.map((share) => {
                // Check if trip/order was completed or cancelled
                const joinedCount = share.members.filter(m => m.status === 'joined').length;
                const cancelledCount = share.members.filter(m => m.status === 'cancelled').length;
                const totalMembers = share.members.length;
                
                // Check minimum requirements for food and other sharing
                let meetsMinimum = true;
                if (share.shareType === 'food' && share.minPersons) {
                  meetsMinimum = joinedCount >= share.minPersons;
                } else if (share.shareType === 'other' && share.otherMinPersons) {
                  meetsMinimum = joinedCount >= share.otherMinPersons;
                }
                
                // Determine completion/cancellation status:
                // - Completed if: (status is 'closed' OR past deadline) AND joined members exist AND minimum met
                // - Cancelled if: status is 'closed' AND (no members OR minimum not met)
                const now = new Date();
                const isPastDeadline = share.shareType === 'cab' 
                  ? (share.departureTime && new Date(share.departureTime) < now)
                  : share.shareType === 'food'
                  ? (share.deadlineTime && new Date(share.deadlineTime) < now)
                  : share.shareType === 'other'
                  ? (share.otherDeadline && new Date(share.otherDeadline) < now)
                  : false;
                
                const isCompleted = (share.status === 'closed' || isPastDeadline) && joinedCount > 0 && meetsMinimum;
                const isCancelled = !isCompleted;
                
                return (
              <div
                key={share._id}
                className={`rounded-2xl border p-4 transition ${
                  isCompleted 
                    ? 'border-emerald-500/50 bg-slate-900/60 hover:border-emerald-500/70' 
                    : 'border-red-500/50 bg-slate-900/60 hover:border-red-500/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{share.name}</h4>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                      {share.shareType === 'cab' && 'ðŸš— Cab'}
                      {share.shareType === 'food' && 'ðŸ” Food'}
                      {share.shareType === 'other' && 'ðŸ“‹ Other'}
                    </span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isCompleted 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {share.shareType === 'cab' && (isCompleted ? 'âœ… Completed Trip' : 'âŒ Cancelled Trip')}
                    {share.shareType === 'food' && (isCompleted ? 'âœ… Completed Order' : 'âŒ Cancelled Order')}
                    {share.shareType === 'other' && (isCompleted ? 'âœ… Completed Share' : 'âŒ Cancelled Share')}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{share.description}</p>
                
                {/* Cab Sharing Details */}
                {share.shareType === 'cab' && (
                  <div className={`mt-3 space-y-1 rounded-lg border p-3 text-sm ${
                    isCompleted 
                      ? 'border-emerald-500/30 bg-emerald-500/10' 
                      : 'border-red-500/30 bg-red-500/10'
                  }`}>
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-medium text-white">ðŸ“ Route:</span>
                      <span>{share.fromCity || 'N/A'} â†’ {share.toCity || 'N/A'}</span>
                    </div>
                    {share.departureTime && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ•’ Departed:</span>
                        <span>{new Date(share.departureTime).toLocaleString()}</span>
                      </div>
                    )}
                    {share.arrivalTime && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ Arrived:</span>
                        <span>{new Date(share.arrivalTime).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-slate-300">
                      {share.maxPassengers && (
                        <span>ðŸ‘¥ Passengers: {share.members.filter(m => m.status === 'joined').length}/{share.maxPassengers}</span>
                      )}
                      {share.vehicleType && (
                        <span>ðŸš™ {share.vehicleType}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Food Sharing Details */}
                {share.shareType === 'food' && (
                  <div className={`mt-3 space-y-1 rounded-lg border p-3 text-sm ${
                    isCompleted 
                      ? 'border-emerald-500/30 bg-emerald-500/10' 
                      : 'border-red-500/30 bg-red-500/10'
                  }`}>
                    {share.foodItems && (
                      <div className="flex items-start gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ” Items:</span>
                        <span>{share.foodItems}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-slate-300">
                      {share.quantity && (
                        <span>ðŸ“Š Qty: {share.quantity}</span>
                      )}
                    </div>
                    {share.deadlineTime && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">â° Delivered:</span>
                        <span>{new Date(share.deadlineTime).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-slate-300">
                      {share.maxPersons && (
                        <span>ðŸ‘¥ Persons: {share.members.filter(m => m.status === 'joined').length}/{share.maxPersons}</span>
                      )}
                      {share.minPersons && (
                        <span>ðŸ”¢ Min: {share.minPersons}</span>
                      )}
                    </div>
                    {isCancelled && share.minPersons && (
                      <div className="mt-2 rounded bg-red-500/20 px-3 py-2 text-xs text-red-200">
                        âŒ Cancelled Reason: {
                          joinedCount < share.minPersons 
                            ? `Minimum ${share.minPersons} persons required, only ${joinedCount} joined`
                            : 'Order cancelled by host'
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Other Sharing Details */}
                {share.shareType === 'other' && (
                  <div className={`mt-3 space-y-1 rounded-lg border p-3 text-sm ${
                    isCompleted 
                      ? 'border-emerald-500/30 bg-emerald-500/10' 
                      : 'border-red-500/30 bg-red-500/10'
                  }`}>
                    {share.category && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ“‹ Category:</span>
                        <span className="rounded-full bg-slate-500/20 px-2 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
                      </div>
                    )}
                    {share.otherDeadline && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">â° Deadline:</span>
                        <span>{new Date(share.otherDeadline).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-slate-300">
                      {share.otherMaxPersons && (
                        <span>ðŸ‘¥ Persons: {share.members.filter(m => m.status === 'joined').length}/{share.otherMaxPersons}</span>
                      )}
                      {share.otherMinPersons && (
                        <span>ðŸ”¢ Min: {share.otherMinPersons}</span>
                      )}
                    </div>
                    {isCancelled && share.otherMinPersons && (
                      <div className="mt-2 rounded bg-red-500/20 px-3 py-2 text-xs text-red-200">
                        âŒ Cancelled Reason: {
                          joinedCount < share.otherMinPersons 
                            ? `Minimum ${share.otherMinPersons} persons required, only ${joinedCount} joined`
                            : 'Share cancelled by host'
                        }
                      </div>
                    )}
                  </div>
                )}
                
                {/* Host Payment Display */}
                {(() => {
                  const hostMember = share.members.find(m => {
                    const memberId = m.user?._id || m.user;
                    return memberId === (user?.id || user?._id);
                  });
                  const hostShare = hostMember?.share || 0;
                  
                  return hostShare > 0 && isCompleted && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">ðŸ’°</span>
                        <span className="text-sm font-medium text-white">You Paid:</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {formatCurrency(hostShare)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                
                <p className="mt-3 text-xs text-slate-500">
                  Total: <span className="text-lg font-bold text-brand-primary">{formatCurrency(share.totalAmount)}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Split: <span className="capitalize">{share.splitType}</span> â€¢ Status:{' '}
                  <span className="capitalize">{share.status}</span>
                </p>
                <div className="mt-2 text-xs text-slate-400">
                  <p>Members: {share.members.filter(m => m.status === 'joined').length} active{share.members.filter(m => m.status === 'cancelled').length > 0 ? `, ${share.members.filter(m => m.status === 'cancelled').length} cancelled` : ''}</p>
                  <ul className="ml-4 mt-1 list-disc">
                    {share.members.map((member) => (
                      <li key={member.user?._id} className={member.status === 'cancelled' ? 'text-red-400 line-through' : ''}>
                        {member.user?.name} - {formatCurrency(member.share)} {member.status === 'cancelled' && '(Cancelled)'}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isCompleted ? 'Completed' : 'Cancelled'}: {new Date(share.departureTime || share.deadlineTime || share.otherDeadline || share.createdAt).toLocaleDateString()}
                </p>
              </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-white">As Member</h3>
          <div className="space-y-3">
            {(() => {
              const currentUserId = user?.id || user?._id;
              const memberShares = allMemberShares.filter((share) => {
                // Don't show shares where user is the host (those appear in "As Host" section)
                const hostId = share.host?._id || share.host;
                return hostId !== currentUserId;
              });
              
              if (memberShares.length === 0) {
                return <p className="text-slate-400">No sharing history as member.</p>;
              }
              
              return memberShares.map((share) => {
              const currentUserId = user?.id || user?._id;
              const userMembership = share.members.find((m) => {
                const memberId = m.user?._id || m.user;
                return memberId === currentUserId;
              });
              
              // Check if THIS USER cancelled their participation
              const userCancelled = userMembership?.status === 'cancelled';
              
              // Check if share is completed or cancelled
              const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
              const meetsMinimum = share.shareType === 'food' 
                ? (!share.minPersons || joinedMembersCount >= share.minPersons)
                : share.shareType === 'other'
                ? (!share.otherMinPersons || joinedMembersCount >= share.otherMinPersons)
                : true; // cab has no minimum requirement
              
              // Determine completion/cancellation status
              const now = new Date();
              const isPastDeadline = share.shareType === 'cab' 
                ? (share.departureTime && new Date(share.departureTime) < now)
                : share.shareType === 'food'
                ? (share.deadlineTime && new Date(share.deadlineTime) < now)
                : share.shareType === 'other'
                ? (share.otherDeadline && new Date(share.otherDeadline) < now)
                : false;
              
              // If user cancelled, show as cancelled regardless of overall trip status
              const isCompleted = !userCancelled && (share.status === 'closed' || isPastDeadline) && joinedMembersCount > 0 && meetsMinimum;
              const isCancelled = userCancelled || !isCompleted;
              
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
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">{share.name}</h4>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                        {share.shareType === 'cab' && 'ðŸš— Cab'}
                        {share.shareType === 'food' && 'ðŸ” Food'}
                        {share.shareType === 'other' && 'ðŸ“‹ Other'}
                      </span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isCancelled 
                        ? 'bg-red-500/20 text-red-300' 
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {share.shareType === 'cab' && (isCancelled ? 'âŒ Cancelled' : 'âœ… Completed Trip')}
                      {share.shareType === 'food' && (isCancelled ? 'âŒ Cancelled' : 'âœ… Completed Order')}
                      {share.shareType === 'other' && (isCancelled ? 'âŒ Cancelled' : 'âœ… Completed Share')}
                    </span>
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
                        <span className="font-medium text-white">ðŸ“ Boarding:</span>
                        <span>{share.fromCity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ“ Dropping:</span>
                        <span>{share.toCity}</span>
                      </div>
                      {share.departureTime && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">ðŸ•’ {isCancelled ? 'Was scheduled:' : 'Departed:'}</span>
                          <span>{new Date(share.departureTime).toLocaleString()}</span>
                        </div>
                      )}
                      {!isCancelled && share.arrivalTime && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">ðŸ Arrived:</span>
                          <span>{new Date(share.arrivalTime).toLocaleString()}</span>
                        </div>
                      )}
                      {!isCancelled && (
                        <div className="mt-2 flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-2">
                          <span className="font-medium text-white">ðŸ’° You Paid:</span>
                          <span className="text-lg font-bold text-emerald-300">
                            {formatCurrency(userMembership?.share || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Food Order Details */}
                  {share.shareType === 'food' && (
                    <div className={`mt-3 space-y-1.5 rounded-lg border p-3 text-sm ${
                      isCancelled
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/10'
                    }`}>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ” Items:</span>
                        <span>{share.foodItems}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ“Š Quantity:</span>
                        <span>{share.quantity}</span>
                      </div>
                      {share.deadlineTime && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">â° {isCancelled ? 'Was scheduled:' : 'Delivered:'}</span>
                          <span>{new Date(share.deadlineTime).toLocaleString()}</span>
                        </div>
                      )}
                      {!isCancelled && (
                        <div className="mt-2 flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-2">
                          <span className="font-medium text-white">ðŸ’° You Paid:</span>
                          <span className="text-lg font-bold text-emerald-300">
                            {formatCurrency(userMembership?.share || 0)}
                          </span>
                        </div>
                      )}
                      {isCancelled && share.minPersons && (
                        <div className="mt-2 rounded bg-red-500/20 px-3 py-2 text-xs text-red-200">
                          âŒ Cancelled Reason: {
                            share.members.filter(m => m.status === 'joined').length < share.minPersons 
                              ? `Minimum ${share.minPersons} persons required, only ${share.members.filter(m => m.status === 'joined').length} joined`
                              : 'Order cancelled'
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* Other Sharing Details */}
                  {share.shareType === 'other' && (
                    <div className={`mt-3 space-y-1.5 rounded-lg border p-3 text-sm ${
                      isCancelled
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/10'
                    }`}>
                      {share.category && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">ðŸ“‹ Category:</span>
                          <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
                        </div>
                      )}
                      {share.otherDeadline && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">â° {isCancelled ? 'Was scheduled:' : 'Completed:'}</span>
                          <span>{new Date(share.otherDeadline).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-medium text-white">ðŸ‘¥ Persons:</span>
                        <span>{share.members.filter(m => m.status === 'joined').length}{share.otherMaxPersons ? ` / ${share.otherMaxPersons}` : ''}</span>
                      </div>
                      {share.otherMinPersons && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="font-medium text-white">ðŸ”¢ Minimum:</span>
                          <span>{share.otherMinPersons}</span>
                        </div>
                      )}
                      {!isCancelled && (
                        <div className="mt-2 flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-2">
                          <span className="font-medium text-white">ðŸ’° You Paid:</span>
                          <span className="text-lg font-bold text-emerald-300">
                            {formatCurrency(userMembership?.share || 0)}
                          </span>
                        </div>
                      )}
                      {isCancelled && share.otherMinPersons && (
                        <div className="mt-2 rounded bg-red-500/20 px-3 py-2 text-xs text-red-200">
                          âŒ Cancelled Reason: {
                            share.members.filter(m => m.status === 'joined').length < share.otherMinPersons 
                              ? `Minimum ${share.otherMinPersons} persons required, only ${share.members.filter(m => m.status === 'joined').length} joined`
                              : 'Share cancelled'
                          }
                        </div>
                      )}
                    </div>
                  )}
                  
                  <p className="mt-3 text-sm text-slate-400">
                    Host: {share.host?.name} ({share.host?.email})
                  </p>
                  <p className="text-xs text-slate-500">
                    Total: {formatCurrency(share.totalAmount)} â€¢ Split: <span className="capitalize">{share.splitType}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Completed: {new Date(share.departureTime || share.deadlineTime || share.otherDeadline || share.createdAt).toLocaleDateString()}
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10 text-slate-100">
      <h1 className="mb-4 sm:mb-6 text-2xl sm:text-4xl font-bold text-white">My History</h1>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-800">
        <button
          onClick={() => setActiveTab('buying')}
          className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition ${
            activeTab === 'buying'
              ? 'border-b-2 border-brand-primary text-brand-primary'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Buying History
        </button>
        <button
          onClick={() => setActiveTab('selling')}
          className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition ${
            activeTab === 'selling'
              ? 'border-b-2 border-brand-primary text-brand-primary'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Selling History
        </button>
        <button
          onClick={() => setActiveTab('cab')}
          className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition ${
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
        {activeTab === 'cab' && renderSharingHistory()}
      </div>
    </main>
  );
};

export default UserHistory;
