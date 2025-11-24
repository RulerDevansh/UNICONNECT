import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

const SharePreview = ({ share }) => {
  // Filter out cancelled members
  const members = share.members?.filter(m => m.status !== 'cancelled') || [];
  const visibleMembers = members.slice(0, 3);
  const remainingMembers = Math.max(members.length - visibleMembers.length, 0);
  const hostName = share.host?.name || 'Host';
  const totalAmount = formatCurrency(share.totalAmount);
  const status = share.status || 'open';
  const statusBadgeClasses = status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300';
  
  // Calculate occupancy for cab sharing
  const joinedMembersCount = share.members?.filter(m => m.status === 'joined').length || 0;
  const remainingSeats = share.maxPassengers ? share.maxPassengers - joinedMembersCount : null;

  // Get sharing type details
  const getShareTypeInfo = () => {
    switch(share.shareType) {
      case 'cab':
        return { label: '🚗 Cab', color: 'bg-blue-500/20 text-blue-300' };
      case 'food':
        return { label: '🍔 Food', color: 'bg-orange-500/20 text-orange-300' };
      case 'other':
        return { label: '📋 Other', color: 'bg-purple-500/20 text-purple-300' };
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
      
      {/* Cab Sharing Details */}
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
      
      {/* Food Sharing Details */}
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
      
      {/* Other Sharing Details */}
      {share.shareType === 'other' && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs">
          {share.category && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="font-medium text-white">📋</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">{share.category}</span>
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
    loadListings();
    loadShares();
  }, []);

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
