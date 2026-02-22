import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import OfferModal from '../components/OfferModal';
import BiddingBox from '../components/BiddingBox';
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
  const [headerPrice, setHeaderPrice] = useState(null);
  const [offers, setOffers] = useState([]);
  const [showOffer, setShowOffer] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [biddingEndInfo, setBiddingEndInfo] = useState(null);

  // Compute sellerId/isSeller early so hooks below can safely depend on them
  const sellerId = listing?.seller?._id || listing?.seller?.id;
  const isSeller = !!(user && sellerId && (sellerId === user.id || sellerId === user._id));

  const loadListing = async () => {
    const { data } = await api.get(`/listings/${id}`);
    setListing(data);
    // Initialize header price: for auction, prefer currentBid if > 0, else startBid, else listing price
    if (data.listingType === 'auction' && data.auction) {
      const currentBid = data.auction.currentBid?.amount;
      const startBid = data.auction.startBid;
      
      // Check if there's an actual bid (currentBid > 0)
      if (typeof currentBid === 'number' && currentBid > 0) {
        setHeaderPrice(currentBid);
      } else if (typeof startBid === 'number') {
        setHeaderPrice(startBid);
      } else {
        setHeaderPrice(data.price || 0);
      }
    } else {
      setHeaderPrice(data.price);
    }
    if (user && data.seller?._id === user.id) {
      const offerRes = await api.get(`/offers/listing/${id}`);
      setOffers(offerRes.data);
    }
    // Check if user already has a pending buy request for this listing
    if (user && data.seller?._id !== user.id) {
      try {
        const { data: transactions } = await api.get('/transactions');
        const pendingForThisListing = transactions.some(
          (t) => 
            t.listing._id === id && 
            ['pending', 'approved', 'payment_sent'].includes(t.status)
        );
        setHasPendingRequest(pendingForThisListing);
      } catch (_err) {
        // silent
      }
    }
  };

  const handleBuyNow = async () => {
    try {
      await api.post('/transactions', {
        listing: id,
        transactionType: 'buy_request',
      });
      alert('Buy request sent to seller! You will be notified when approved.');
      setHasPendingRequest(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send buy request');
    }
  };

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Join listing room and listen for refresh events
  useEffect(() => {
    if (!socket || !listing) return;
    const listingId = listing._id;
    socket.emit('joinListing', { listingId });
    const onRefresh = (payload) => {
      if (payload.listingId !== listingId) return;
      loadListing(); // Reload the listing data
    };
    socket.on('listing:refresh', onRefresh);
    return () => {
      socket.off('listing:refresh', onRefresh);
    };
  }, [socket, listing]);

  // Live update header price for auction via socket
  useEffect(() => {
    if (!socket || !listing || listing.listingType !== 'auction') return;
    const listingId = listing._id;
    try {
      socket.emit('auction:join', { listingId });
    } catch {}
    const onUpdate = (payload) => {
      if (payload.listingId !== listingId) return;
      // Update header price: show currentBid if > 0, else show startBid
      if (payload.currentBid?.amount != null && payload.currentBid.amount > 0) {
        setHeaderPrice(payload.currentBid.amount);
      } else if (listing.auction?.startBid != null) {
        setHeaderPrice(listing.auction.startBid);
      }
      // Update listing state to ensure BiddingBox sees fresh data
      setListing(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          auction: {
            ...prev.auction,
            currentBid: payload.currentBid || prev.auction?.currentBid,
            highestBidPerUser: payload.highestBidPerUser || prev.auction?.highestBidPerUser,
            isAuction: prev.auction?.isAuction !== undefined ? prev.auction.isAuction : true,
          }
        };
      });
    };
    const onSellerWinner = (payload) => {
      if (!isSeller) return;
      if (payload.listingId !== listingId) return;
      setBiddingEndInfo({ finalBid: payload.finalBid, winner: payload.winner });
    };
    socket.on('auction:update', onUpdate);
    socket.on('auction:winner', onSellerWinner);
    return () => {
      socket.off('auction:update', onUpdate);
      socket.off('auction:winner', onSellerWinner);
    };
  }, [socket, listing, isSeller]);


  if (!listing) {
    return <p className="p-8 text-center text-slate-500">Loading listing…</p>;
  }

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
            <p className="mt-5 text-3xl font-bold text-white">{formatCurrency(headerPrice ?? listing.price)}</p>
            <div className="mt-4">
              <span className="inline-block rounded-full bg-slate-800 px-4 py-1.5 text-sm font-medium capitalize text-slate-200">
                Condition: {listing.condition}
              </span>
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
                {hasPendingRequest ? (
                  <div className="rounded-full bg-yellow-500/20 border border-yellow-500/50 px-6 py-2 text-sm font-semibold text-yellow-300">
                    Request Pending
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
                  >
                    Buy Now
                  </button>
                )}
              </div>
            )}
            {canChat && listing.listingType === 'offer' && listing.status !== 'sold' && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startChat(sellerId, { listingId: listing._id })}
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

        {listing.listingType === 'auction' && listing.auction?.isAuction && user &&
          sellerId && user && sellerId !== user.id && sellerId !== user._id && (
          <BiddingBox listing={listing} user={user} />
        )}
        {listing.listingType === 'auction' && isSeller && listing.auction?.status === 'ended' && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Auction Result</h3>
            {listing.auction?.winner ? (
              <div className="text-slate-200">
                <p>Winner: <span className="font-medium">{listing.auction.winner?.name || listing.auction.winner?.email || 'User'}</span></p>
                <p className="mt-1">Final Bid: <span className="font-medium">{formatCurrency(listing.auction?.currentBid?.amount || 0)}</span></p>
                {biddingEndInfo && (
                  <p className="mt-2 text-sm text-slate-400">Updated just now.</p>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const buyerId = listing.auction?.winner?._id || listing.auction?.winner;
                      if (buyerId) startChat(buyerId, { listingId: listing._id });
                    }}
                    className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400"
                  >
                    Chat with Buyer
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300">No bids were placed.</p>
            )}
          </div>
        )}
      </div>
      {showOffer && (
        <OfferModal listingId={listing._id} onClose={() => setShowOffer(false)} onSubmitted={loadListing} />
      )}
    </main>
  );
};

export default ListingDetail;
