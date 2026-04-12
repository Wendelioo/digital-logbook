import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GetNotifications, MarkNotificationRead, MarkAllNotificationsRead } from '../../wailsjs/go/backend/App';
import { useAuth } from './AuthContext';

export interface BackendNotification {
  id: number;
  user_id: number;
  category: string;
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'success';
  is_read: boolean;
  reference_type?: string;
  reference_id?: number;
  created_at: string;
  read_at?: string;
}

interface NotificationContextType {
  notifications: BackendNotification[];
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 15_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const summary = await GetNotifications(user.id, 0);
      setNotifications((summary.notifications || []) as BackendNotification[]);
      setUnreadCount(summary.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user?.id]);

  // Poll on interval and on window focus
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    window.addEventListener('focus', fetchNotifications);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [user?.id, fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    if (!user?.id) return;
    try {
      await MarkNotificationRead(id, user.id);
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [user?.id, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await MarkAllNotificationsRead(user.id);
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [user?.id, fetchNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      refresh: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
