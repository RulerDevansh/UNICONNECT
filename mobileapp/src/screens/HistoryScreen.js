import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, EmptyState, LoadingState, Screen, SegmentTabs, Title } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { getId } from '../utils/id';

const TxHistoryCard = ({ transaction, role }) => {
  const listing = transaction.listing || transaction.listingSnapshot || {};
  const image = listing.images?.[0]?.url;
  const actor = role === 'buying' ? transaction.seller : transaction.buyer;
  return (
    <Card style={styles.card}>
      <View style={styles.txRow}>
        {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={[styles.image, styles.noImage]}><Text style={styles.noImageText}>No image</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{listing.title || 'Listing unavailable'}</Text>
          <Text style={styles.meta}>{role === 'buying' ? 'Seller' : 'Buyer'}: {actor?.name || 'User'} {actor?.email ? `(${actor.email})` : ''}</Text>
          <Text style={styles.price}>{formatCurrency(transaction.amount)}</Text>
          <Text style={styles.meta}>Status: {transaction.status} | {formatDate(transaction.createdAt)}</Text>
          {transaction.transactionType === 'auction' && <Badge tone="info">Auction</Badge>}
        </View>
      </View>
    </Card>
  );
};

const ShareHistoryCard = ({ share, userId, host }) => {
  const joined = share.members?.filter((m) => m.status === 'joined').length || 0;
  const userMembership = share.members?.find((m) => getId(m.user) === userId);
  const min = share.shareType === 'food' ? share.minPersons : share.otherMinPersons;
  const meetsMinimum = share.shareType === 'cab' || !min || joined >= min;
  const completed = share.status === 'closed' && joined > 0 && meetsMinimum && userMembership?.status !== 'cancelled';
  return (
    <Card style={[styles.card, { borderColor: completed ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.35)' }]}>
      <View style={styles.shareHeader}>
        <Text style={styles.title}>{share.name}</Text>
        <Badge tone={completed ? 'success' : 'danger'}>{completed ? 'Completed' : 'Cancelled'}</Badge>
      </View>
      <Text style={styles.meta}>{share.description}</Text>
      <Text style={styles.meta}>Type: {share.shareType}</Text>
      {share.shareType === 'cab' && <Text style={styles.meta}>Route: {share.fromCity || 'N/A'} -> {share.toCity || 'N/A'}</Text>}
      {share.shareType === 'food' && <Text style={styles.meta}>Items: {share.foodItems || 'N/A'}</Text>}
      {share.shareType === 'other' && <Text style={styles.meta}>Category: {share.category || 'N/A'}</Text>}
      <Text style={styles.meta}>When: {formatDateTime(share.departureTime || share.deadlineTime || share.otherDeadline || share.createdAt)}</Text>
      <Text style={styles.price}>{host ? 'Host total' : 'You paid'}: {formatCurrency(host ? share.totalAmount : userMembership?.share || 0)}</Text>
    </Card>
  );
};

const HistoryScreen = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [activeTab, setActiveTab] = useState('buying');

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      const { data } = await api.get('/users/me/history');
      if (active) setHistory(data);
    };
    load();
    return () => { active = false; };
  }, []));

  if (!history) return <Screen><LoadingState title="Loading history..." /></Screen>;

  const hostShares = [
    ...(history.cabSharing?.asHost || []),
    ...(history.foodSharing?.asHost || []),
    ...(history.otherSharing?.asHost || []),
  ];
  const memberShares = [
    ...(history.cabSharing?.asMember || []),
    ...(history.foodSharing?.asMember || []),
    ...(history.otherSharing?.asMember || []),
  ].filter((share) => getId(share.host) !== getId(user));

  return (
    <Screen>
      <Title>My History</Title>
      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'buying', label: 'Buying' },
          { value: 'selling', label: 'Selling' },
          { value: 'sharing', label: 'Sharing' },
        ]}
      />
      {activeTab === 'buying' && (
        history.buyingHistory?.length ? history.buyingHistory.map((tx) => <TxHistoryCard key={tx._id} transaction={tx} role="buying" />) : <EmptyState title="No buying history yet." />
      )}
      {activeTab === 'selling' && (
        history.sellingHistory?.length ? history.sellingHistory.map((tx) => <TxHistoryCard key={tx._id} transaction={tx} role="selling" />) : <EmptyState title="No selling history yet." />
      )}
      {activeTab === 'sharing' && (
        <>
          <Text style={styles.sectionTitle}>As Host</Text>
          {hostShares.length ? hostShares.map((share) => <ShareHistoryCard key={`host-${share._id}`} share={share} userId={getId(user)} host />) : <EmptyState title="No sharing history as host." />}
          <Text style={styles.sectionTitle}>As Member</Text>
          {memberShares.length ? memberShares.map((share) => <ShareHistoryCard key={`member-${share._id}`} share={share} userId={getId(user)} />) : <EmptyState title="No sharing history as member." />}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  txRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  image: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    color: colors.faint,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
  },
  price: {
    color: colors.primary,
    marginTop: 8,
    fontWeight: '900',
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});

export default HistoryScreen;

