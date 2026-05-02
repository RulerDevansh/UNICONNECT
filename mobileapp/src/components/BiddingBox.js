import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { colors, commonStyles, radius, spacing } from '../theme';
import { formatCurrency } from '../utils/format';
import { useSocket } from '../context/SocketContext';
import { AppButton, Field, Message } from './ui';

const BiddingBox = ({ listing, user }) => {
  const { socket } = useSocket();
  const [bid, setBid] = useState('');
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);
  const [wonMsg, setWonMsg] = useState('');
  const [status, setStatus] = useState({
    startBid: listing.auction?.startBid || 0,
    currentBid: listing.auction?.currentBid || null,
    endTime: listing.auction?.endTime || null,
    yourHighestBid: 0,
  });

  const endTime = useMemo(() => (status.endTime ? new Date(status.endTime) : null), [status.endTime]);
  const [secondsLeft, setSecondsLeft] = useState(() => (endTime ? Math.max(0, Math.floor((endTime - Date.now()) / 1000)) : null));
  const currentBidAmount = status.currentBid?.amount || status.startBid || 0;

  const refresh = async () => {
    try {
      const { data } = await api.get(`/bidding/${listing._id}`);
      setStatus(data);
      if (data.endTime && new Date(data.endTime) <= new Date()) setEnded(true);
      if (data.status === 'ended' && data.isWinner && (data.winnerOpen ?? true)) {
        setWonMsg(`You won with ${formatCurrency(data.finalBid ?? data.currentBid?.amount ?? 0)}.`);
      }
    } catch {
      // Bidding status is also pushed by sockets.
    }
  };

  useEffect(() => {
    refresh();
  }, [listing._id]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('auction:join', { listingId: listing._id });
    const onUpdate = (payload) => {
      if (payload.listingId !== listing._id) return;
      setStatus((prev) => ({
        ...prev,
        currentBid: payload.currentBid || prev.currentBid,
        yourHighestBid: payload.highestBidPerUser?.[user?.id || user?._id] ?? prev.yourHighestBid,
      }));
    };
    const onEnd = (payload) => {
      if (payload.listingId === listing._id) setEnded(true);
    };
    const onWon = (payload) => {
      if (payload.listingId === listing._id) setWonMsg(`You won with ${formatCurrency(payload.finalBid)}.`);
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
  }, [socket, listing._id, user?.id, user?._id]);

  useEffect(() => {
    if (!endTime) return undefined;
    const tick = () => {
      const secs = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0) setEnded(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const placeBid = () => {
    setError('');
    const value = Number(bid);
    if (!Number.isFinite(value) || value < currentBidAmount + 1) {
      setError(`Bid must be at least ${formatCurrency(currentBidAmount + 1)}.`);
      return;
    }
    if (!socket) {
      Alert.alert('Offline', 'Socket connection is not ready yet.');
      return;
    }
    socket.emit('auction:bid', { listingId: listing._id, amount: value });
    setStatus((prev) => ({
      ...prev,
      currentBid: { amount: value, bidder: user?.id || user?._id, timestamp: new Date() },
      yourHighestBid: value,
    }));
    setBid('');
  };

  return (
    <View style={styles.box}>
      <Text style={commonStyles.h2}>Live Bidding</Text>
      {!!wonMsg && <Message type="success">{wonMsg}</Message>}
      {!wonMsg && ended && <Message>Bidding has ended.</Message>}
      {!!error && <Message type="error">{error}</Message>}
      <View style={styles.row}><Text style={styles.k}>Current bid</Text><Text style={styles.v}>{formatCurrency(currentBidAmount)}</Text></View>
      <View style={styles.row}><Text style={styles.k}>Time left</Text><Text style={styles.v}>{secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s` : 'N/A'}</Text></View>
      <View style={styles.row}><Text style={styles.k}>Your highest bid</Text><Text style={styles.v}>{formatCurrency(status.yourHighestBid || 0)}</Text></View>
      <Field label="Bid amount" value={bid} onChangeText={setBid} keyboardType="numeric" placeholder={`Min ${currentBidAmount + 1}`} />
      <AppButton title={ended ? 'Bidding Ended' : 'Place Bid'} onPress={placeBid} disabled={ended} />
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  k: {
    color: colors.muted,
  },
  v: {
    color: colors.text,
    fontWeight: '800',
  },
});

export default BiddingBox;

