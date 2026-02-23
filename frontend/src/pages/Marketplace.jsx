import { useEffect, useState } from 'react';
import ListingCard from '../components/ListingCard';
import CategorySelect from '../components/CategorySelect';
import api from '../services/api';

const Marketplace = () => {
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadListings = async (q = '', cat = '') => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (q) params.q = q;
      if (cat) params.category = cat;
      
      const { data } = await api.get('/listings', { params });
      setListings(data.data);
    } catch (_err) {
      setError('Unable to load listings right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadListings(searchQuery, category);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 text-slate-100">
      <section className="rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-brand-secondary/30 to-brand-primary/40 p-4 sm:p-8 shadow-2xl shadow-black/40">
        <h1 className="text-2xl sm:text-4xl font-semibold text-white">Marketplace</h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-lg text-slate-200">Search every listing in one focused view.</p>
        <form onSubmit={handleSearch} className="mt-4 sm:mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1">
            <input
              placeholder="Search listings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 pr-10 text-white placeholder:text-white/70"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white text-xl"
                onClick={() => {
                  setSearchQuery('');
                  loadListings('', category);
                }}
              >
                &#10005;
              </button>
            )}
          </div>
          <CategorySelect
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              loadListings(searchQuery, e.target.value);
            }}
          />
          <button type="submit" className="w-full sm:w-auto rounded-full bg-white px-6 py-3 font-semibold text-slate-900 shadow-lg shadow-white/40">
            Search
          </button>
        </form>
      </section>
      <section className="mt-10">
        {error && <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2">
          {loading ? (
            <p className="col-span-full text-center text-slate-400">Loading listings…</p>
          ) : listings.length ? (
            listings.map((listing) => <ListingCard key={listing._id} listing={listing} wideImage hideBuyNowBadge />)
          ) : (
            <p className="col-span-full text-center text-slate-500">No listings match those filters.</p>
          )}
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
