import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import LocationPicker from '../components/LocationPicker';
import NearestProducts from '../components/NearestProducts';
import NearestShares from '../components/NearestShares';
import SharePreviewCard from '../components/SharePreviewCard';
import api from '../services/api';
import logo from '../assets/logo.svg';

const Home = () => {
  const { isAuthenticated, user, refreshProfile } = useAuth();
  const [listings, setListings] = useState([]);
  const [listingError, setListingError] = useState('');
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingTypeFilter, setListingTypeFilter] = useState('');
  const [shares, setShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(true);
  const [shareError, setShareError] = useState('');
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locationDraft, setLocationDraft] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const loadListings = async (type = '') => {
    setListingsLoading(true);
    setListingError('');
    try {
      const params = {};
      if (type) params.listingType = type;
      const { data } = await api.get('/listings', { params });
      setListings(data.data);
    } catch {
      setListingError('Unable to load listings right now.');
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  };

  const loadShares = async () => {
    setSharesLoading(true);
    setShareError('');
    try {
      const { data } = await api.get('/shares');
      
      // Filter out cab shares with expired deadline or full seats, and food shares with expired deadline
      const filteredShares = data.filter(share => {
        if (share.shareType === 'cab') {
          // Check if booking deadline has passed
          const isDeadlinePassed = share.bookingDeadline 
            ? new Date() > new Date(share.bookingDeadline) 
            : false;
          
          // Check if all seats are booked
          const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
          const isFullyBooked = share.maxPassengers 
            ? joinedMembersCount >= share.maxPassengers
            : false;
          
          // Exclude if deadline passed or fully booked
          if (isDeadlinePassed || isFullyBooked) {
            return false;
          }
        }
        
        if (share.shareType === 'food') {
          // Check if order deadline has passed
          const isDeadlinePassed = share.deadlineTime 
            ? new Date() > new Date(share.deadlineTime) 
            : false;
          
          // Check if max persons reached
          const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
          const isFullyBooked = share.maxPersons 
            ? joinedMembersCount >= share.maxPersons
            : false;
          
          // Exclude if deadline passed or fully booked
          if (isDeadlinePassed || isFullyBooked) {
            return false;
          }
        }
        
        if (share.shareType === 'other') {
          // Check if deadline has passed
          const isDeadlinePassed = share.otherDeadline 
            ? new Date() > new Date(share.otherDeadline) 
            : false;
          
          // Check if max persons reached
          const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
          const isFullyBooked = share.otherMaxPersons 
            ? joinedMembersCount >= share.otherMaxPersons
            : false;
          
          // Exclude if deadline passed or fully booked
          if (isDeadlinePassed || isFullyBooked) {
            return false;
          }
        }
        
        return true;
      });
      
      setShares(filteredShares);
    } catch (err) {
      if (err.response?.status === 401) {
        setShareError('Login to view shares.');
      } else {
        setShareError('Unable to load shares right now.');
      }
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  };

  useEffect(() => {
    loadListings(listingTypeFilter);
    loadShares();
  }, [listingTypeFilter]);

  useEffect(() => {
    if (user?.location?.latitude && user?.location?.longitude) {
      setLocationDraft({
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        address: user.location.address || '',
        accuracy: user.location.accuracy,
        source: user.location.source || 'manual',
      });
    }
  }, [user]);

  const handleSaveLocation = async () => {
    if (!locationDraft) return;
    try {
      setSavingLocation(true);
      await api.post('/users/location', locationDraft);
      await refreshProfile();
      setShowLocationEditor(false);
    } catch (err) {
      console.error('Failed to update location:', err);
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 text-slate-100">
      <div className="flex flex-col gap-4 sm:gap-8 text-center">
        <div>
          <div className="flex items-center justify-center gap-3">
            <img 
              src={logo} 
              alt="UniConnect Logo" 
              className="h-5 w-5 sm:h-7 sm:w-7 rounded-full object-cover" 
            />
            <p className="text-sm uppercase tracking-[0.2em] text-brand-secondary">UniConnect</p>
            {!isAuthenticated && (
              <a
                href="https://drive.google.com/file/d/1nSFlQ0R0BM1mO4VrEwjyCo4G9d4Iddi_/view?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-brand-secondary/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-secondary transition hover:border-brand-secondary/70 hover:bg-brand-secondary/10 whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[30px] w-[30px] text-emerald-400">
                    <path d="M17.6 9.48l1.84-3.18c.08-.14.03-.32-.11-.4-.14-.08-.32-.03-.4.11l-1.85 3.2A8.94 8.94 0 0012 8c-1.88 0-3.62.58-5.08 1.57L5.07 6.01c-.08-.14-.26-.19-.4-.11-.14.08-.19.26-.11.4L6.4 9.48A8.92 8.92 0 003 16h18a8.92 8.92 0 00-3.4-6.52zM8.75 12.5a.75.75 0 110-1.5.75.75 0 010 1.5zm6.5 0a.75.75 0 110-1.5.75.75 0 010 1.5zM7 19.5h10a1 1 0 001-1v-.5H6v.5a1 1 0 001 1z" />
                  </svg>
                  <span>Get Mobile APP</span>
                </span>
              </a>
            )}
          </div>
          <h1 className="mt-1 text-2xl sm:text-4xl font-semibold text-white">Marketplace + Sharing hub</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-400">Everything classmates are selling and splitting, side by side.</p>
        </div>
      </div>
      {isAuthenticated && (
        <section className="mt-6 sm:mt-10">
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowLocationEditor((prev) => !prev)}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
            >
              {showLocationEditor ? 'Close' : 'Set Location'}
            </button>
          </div>
          {showLocationEditor && (
            <div className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 sm:p-6 shadow-2xl shadow-black/40">
              <LocationPicker value={locationDraft} onChange={setLocationDraft} />
              <button
                type="button"
                onClick={handleSaveLocation}
                className="mt-4 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow shadow-brand-primary/40 transition hover:bg-brand-secondary"
                disabled={savingLocation}
              >
                {savingLocation ? 'Saving…' : 'Save Location'}
              </button>
            </div>
          )}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900/80 p-4 sm:p-6 shadow-2xl shadow-black/40">
              <NearestProducts />
            </div>
            <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 sm:p-6 shadow-2xl shadow-black/40">
              <NearestShares />
            </div>
          </div>
        </section>
      )}
      <section className="mt-6 sm:mt-10 grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900/80 p-4 sm:p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-brand-secondary">Marketplace</p>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Live Listings</h2>
              <p className="text-sm text-slate-400">Scroll every item without leaving home.</p>
            </div>
            <Link
              to="/marketplace"
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:border-white/60"
            >
              Go to Marketplace
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setListingTypeFilter('')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                listingTypeFilter === ''
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              All Listings
            </button>
            <button
              type="button"
              onClick={() => setListingTypeFilter('rental')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                listingTypeFilter === 'rental'
                  ? 'border-orange-300/70 bg-orange-500/15 text-orange-200'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              Rental Only
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {listingsLoading ? (
              <p className="text-center text-sm text-slate-400">Loading listings…</p>
            ) : listingError ? (
              <p className="text-center text-sm text-slate-500">{listingError}</p>
            ) : listings.length ? (
              listings.map((listing) => <ListingCard key={listing._id} listing={listing} compactButtons />)
            ) : (
              <p className="text-center text-sm text-slate-500">
                {listingTypeFilter === 'rental' ? 'No rental listings posted yet.' : 'No listings posted yet.'}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 sm:p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-400">Sharing</p>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Active Splits</h2>
              <p className="text-sm text-slate-400">Every expense classmates are splitting right now.</p>
            </div>
            <Link to="/shares" className="text-sm font-semibold text-brand-primary hover:text-brand-secondary">
              Manage
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {sharesLoading ? (
              <p className="text-center text-sm text-slate-400">Loading shares…</p>
            ) : shareError ? (
              <p className="text-center text-sm text-slate-500">{shareError}</p>
            ) : shares.length ? (
              shares.map((share) => <SharePreviewCard key={share._id} share={share} />)
            ) : (
              <p className="text-center text-sm text-slate-500">No shares created yet.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
