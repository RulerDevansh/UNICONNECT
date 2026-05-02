import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import {
  getDisputes,
  getFlaggedListings,
  getOverviewMetrics,
  getTrends,
  getUsers,
  resolveDispute,
  reviewListing,
  updateUserSuspension,
  warnUser,
} from '../services/adminService';
import { AppButton, AppModal, Badge, Card, EmptyState, Field, LoadingState, Message, Screen, SegmentTabs, SelectField, Title } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime } from '../utils/format';

const AdminScreen = () => {
  const [tab, setTab] = useState('overview');
  return (
    <Screen>
      <Title subtitle="Operations control for listings, disputes, users, and metrics.">Admin Workspace</Title>
      <SegmentTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'listings', label: 'Listings' },
          { value: 'disputes', label: 'Disputes' },
          { value: 'users', label: 'Users' },
        ]}
      />
      {tab === 'overview' && <AdminOverview />}
      {tab === 'listings' && <AdminListings />}
      {tab === 'disputes' && <AdminDisputes />}
      {tab === 'users' && <AdminUsers />}
    </Screen>
  );
};

const AdminOverview = () => {
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    return { start: start.toISOString(), end: end.toISOString(), bucket: 'day' };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [metricsRes, trendsRes] = await Promise.all([getOverviewMetrics(), getTrends(dateRange)]);
    setMetrics(metricsRes.data);
    setTrends(trendsRes.data);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);
  if (loading && !metrics) return <LoadingState title="Loading analytics..." />;

  return (
    <View>
      <View style={styles.metricGrid}>
        {Object.entries(metrics || {}).map(([key, value]) => (
          <Card key={key} style={styles.metricCard}>
            <Text style={styles.metricKey}>{key}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Trends</Text>
          <AppButton title="Refresh" variant="outline" onPress={load} />
        </View>
        {['users', 'listings', 'transactions'].map((series) => (
          <View key={series} style={styles.trendBlock}>
            <Text style={styles.metricKey}>{series}</Text>
            {(trends?.[series] || []).map((item) => (
              <View key={item._id} style={styles.lineRow}>
                <Text style={styles.meta}>{item._id}</Text>
                <Text style={styles.value}>{item.count}</Text>
              </View>
            ))}
            {!trends?.[series]?.length && <Text style={styles.meta}>No data</Text>}
          </View>
        ))}
      </Card>
    </View>
  );
};

const AdminListings = () => {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ source: '', reason: '', q: '' });
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const { data } = await getFlaggedListings({ page, limit: 10, sort: 'newest', ...filters });
    setListings(data.data || []);
    setMeta({ page: data.page || 1, totalPages: data.totalPages || 1 });
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(1); }, [load]);

  const act = (listing, action) => {
    const labels = { approve: 'Approve', block: 'Block', ban: 'Ban' };
    Alert.alert(`${labels[action]} listing`, `${labels[action]} "${listing.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: labels[action],
        style: action === 'ban' ? 'destructive' : 'default',
        onPress: async () => {
          await reviewListing(listing._id, { action });
          setMessage(`Listing ${action}d.`);
          load(meta.page);
        },
      },
    ]);
  };

  return (
    <View>
      {!!message && <Message type="success">{message}</Message>}
      <Field label="Search title or description" value={filters.q} onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))} />
      <Field label="Reason" value={filters.reason} onChangeText={(v) => setFilters((p) => ({ ...p, reason: v }))} />
      <SelectField
        label="Source"
        selectedValue={filters.source}
        onValueChange={(v) => setFilters((p) => ({ ...p, source: v }))}
        items={[
          { value: '', label: 'All sources' },
          { value: 'system', label: 'System detection' },
          { value: 'report', label: 'User report' },
          { value: 'review_request', label: 'Review request' },
        ]}
      />
      {loading ? <LoadingState title="Loading flagged listings..." /> : listings.length ? listings.map((listing) => {
        const image = listing.images?.[0]?.url || listing.images?.[0];
        const source = listing.moderation?.source || (listing.moderation?.reportedBy ? 'report' : 'system');
        return (
          <Card key={listing._id} style={styles.card}>
            <View style={styles.itemRow}>
              {image ? <Image source={{ uri: image }} style={styles.thumb} /> : <View style={[styles.thumb, styles.noImage]}><Text style={styles.meta}>No image</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{listing.title}</Text>
                <Text style={styles.meta}>Source: {source}</Text>
                <Text style={styles.meta}>Reason: {listing.moderation?.reason || listing.moderation?.reportReason || 'n/a'}</Text>
                <Text style={styles.meta}>Seller: {listing.seller?.name || 'unknown'} {listing.seller?.email ? `(${listing.seller.email})` : ''}</Text>
              </View>
            </View>
            <Text style={styles.description}>{listing.description}</Text>
            <View style={styles.actionRow}>
              <AppButton title="Approve" variant="success" onPress={() => act(listing, 'approve')} style={{ flex: 1 }} />
              <AppButton title="Block" variant="outline" onPress={() => act(listing, 'block')} style={{ flex: 1 }} />
              <AppButton title="Ban" variant="danger" onPress={() => act(listing, 'ban')} style={{ flex: 1 }} />
            </View>
          </Card>
        );
      }) : <EmptyState title="No flagged listings." />}
      <Pager meta={meta} load={load} />
    </View>
  );
};

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [filters, setFilters] = useState({ status: 'open', q: '' });
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const { data } = await getDisputes({ page, limit: 10, sort: 'newest', ...filters });
    setDisputes(data.data || []);
    setMeta({ page: data.page || 1, totalPages: data.totalPages || 1 });
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(1); }, [load]);

  const resolve = (dispute, action) => {
    Alert.alert('Resolve dispute', action === 'release' ? 'Release deposit?' : 'Forfeit deposit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'release' ? 'Release' : 'Forfeit',
        style: action === 'forfeit' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await resolveDispute(dispute._id, { action });
            setMessage(action === 'release' ? 'Dispute resolved and deposit released.' : 'Dispute resolved and deposit forfeited.');
            await load(meta.page);
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to resolve dispute.');
          }
        },
      },
    ]);
  };

  return (
    <View>
      {!!message && <Message type="success">{message}</Message>}
      {!!error && <Message type="error">{error}</Message>}
      <Field label="Search listing, buyer, seller" value={filters.q} onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))} />
      <SelectField
        label="Status"
        selectedValue={filters.status}
        onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
        items={[
          { value: 'open', label: 'Open disputes' },
          { value: 'resolved', label: 'Resolved disputes' },
          { value: 'all', label: 'All disputes' },
        ]}
      />
      {loading ? <LoadingState title="Loading disputes..." /> : disputes.length ? disputes.map((dispute) => (
        <Card key={dispute._id} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.itemTitle}>{dispute.listing?.title || dispute.listingSnapshot?.title || 'Listing unavailable'}</Text>
            <Badge tone={dispute.disputeStatus === 'open' ? 'warning' : 'success'}>{dispute.disputeStatus}</Badge>
          </View>
          <Text style={styles.meta}>Buyer: {dispute.buyer?.name || 'unavailable'} {dispute.buyer?.email ? `(${dispute.buyer.email})` : ''}</Text>
          <Text style={styles.meta}>Seller: {dispute.seller?.name || 'unavailable'} {dispute.seller?.email ? `(${dispute.seller.email})` : ''}</Text>
          <Text style={styles.meta}>Rental: {dispute.rentalStatus} | Deposit: {dispute.depositStatus}</Text>
          <Text style={styles.meta}>Updated: {formatDateTime(dispute.updatedAt)}</Text>
          {dispute.disputeStatus === 'open' && (
            <View style={styles.actionRow}>
              <AppButton title="Release" onPress={() => resolve(dispute, 'release')} style={{ flex: 1 }} />
              <AppButton title="Forfeit" variant="danger" onPress={() => resolve(dispute, 'forfeit')} style={{ flex: 1 }} />
            </View>
          )}
        </Card>
      )) : <EmptyState title="No disputes found." />}
      <Pager meta={meta} load={load} />
    </View>
  );
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ q: '', role: '', verified: '', suspended: '' });
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [warningUser, setWarningUser] = useState(null);
  const [warningReason, setWarningReason] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const { data } = await getUsers({ page, limit: 10, sort: 'newest', ...filters });
    setUsers(data.data || []);
    setMeta({ page: data.page || 1, totalPages: data.totalPages || 1 });
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(1); }, [load]);

  const toggleSuspension = (user) => {
    const suspended = !user.suspended;
    Alert.alert(suspended ? 'Suspend user' : 'Unsuspend user', `${suspended ? 'Suspend' : 'Unsuspend'} ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: suspended ? 'Suspend' : 'Unsuspend',
        style: suspended ? 'destructive' : 'default',
        onPress: async () => {
          await updateUserSuspension(user._id, { suspended, reason: suspended ? 'Admin action from mobile app' : '' });
          setMessage(suspended ? 'User suspended.' : 'User unsuspended.');
          load(meta.page);
        },
      },
    ]);
  };

  const sendWarning = async () => {
    if (!warningUser) return;
    await warnUser(warningUser._id, { reason: warningReason || undefined });
    setWarningUser(null);
    setWarningReason('');
    setMessage('Warning sent.');
    load(meta.page);
  };

  return (
    <View>
      {!!message && <Message type="success">{message}</Message>}
      <Field label="Search name or email" value={filters.q} onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))} />
      <Field label="Role" value={filters.role} onChangeText={(v) => setFilters((p) => ({ ...p, role: v }))} />
      <Field label="Verified true/false" value={filters.verified} onChangeText={(v) => setFilters((p) => ({ ...p, verified: v }))} />
      <Field label="Suspended true/false" value={filters.suspended} onChangeText={(v) => setFilters((p) => ({ ...p, suspended: v }))} />
      {loading ? <LoadingState title="Loading users..." /> : users.length ? users.map((user) => (
        <Card key={user._id} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{user.name}</Text>
              <Text style={styles.meta}>{user.email}</Text>
              <Text style={styles.meta}>Role: {user.role} | Verified: {String(user.verified)}</Text>
              {user.suspended && <Text style={[styles.meta, { color: '#fecaca' }]}>Suspended: {user.suspendedReason || 'no reason provided'}</Text>}
            </View>
            <Badge tone={user.suspended ? 'danger' : 'success'}>{user.suspended ? 'Suspended' : 'Active'}</Badge>
          </View>
          {user.role !== 'admin' && (
            <View style={styles.actionRow}>
              <AppButton title="Warn" variant="outline" onPress={() => setWarningUser(user)} style={{ flex: 1 }} />
              <AppButton title={user.suspended ? 'Unsuspend' : 'Suspend'} variant={user.suspended ? 'success' : 'danger'} onPress={() => toggleSuspension(user)} style={{ flex: 1 }} />
            </View>
          )}
        </Card>
      )) : <EmptyState title="No users found." />}
      <Pager meta={meta} load={load} />
      <AppModal visible={!!warningUser} title="Send Warning" onClose={() => setWarningUser(null)}>
        <Text style={styles.meta}>Warning for {warningUser?.name} ({warningUser?.email})</Text>
        <Field label="Reason" value={warningReason} onChangeText={setWarningReason} multiline autoCapitalize="sentences" />
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {['Inappropriate listing', 'Spam activity', 'Harassment or abuse', 'Misleading information'].map((preset) => (
            <AppButton key={preset} title={preset} variant="outline" onPress={() => setWarningReason(preset)} />
          ))}
        </View>
        <AppButton title="Send Warning" onPress={sendWarning} />
      </AppModal>
    </View>
  );
};

const Pager = ({ meta, load }) => (
  <View style={styles.pager}>
    <Text style={styles.meta}>Page {meta.page} of {meta.totalPages}</Text>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <AppButton title="Prev" variant="outline" disabled={meta.page <= 1} onPress={() => load(Math.max(1, meta.page - 1))} />
      <AppButton title="Next" variant="outline" disabled={meta.page >= meta.totalPages} onPress={() => load(Math.min(meta.totalPages, meta.page + 1))} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metricCard: {
    width: '47%',
  },
  metricKey: {
    color: colors.muted,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '900',
  },
  metricValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  trendBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.mutedBorder,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  value: {
    color: colors.text,
    fontWeight: '800',
  },
  card: {
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thumb: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  description: {
    color: '#cbd5e1',
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pager: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
});

export default AdminScreen;

