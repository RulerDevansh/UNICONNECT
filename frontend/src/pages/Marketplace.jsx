import { useEffect, useState } from 'react';
import ListingCard from '../components/ListingCard';
import CategorySelect from '../components/CategorySelect';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

const Marketplace = () => {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ q: '', category: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket } = useSocket();

  const loadListings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/listings', { params: filters });
      setListings(data.data);
    } catch (err) {
      setError('Unable to load listings right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAuctionCancelled = (payload) => {
      const listingId = payload.listingId;
      setListings((prev) => prev.filter((listing) => listing._id !== listingId));
    };

    socket.on('auction:cancelled', handleAuctionCancelled);

    return () => {
      socket.off('auction:cancelled', handleAuctionCancelled);
    };
  }, [socket]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadListings();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-brand-secondary/30 to-brand-primary/40 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-4xl font-semibold text-white">Marketplace</h1>
        <p className="mt-3 text-lg text-slate-200">Search every listing in one focused view.</p>
        <form onSubmit={handleSearch} className="mt-6 flex flex-wrap gap-3">
          <input
            placeholder="Search listings"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white placeholder:text-white/70"
          />
          <CategorySelect
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          />
          <button type="submit" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 shadow-lg shadow-white/40">
            Search
          </button>
        </form>
      </section>
      <section className="mt-10">
        {error && <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="col-span-full text-center text-slate-400">Loading listings…</p>
          ) : listings.length ? (
            listings.map((listing) => <ListingCard key={listing._id} listing={listing} />)
          ) : (
            <p className="col-span-full text-center text-slate-500">No listings match those filters.</p>
          )}
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
