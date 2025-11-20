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

const BillShareCard = ({ share, onJoin, onApprove, currentUserId, joiningId }) => {
  const memberIds = share.members?.map((member) => normalizeId(member.user)) || [];
  const pendingIds = share.pendingRequests?.map((req) => normalizeId(req)) || [];
  const hostId = normalizeId(share.host);
  const isMember = memberIds.includes(currentUserId);
  const isPending = pendingIds.includes(currentUserId);
  const isHost = hostId === currentUserId;
  const disabled = share.status !== 'open' || isMember || isPending || isHost;
  const isJoining = joiningId === share._id;

  const ctaLabel = isHost
    ? 'You are hosting'
    : isMember
      ? 'Joined'
      : isPending
        ? 'Request Pending'
        : 'Request to Join';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow shadow-black/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{share.name}</h3>
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
      <p className="mt-3 text-sm text-slate-300">
        Total: <strong className="text-white">{formatCurrency(share.totalAmount)}</strong> • Split: {share.splitType}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        {share.members?.map((member) => (
          <span key={member.user?._id || member.user} className="rounded-full bg-slate-800/80 px-3 py-0.5">
            {member.user?.name || 'Member'} ({member.status})
          </span>
        ))}
      </div>
      {isHost && share.pendingRequests?.length > 0 && (
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
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
      {share.status === 'open' && (
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
    </div>
  );
};

export default BillShareCard;
