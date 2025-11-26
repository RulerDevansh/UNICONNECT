import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import api from '../services/api';

const formatTimeRemaining = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const ListingCard = ({ listing }) => {
  const { user } = useAuth();
    const sellerId = listing.seller?._id || listing.seller?.id || listing.seller;
    const currentUserId = user?.id || user?._id;
  const status = listing.status || 'active';
    const isOwnListing = sellerId && currentUserId && String(sellerId) === String(currentUserId);
  const showBuyCta = listing.listingType === 'buy-now' && !isOwnListing && sellerId && status === 'active';
  const [timeRemaining, setTimeRemaining] = useState('');
  const isAuction = listing.listingType === 'auction';

  useEffect(() => {
    if (isAuction && listing.auction?.endTime) {
      const timer = setInterval(() => {
        setTimeRemaining(formatTimeRemaining(listing.auction.endTime));
      }, 60000); // Update every minute

      setTimeRemaining(formatTimeRemaining(listing.auction.endTime));

      return () => clearInterval(timer);
    }
  }, [isAuction, listing.auction?.endTime]);

  const handleBuyNow = async () => {
    try {
      await api.post('/transactions', {
        listing: listing._id,
        transactionType: 'buy_request',
      });
      alert('Buy request sent to seller! You will be notified when approved.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send buy request');
    }
  };
  const statusLabelMap = {
    sold: 'Sold',
    flagged: 'Flagged',
    archived: 'Archived',
    draft: 'Draft',
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 backdrop-blur">
      {listing.images?.[0] && (
        <img
          src={listing.images[0].url}
          alt={listing.title}
          className="h-48 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{listing.title}</h3>
          <p className="text-sm text-slate-400">{listing.category}</p>
        </div>
        <p className="text-xl font-semibold text-white">{formatCurrency(listing.price)}</p>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-300">{listing.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
      </div>
      
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span
          className={classNames('rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide', {
            'bg-emerald-500/20 text-emerald-300': listing.listingType === 'buy-now',
            'bg-amber-500/20 text-amber-200': listing.listingType === 'offer',
            'bg-purple-500/20 text-purple-200': listing.listingType === 'auction',
          })}
        >
          {listing.listingType}
        </span>
        {isAuction && listing.auction?.endTime && (
          <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-2 py-1">
            <span className="text-xs text-purple-300">⏱</span>
            <span className="text-xs font-semibold text-purple-200">{timeRemaining}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {status !== 'active' && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {statusLabelMap[status] || status}
            </span>
          )}
          {showBuyCta && (
            <button
              type="button"
              onClick={handleBuyNow}
              className="rounded-full bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
            >
              Buy Now
            </button>
          )}
          <Link
            to={`/listings/${listing._id}`}
            className="rounded-full border border-slate-600 px-4 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
