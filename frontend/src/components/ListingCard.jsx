import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

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

const ListingCard = ({ listing, wideImage = false, hideBuyNowBadge = false, compactButtons = false }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
    const sellerId = listing.seller?._id || listing.seller?.id || listing.seller;
    const currentUserId = user?.id || user?._id;
  const status = listing.status || 'active';
    const isOwnListing = sellerId && currentUserId && String(sellerId) === String(currentUserId);
  const showBuyCta = listing.listingType === 'buy-now' && !isOwnListing && sellerId && status === 'active';
  const [timeRemaining, setTimeRemaining] = useState('');
  const isAuction = listing.listingType === 'auction';
  const isBidding = listing.listingType === 'bidding';
  const [biddingTimeRemaining, setBiddingTimeRemaining] = useState('');
  const [displayPrice, setDisplayPrice] = useState(() => {
    if (isBidding) {
      return (
        listing?.auction?.currentBid?.amount ??
        listing?.auction?.startBid ??
        listing.price
      );
    }
    return listing.price;
  });

  useEffect(() => {
    if (isAuction && listing.auction?.endTime) {
      const timer = setInterval(() => {
        setTimeRemaining(formatTimeRemaining(listing.auction.endTime));
      }, 60000); // Update every minute

      setTimeRemaining(formatTimeRemaining(listing.auction.endTime));

      return () => clearInterval(timer);
    }
  }, [isAuction, listing.auction?.endTime]);

  useEffect(() => {
    if (isBidding && listing.auction?.endTime) {
      const timer = setInterval(() => {
        setBiddingTimeRemaining(formatTimeRemaining(listing.auction.endTime));
      }, 60000);
      setBiddingTimeRemaining(formatTimeRemaining(listing.auction.endTime));
      return () => clearInterval(timer);
    }
  }, [isBidding, listing.auction?.endTime]);

  // Live price updates for bidding via socket
  useEffect(() => {
    if (!socket || !isBidding) return;
    const listingId = listing._id;
    try { socket.emit('bidding:join', { listingId }); } catch {}
    const onUpdate = (payload) => {
      if (payload.listingId !== listingId) return;
      if (payload.currentBid?.amount != null) {
        setDisplayPrice(payload.currentBid.amount);
      }
    };
    socket.on('bidding:update', onUpdate);
    return () => { socket.off('bidding:update', onUpdate); };
  }, [socket, isBidding, listing._id]);

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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 backdrop-blur overflow-hidden">
      <div className="flex gap-4">
        {/* Left: Image box */}
        <div className={(wideImage ? 'basis-1/2' : 'basis-1/4') + ' flex-shrink-0'}>
          {listing.images?.[0] ? (
            <div className="relative w-full aspect-square">
              <img
                src={listing.images[0].url}
                alt={listing.title}
                className="h-full w-full rounded-xl object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-800 text-slate-300 aspect-square">
              <span>No Image</span>
            </div>
          )}
        </div>

        {/* Right: Text details */}
        <div className={(wideImage ? 'basis-1/2' : 'basis-3/4') + ' min-w-0 relative pb-4'}>
          <div className="flex items-start justify-between pr-2 md:pr-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">{listing.title}</h3>
              <p className="text-sm text-slate-400">{listing.category}</p>
            </div>
            <p className="text-xl font-semibold text-white whitespace-nowrap">{formatCurrency(displayPrice)}</p>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-300">{listing.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 pr-2 md:pr-3">
            {!(hideBuyNowBadge && listing.listingType === 'buy-now') && (
              <span
                className={classNames('rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide', {
                  'bg-emerald-500/20 text-emerald-300': listing.listingType === 'buy-now',
                  'bg-amber-500/20 text-amber-200': listing.listingType === 'offer',
                  'bg-purple-500/20 text-purple-200': listing.listingType === 'auction',
                  'bg-cyan-500/20 text-cyan-200': listing.listingType === 'bidding',
                })}
              >
                {listing.listingType}
              </span>
            )}
            {isAuction && listing.auction?.endTime && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-2 py-1">
                <span className="text-xs text-purple-300">⏱</span>
                <span className="text-xs font-semibold text-purple-200">{timeRemaining}</span>
              </div>
            )}
            {isBidding && listing.auction?.endTime && listing.auction?.status !== 'ended' && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-700/60 px-2 py-1">
                <span className="text-xs text-slate-300">⏱</span>
                <span className="text-xs font-semibold text-slate-200">{biddingTimeRemaining}</span>
              </div>
            )}
            {isBidding && listing.auction?.status === 'ended' && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-700/60 px-2 py-1">
                <span className="text-xs font-semibold text-slate-200">Ended</span>
              </div>
            )}
            {status !== 'active' && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                {statusLabelMap[status] || status}
              </span>
            )}
          </div>

          {/* Fixed bottom-right action buttons */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {showBuyCta && (
              <button
                type="button"
                onClick={handleBuyNow}
                className={`rounded-full bg-brand-primary font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary ${
                  compactButtons ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
                }`}
              >
                Buy Now
              </button>
            )}
            <Link
              to={`/listings/${listing._id}`}
              className={`rounded-full border border-slate-600 font-semibold text-slate-200 transition hover:border-slate-400 ${
                compactButtons ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
              }`}
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
