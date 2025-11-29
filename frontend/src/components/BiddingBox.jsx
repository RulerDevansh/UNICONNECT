import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { formatCurrency } from '../utils/currency';

const BiddingBox = ({ listing, user }) => {
  const { socket } = useSocket();
  const [bid, setBid] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState({ startBid: listing.auction?.startBid || 0, currentBid: listing.auction?.currentBid || null, endTime: listing.auction?.endTime || null, yourHighestBid: 0 });
  const [ended, setEnded] = useState(false);
  const [wonMsg, setWonMsg] = useState(null);
  const endTime = useMemo(() => (status.endTime ? new Date(status.endTime) : null), [status.endTime]);

  const minBid = status.startBid || 0;
  const currentBidAmt = status.currentBid?.amount || minBid;
  const [secondsLeft, setSecondsLeft] = useState(() => (endTime ? Math.max(0, Math.floor((endTime - Date.now()) / 1000)) : null));

  const refreshStatus = async () => {
    try {
      const { data } = await api.get(`/bidding/${listing._id}`);
      setStatus(data);
      if (data.endTime && new Date(data.endTime) <= new Date()) setEnded(true);
      // Persist 'You won' message across reloads until seller completes
      if (data.status === 'ended' && data.isWinner && (data.winnerOpen ?? true)) {
        setWonMsg(`You won with ${formatCurrency(data.finalBid ?? data.currentBid?.amount ?? 0)}!`);
      }
    } catch (err) {
      // silently ignore if not available
    }
  };

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing._id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('auction:join', { listingId: listing._id });
    const onUpdate = (payload) => {
      if (payload.listingId !== listing._id) return;
      setStatus((prev) => ({
        ...prev,
        currentBid: payload.currentBid || prev.currentBid,
        yourHighestBid: payload.highestBidPerUser?.[user?.id] ?? prev.yourHighestBid,
      }));
    };
    const onEnd = (payload) => {
      if (payload.listingId !== listing._id) return;
      setEnded(true);
    };
    const onWon = (payload) => {
      if (payload.listingId !== listing._id) return;
      // This event is only emitted to the winner user channel
      setWonMsg(`You won with ${formatCurrency(payload.finalBid)}!`);
    };
    const onError = (err) => setError(err?.message || 'Bidding error');
    socket.on('auction:update', onUpdate);
    socket.on('auction:end', onEnd);
    socket.on('auction:won', onWon);
    socket.on('auction:error', onError);
    return () => {
      socket.off('auction:update', onUpdate);
      socket.off('auction:end', onEnd);
      socket.off('auction:won', onWon);
      socket.off('auction:error', onError);
    };
  }, [socket, listing._id, user?.id]);

  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0) setEnded(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  const handleBid = async (e) => {
    e.preventDefault();
    setError('');
    const bidValue = Number(bid);
    if (isNaN(bidValue) || bidValue < currentBidAmt + 1) {
      setError(`Bid must be at least ₹${currentBidAmt + 1}`);
      return;
    }
    try {
      socket.emit('auction:bid', { listingId: listing._id, amount: bidValue });
      // Optimistically update local state
      setStatus((prev) => ({
        ...prev,
        currentBid: { amount: bidValue, bidder: user?.id, timestamp: new Date() },
        yourHighestBid: bidValue,
      }));
      setBid('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to place bid';
      setError(msg);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/40 p-6">
      <h2 className="text-lg font-bold text-slate-200 mb-4">Live Bidding</h2>
      {wonMsg && (
        <div className="mb-4 rounded-lg border border-emerald-600/40 bg-emerald-700/20 px-4 py-2 text-emerald-200">
          {wonMsg}
        </div>
      )}
      {!wonMsg && ended && (
        <div className="mb-4 rounded-lg border border-slate-600/40 bg-slate-700/30 px-4 py-2 text-slate-200">
          Bidding has ended.
        </div>
      )}
      <div className="mb-2 flex justify-between text-slate-100">
        <span>Current Bid:</span>
        <span>{formatCurrency(currentBidAmt)}</span>
      </div>
      <div className="mb-2 flex justify-between text-slate-100">
        <span>Time remaining:</span>
        <span>{secondsLeft !== null ? `${Math.floor(secondsLeft/60)}m ${secondsLeft%60}s` : 'N/A'}</span>
      </div>
      <div className="mb-4">
        <span className="block text-sm text-slate-300 mb-1">Your Highest Bid:</span>
        <span className="block rounded bg-slate-800 px-4 py-2 text-slate-200">You bid ₹{status.yourHighestBid ?? 0}</span>
      </div>
      <form onSubmit={handleBid} className="flex gap-2">
        <input
          type="number"
          min={currentBidAmt + 1}
          value={bid}
          onChange={e => setBid(e.target.value)}
          placeholder={`Min: ₹${currentBidAmt + 1}`}
          className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          disabled={ended}
        />
        <button type="submit" className="rounded bg-brand-primary px-6 py-2 text-white font-semibold" disabled={ended}>
          {ended ? 'Bidding Ended' : 'Bid'}
        </button>
      </form>
      {error && <div className="mt-2 text-red-400 text-sm">{error}</div>}
    </div>
  );
};

export default BiddingBox;
