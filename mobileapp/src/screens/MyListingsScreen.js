import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarPlus, MessageCircle, PackagePlus } from 'lucide-react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import { AppButton, Badge, Card, EmptyState, LoadingState, Message, Screen, SegmentTabs, Title } from '../components/ui';
import { colors, commonStyles, spacing } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';
import { getId } from '../utils/id';

const activeTx = (status) => !['cancelled', 'rejected', 'completed', 'withdrawn'].includes(status);

const TxCard = ({ request, mode, onAction, onChat, updatingId }) => {
  const isRental = request.transactionType === 'rental_booking';
  const title = request.listing?.title || request.listingSnapshot?.title || 'Listing unavailable';
  const image = request.listing?.images?.[0]?.url || request.listingSnapshot?.images?.[0]?.url;
  const actor = mode === 'seller' ? request.buyer : request.seller;
  const actorLabel = mode === 'seller' ? 'Buyer' : 'Seller';
  const disabled = updatingId === request._id;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={styles.txHeader}>
        {image ? <Image source={{ uri: image }} style={styles.txImage} /> : <View style={[styles.txImage, styles.noImage]}><Text style={{ color: colors.faint }}>No image</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.txTitle}>{title}</Text>
          <Text style={styles.txMeta}>{actorLabel}: {actor?.name || 'User'} {actor?.email ? `(${actor.email})` : ''}</Text>
          <Text style={styles.txPrice}>{formatCurrency(request.amount ?? request.listing?.price ?? 0)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            <Badge tone={request.status === 'completed' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}>{request.status}</Badge>
            {isRental && <Badge tone="orange">{request.rentalStatus || 'requested'}</Badge>}
            {isRental && <Badge tone="muted">Deposit {request.depositStatus || 'not_required'}</Badge>}
          </View>
        </View>
      </View>
      <Text style={styles.txMeta}>Requested: {formatDateTime(request.createdAt)}</Text>
      {isRental && (
        <Text style={styles.txMeta}>Rental: {formatDateTime(request.rentalStartDate)} to {formatDateTime(request.rentalEndDate)} ({request.rentalDays || '-'} day(s))</Text>
      )}
      {request.disputeStatus === 'open' && <Message type="warning">Rental dispute is open.</Message>}

      <View style={styles.actionStack}>
        {mode === 'seller' && request.status === 'pending' && (
          <>
            <AppButton title="Approve" variant="success" disabled={disabled} onPress={() => onAction(request._id, { status: 'approved' }, 'Request approved.')} />
            <AppButton title="Reject" variant="danger" disabled={disabled} onPress={() => onAction(request._id, { status: 'rejected' }, 'Request rejected.')} />
          </>
        )}
        {mode === 'buyer' && request.status === 'approved' && !isRental && (
          <AppButton title="Mark as Paid" disabled={disabled} onPress={() => onAction(request._id, { status: 'payment_sent' }, 'Payment marked as sent.')} />
        )}
        {mode === 'buyer' && ['pending', 'approved'].includes(request.status) && !['auction'].includes(request.transactionType) && (
          <AppButton title="Withdraw Request" variant="danger" disabled={disabled} onPress={() => onAction(request._id, { status: 'withdrawn' }, 'Request withdrawn.')} />
        )}
        {mode === 'seller' && request.status === 'payment_sent' && !isRental && (
          <AppButton title="Confirm Payment" disabled={disabled} onPress={() => onAction(request._id, { status: 'payment_received' }, 'Payment confirmed.')} />
        )}
        {mode === 'seller' && request.status === 'payment_received' && !isRental && (
          <AppButton title="Complete Transaction" variant="success" disabled={disabled} onPress={() => onAction(request._id, { status: 'completed' }, 'Transaction completed.')} />
        )}
        {isRental && mode === 'seller' && request.status === 'approved' && request.rentalStatus === 'approved' && (
          <AppButton title="Mark Rental Active" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'mark_active' }, 'Rental marked active.')} />
        )}
        {isRental && mode === 'seller' && request.rentalStatus === 'active' && (
          <AppButton title="Confirm Return" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'confirm_return' }, 'Return confirmed.')} />
        )}
        {isRental && mode === 'seller' && request.rentalStatus === 'returned' && request.depositStatus === 'held' && (
          <AppButton title="Release Deposit" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'release_deposit' }, 'Security deposit released.')} />
        )}
        {isRental && ['approved', 'active'].includes(request.rentalStatus) && request.disputeStatus !== 'open' && (
          <AppButton title="Raise Dispute" variant="outline" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'raise_dispute' }, 'Dispute raised.')} />
        )}
        {isRental && mode === 'seller' && request.disputeStatus === 'open' && (
          <>
            <AppButton title="Resolve + Release" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'resolve_dispute_release' }, 'Dispute resolved and deposit released.')} />
            <AppButton title="Resolve + Forfeit" variant="danger" disabled={disabled} onPress={() => onAction(request._id, { rentalAction: 'resolve_dispute_forfeit' }, 'Dispute resolved and deposit forfeited.')} />
          </>
        )}
        {['approved', 'payment_sent', 'payment_received'].includes(request.status) && (
          <AppButton title={mode === 'seller' ? 'Chat with Buyer' : 'Chat with Seller'} icon={MessageCircle} variant="outline" onPress={() => onChat(request)} />
        )}
      </View>
    </Card>
  );
};

const MyListingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [buyRequests, setBuyRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('listings');
  const [listingFilter, setListingFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listingRes, buyRes, myRes] = await Promise.all([
        api.get('/listings/me'),
        api.get('/transactions/requests'),
        api.get('/transactions/my-requests'),
      ]);
      setListings(listingRes.data || []);
      setBuyRequests(buyRes.data || []);
      setMyRequests(myRes.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayedListings = useMemo(
    () => listings.filter((listing) => {
      if (listingFilter === 'products') return listing.listingType !== 'rental';
      if (listingFilter === 'rentals') return listing.listingType === 'rental';
      return true;
    }),
    [listings, listingFilter]
  );
  const displayedBuyRequests = buyRequests;
  const displayedMyRequests = myRequests;
  const productCount = listings.filter((listing) => listing.listingType !== 'rental').length;
  const rentalCount = listings.filter((listing) => listing.listingType === 'rental').length;

  const updateTx = async (transactionId, payload, successMessage) => {
    setUpdatingId(transactionId);
    setError('');
    setMessage('');
    try {
      await api.put(`/transactions/${transactionId}`, payload);
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update request.');
    } finally {
      setUpdatingId('');
    }
  };

  const deleteListing = (listing) => {
    Alert.alert('Delete listing', `Remove "${listing.title}" and related chats?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUpdatingId(listing._id);
          try {
            await api.delete(`/listings/${listing._id}`);
            setMessage('Listing and related chats deleted.');
            await load();
          } catch (err) {
            setError(err.response?.data?.message || 'Unable to delete listing.');
          } finally {
            setUpdatingId('');
          }
        },
      },
    ]);
  };

  const requestReview = async (listing) => {
    setUpdatingId(listing._id);
    try {
      await api.post(`/listings/${listing._id}/review`, {});
      setMessage('Review requested.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to request review.');
    } finally {
      setUpdatingId('');
    }
  };

  const openChat = async (request) => {
    try {
      const payload = { listingId: getId(request.listing) };
      if (request.buyer && getId(request.buyer) !== getId(user)) payload.userId = getId(request.buyer);
      if (request.seller && getId(request.seller) !== getId(user)) payload.userId = getId(request.seller);
      const { data } = await api.post('/chats', payload);
      navigation.navigate('Chat', { chatId: data._id });
    } catch (err) {
      Alert.alert('Unable to open chat', err.response?.data?.message || 'Try again later.');
    }
  };

  if (loading) return <Screen><LoadingState title="Loading dashboard..." /></Screen>;

  return (
    <Screen>
      <Title subtitle="Manage products, rentals, received requests, and your own requests.">My Listings</Title>
      {!!message && <Message type="success">{message}</Message>}
      {!!error && <Message type="error">{error}</Message>}
      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'listings', label: 'Listings' },
          { value: 'received', label: `Received (${displayedBuyRequests.filter((r) => activeTx(r.status)).length})` },
          { value: 'mine', label: `My Requests (${displayedMyRequests.filter((r) => activeTx(r.status)).length})` },
        ]}
      />

      {activeTab === 'listings' && (
        <>
          <View style={styles.createRow}>
            <AppButton
              title="Create Listing"
              icon={PackagePlus}
              onPress={() => navigation.navigate('CreateListing')}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Create Rental"
              icon={CalendarPlus}
              variant="secondary"
              onPress={() => navigation.navigate('CreateRental')}
              style={{ flex: 1 }}
            />
          </View>
          <SegmentTabs
            value={listingFilter}
            onChange={setListingFilter}
            items={[
              { value: 'all', label: `All (${listings.length})` },
              { value: 'products', label: `Products (${productCount})` },
              { value: 'rentals', label: `Rentals (${rentalCount})` },
            ]}
          />
          {displayedListings.length ? displayedListings.map((listing) => (
            <View key={listing._id} style={styles.listingManageItem}>
              <ListingCard listing={listing} onView={(item) => navigation.navigate('ListingDetail', { id: item._id })} />
              {listing.status === 'blocked' && listing.moderation?.action !== 'ban' && (
                <AppButton title={listing.moderation?.flagged ? 'Review Pending' : 'Request Review'} variant="outline" onPress={() => requestReview(listing)} disabled={updatingId === listing._id || listing.moderation?.flagged} />
              )}
              <View style={styles.listingActions}>
                <AppButton title="Edit" variant="outline" onPress={() => navigation.navigate('EditListing', { id: listing._id })} style={{ flex: 1 }} disabled={listing.moderation?.action === 'ban'} />
                {listing.status !== 'sold' && listing.status !== 'archived' ? (
                  <AppButton title="Delete" variant="danger" onPress={() => deleteListing(listing)} style={{ flex: 1 }} disabled={updatingId === listing._id} />
                ) : (
                  <AppButton title={listing.status} variant="muted" disabled style={{ flex: 1 }} />
                )}
              </View>
            </View>
          )) : <EmptyState title="No listings in this view." subtitle="Create a product listing or rental from the buttons above." />}
        </>
      )}

      {activeTab === 'received' && (
        displayedBuyRequests.length ? displayedBuyRequests.map((request) => (
          <TxCard key={request._id} request={request} mode="seller" onAction={updateTx} onChat={openChat} updatingId={updatingId} />
        )) : <EmptyState title="No received requests yet." subtitle="Buy and rental requests from other users will appear here." />
      )}

      {activeTab === 'mine' && (
        displayedMyRequests.length ? displayedMyRequests.map((request) => (
          <TxCard key={request._id} request={request} mode="buyer" onAction={updateTx} onChat={openChat} updatingId={updatingId} />
        )) : <EmptyState title="You have not made any requests yet." subtitle="Your buy, offer, auction, and rental requests will be tracked here." />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  listingManageItem: {
    marginBottom: spacing.lg,
  },
  listingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  txHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  txImage: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  txMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  txPrice: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  actionStack: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

export default MyListingsScreen;
