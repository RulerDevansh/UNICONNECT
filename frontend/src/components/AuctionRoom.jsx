import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { formatCurrency } from '../utils/currency';

const AuctionRoom = ({ listing }) => {
  const { socket } = useSocket();
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!socket || !listing) return;
    socket.emit('auction:join', listing._id);
    const onBid = (bid) => setBids((prev) => [bid, ...prev.slice(0, 49)]);
    socket.on('auction:bid', onBid);
    socket.on('auction:rejected', (payload) => setStatus(payload.reason));
    return () => {
      socket.off('auction:bid', onBid);
    };
  }, [socket, listing]);

  const placeBid = () => {
    if (!socket || !amount) return;
    socket.emit('auction:bid', { listingId: listing._id, amount: Number(amount) });
    setAmount('');
  };

  return (
    <div className="rounded border border-purple-200 bg-purple-50 p-4">
      <h4 className="font-semibold text-purple-900">Live Auction</h4>
      <p className="text-sm text-purple-800">
        Current bid: {formatCurrency(listing.auction?.currentBid?.amount ?? listing.auction?.startBid)}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded border border-purple-200 px-3 py-2"
        />
        <button type="button" onClick={placeBid} className="rounded bg-purple-600 px-4 py-2 text-white">
          Bid
        </button>
      </div>
      {status !== 'idle' && <p className="mt-2 text-xs text-purple-700">{status}</p>}
      <ul className="mt-4 space-y-1 text-sm text-purple-900">
        {bids.map((bid) => (
          <li key={`${bid.bidder}-${bid.createdAt}`}>
            {formatCurrency(bid.amount)} at {new Date(bid.createdAt).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AuctionRoom;
