import { Link } from 'react-router-dom';
import classNames from 'classnames';
import { useAuth } from '../context/AuthContext';
import useChatLauncher from '../hooks/useChatLauncher';
import { formatCurrency } from '../utils/currency';

const ListingCard = ({ listing }) => {
  const { user } = useAuth();
  const startChat = useChatLauncher();
  const sellerId = listing.seller?._id || listing.seller?.id || listing.seller;
  const status = listing.status || 'active';
  const isOwnListing = sellerId && sellerId === user?.id;
  const showBuyCta = listing.listingType === 'buy-now' && !isOwnListing && sellerId && status === 'active';
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
        {listing.tags?.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {tag}
          </span>
        ))}
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
        <div className="flex items-center gap-2">
          {status !== 'active' && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {statusLabelMap[status] || status}
            </span>
          )}
          {showBuyCta && (
            <button
              type="button"
              onClick={() => startChat(sellerId)}
              className="rounded-full bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
            >
              Buy Now
            </button>
          )}
          <Link
            to={`/listings/${listing._id}`}
            className="text-sm font-semibold text-brand-primary transition hover:text-brand-secondary"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
