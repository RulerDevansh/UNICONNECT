import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const formatTimeRemaining = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;

  if (diff <= 0) return 'Auction Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const AuctionRoom = ({ listing }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [currentBid, setCurrentBid] = useState(listing.auction?.currentBid?.amount || 0);
  const [currentBidder, setCurrentBidder] = useState(listing.auction?.currentBid?.bidder);
  const [allBids, setAllBids] = useState(listing.auction?.bidders || []);
  const [myHighestBid, setMyHighestBid] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [auctionStatus, setAuctionStatus] = useState(listing.auction?.status || 'active');
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');

  const isSeller = user?.id === listing.seller._id || user?.id === listing.seller;
  const isWinner = winner?._id === user?.id || winner === user?.id;
  const hasEnded = auctionStatus === 'ended' || new Date(listing.auction.endTime) <= new Date();

  useEffect(() => {
    if (!socket || !listing._id) return;

    socket.emit('auction:join', { listingId: listing._id });

    // Calculate my highest bid
    const myBids = allBids.filter(
      (bid) => bid.user?._id === user?.id || bid.user === user?.id
    );
    if (myBids.length > 0) {
      const highest = Math.max(...myBids.map((bid) => bid.amount));
      setMyHighestBid(highest);
    }

    const handleBidUpdate = (data) => {
      setCurrentBid(data.currentBid);
      setCurrentBidder(data.bidder);
      setAllBids(data.allBids || []);
      
      // Update my highest bid
      const myBids = (data.allBids || []).filter(
        (bid) => bid.user?._id === user?.id || bid.user === user?.id
      );
      if (myBids.length > 0) {
        const highest = Math.max(...myBids.map((bid) => bid.amount));
        setMyHighestBid(highest);
      }
      setError('');
    };

    const handleAuctionEnd = (data) => {
      setAuctionStatus('ended');
      setWinner(data.winner);
      setCurrentBid(data.finalBid);
    };

    const handleBidError = (data) => {
      setError(data.message);
    };

    socket.on('auction:update', handleBidUpdate);
    socket.on('auction:end', handleAuctionEnd);
    socket.on('auction:error', handleBidError);

    return () => {
      socket.off('auction:update', handleBidUpdate);
      socket.off('auction:end', handleAuctionEnd);
      socket.off('auction:error', handleBidError);
    };
  }, [socket, listing._id, user?.id, allBids]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(listing.auction.endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [listing.auction.endTime]);

  const handlePlaceBid = () => {
    if (!socket || !bidAmount) return;

    const amount = Number(bidAmount);
    const minBid = currentBid > 0 ? currentBid + 1 : listing.auction.startBid;

    if (amount < minBid) {
      setError(`Bid must be at least ₹${minBid}`);
      return;
    }

    socket.emit('auction:bid', {
      listingId: listing._id,
      amount,
    });

    setBidAmount('');
  };

  // Seller cannot bid
  if (isSeller) {
    return (
      <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-6">
        <h3 className="text-xl font-bold text-purple-200">Live Auction</h3>
        
        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-purple-300">Current Highest Bid:</span>
            <span className="text-xl font-bold text-purple-100">₹{currentBid || listing.auction.startBid}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-purple-300">Time Remaining:</span>
            <span className="font-semibold text-purple-200">{timeRemaining}</span>
          </div>
        </div>

        {hasEnded ? (
          winner ? (
            <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <h4 className="font-bold text-green-200">🎉 Auction Ended - Winner Found!</h4>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-green-300">Winner:</span>
                  <span className="font-semibold text-green-100">{winner.name || winner.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-300">Final Bid:</span>
                  <span className="font-semibold text-green-100">₹{currentBid}</span>
                </div>
              </div>
              <button
                onClick={() => (window.location.href = `/chat?userId=${winner._id || winner}`)}
                className="mt-4 w-full rounded-full bg-green-600 py-2 font-semibold text-white hover:bg-green-700"
              >
                💬 Contact Buyer
              </button>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <h4 className="font-bold text-red-200">Auction Ended - No Bids</h4>
              <p className="mt-2 text-red-300">Your auction ended with no bids.</p>
            </div>
          )
        ) : (
          <div className="mt-6">
            <h4 className="font-semibold text-purple-200">All Bids (Seller View):</h4>
            {allBids.length > 0 ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {allBids
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 5)
                  .map((bid, idx) => (
                    <div
                      key={idx}
                      className={`flex justify-between rounded p-2 ${
                        idx === 0 ? 'bg-purple-500/20' : 'bg-purple-500/5'
                      }`}
                    >
                      <span className="text-sm text-purple-300">
                        {bid.user?.name || bid.user?.email || 'Anonymous'}
                      </span>
                      <span className="text-sm font-semibold text-purple-100">₹{bid.amount}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-purple-400">No bids yet</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Bidder view
  return (
    <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-6">
      <h3 className="text-xl font-bold text-purple-200">Live Auction</h3>

      <div className="mt-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-purple-300">Current Bid:</span>
          <span className="text-xl font-bold text-purple-100">
            ₹{currentBid || listing.auction.startBid}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-purple-300">Condition:</span>
          <span className="capitalize text-purple-200">{listing.condition}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-purple-300">Time remaining:</span>
          <span className="font-semibold text-purple-200">{timeRemaining}</span>
        </div>
      </div>

      {hasEnded ? (
        isWinner ? (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <h4 className="font-bold text-green-200">🎉 Congratulations! You Won!</h4>
            <p className="mt-2 text-green-300">Final Bid: ₹{currentBid}</p>
            <button
              onClick={() => (window.location.href = `/chat?userId=${listing.seller._id || listing.seller}`)}
              className="mt-4 w-full rounded-full bg-green-600 py-2 text-white hover:bg-green-700"
            >
              Contact Seller
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-gray-500/30 bg-gray-500/10 p-4">
            <h4 className="font-bold text-gray-200">Auction Ended</h4>
            <p className="mt-2 text-gray-300">
              {currentBid > 0
                ? 'This auction has ended. Another bidder won.'
                : 'This auction ended with no bids.'}
            </p>
          </div>
        )
      ) : (
        <>
          {error && (
            <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-purple-200">Latest Highest Bid:</h4>
            <div className="mt-2 rounded bg-purple-500/20 p-3">
              <p className="text-lg font-bold text-purple-100">
                {currentBidder?._id === user?.id || currentBidder === user?.id
                  ? `You bid ₹${currentBid}`
                  : currentBid > 0
                  ? `Someone bid ₹${currentBid}`
                  : 'No bids yet'}
              </p>
            </div>
          </div>

          {myHighestBid > 0 && (
            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <h4 className="text-sm font-semibold text-blue-200">Your Highest Bid</h4>
              <p className="text-lg font-bold text-blue-100">₹{myHighestBid}</p>
            </div>
          )}

          <div className="mt-6">
            <label className="text-sm font-medium text-purple-300">Place Your Bid (₹)</label>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={currentBid > 0 ? currentBid + 1 : listing.auction.startBid}
                placeholder={`Min: ₹${currentBid > 0 ? currentBid + 1 : listing.auction.startBid}`}
                className="flex-1 rounded border border-purple-700 bg-purple-950/60 px-3 py-2 text-slate-100"
              />
              <button
                onClick={handlePlaceBid}
                className="rounded-full bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700"
              >
                Bid
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuctionRoom;
