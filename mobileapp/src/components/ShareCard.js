import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors, commonStyles, radius, spacing } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';
import { getId } from '../utils/id';
import { AppButton, Badge, Card } from './ui';

const normalizeMembers = (share) => share.members || [];

const shareTypeLabel = {
  cab: 'Cab',
  food: 'Food',
  other: 'Other',
};

const getCapacity = (share) => {
  const joined = normalizeMembers(share).filter((m) => m.status === 'joined').length;
  if (share.shareType === 'cab') return `${joined}/${share.maxPassengers || '-'}`;
  if (share.shareType === 'food') return `${joined}/${share.maxPersons || '-'}`;
  return `${joined}/${share.otherMaxPersons || '-'}`;
};

const getDeadline = (share) => {
  if (share.shareType === 'cab') return share.bookingDeadline || share.departureTime;
  if (share.shareType === 'food') return share.deadlineTime;
  return share.otherDeadline;
};

const ShareCard = ({
  share,
  currentUserId,
  onJoin,
  onCancel,
  onApprove,
  onReject,
  onUpdate,
  onDelete,
  onFinalize,
  joiningId,
  cancellingId,
}) => {
  const hostId = getId(share.host);
  const isHost = hostId === currentUserId;
  const members = normalizeMembers(share);
  const currentMembership = members.find((member) => getId(member.user) === currentUserId);
  const isMember = !!currentMembership;
  const isCancelled = currentMembership?.status === 'cancelled' && share.status === 'open';
  const pendingIds = (share.pendingRequests || []).map(getId);
  const currentRejection = (share.rejectedRequests || []).find((entry) => getId(entry.user) === currentUserId);
  const rejectedIds = (share.rejectedRequests || []).map((entry) => getId(entry.user));
  const isPending = pendingIds.includes(currentUserId);
  const isRejected = rejectedIds.includes(currentUserId);
  const joinedCount = members.filter((m) => m.status === 'joined').length;
  const deadline = getDeadline(share);
  const isDeadlinePassed = deadline ? new Date() > new Date(deadline) : false;
  const max = share.shareType === 'cab' ? share.maxPassengers : share.shareType === 'food' ? share.maxPersons : share.otherMaxPersons;
  const isFull = max ? joinedCount >= max : false;
  const hasJoinAction = typeof onJoin === 'function';
  const disabled = !hasJoinAction || share.status !== 'open' || isHost || isMember || isPending || isDeadlinePassed || isFull || isRejected;
  const calculatedShare = currentMembership?.share || (isMember && joinedCount ? Number(share.totalAmount || 0) / joinedCount : 0);
  const canRequestAgain = hasJoinAction && !isHost && !isPending && (isCancelled || isRejected) && share.status === 'open' && !isDeadlinePassed && !isFull;
  const retryLabel = isRejected
    ? 'Request Again'
    : share.shareType === 'food'
      ? 'Reorder'
      : share.shareType === 'cab'
        ? 'Rebook This Trip'
        : 'Rebook';

  const confirmDelete = () => {
    Alert.alert('Delete share', `Delete "${share.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(share._id) },
    ]);
  };

  const ctaLabel = isHost
    ? 'You are hosting'
    : isCancelled
      ? 'Cancelled'
      : isRejected
        ? 'Request rejected'
        : isMember
          ? 'Confirmed'
          : isPending
            ? 'Request pending'
            : isFull
              ? 'Fully booked'
              : isDeadlinePassed
                ? 'Booking closed'
                : 'Request to Join';

  return (
    <Card style={styles.card}>
      <View style={commonStyles.between}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{share.name}</Text>
          {!!share.description && <Text style={styles.description}>{share.description}</Text>}
        </View>
        <Badge tone={share.status === 'open' ? 'success' : 'muted'}>{share.status || 'open'}</Badge>
      </View>

      <View style={styles.badges}>
        <Badge tone="primary">{shareTypeLabel[share.shareType] || 'Share'}</Badge>
        <Badge tone={isFull ? 'danger' : 'muted'}>Capacity {getCapacity(share)}</Badge>
        {isDeadlinePassed && <Badge tone="danger">Closed</Badge>}
      </View>

      <View style={styles.details}>
        {share.shareType === 'cab' && (
          <>
            <Text style={styles.detail}>Route: {share.fromCity || 'N/A'} -> {share.toCity || 'N/A'}</Text>
            <Text style={styles.detail}>Departure: {formatDateTime(share.departureTime)}</Text>
            <Text style={styles.detail}>Booking until: {formatDateTime(share.bookingDeadline)}</Text>
            {!!share.vehicleType && <Text style={styles.detail}>Vehicle: {share.vehicleType}</Text>}
          </>
        )}
        {share.shareType === 'food' && (
          <>
            <Text style={styles.detail}>Items: {share.foodItems || 'N/A'}</Text>
            <Text style={styles.detail}>Quantity: {share.quantity || 1}</Text>
            <Text style={styles.detail}>Delivery: {formatDateTime(share.deadlineTime)}</Text>
            <Text style={styles.detail}>Min persons: {share.minPersons || '-'}</Text>
          </>
        )}
        {share.shareType === 'other' && (
          <>
            <Text style={styles.detail}>Category: {share.category || 'N/A'}</Text>
            <Text style={styles.detail}>Deadline: {formatDateTime(share.otherDeadline)}</Text>
            <Text style={styles.detail}>Min persons: {share.otherMinPersons || '-'}</Text>
          </>
        )}
      </View>

      <Text style={styles.total}>
        Total: {formatCurrency(share.totalAmount)} | Split: {share.splitType}
        {share.splitType === 'custom' && Number(share.hostContribution) > 0 ? ` | Host: ${formatCurrency(share.hostContribution)}` : ''}
      </Text>

      {isMember && !isCancelled && calculatedShare > 0 && (
        <Text style={styles.ownShare}>Your share: {formatCurrency(calculatedShare)}</Text>
      )}

      {isCancelled && !isHost && (
        <View style={[styles.statePanel, styles.cancelledPanel]}>
          <Text style={styles.stateTitle}>Booking cancelled</Text>
          <Text style={styles.stateText}>
            {canRequestAgain ? 'A spot is available. You can request this share again.' : 'This share will stay here until its deadline.'}
          </Text>
        </View>
      )}

      {isRejected && !isHost && (
        <View style={[styles.statePanel, styles.rejectedPanel]}>
          <Text style={styles.stateTitle}>Request not accepted</Text>
          <Text style={styles.stateText}>
            {currentRejection?.reason || 'The host could not accept your request.'}
            {canRequestAgain ? ' You can request again now.' : ''}
          </Text>
        </View>
      )}

      {isHost && share.pendingRequests?.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Pending Requests</Text>
          {share.pendingRequests.map((pending) => (
            <View key={getId(pending)} style={styles.requestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{pending.name || 'Classmate'}</Text>
                <Text style={styles.memberMeta}>{pending.email || 'Pending approval'}</Text>
              </View>
              <AppButton title="Approve" variant="success" onPress={() => onApprove?.(share._id, getId(pending))} style={styles.miniButton} />
              <AppButton title="Reject" variant="danger" onPress={() => onReject?.(share._id, getId(pending))} style={styles.miniButton} />
            </View>
          ))}
        </View>
      )}

      {isHost && members.length > 1 && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Members</Text>
          {members.filter((member) => getId(member.user) !== currentUserId).map((member) => (
            <Text key={getId(member.user)} style={styles.memberMeta}>
              {member.user?.name || 'Member'} | {member.status} | {formatCurrency(member.share || 0)}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {!isHost && share.status === 'open' && typeof onCancel === 'function' && (isPending || (isMember && !isCancelled)) && (
          <AppButton title={cancellingId === share._id ? 'Cancelling...' : 'Cancel Booking'} variant="danger" onPress={() => onCancel?.(share._id)} />
        )}
        {canRequestAgain && (
          <AppButton
            title={joiningId === share._id ? 'Requesting...' : retryLabel}
            variant="success"
            onPress={() => onJoin?.(share._id)}
            disabled={joiningId === share._id}
          />
        )}
        {!isHost && share.status === 'open' && hasJoinAction && !isPending && !isMember && !isRejected && (
          <AppButton title={joiningId === share._id ? 'Requesting...' : ctaLabel} onPress={() => onJoin?.(share._id)} disabled={disabled || joiningId === share._id} />
        )}
        {isHost && (
          <>
            {onUpdate && <AppButton title="Update" variant="outline" onPress={() => onUpdate(share)} />}
            {onFinalize && share.status === 'open' && <AppButton title="Finalize" variant="success" onPress={() => onFinalize(share._id)} />}
            {onDelete && <AppButton title="Delete" variant="danger" onPress={confirmDelete} />}
          </>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    marginTop: 3,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  details: {
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    borderRadius: radius.md,
    backgroundColor: 'rgba(2,6,23,0.44)',
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  detail: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  total: {
    color: colors.text,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  ownShare: {
    color: '#bbf7d0',
    marginTop: spacing.sm,
    fontWeight: '800',
  },
  statePanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cancelledPanel: {
    borderColor: 'rgba(239,68,68,0.38)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  rejectedPanel: {
    borderColor: 'rgba(249,115,22,0.38)',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  stateTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  stateText: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberName: {
    color: colors.text,
    fontWeight: '700',
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  miniButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
});

export default ShareCard;
