import { create } from 'zustand';
import { api } from '../services/api';
import { logger } from '../lib/logger';

export interface AppNotification {
  id: string;
  notificationType: string;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;

  fetchNotifications(): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  async fetchNotifications() {
    set({ loading: true });
    try {
      const notifications = await api.get<AppNotification[]>('/api/notifications?limit=20');
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      set({ notifications, unreadCount, loading: false });
    } catch (err) {
      logger.error('notificationStore.fetchNotifications failed', { err });
      set({ loading: false });
    }
  },

  async markRead(id) {
    try {
      const updated = await api.patch<AppNotification>(`/api/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? updated : n)),
        unreadCount: Math.max(0, s.unreadCount - (updated.isRead && !s.notifications.find((n) => n.id === id)?.isRead ? 1 : 0)),
      }));
      // Recount from store state for accuracy
      set((s) => ({ unreadCount: s.notifications.filter((n) => !n.isRead).length }));
    } catch (err) {
      logger.error('notificationStore.markRead failed', { id, err });
    }
  },

  async markAllRead() {
    try {
      await api.post('/api/notifications/read-all');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      logger.error('notificationStore.markAllRead failed', { err });
    }
  },
}));
