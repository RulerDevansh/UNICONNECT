import { useEffect, useState } from 'react';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { markAllReadLocal, decrementUnread } = useNotifications();

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      const target = notifications.find((n) => n._id === id);
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map((n) => (n._id === id ? { ...n, read: true } : n)));
      if (target && !target.read) {
        decrementUnread();
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      markAllReadLocal();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const target = notifications.find((n) => n._id === id);
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter((n) => n._id !== id));
      if (target && !target.read) {
        decrementUnread();
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      markAllReadLocal();
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'minimum_not_met':
        return '❌';
      case 'order_cancelled':
        return '🚫';
      case 'request_approved':
        return '✅';
      case 'request_rejected':
        return '⛔';
      case 'share_full':
        return '🔒';
      default:
        return '📢';
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-slate-400">Loading notifications...</p>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white">Notifications</h1>
        <div className="flex gap-3">
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary/80"
            >
              Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="rounded-full bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/30"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-slate-400">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`rounded-2xl border p-4 transition hover:border-slate-700 ${
                notification.read
                  ? 'border-slate-800 bg-slate-900/40'
                  : 'border-brand-primary/30 bg-brand-primary/5'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{notification.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification._id)}
                      className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification._id)}
                    className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/30"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default Notifications;
