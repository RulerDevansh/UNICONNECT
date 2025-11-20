import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import api from '../services/api';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = async () => {
    const { data } = await api.get('/listings/me');
    setListings(data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (location.state?.toast) {
      setToast(location.state.toast);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);
  const deleteListing = async () => {
    if (!pendingDelete) return;
    setUpdatingId(pendingDelete._id);
    setError('');
    try {
      await api.delete(`/listings/${pendingDelete._id}`);
      await load();
      setToast('Listing and related chats deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete listing');
    } finally {
      setUpdatingId('');
      setPendingDelete(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <h1 className="text-4xl font-semibold text-white">My Listings</h1>
      {error && <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {toast && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <p>{toast}</p>
          <button type="button" onClick={() => setToast('')} className="text-xs uppercase tracking-wide text-emerald-200/80">
            Dismiss
          </button>
        </div>
      )}
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {listings.map((listing) => (
          <div key={listing._id} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow shadow-black/40">
            <ListingCard listing={listing} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/listings/${listing._id}/edit`)}
                className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(listing)}
                disabled={updatingId === listing._id}
                className="flex-1 rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Delete / Sold
              </button>
            </div>
          </div>
        ))}
        {!listings.length && <p className="text-slate-400">No listings yet.</p>}
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60">
            <p className="text-xs uppercase tracking-[0.3em] text-red-300">Confirm delete</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Remove “{pendingDelete.title}”?</h2>
            <p className="mt-3 text-sm text-slate-400">
              This permanently deletes the listing and any chats started from it. Buyers will lose access to the conversation history.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/60"
              >
                Keep Listing
              </button>
              <button
                type="button"
                onClick={deleteListing}
                disabled={updatingId === pendingDelete._id}
                className="flex-1 rounded-full border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MyListings;
