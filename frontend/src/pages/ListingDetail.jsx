import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import OfferModal from '../components/OfferModal';
import AuctionRoom from '../components/AuctionRoom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import useChatLauncher from '../hooks/useChatLauncher';
import { formatCurrency } from '../utils/currency';

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const startChat = useChatLauncher();
  const [listing, setListing] = useState(null);
  const [offers, setOffers] = useState([]);
  const [showOffer, setShowOffer] = useState(false);
  const [recommended, setRecommended] = useState([]);

  const loadListing = async () => {
    const { data } = await api.get(`/listings/${id}`);
    setListing(data);
    if (user && data.seller?._id === user.id) {
      const offerRes = await api.get(`/offers/listing/${id}`);
      setOffers(offerRes.data);
    }
  };

  const handleBuyNow = async () => {
    try {
      await api.post('/transactions', {
        listing: id,
        transactionType: 'buy_request',
      });
      alert('Buy request sent to seller! You will be notified when approved.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send buy request');
    }
  };

  const handleMarkAsSold = async () => {
    if (!confirm('Are you sure you want to mark this item as sold? This will remove it from the marketplace.')) return;
    try {
      await api.delete(`/listings/${id}`);
      navigate('/marketplace');
    } catch (err) {
      console.error(err);
      alert('Failed to mark as sold');
    }
  };

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data } = await api.post('/ml/recommendations', {
          userId: user?.id,
          recent_item_ids: [id],
          limit: 4,
        });
        setRecommended(data);
      } catch (err) {
        // silent fail when ML service offline
      }
    };
    fetchRecommendations();
  }, [id, user]);

  if (!listing) {
    return <p className="p-8 text-center text-slate-500">Loading listing…</p>;
  }

  const sellerId = listing.seller?._id || listing.seller?.id;
  const canChat = user && sellerId && sellerId !== user.id;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="grid gap-6 lg:grid-cols-2">
          <img
            src={listing.images?.[0]?.url || 'https://placehold.co/600x400'}
            alt={listing.title}
            className="w-full rounded-2xl border border-slate-800 object-cover"
          />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{listing.category}</p>
            <h1 className="mt-1 text-4xl font-semibold text-white">{listing.title}</h1>
            <p className="mt-3 text-lg text-slate-300">{listing.description}</p>
            <p className="mt-5 text-3xl font-bold text-white">{formatCurrency(listing.price)}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              {listing.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-800 px-3 py-0.5 text-slate-200">
                  {tag}
                </span>
              ))}
            </div>
            {listing.status === 'sold' && (
              <div className="mt-6">
                <span className="inline-block rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white">
                  Sold
                </span>
              </div>
            )}
            {canChat && listing.listingType === 'buy-now' && listing.status !== 'sold' && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
                >
                  Buy Now
                </button>
              </div>
            )}
            {canChat && listing.listingType === 'offer' && listing.status !== 'sold' && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startChat(sellerId)}
                  className="rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
                >
                  Chat with Seller
                </button>
                <button
                  type="button"
                  onClick={() => setShowOffer(true)}
                  className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                >
                  Make Offer
                </button>
              </div>
            )}
          </div>
        </div>

        {listing.listingType === 'auction' && listing.auction?.isAuction && (
          <AuctionRoom listing={listing} />
        )}

        {user && listing.seller?._id === user.id && (
          <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <h2 className="text-xl font-semibold text-white">Seller Controls</h2>
            
            <h3 className="mt-4 text-lg font-medium text-slate-200">Offers</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {offers.map((offer) => (
                <li key={offer._id} className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <p>
                    {formatCurrency(offer.amount)} — {offer.status} by {offer.buyer?.name}
                  </p>
                </li>
              ))}
              {!offers.length && <p>No offers yet.</p>}
            </ul>
          </section>
        )}
      </div>
      {recommended.length > 0 && (
        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Recommended IDs</h3>
          <p className="text-sm text-slate-400">Hook into actual listing fetch for production.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
            {recommended.map((rec) => (
              <span key={rec.id} className="rounded bg-slate-800 px-3 py-1">
                {rec.id} ({rec.score.toFixed(2)})
              </span>
            ))}
          </div>
        </section>
      )}
      {showOffer && (
        <OfferModal listingId={listing._id} onClose={() => setShowOffer(false)} onSubmitted={loadListing} />
      )}
    </main>
  );
};

export default ListingDetail;
