import { useEffect, useState } from 'react';
import { getFlaggedListings, reviewListing } from '../../services/adminService';

const AdminListings = () => {
  const [listings, setListings] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ source: '', reason: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState({ open: false, action: '', listing: null });
  const [reviewNotes, setReviewNotes] = useState('');

  const load = async (page = meta.page) => {
    setLoading(true);
    const { data } = await getFlaggedListings({
      page,
      limit: 10,
      sort: 'newest',
      ...filters,
    });
    setListings(data.data || []);
    setMeta({ page: data.page, totalPages: data.totalPages });
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, [filters]);

  const openReviewModal = (listing, action) => {
    setReviewNotes('');
    setReviewModal({ open: true, action, listing });
  };

  const closeReviewModal = () => {
    setReviewModal({ open: false, action: '', listing: null });
    setReviewNotes('');
  };

  const submitReview = async () => {
    if (!reviewModal.listing) return;
    await reviewListing(reviewModal.listing._id, { action: reviewModal.action, notes: reviewNotes || '' });
    closeReviewModal();
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Listing Moderation</h2>
        <p className="text-sm text-slate-400">Review flagged listings and take action with notes.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Search title or description"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Reason"
          value={filters.reason}
          onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value }))}
        />
        <select
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          value={filters.source}
          onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
        >
          <option value="">All sources</option>
          <option value="system">System detection</option>
          <option value="report">User report</option>
          <option value="review_request">Review request</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading flagged listings...</p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const imageUrl = listing.images?.[0]?.url || listing.images?.[0] || '';
            const scoreValue = Number.isFinite(listing.moderation?.score)
              ? Math.round(listing.moderation.score * 100)
              : null;
            const reporter = listing.moderation?.reportedBy;
            const reporterName = listing.moderation?.reporterName || reporter?.name || '';
            const reporterEmail = reporter?.email || '';
            const sellerName = listing.seller?.name || '';
            const sellerEmail = listing.seller?.email || 'unknown';
            const source = listing.moderation?.source || (listing.moderation?.reportedBy ? 'report' : 'system');
            const rawReason = listing.moderation?.reason || 'other';
            const formattedReason = rawReason.startsWith('keyword:')
              ? `${rawReason.replace('keyword:', '').trim()} (keyword)`
              : rawReason;
            const rawReportReason = listing.moderation?.reportReason || '';
            const rawReportDetails = listing.moderation?.reportMessage || '';
            const combinedMatch = rawReportDetails.match(/^User provided reason:\s*(.+?)\s*Details:\s*(.+)$/i);
            const reportReason = combinedMatch ? combinedMatch[1] : rawReportReason;
            const reportDetails = combinedMatch ? combinedMatch[2] : rawReportDetails;

            return (
              <div key={listing._id} className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-4">
                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setImagePreview({ url: imageUrl, title: listing.title })}
                        className="h-20 w-20 overflow-hidden rounded-xl"
                        title="Open image"
                      >
                        <img
                          src={imageUrl}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-500">
                        No image
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
                      {source !== 'report' && (
                        <p className="text-xs text-red-200/80">Reason: {formattedReason}</p>
                      )}
                      <p className="text-xs text-amber-200">Moderation: {scoreValue !== null ? `${scoreValue}%` : 'n/a'}</p>
                      {source === 'report' ? (
                        <div className="mt-1 text-xs text-slate-300">
                          <p>Reporter: {reporterName}{reporterEmail ? ` (${reporterEmail})` : ''}</p>
                          {listing.moderation?.reportedAt && (
                            <p>Reported at: {new Date(listing.moderation.reportedAt).toLocaleString()}</p>
                          )}
                          <p>Reason: {reportReason || 'n/a'}</p>
                          <p>Details: {reportDetails || 'n/a'}</p>
                          <p>Seller: {sellerName}{sellerName && sellerEmail ? ` (${sellerEmail})` : sellerEmail}</p>
                          {listing.mlPredictionLabel && (
                            <p>Label: {listing.mlPredictionLabel}</p>
                          )}
                          {Number.isFinite(listing.mlConfidence) && (
                            <p>ML confidence: {Math.round(listing.mlConfidence * 100)}%</p>
                          )}
                        </div>
                      ) : (
                        <>
                          {imageUrl && listing.mlPredictionLabel && (
                            <p className="text-xs text-slate-300">Label: {listing.mlPredictionLabel}</p>
                          )}
                          {imageUrl && Number.isFinite(listing.mlConfidence) && (
                            <p className="text-xs text-slate-300">ML confidence: {Math.round(listing.mlConfidence * 100)}%</p>
                          )}
                          {source === 'review_request' && (
                            <p className="text-xs text-slate-300">Review note: {listing.moderation?.reviewNotes || ''}</p>
                          )}
                          <p className="text-xs text-slate-400">Seller: {sellerName}{sellerName && sellerEmail ? ` (${sellerEmail})` : sellerEmail}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg" title="Source">
                      {source === 'report' ? '👤' : source === 'review_request' ? '📝' : '🖥️'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openReviewModal(listing, 'approve')}
                      className="rounded-full bg-emerald-500/80 px-3 py-1 text-xs text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => openReviewModal(listing, 'block')}
                      className="rounded-full bg-amber-500/80 px-3 py-1 text-xs text-white"
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      onClick={() => openReviewModal(listing, 'ban')}
                      className="rounded-full bg-red-600/80 px-3 py-1 text-xs text-white"
                    >
                      Ban
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-300">{listing.description}</p>
              </div>
            );
          })}
          {!listings.length && <p className="text-sm text-slate-400">No flagged listings.</p>}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Page {meta.page} of {meta.totalPages}</span>
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
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute right-0 top-0 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200"
            >
              Close
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.title}
              className="mt-8 max-h-[75vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {reviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Review listing</h3>
                <p className="text-xs text-slate-400">
                  {reviewModal.action === 'ban'
                    ? 'Ban this listing permanently. The seller cannot request review.'
                    : reviewModal.action === 'block'
                      ? 'Block this listing. The seller can request review.'
                      : 'Approve this listing and restore visibility.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase text-slate-500">Review notes (optional)</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                placeholder="Add context for the seller"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReview}
                className={`rounded-full px-4 py-2 text-xs text-white ${
                  reviewModal.action === 'ban'
                    ? 'bg-red-600/80'
                    : reviewModal.action === 'block'
                      ? 'bg-amber-500/80'
                      : 'bg-emerald-500/80'
                }`}
              >
                {reviewModal.action === 'ban'
                  ? 'Ban listing'
                  : reviewModal.action === 'block'
                    ? 'Block listing'
                    : 'Approve listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminListings;
