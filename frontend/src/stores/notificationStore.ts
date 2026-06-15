import { create } from 'zustand';
import { api } from '../services/api';
import { logger } from '../lib/logger';

export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  href: string | null;
  group_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  fetchNotifications(): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  async fetchNotifications() {
    set({ loading: true, error: null });
    try {
      const notifications = await api.get<AppNotification[]>('/api/notifications?limit=50');
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount, loading: false });
    } catch (err) {
      logger.error('notificationStore.fetchNotifications failed', { err });
      set({ loading: false, error: 'Could not load notifications' });
    }
  },

  async markRead(id) {
    try {
      const updated = await api.patch<AppNotification>(`/api/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? updated : n)),
      }));
      set((s) => ({ unreadCount: s.notifications.filter((n) => !n.is_read).length }));
    } catch (err) {
      logger.error('notificationStore.markRead failed', { id, err });
    }
  },

  async markAllRead() {
    try {
      await api.post('/api/notifications/read-all');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      logger.error('notificationStore.markAllRead failed', { err });
    }
  },
}));
