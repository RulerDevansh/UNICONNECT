import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

const SharePreview = ({ share }) => {
  const members = share.members || [];
  const visibleMembers = members.slice(0, 3);
  const remainingMembers = Math.max(members.length - visibleMembers.length, 0);
  const hostName = share.host?.name || 'Host';
  const totalAmount = formatCurrency(share.totalAmount);
  const status = share.status || 'open';
  const statusBadgeClasses = status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300';

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 shadow shadow-black/30">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>{share.splitType} split</span>
        <span className={`rounded-full px-3 py-0.5 text-[11px] font-semibold ${statusBadgeClasses}`}>{status}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-white">{share.name}</h3>
      {share.description && <p className="text-sm text-slate-400">{share.description}</p>}
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

const Home = () => {
  const [listings, setListings] = useState([]);
  const [listingError, setListingError] = useState('');
  const [listingsLoading, setListingsLoading] = useState(true);
  const [shares, setShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(true);
  const [shareError, setShareError] = useState('');
  const { socket } = useSocket();

  const loadListings = async () => {
    setListingsLoading(true);
    setListingError('');
    try {
      const { data } = await api.get('/listings');
      setListings(data.data);
    } catch (err) {
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
      
      // Filter out cab shares with expired deadline or full seats
      const filteredShares = data.filter(share => {
        if (share.shareType === 'cab') {
          // Check if booking deadline has passed
          const isDeadlinePassed = share.bookingDeadline 
            ? new Date() > new Date(share.bookingDeadline) 
            : false;
          
          // Check if all seats are booked
          const isFullyBooked = share.maxPassengers 
            ? share.members.length >= share.maxPassengers
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
    loadListings();
    loadShares();
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <div className="flex flex-col gap-8 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-brand-secondary">UniConnect</p>
          <h1 className="mt-1 text-4xl font-semibold text-white">Marketplace + Sharing hub</h1>
          <p className="mt-2 text-base text-slate-400">Everything classmates are selling and splitting, side by side.</p>
        </div>
      </div>
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900/80 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-brand-secondary">Marketplace</p>
              <h2 className="text-2xl font-semibold text-white">Live Listings</h2>
              <p className="text-sm text-slate-400">Scroll every item without leaving home.</p>
            </div>
            <Link
              to="/marketplace"
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:border-white/60"
            >
              Go to Marketplace
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {listingsLoading ? (
              <p className="text-center text-sm text-slate-400">Loading listings…</p>
            ) : listingError ? (
              <p className="text-center text-sm text-slate-500">{listingError}</p>
            ) : listings.length ? (
              listings.map((listing) => <ListingCard key={listing._id} listing={listing} />)
            ) : (
              <p className="text-center text-sm text-slate-500">No listings posted yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-400">Sharing</p>
              <h2 className="text-2xl font-semibold text-white">Active Splits</h2>
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
              shares.map((share) => <SharePreview key={share._id} share={share} />)
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
