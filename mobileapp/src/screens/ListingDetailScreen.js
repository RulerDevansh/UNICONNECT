import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Flag, HandCoins, MapPin, MessageCircle, ShoppingBag } from 'lucide-react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import BiddingBox from '../components/BiddingBox';
import { AppButton, AppModal, Badge, Card, Field, LoadingState, Message, Screen, Title } from '../components/ui';
import { colors, commonStyles, spacing } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';
import { getCategoryLabel, getListingDisplayPrice, getListingPriceText, getListingTypeLabel } from '../utils/listing';
import { getId, sameId } from '../utils/id';

const ListingDetailScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const { user } = useAuth();
  const { socket } = useSocket();
  const { pushToast } = useToast();
  const [listing, setListing] = useState(null);
  const [headerPrice, setHeaderPrice] = useState(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOffer, setShowOffer] = useState(false);
  const [offer, setOffer] = useState({ amount: '', notes: '' });
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ reason: '', message: '' });
  const [rentalDates, setRentalDates] = useState({ start: '', end: '' });

  const loadListing = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/listings/${id}`);
      setListing(data);
      setHeaderPrice(getListingDisplayPrice(data));
      if (user && !sameId(data.seller, user)) {
        try {
          const txRes = await api.get('/transactions');
          setHasPendingRequest((txRes.data || []).some((tx) => {
            const listingId = getId(tx.listing);
            return listingId === id && ['pending', 'approved', 'payment_sent'].includes(tx.status);
          }));
        } catch {
          setHasPendingRequest(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useFocusEffect(useCallback(() => { loadListing(); }, [loadListing]));

  useEffect(() => {
    if (!socket || !listing) return undefined;
    const listingId = listing._id;
    socket.emit('joinListing', { listingId });
    const refresh = (payload) => {
      if (payload.listingId === listingId) loadListing();
    };
    socket.on('listing:refresh', refresh);
    return () => socket.off('listing:refresh', refresh);
  }, [socket, listing?._id, loadListing]);

  useEffect(() => {
    if (!socket || !listing || listing.listingType !== 'auction') return undefined;
    const listingId = listing._id;
    socket.emit('auction:join', { listingId });
    const update = (payload) => {
      if (payload.listingId !== listingId) return;
      if (payload.currentBid?.amount > 0) setHeaderPrice(payload.currentBid.amount);
      setListing((prev) => prev ? ({
        ...prev,
        auction: {
          ...prev.auction,
          currentBid: payload.currentBid || prev.auction?.currentBid,
          highestBidPerUser: payload.highestBidPerUser || prev.auction?.highestBidPerUser,
        },
      }) : prev);
    };
    socket.on('auction:update', update);
    return () => socket.off('auction:update', update);
  }, [socket, listing?._id, listing?.listingType]);

  const startChat = async (targetUserId) => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    try {
      const payload = { listingId: listing._id };
      if (targetUserId) payload.userId = targetUserId;
      const { data } = await api.post('/chats', payload);
      navigation.navigate('Chat', { chatId: data._id });
    } catch (err) {
      pushToast(err.response?.data?.message || 'Unable to open chat.', { type: 'error' });
    }
  };

  const buyNow = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    try {
      await api.post('/transactions', { listing: id, transactionType: 'buy_request' });
      pushToast('Buy request sent. You will be notified when approved.', { type: 'success' });
      setHasPendingRequest(true);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to send buy request.', { type: 'error' });
    }
  };

  const requestRental = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    if (!rentalDates.start || !rentalDates.end) {
      pushToast('Please enter rental start and end dates.', { type: 'warning' });
      return;
    }
    if (new Date(rentalDates.end) <= new Date(rentalDates.start)) {
      pushToast('Rental end date must be after start date.', { type: 'warning' });
      return;
    }
    try {
      await api.post('/transactions', {
        listing: id,
        transactionType: 'rental_booking',
        rentalStartDate: new Date(rentalDates.start).toISOString(),
        rentalEndDate: new Date(rentalDates.end).toISOString(),
      });
      pushToast('Rental request sent to owner.', { type: 'success' });
      setHasPendingRequest(true);
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to send rental request.', { type: 'error' });
    }
  };

  const submitOffer = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    try {
      await api.post('/offers', { listing: id, amount: Number(offer.amount), notes: offer.notes });
      setShowOffer(false);
      setOffer({ amount: '', notes: '' });
      pushToast('Offer sent to the seller.', { type: 'success' });
      loadListing();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to submit offer.', { type: 'error' });
    }
  };

  const submitReport = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    if (!report.reason.trim()) {
      pushToast('Please enter a report reason.', { type: 'warning' });
      return;
    }
    try {
      await api.post('/reports', { listing: id, reason: report.reason.trim(), message: report.message.trim() });
      setShowReport(false);
      setReport({ reason: '', message: '' });
      pushToast('Report submitted. The team will review this listing.', { type: 'success' });
      loadListing();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to submit report.', { type: 'error' });
    }
  };

  if (loading && !listing) return <Screen><LoadingState title="Loading listing..." /></Screen>;
  if (!listing) return <Screen><Message type="error">Listing not found.</Message></Screen>;

  const sellerId = getId(listing.seller);
  const isSeller = sameId(sellerId, user);
  const canInteract = user && sellerId && !isSeller;
  const isRental = listing.listingType === 'rental';
  const priceText = getListingPriceText(listing, headerPrice);

  return (
    <Screen>
      <Title subtitle={getCategoryLabel(listing.category)}>{listing.title}</Title>
      <Card>
        {listing.images?.[0]?.url ? (
          <Image source={{ uri: listing.images[0].url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.fallback]}><Text style={{ color: colors.faint }}>No Image</Text></View>
        )}
        <View style={commonStyles.between}>
          <Badge tone={listing.listingType === 'rental' ? 'orange' : listing.listingType === 'auction' ? 'info' : 'primary'}>{getListingTypeLabel(listing.listingType)}</Badge>
          <Text style={styles.price}>{priceText}</Text>
        </View>
        <Text style={styles.description}>{listing.description}</Text>
        <Text style={styles.meta}>Condition: {listing.condition || 'good'}</Text>
        {listing.location?.latitude != null && listing.location?.longitude != null && (
          <View style={styles.panel}>
            <View style={styles.panelTitleRow}>
              <MapPin size={16} color={colors.muted} />
              <Text style={styles.panelTitle}>Location</Text>
            </View>
            {typeof listing.distance_km === 'number' && (
              <Badge tone="info" style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                {listing.distance_km.toFixed(1)} km away
              </Badge>
            )}
            <Text style={styles.meta}>Coordinates: {Number(listing.location.latitude).toFixed(4)}, {Number(listing.location.longitude).toFixed(4)}</Text>
            {!!listing.location.address && <Text style={styles.meta}>Address: {listing.location.address}</Text>}
          </View>
        )}
        {isRental && (
          <View style={styles.panel}>
            <View style={styles.panelTitleRow}>
              <CalendarDays size={16} color={colors.muted} />
              <Text style={styles.panelTitle}>Rental details</Text>
            </View>
            <Text style={styles.meta}>Minimum days: {listing.rental?.minimumDays || 1}</Text>
            <Text style={styles.meta}>Security deposit: {formatCurrency(listing.rental?.securityDeposit || 0)}</Text>
            <Text style={styles.meta}>Available from: {formatDateTime(listing.rental?.availableFrom)}</Text>
            <Text style={styles.meta}>Available until: {formatDateTime(listing.rental?.availableUntil)}</Text>
          </View>
        )}

        {listing.status === 'sold' && <Message>Sold</Message>}

        {canInteract && listing.status !== 'sold' && listing.listingType === 'buy-now' && (
          hasPendingRequest ? <Message type="warning">Request pending</Message> : <AppButton title="Buy Now" icon={ShoppingBag} onPress={buyNow} />
        )}

        {canInteract && listing.status !== 'sold' && listing.listingType === 'offer' && (
          <View style={styles.actions}>
            <AppButton title="Chat" icon={MessageCircle} onPress={() => startChat(sellerId)} style={{ flex: 1 }} />
            <AppButton title="Offer" icon={HandCoins} variant="outline" onPress={() => setShowOffer(true)} style={{ flex: 1 }} />
          </View>
        )}

        {canInteract && listing.status !== 'sold' && isRental && (
          hasPendingRequest ? <Message type="warning">Rental request pending</Message> : (
            <View style={styles.panel}>
              <Field label="Start date" value={rentalDates.start} onChangeText={(v) => setRentalDates((prev) => ({ ...prev, start: v }))} placeholder="2026-05-06" />
              <Field label="End date" value={rentalDates.end} onChangeText={(v) => setRentalDates((prev) => ({ ...prev, end: v }))} placeholder="2026-05-09" />
              <AppButton title="Request Rental" icon={CalendarDays} onPress={requestRental} />
            </View>
          )
        )}

        {canInteract && <AppButton title="Report Listing" icon={Flag} variant="danger" onPress={() => setShowReport(true)} style={{ marginTop: spacing.md }} />}
      </Card>

      {listing.listingType === 'auction' && listing.auction?.isAuction && canInteract && (
        <BiddingBox listing={listing} user={user} />
      )}

      {listing.listingType === 'auction' && isSeller && listing.auction?.status === 'ended' && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={commonStyles.h2}>Auction Result</Text>
          {listing.auction?.winner ? (
            <>
              <Text style={styles.meta}>Winner: {listing.auction.winner?.name || listing.auction.winner?.email || 'User'}</Text>
              <Text style={styles.meta}>Final bid: {formatCurrency(listing.auction?.currentBid?.amount || 0)}</Text>
              <AppButton title="Chat with Buyer" icon={MessageCircle} variant="outline" onPress={() => startChat(getId(listing.auction.winner))} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <Text style={styles.meta}>No bids were placed.</Text>
          )}
        </Card>
      )}

      <AppModal visible={showOffer} title="Make an Offer" onClose={() => setShowOffer(false)}>
        <Field label="Amount" value={offer.amount} onChangeText={(v) => setOffer((prev) => ({ ...prev, amount: v }))} keyboardType="numeric" />
        <Field label="Notes" value={offer.notes} onChangeText={(v) => setOffer((prev) => ({ ...prev, notes: v }))} multiline autoCapitalize="sentences" />
        <AppButton title="Submit Offer" onPress={submitOffer} />
      </AppModal>

      <AppModal visible={showReport} title="Report Listing" onClose={() => setShowReport(false)}>
        <Field label="Reason" value={report.reason} onChangeText={(v) => setReport((prev) => ({ ...prev, reason: v }))} autoCapitalize="sentences" />
        <Field label="Details" value={report.message} onChangeText={(v) => setReport((prev) => ({ ...prev, message: v }))} multiline autoCapitalize="sentences" />
        <AppButton title="Submit Report" variant="danger" onPress={submitReport} />
      </AppModal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    backgroundColor: colors.panel,
    marginBottom: spacing.md,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  description: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  meta: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: 'rgba(2,6,23,0.46)',
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

export default ListingDetailScreen;
