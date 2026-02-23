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

const BillShareCard = ({ share, onJoin, onCancel, onApprove, onReject, onUpdate, onDelete, onFinalize, currentUserId, joiningId, cancellingId }) => {
  const memberIds = share.members?.map((member) => normalizeId(member.user)) || [];
  const pendingIds = share.pendingRequests?.map((req) => normalizeId(req)) || [];
  const rejectedIds = share.rejectedRequests?.map((req) => normalizeId(req.user)) || [];
  const hostId = normalizeId(share.host);
  
  // Check user's membership status
  const currentUserMember = share.members?.find(m => normalizeId(m.user) === currentUserId);
  const currentUserRejection = share.rejectedRequests?.find(req => normalizeId(req.user) === currentUserId);
  const rejectionReason = currentUserRejection?.reason || 'Trip fully occupied';
  const isMember = memberIds.includes(currentUserId);
  
  // Only show as cancelled if user voluntarily cancelled (and share is still open)
  // If share is closed and minimum not met, all members are auto-cancelled by system
  const isCancelled = currentUserMember?.status === 'cancelled' && share.status === 'open';
  
  const isPending = pendingIds.includes(currentUserId);
  const isRejected = rejectedIds.includes(currentUserId);
  const isHost = hostId === currentUserId;
  
  // Check if booking deadline has passed for cab sharing
  let isDeadlinePassed = false;
  let isFullyBooked = false;
  const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
  
  if (share.shareType === 'cab') {
    isDeadlinePassed = share.bookingDeadline ? new Date() > new Date(share.bookingDeadline) : false;
    isFullyBooked = share.maxPassengers ? joinedMembersCount >= share.maxPassengers : false;
  } else if (share.shareType === 'food') {
    isDeadlinePassed = share.deadlineTime ? new Date() > new Date(share.deadlineTime) : false;
    isFullyBooked = share.maxPersons ? joinedMembersCount >= share.maxPersons : false;
  } else if (share.shareType === 'other') {
    isDeadlinePassed = share.otherDeadline ? new Date() > new Date(share.otherDeadline) : false;
    isFullyBooked = share.otherMaxPersons ? joinedMembersCount >= share.otherMaxPersons : false;
  }
  
  // Calculate user's share amount
  const userShare = currentUserMember?.share || 0;
  
  // If no custom share calculated yet, calculate equal split
  const calculatedShare = userShare > 0 ? userShare : 
    (share.splitType === 'equal' && isMember && !isCancelled ? share.totalAmount / share.members.filter(m => m.status === 'joined').length : 0);
  
  const disabled = share.status !== 'open' || isMember || isPending || isHost || isDeadlinePassed || isFullyBooked || isCancelled || isRejected;
  const isJoining = joiningId === share._id;

  const ctaLabel = isHost
    ? 'You are hosting'
    : isCancelled
      ? '❌ Cancelled'
      : isRejected
        ? '🚫 Request Rejected'
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5 shadow shadow-black/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-white">{share.name}</h3>
            {share.shareType && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                {share.shareType === 'cab' && '🚗 Cab'}
                {share.shareType === 'food' && '🍔 Food'}
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

      {/* Completed Trip Banner for Host */}
      {share.shareType === 'cab' && isHost && share.status === 'closed' && joinedMembersCount > 0 && (
        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-blue-300">Trip Completed!</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📍 Route:</span>
              <span>{share.fromCity} → {share.toCity}</span>
            </div>
            {share.departureTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Completed on:</span>
                <span>{new Date(share.departureTime).toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 rounded bg-blue-500/20 px-3 py-2">
              <span className="font-medium text-white">👥 Passengers:</span>
              <span className="text-lg font-bold text-blue-300">{joinedMembersCount}/{share.maxPassengers}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Trip Banner for Host */}
      {share.shareType === 'cab' && isHost && (joinedMembersCount === 0 || (share.members && share.members.length > 0 && share.members.every(m => m.status === 'cancelled'))) && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-semibold text-red-300">Trip Cancelled</span>
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
              This trip has been cancelled
            </p>
          </div>
        </div>
      )}

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

      {/* Completed Order Banner for Host */}
      {share.shareType === 'food' && isHost && share.status === 'closed' && joinedMembersCount > 0 && (
        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-blue-300">Order Completed!</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">🍔 Items:</span>
              <span>{share.foodItems}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📊 Qty:</span>
              <span>{share.quantity}</span>
            </div>
            {share.deadlineTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">⏰ Delivered on:</span>
                <span>{new Date(share.deadlineTime).toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 rounded bg-blue-500/20 px-3 py-2">
              <span className="font-medium text-white">👥 Members:</span>
              <span className="text-lg font-bold text-blue-300">{joinedMembersCount}/{share.maxPersons}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Order Banner for Host */}
      {share.shareType === 'food' && isHost && (joinedMembersCount === 0 || (share.members && share.members.length > 0 && share.members.every(m => m.status === 'cancelled'))) && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-semibold text-red-300">Order Cancelled</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">🍔 Items:</span>
              <span>{share.foodItems}</span>
            </div>
            {share.deadlineTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Was scheduled for:</span>
                <span>{new Date(share.deadlineTime).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {joinedMembersCount < share.minPersons 
                ? `Cancelled - Minimum ${share.minPersons} members required, only ${joinedMembersCount} joined`
                : 'This order has been cancelled'}
            </p>
          </div>
        </div>
      )}

      {/* Confirmed Order Banner for Food Sharing */}
      {share.shareType === 'food' && isMember && !isHost && !isCancelled && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-emerald-300">Order Confirmed!</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">🍔 Items:</span>
              <span>{share.foodItems}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📊 Qty:</span>
              <span>{share.quantity}</span>
            </div>
            {share.deadlineTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">⏰ Delivery:</span>
                <span>{new Date(share.deadlineTime).toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 rounded bg-emerald-500/20 px-3 py-2">
              <span className="font-medium text-white">💰 Your Share:</span>
              <span className="text-lg font-bold text-emerald-300">{formatCurrency(calculatedShare)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed Share Banner for Other Sharing */}
      {share.shareType === 'other' && isMember && !isHost && !isCancelled && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-emerald-300">Share Confirmed!</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            {share.category && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">📋 Category:</span>
                <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
              </div>
            )}
            {share.otherDeadline && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">⏰ Deadline:</span>
                <span>{new Date(share.otherDeadline).toLocaleString()}</span>
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
          {/* Rebook button - show if seats available and deadline not passed */}
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Rebooking...' : '🔄 Rebook This Trip'}
            </button>
          )}
        </div>
      )}

      {/* Cancelled Order Banner for Food Sharing */}
      {share.shareType === 'food' && isCancelled && !isHost && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-semibold text-red-300">Order Cancelled</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">🍔 Items:</span>
              <span>{share.foodItems}</span>
            </div>
            {share.deadlineTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Was scheduled for:</span>
                <span>{new Date(share.deadlineTime).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              This order will be removed after the delivery time
            </p>
          </div>
          {/* Reorder button - show if capacity available and deadline not passed */}
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Reordering...' : '🔄 Reorder'}
            </button>
          )}
        </div>
      )}

      {/* Rejected Request Banner */}
      {share.shareType === 'cab' && isRejected && !isHost && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <span className="font-semibold text-orange-300">Request Not Accepted</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">📍 Route:</span>
              <span>{share.fromCity} → {share.toCity}</span>
            </div>
            {share.departureTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Departure:</span>
                <span>{new Date(share.departureTime).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 rounded bg-orange-500/20 px-3 py-2 text-xs text-orange-200">
              ℹ️ {rejectionReason === 'Rejected by host' 
                ? 'Your request was rejected by the host. This notification will be removed after departure.' 
                : 'This trip was fully occupied when you requested. This notification will be removed after departure.'}
            </p>
          </div>
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Requesting...' : '🔄 Request Again'}
            </button>
          )}
        </div>
      )}

      {/* Rejected Request Banner for Food Sharing */}
      {share.shareType === 'food' && isRejected && !isHost && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <span className="font-semibold text-orange-300">Request Not Accepted</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">🍔 Items:</span>
              <span>{share.foodItems}</span>
            </div>
            {share.deadlineTime && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Delivery:</span>
                <span>{new Date(share.deadlineTime).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 rounded bg-orange-500/20 px-3 py-2 text-xs text-orange-200">
              ℹ️ {rejectionReason === 'Rejected by host' 
                ? 'Your request was rejected by the host. This notification will be removed after delivery.' 
                : 'This order was at full capacity when you requested. This notification will be removed after delivery.'}
            </p>
          </div>
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Requesting...' : '🔄 Request Again'}
            </button>
          )}
        </div>
      )}

      {/* Cancelled Banner for Other Sharing */}
      {share.shareType === 'other' && isCancelled && !isHost && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">❌</span>
            <span className="font-semibold text-red-300">Share Cancelled</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            {share.category && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">📋 Category:</span>
                <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
              </div>
            )}
            {share.otherDeadline && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Was scheduled for:</span>
                <span>{new Date(share.otherDeadline).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              This share will be removed after the deadline
            </p>
          </div>
          {/* Rebook button - show if capacity available and deadline not passed */}
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Rebooking...' : '🔄 Rebook'}
            </button>
          )}
        </div>
      )}

      {/* Rejected Request Banner for Other Sharing */}
      {share.shareType === 'other' && isRejected && !isHost && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <span className="font-semibold text-orange-300">Request Not Accepted</span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            {share.category && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">📋 Category:</span>
                <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
              </div>
            )}
            {share.otherDeadline && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">🕒 Deadline:</span>
                <span>{new Date(share.otherDeadline).toLocaleString()}</span>
              </div>
            )}
            <p className="mt-2 rounded bg-orange-500/20 px-3 py-2 text-xs text-orange-200">
              ℹ️ {rejectionReason === 'Rejected by host' 
                ? 'Your request was rejected by the host. This notification will be removed after the deadline.' 
                : 'This share was at full capacity when you requested. This notification will be removed after the deadline.'}
            </p>
          </div>
          {!isFullyBooked && !isDeadlinePassed && share.status === 'open' && onJoin && (
            <button
              type="button"
              onClick={() => onJoin(share._id)}
              disabled={joiningId === share._id}
              className="mt-3 w-full rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joiningId === share._id ? '🔄 Requesting...' : '🔄 Request Again'}
            </button>
          )}
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
                👥 Seats: {joinedMembersCount}/{share.maxPassengers}
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
          </div>
          {share.deadlineTime && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">Delivery Time:</span>
              <span className={new Date() > new Date(share.deadlineTime) ? 'text-red-400 font-semibold' : ''}>
                {new Date(share.deadlineTime).toLocaleString()}
                {new Date() > new Date(share.deadlineTime) && ' (Expired)'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 text-slate-300">
            {share.maxPersons && (
              <span className={isFullyBooked ? 'text-red-400 font-semibold' : ''}>
                👥 Participants: {joinedMembersCount}/{share.maxPersons}
                {isFullyBooked && ' (Full)'}
              </span>
            )}
            {share.minPersons && (
              <span className={joinedMembersCount < share.minPersons ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
                🔢 Min Required: {share.minPersons}
                {joinedMembersCount < share.minPersons && ' ⚠️'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Other Sharing Details */}
      {share.shareType === 'other' && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
          {share.category && (
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <span className="font-medium text-white">Category:</span>
              <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">{share.category}</span>
            </div>
          )}
          {share.otherMinPersons && share.otherMaxPersons && (
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <span className="font-medium text-white">👥 Participants:</span>
              <span>{share.members?.filter(m => m.status === 'joined').length}/{share.otherMaxPersons} (min: {share.otherMinPersons})</span>
              {share.members?.filter(m => m.status === 'joined').length < share.otherMinPersons && (
                <span className="text-orange-400 text-xs">⚠️ Min not met</span>
              )}
            </div>
          )}
          {share.otherDeadline && (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-medium text-white">⏰ Deadline:</span>
              <span>{new Date(share.otherDeadline).toLocaleString()}</span>
            </div>
          )}
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
        {share.members?.filter(m => m.status !== 'cancelled').map((member) => (
          <span 
            key={member.user?._id || member.user} 
            className="rounded-full bg-slate-800/80 px-3 py-0.5"
          >
            {member.user?.name || 'Member'} ({member.status})
          </span>
        ))}
      </div>
      {isHost && (share.pendingRequests?.length > 0 || share.rejectedRequests?.length > 0 || (share.members?.length > 1)) && (
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove?.(share._id, normalizeId(pending))}
                      className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200 hover:border-emerald-200"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject?.(share._id, normalizeId(pending))}
                      className="rounded-full border border-red-400/40 px-3 py-1 text-xs font-semibold text-red-200 hover:border-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {share.rejectedRequests?.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-orange-400">🚫 Rejected Requests</p>
              {share.rejectedRequests.map((rejected) => (
                <div key={normalizeId(rejected.user)} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                  <div>
                    <p className="font-medium">{rejected.user?.name || 'Classmate'}</p>
                    <p className="text-xs text-orange-400">
                      Rejected: {new Date(rejected.rejectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-300">
                    {rejected.reason === 'Rejected by host' ? 'Rejected by host' : 
                     rejected.reason === 'Trip fully occupied' ? 'Trip Full' : 
                     rejected.reason === 'Order fully occupied' ? 'Order Full' : 
                     rejected.reason === 'Share fully occupied' ? 'Share Full' : 
                     rejected.reason}
                  </span>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                These requests will be removed after departure time
              </p>
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
      {isHost && (onUpdate || onDelete || (onFinalize && share.status === 'open')) && (
        <div className="mt-4 space-y-3">
          {/* Mark as Complete button removed for host */}
          <div className="flex gap-3">
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
        </div>
      )}
    </div>
  );
};

export default BillShareCard;
