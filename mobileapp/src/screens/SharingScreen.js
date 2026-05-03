import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PlusCircle } from 'lucide-react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ShareCard from '../components/ShareCard';
import ShareForm from '../components/ShareForm';
import { AppButton, AppModal, EmptyState, LoadingState, Message, Screen, SegmentTabs, Title } from '../components/ui';
import { spacing } from '../theme';
import { getId } from '../utils/id';

const isPast = (value) => value && new Date() > new Date(value);

const isShareExpired = (share) => {
  if (share.shareType === 'cab') return isPast(share.departureTime);
  if (share.shareType === 'food') return isPast(share.deadlineTime);
  return isPast(share.otherDeadline);
};

const isJoinClosed = (share) => {
  const joined = share.members?.filter((m) => m.status === 'joined').length || 0;
  if (share.shareType === 'cab') return isPast(share.bookingDeadline) || (share.maxPassengers && joined >= share.maxPassengers);
  if (share.shareType === 'food') return isPast(share.deadlineTime) || (share.maxPersons && joined >= share.maxPersons);
  return isPast(share.otherDeadline) || (share.otherMaxPersons && joined >= share.otherMaxPersons);
};

const SharingScreen = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [shares, setShares] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingShare, setEditingShare] = useState(null);

  const currentUserId = getId(user);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shares');
      setShares(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load shares.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket || !user) return undefined;
    const refresh = () => load();
    const events = ['share:updated', 'share:request', 'share:approved', 'share:rejected', 'share:cancelled', 'share:deleted'];
    events.forEach((event) => socket.on(event, refresh));
    return () => events.forEach((event) => socket.off(event, refresh));
  }, [socket, user, load]);

  const myShares = useMemo(() => shares.filter((share) => {
    const isHost = getId(share.host) === currentUserId;
    if (!isHost) return false;
    if (share.status === 'open' && isShareExpired(share)) return false;
    if (['closed', 'cancelled'].includes(share.status)) {
      const deadline = share.departureTime || share.deadlineTime || share.otherDeadline;
      if (deadline && (new Date() - new Date(deadline)) / 3600000 > 24) return false;
    }
    return true;
  }), [shares, currentUserId]);

  const availableShares = useMemo(() => shares.filter((share) => {
    const hostId = getId(share.host);
    if (hostId === currentUserId) return false;
    if (isJoinClosed(share)) return false;
    const isMember = share.members?.some((m) => getId(m.user) === currentUserId);
    const isPending = share.pendingRequests?.some((req) => getId(req) === currentUserId);
    return !isMember && !isPending;
  }), [shares, currentUserId]);

  const myRequestShares = useMemo(() => shares.filter((share) => {
    if (getId(share.host) === currentUserId || isShareExpired(share)) return false;
    const isMember = share.members?.some((m) => getId(m.user) === currentUserId);
    const isPending = share.pendingRequests?.some((req) => getId(req) === currentUserId);
    const isRejected = share.rejectedRequests?.some((req) => getId(req.user) === currentUserId);
    return isMember || isPending || isRejected;
  }), [shares, currentUserId]);

  const receivedShares = useMemo(() => shares.filter((share) => {
    if (getId(share.host) !== currentUserId || isShareExpired(share)) return false;
    return (share.pendingRequests?.length || 0) > 0 || (share.members?.length || 0) > 1;
  }), [shares, currentUserId]);

  const doAction = async (callback, success) => {
    setError('');
    setMessage('');
    try {
      await callback();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    }
  };

  const join = async (shareId) => {
    setJoiningId(shareId);
    await doAction(() => api.post(`/shares/${shareId}/join`), 'Join request submitted.');
    setJoiningId('');
  };

  const cancel = async (shareId) => {
    setCancellingId(shareId);
    await doAction(() => api.post(`/shares/${shareId}/cancel`), 'Booking cancelled successfully.');
    setCancellingId('');
  };

  const approve = (shareId, userId) => doAction(() => api.post(`/shares/${shareId}/approve`, { userId }), 'Member approved.');
  const reject = (shareId, userId) => doAction(() => api.post(`/shares/${shareId}/reject`, { userId }), 'Request rejected.');
  const finalize = (shareId) => doAction(() => api.post(`/shares/${shareId}/finalize`), 'Share marked as complete.');

  const deleteShare = (shareId) => {
    Alert.alert('Delete share', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => doAction(() => api.delete(`/shares/${shareId}`), 'Share deleted successfully.') },
    ]);
  };

  const renderShares = (items, emptyText, mode = 'browse') => {
    if (!items.length) return <EmptyState title={emptyText} subtitle="This space will stay compact until there is something useful to show." />;
    return items.map((share) => (
      <ShareCard
        key={share._id}
        share={share}
        currentUserId={currentUserId}
        onJoin={join}
        onCancel={cancel}
        onApprove={approve}
        onReject={reject}
        onUpdate={mode === 'host' ? setEditingShare : undefined}
        onDelete={mode === 'host' ? deleteShare : undefined}
        onFinalize={mode === 'host' ? finalize : undefined}
        joiningId={joiningId}
        cancellingId={cancellingId}
      />
    ));
  };

  if (loading) return <Screen><LoadingState title="Loading sharing..." /></Screen>;

  return (
    <Screen>
      <Title subtitle="Cab, food, and other expense splits in one place.">Sharing</Title>
      {!!message && <Message type="success">{message}</Message>}
      {!!error && <Message type="error">{error}</Message>}
      <AppButton title="Create Share" icon={PlusCircle} onPress={() => setCreateOpen(true)} style={{ marginBottom: spacing.md }} />
      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'available', label: 'Available' },
          { value: 'mine', label: 'My Sharing' },
          { value: 'requests', label: 'My Requests' },
          { value: 'received', label: 'Received' },
        ]}
      />
      {activeTab === 'available' && renderShares(availableShares, 'No available shares right now.')}
      {activeTab === 'mine' && renderShares(myShares, 'You have not created any shares yet.', 'host')}
      {activeTab === 'requests' && renderShares(myRequestShares, 'You have no share requests yet.')}
      {activeTab === 'received' && renderShares(receivedShares, 'No received requests yet.', 'host')}

      <AppModal visible={createOpen} title="Create Share" onClose={() => setCreateOpen(false)}>
        <ShareForm
          onSuccess={() => {
            setCreateOpen(false);
            setMessage('Share created successfully.');
            load();
          }}
        />
      </AppModal>
      <AppModal visible={!!editingShare} title="Update Share" onClose={() => setEditingShare(null)}>
        {editingShare && (
          <ShareForm
            mode="edit"
            initialData={editingShare}
            onSuccess={() => {
              setEditingShare(null);
              setMessage('Share updated successfully.');
              load();
            }}
          />
        )}
      </AppModal>
    </Screen>
  );
};

export default SharingScreen;
