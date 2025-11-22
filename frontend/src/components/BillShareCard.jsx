import classNames from 'classnames';
import { formatCurrency } from '../utils/currency';

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return value._id || value.id || value.toString?.() || '';
  }
  return '';
};

const BillShareCard = ({ share, onJoin, onCancel, onApprove, onUpdate, onDelete, currentUserId, joiningId, cancellingId }) => {
  const memberIds = share.members?.map((member) => normalizeId(member.user)) || [];
  const pendingIds = share.pendingRequests?.map((req) => normalizeId(req)) || [];
  const hostId = normalizeId(share.host);
  
  // Check user's membership status
  const currentUserMember = share.members?.find(m => normalizeId(m.user) === currentUserId);
  const isMember = memberIds.includes(currentUserId);
  const isCancelled = currentUserMember?.status === 'cancelled';
  const isPending = pendingIds.includes(currentUserId);
  const isHost = hostId === currentUserId;
  
  // Check if booking deadline has passed for cab sharing
  const isDeadlinePassed = share.shareType === 'cab' && share.bookingDeadline 
    ? new Date() > new Date(share.bookingDeadline) 
    : false;
  
  // Check if all seats are booked for cab sharing
  const isFullyBooked = share.shareType === 'cab' && share.maxPassengers 
    ? share.members.filter(m => m.status === 'joined').length >= share.maxPassengers
    : false;
  
  // Calculate user's share amount
  const userShare = currentUserMember?.share || 0;
  
  // If no custom share calculated yet, calculate equal split
  const calculatedShare = userShare > 0 ? userShare : 
    (share.splitType === 'equal' && isMember && !isCancelled ? share.totalAmount / share.members.filter(m => m.status === 'joined').length : 0);
  
  const disabled = share.status !== 'open' || isMember || isPending || isHost || isDeadlinePassed || isFullyBooked || isCancelled;
  const isJoining = joiningId === share._id;

  const ctaLabel = isHost
    ? 'You are hosting'
    : isCancelled
      ? '❌ Cancelled'
      : isMember
        ? '✅ Confirmed'
        : isPending
          ? '⏳ Request Pending'
          : isFullyBooked
            ? '🚫 Fully Booked'
          : isDeadlinePassed
            ? '🔒 Booking Closed'
            : 'Request to Join';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow shadow-black/30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{share.name}</h3>
            {share.shareType && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                {share.shareType === 'cab' && '🚗 Cab'}
                {share.shareType === 'food' && '🍔 Food'}
                {share.shareType === 'product' && '📦 Product'}
                {share.shareType === 'other' && '📋 Other'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">{share.description}</p>
        </div>
        <span
          className={classNames('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', {
            'bg-emerald-500/15 text-emerald-300': share.status === 'open',
            'bg-slate-700 text-slate-300': share.status === 'closed',
          })}
        >
          {share.status}
        </span>
      </div>

      {/* Confirmed Trip Banner for Approved Members */}
      {share.shareType === 'cab' && isMember && !isHost && !isCancelled && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-emerald-300">Trip Confirmed!</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📍 Boarding:</span>
              <span>{share.fromCity}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📍 Dropping:</span>
              <span>{share.toCity}</span>
            </div>
            {share.departureTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Departure:</span>
                <span>{new Date(share.departureTime).toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-2">
              <span className="font-medium text-white">💰 Your Share:</span>
              <span className="text-lg font-bold text-emerald-300">{formatCurrency(calculatedShare)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Trip Banner */}
      {share.shareType === 'cab' && isCancelled && !isHost && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-semibold text-red-300">Booking Cancelled</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📍 Route:</span>
              <span>{share.fromCity} → {share.toCity}</span>
            </div>
            {share.departureTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Was scheduled for:</span>
                <span>{new Date(share.departureTime).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              This booking will be removed after the departure time
            </p>
          </div>
        </div>
      )}

      {/* Cab Sharing Details */}
      {share.shareType === 'cab' && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-medium text-white">Route:</span>
            <span>{share.fromCity || 'N/A'} → {share.toCity || 'N/A'}</span>
          </div>
          {share.departureTime && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Departure:</span>
              <span>{new Date(share.departureTime).toLocaleString()}</span>
            </div>
          )}
          {share.arrivalTime && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Arrival:</span>
              <span>{new Date(share.arrivalTime).toLocaleString()}</span>
            </div>
          )}
          {share.bookingDeadline && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Booking Until:</span>
              <span className={new Date() > new Date(share.bookingDeadline) ? 'text-red-400 font-semibold' : ''}>
                {new Date(share.bookingDeadline).toLocaleString()}
                {new Date() > new Date(share.bookingDeadline) && ' (Expired)'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 text-slate-300">
            {share.maxPassengers && (
              <span className={isFullyBooked ? 'text-red-400 font-semibold' : ''}>
                👥 Seats: {share.members.length}/{share.maxPassengers}
                {isFullyBooked && ' (Full)'}
              </span>
            )}
            {share.vehicleType && (
              <span>🚙 {share.vehicleType}</span>
            )}
          </div>
        </div>
      )}

      {/* Food Sharing Details */}
      {share.shareType === 'food' && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
          {share.foodItems && (
            <div className="flex items-start gap-2 text-slate-300">
              <span className="font-medium text-white">Items:</span>
              <span>{share.foodItems}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-slate-300">
            {share.quantity && (
              <span>📊 Qty: {share.quantity}</span>
            )}
            {share.discount > 0 && (
              <span className="text-emerald-400">🏷️ {share.discount}% off</span>
            )}
          </div>
          {share.cuisineType && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Cuisine:</span>
              <span>{share.cuisineType}</span>
            </div>
          )}
          {share.deliveryTime && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Delivery:</span>
              <span>{new Date(share.deliveryTime).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Product Sharing Details */}
      {share.shareType === 'product' && (
        <div className="mt-3 space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
          {share.productName && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Product:</span>
              <span>{share.productName}</span>
            </div>
          )}
          {share.productCategory && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Category:</span>
              <span>{share.productCategory}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-slate-300">
            {share.bulkQuantity && (
              <span>📦 Bulk: {share.bulkQuantity} units</span>
            )}
            {share.pricePerUnit && (
              <span>💰 {formatCurrency(share.pricePerUnit)}/unit</span>
            )}
          </div>
        </div>
      )}

      {/* Other Sharing Details */}
      {share.shareType === 'other' && share.category && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-medium text-white">Category:</span>
            <span>{share.category}</span>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm text-slate-300">
        Total: <strong className="text-white">{formatCurrency(share.totalAmount)}</strong> • Split: {share.splitType}
        {share.splitType === 'custom' && share.hostContribution > 0 && (
          <span className="ml-2 text-slate-400">
            (Host pays: <strong className="text-emerald-400">{formatCurrency(share.hostContribution)}</strong>)
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        {share.members?.map((member) => (
          <span 
            key={member.user?._id || member.user} 
            className={`rounded-full px-3 py-0.5 ${
              member.status === 'cancelled' 
                ? 'bg-red-500/20 text-red-300 line-through' 
                : 'bg-slate-800/80'
            }`}
          >
            {member.user?.name || 'Member'} ({member.status})
          </span>
        ))}
      </div>
      {isHost && (share.pendingRequests?.length > 0 || (share.members?.length > 1)) && (
        <div className="mt-4 space-y-3">
          {share.pendingRequests?.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Pending Requests</p>
              {share.pendingRequests.map((pending) => (
                <div key={normalizeId(pending)} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                  <div>
                    <p className="font-medium">{pending.name || 'Classmate'}</p>
                    <p className="text-xs text-slate-400">{pending.email || 'Pending approval'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApprove?.(share._id, normalizeId(pending))}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200 hover:border-emerald-200"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
          {share.members?.length > 1 && (
            <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-400">✅ Approved Members</p>
              {share.members
                .filter(m => normalizeId(m.user) !== currentUserId)
                .map((member) => (
                  <div key={normalizeId(member.user)} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                    <div>
                      <p className="font-medium">{member.user?.name || 'Member'}</p>
                      <p className={`text-xs ${member.status === 'cancelled' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {member.status === 'cancelled' ? 'Cancelled' : `Confirmed • ${member.status}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      member.status === 'cancelled' 
                        ? 'bg-red-500/20 text-red-300 line-through' 
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {formatCurrency(member.share || 0)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {/* Cancel Button for Pending/Approved Members (not cancelled) */}
      {share.status === 'open' && !isHost && (isPending || (isMember && !isCancelled)) && onCancel && (
        <button
          type="button"
          onClick={() => onCancel(share._id)}
          disabled={cancellingId === share._id}
          className="mt-4 w-full rounded-full border border-red-500 bg-transparent px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancellingId === share._id ? 'Cancelling…' : '❌ Cancel Booking'}
        </button>
      )}
      
      {share.status === 'open' && !isHost && !isPending && !isMember && (
        <button
          type="button"
          onClick={() => !disabled && onJoin?.(share._id)}
          disabled={disabled}
          className={classNames(
            'mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold transition',
            disabled
              ? 'cursor-not-allowed border border-slate-700 text-slate-500'
              : 'bg-brand-primary text-white shadow shadow-brand-primary/40 hover:-translate-y-0.5 hover:bg-brand-secondary'
          )}
        >
          {isJoining ? 'Requesting…' : ctaLabel}
        </button>
      )}
      {isHost && (onUpdate || onDelete) && (
        <div className="mt-4 flex gap-3">
          {onUpdate && (
            <button
              type="button"
              onClick={() => onUpdate(share._id)}
              className="flex-1 rounded-full border border-brand-primary bg-transparent px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white"
            >
              Update
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(share._id)}
              className="flex-1 rounded-full border border-red-500 bg-transparent px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BillShareCard;
