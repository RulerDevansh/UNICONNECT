import { formatCurrency } from '../utils/currency';

const SharePreviewCard = ({ share }) => {
  const members = share.members?.filter((member) => member.status !== 'cancelled') || [];
  const visibleMembers = members.slice(0, 3);
  const remainingMembers = Math.max(members.length - visibleMembers.length, 0);
  const hostName = share.host?.name || 'Host';
  const totalAmount = formatCurrency(share.totalAmount);
  const status = share.status || 'open';
  const statusBadgeClasses = status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300';

  const joinedMembersCount = members.filter((member) => member.status === 'joined').length || 0;
  const remainingSeats = share.maxPassengers ? share.maxPassengers - joinedMembersCount : null;

  const getShareTypeInfo = () => {
    switch (share.shareType) {
      case 'cab':
        return { label: '🚗 Cab', color: 'bg-blue-500/20 text-blue-300' };
      case 'food':
        return { label: '🍔 Food', color: 'bg-orange-500/20 text-orange-300' };
      case 'other':
        return { label: '📋 Other', color: 'bg-slate-500/20 text-slate-300' };
      default:
        return { label: '📋 Split', color: 'bg-slate-500/20 text-slate-300' };
    }
  };

  const shareTypeInfo = getShareTypeInfo();

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 shadow shadow-black/30">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${shareTypeInfo.color}`}>
            {shareTypeInfo.label}
          </span>
          <span className="uppercase tracking-wide text-slate-400">{share.splitType} split</span>
        </div>
        <span className={`rounded-full px-3 py-0.5 text-[11px] font-semibold ${statusBadgeClasses}`}>{status}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-white">{share.name}</h3>
      {share.description && <p className="text-sm text-slate-400">{share.description}</p>}

      {share.shareType === 'cab' && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs">
          {share.fromCity && share.toCity && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">📍</span>
              <span>{share.fromCity} → {share.toCity}</span>
            </div>
          )}
          {share.departureTime && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">🕒</span>
              <span>{new Date(share.departureTime).toLocaleString()}</span>
            </div>
          )}
          {share.bookingDeadline && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">⏰</span>
              <span>Deadline: {new Date(share.bookingDeadline).toLocaleDateString()}</span>
            </div>
          )}
          {share.maxPassengers && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="font-medium text-white">👥</span>
                <span>Occupancy: {joinedMembersCount}/{share.maxPassengers}</span>
              </div>
              {remainingSeats > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {remainingSeats} seat{remainingSeats !== 1 ? 's' : ''} left
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {share.shareType === 'food' && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs">
          {share.foodItems && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">🍽️</span>
              <span>{share.foodItems}</span>
            </div>
          )}
          {share.deadlineTime && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">⏰</span>
              <span>Deadline: {new Date(share.deadlineTime).toLocaleString()}</span>
            </div>
          )}
          {share.maxPersons && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="font-medium text-white">👥</span>
                <span>Participants: {joinedMembersCount}/{share.maxPersons}</span>
              </div>
              {(share.maxPersons - joinedMembersCount) > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {share.maxPersons - joinedMembersCount} spot{(share.maxPersons - joinedMembersCount) !== 1 ? 's' : ''} left
                </span>
              )}
            </div>
          )}
          {share.minPersons && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">🔢</span>
              <span className={joinedMembersCount < share.minPersons ? 'text-orange-400 font-semibold' : ''}>
                Min Required: {share.minPersons}
                {joinedMembersCount < share.minPersons && ' ⚠️'}
              </span>
            </div>
          )}
        </div>
      )}

      {share.shareType === 'other' && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs">
          {share.category && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">📋</span>
              <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{share.category}</span>
            </div>
          )}
          {share.otherDeadline && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">⏰</span>
              <span>Deadline: {new Date(share.otherDeadline).toLocaleString()}</span>
            </div>
          )}
          {share.otherMaxPersons && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="font-medium text-white">👥</span>
                <span>Participants: {joinedMembersCount}/{share.otherMaxPersons}</span>
              </div>
              {(share.otherMaxPersons - joinedMembersCount) > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {share.otherMaxPersons - joinedMembersCount} spot{(share.otherMaxPersons - joinedMembersCount) !== 1 ? 's' : ''} left
                </span>
              )}
            </div>
          )}
          {share.otherMinPersons && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">🔢</span>
              <span className={joinedMembersCount < share.otherMinPersons ? 'text-orange-400 font-semibold' : ''}>
                Min Required: {share.otherMinPersons}
                {joinedMembersCount < share.otherMinPersons && ' ⚠️'}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-slate-300">
        Total <span className="font-semibold text-white">{totalAmount}</span>
      </p>
      <p className="text-xs uppercase tracking-wide text-slate-500">Host: {hostName}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        {visibleMembers.map((member, index) => (
          <span key={`${share._id}-${index}`} className="rounded-full bg-slate-900/80 px-3 py-0.5">
            {member.user?.name || 'Member'}
          </span>
        ))}
        {remainingMembers > 0 && <span className="rounded-full bg-slate-900/40 px-3 py-0.5">+{remainingMembers} more</span>}
        {!visibleMembers.length && <span className="text-slate-500">No members yet</span>}
      </div>
    </div>
  );
};

export default SharePreviewCard;
