import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { AppButton, Card, EmptyState, LoadingState, Screen, Title } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime } from '../utils/format';

const iconForType = (type) => {
  switch (type) {
    case 'minimum_not_met':
      return '!';
    case 'order_cancelled':
      return 'x';
    case 'request_approved':
      return 'ok';
    case 'request_rejected':
      return 'no';
    case 'share_full':
      return 'lock';
    case 'user_warning':
      return 'warn';
    default:
      return 'note';
  }
};

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { markAllReadLocal, decrementUnread } = useNotifications();
  const { pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id) => {
    const target = notifications.find((n) => n._id === id);
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    if (target && !target.read) decrementUnread();
  };

  const markAllRead = async () => {
    await api.put('/notifications/mark-all-read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllReadLocal();
  };

  const deleteOne = async (id) => {
    const target = notifications.find((n) => n._id === id);
    await api.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (target && !target.read) decrementUnread();
  };

  const clearAll = async () => {
    await api.delete('/notifications/clear-all');
    setNotifications([]);
    markAllReadLocal();
    pushToast('All notifications cleared.', { type: 'success' });
  };

  if (loading) return <Screen><LoadingState title="Loading notifications..." /></Screen>;

  return (
    <Screen>
      <Title>Notifications</Title>
      <View style={styles.actions}>
        {notifications.some((n) => !n.read) && <AppButton title="Mark All Read" onPress={markAllRead} style={{ flex: 1 }} />}
        {notifications.length > 0 && <AppButton title="Clear All" variant="danger" onPress={clearAll} style={{ flex: 1 }} />}
      </View>
      {notifications.length ? notifications.map((notification) => (
        <Card key={notification._id} style={[styles.card, !notification.read && styles.unread]}>
          <View style={styles.notificationRow}>
            <View style={styles.icon}><Text style={styles.iconText}>{iconForType(notification.type)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{notification.title}</Text>
              <Text style={styles.message}>{notification.message}</Text>
              <Text style={styles.date}>{formatDateTime(notification.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            {!notification.read && <AppButton title="Read" variant="outline" onPress={() => markRead(notification._id)} style={{ flex: 1 }} />}
            <AppButton title="Delete" variant="danger" onPress={() => deleteOne(notification._id)} style={{ flex: 1 }} />
          </View>
        </Card>
      )) : <EmptyState title="No notifications yet." />}
    </Screen>
  );
};

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  unread: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(29,78,216,0.12)',
  },
  notificationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  message: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  date: {
    color: colors.faint,
    fontSize: 12,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

export default NotificationsScreen;

