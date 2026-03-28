import { useCallback, useEffect, useState } from 'react';
import { getDisputes, resolveDispute } from '../../services/adminService';

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ status: 'open', q: '' });
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (page = meta.page) => {
    setLoading(true);
    try {
      const { data } = await getDisputes({
        page,
        limit: 10,
        sort: 'newest',
        ...filters,
      });
      setDisputes(data.data || []);
      setMeta({ page: data.page, totalPages: data.totalPages });
      setError('');
    } finally {
      setLoading(false);
    }
  }, [filters, meta.page]);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleResolve = async (disputeId, action) => {
    const confirmationText = action === 'release'
      ? 'Resolve dispute and release deposit?'
      : 'Resolve dispute and forfeit deposit?';
    if (!window.confirm(confirmationText)) return;

    const notes = window.prompt('Resolution notes (optional):', '') || '';
    setResolvingId(disputeId);
    setToast('');

    try {
      await resolveDispute(disputeId, { action, notes });
      setToast(action === 'release' ? 'Dispute resolved and deposit released.' : 'Dispute resolved and deposit forfeited.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolvingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Rental Disputes</h2>
        <p className="text-sm text-slate-400">Track open and resolved rental disputes across the platform.</p>
      </div>

      {(toast || error) && (
        <div className="space-y-2">
          {toast && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{toast}</p>}
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Search listing title, buyer, seller"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
        />
        <select
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="open">Open disputes</option>
          <option value="resolved">Resolved disputes</option>
          <option value="all">All disputes</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading disputes...</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => {
            const listingTitle = dispute.listing?.title || dispute.listingSnapshot?.title || 'Listing unavailable';
            const buyerText = dispute.buyer?.name
              ? `${dispute.buyer.name} (${dispute.buyer.email || 'no email'})`
              : 'Buyer unavailable';
            const sellerText = dispute.seller?.name
              ? `${dispute.seller.name} (${dispute.seller.email || 'no email'})`
              : 'Seller unavailable';
            const resolvedByName = dispute.disputeResolution?.resolvedBy?.name || 'Admin';
            const resolvedByEmail = dispute.disputeResolution?.resolvedBy?.email || '';
            const resolutionAction = dispute.disputeResolution?.action || null;
            const resolutionNotes = dispute.disputeResolution?.notes || '';
            const resolvedAt = dispute.disputeResolution?.resolvedAt;

            return (
              <div key={dispute._id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{listingTitle}</h3>
                    <p className="mt-1 text-xs text-slate-300">Buyer: {buyerText}</p>
                    <p className="text-xs text-slate-300">Seller: {sellerText}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Updated: {new Date(dispute.updatedAt).toLocaleString()}
                    </p>
                    {dispute.disputeStatus === 'resolved' && (
                      <div className="mt-2 space-y-1 text-xs text-emerald-200">
                        <p>
                          Resolution: {resolutionAction || 'resolved'}
                        </p>
                        <p>
                          Resolved by: {resolvedByName}{resolvedByEmail ? ` (${resolvedByEmail})` : ''}
                        </p>
                        {resolvedAt && <p>Resolved at: {new Date(resolvedAt).toLocaleString()}</p>}
                        {resolutionNotes && <p>Notes: {resolutionNotes}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        dispute.disputeStatus === 'open'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {dispute.disputeStatus}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                      deposit: {dispute.depositStatus}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                      rental: {dispute.rentalStatus}
                    </span>
                    {dispute.disputeStatus === 'open' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResolve(dispute._id, 'release')}
                          disabled={resolvingId === dispute._id}
                          className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                        >
                          Release
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(dispute._id, 'forfeit')}
                          disabled={resolvingId === dispute._id}
                          className="rounded-full border border-red-500/60 px-3 py-1 text-xs text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                        >
                          Forfeit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!disputes.length && <p className="text-sm text-slate-400">No disputes found.</p>}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(Math.max(1, meta.page - 1))}
            disabled={meta.page <= 1}
            className="rounded-full border border-slate-700 px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => load(Math.min(meta.totalPages, meta.page + 1))}
            disabled={meta.page >= meta.totalPages}
            className="rounded-full border border-slate-700 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDisputes;
