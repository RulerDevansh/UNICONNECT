import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { formatCurrency } from '../utils/currency';

const AuctionRoom = ({ listing }) => {
  const { socket } = useSocket();
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [winner, setWinner] = useState(null);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    if (!socket || !listing) return;
    socket.emit('auction:join', listing._id);
    
    const onBid = (bid) => setBids((prev) => [bid, ...prev.slice(0, 49)]);
    const onEnded = (payload) => {
      setIsEnded(true);
      setWinner(payload?.winnerName || 'Unknown');
      setStatus('Auction ended');
    };
    const onCancelled = (payload) => {
      setIsEnded(true);
      setStatus(`Auction cancelled: ${payload.reason}`);
    };

    socket.on('auction:bid', onBid);
    socket.on('auction:rejected', (payload) => setStatus(payload.reason));
    socket.on('auction:ended', onEnded);
    socket.on('auction:cancelled', onCancelled);

    return () => {
      socket.off('auction:bid', onBid);
      socket.off('auction:ended', onEnded);
      socket.off('auction:cancelled', onCancelled);
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
      
      {isEnded ? (
        <div className="mt-3 rounded bg-purple-200 p-3 text-center text-purple-900">
          <p className="font-bold">
            {winner ? 'Auction Ended' : 'Auction Cancelled'}
          </p>
          {winner && (
            <>
              <p>Winner: {winner}</p>
              <p className="text-xs mt-1">Please collect your product.</p>
            </>
          )}
          {status && status.includes('cancelled') && (
            <p className="text-xs mt-1">{status}</p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded border border-purple-200 bg-white px-3 py-2 text-purple-900"
          />
          <button type="button" onClick={placeBid} className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
            Bid
          </button>
        </div>
      )}
      
      {status !== 'idle' && !isEnded && <p className="mt-2 text-xs text-purple-700">{status}</p>}
      
      <ul className="mt-4 space-y-1 text-sm text-purple-900 max-h-40 overflow-y-auto">
        {bids.map((bid) => (
          <li key={`${bid.bidder}-${bid.createdAt}`}>
            {formatCurrency(bid.amount)} {bid.bidderName ? `by ${bid.bidderName}` : ''} at {new Date(bid.createdAt).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AuctionRoom;
