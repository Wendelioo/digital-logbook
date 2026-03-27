import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, type BackendNotification } from '../contexts/NotificationContext';

export interface DashboardNotificationItem {
  id: string;
  message: string;
  createdAt: number;
  tone?: 'info' | 'warning' | 'success';
}

interface DashboardNotificationsProps {
  items: DashboardNotificationItem[];
  emptyMessage: string;
}

function getRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (seconds < 10) return 'Now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardNotifications({ items, emptyMessage }: DashboardNotificationsProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const visibleItems = useMemo(() => items.slice(0, 5), [items]);

  return (
    <div className="space-y-3">
      {visibleItems.length === 0 ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-primary-600 mr-3" />
            <span className="text-sm text-gray-700">{emptyMessage}</span>
          </div>
          <span className="text-xs text-gray-500">Now</span>
        </div>
      ) : (
        visibleItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="flex-1 pr-3">
              <span className="text-sm text-gray-800">{item.message}</span>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {getRelativeTime(item.createdAt, now)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

interface BackendDashboardNotificationsProps {
  category?: string;
  emptyMessage: string;
}

export function BackendDashboardNotifications({ category, emptyMessage }: BackendDashboardNotificationsProps) {
  const { notifications } = useNotifications();

  const filtered = category
    ? notifications.filter(n => n.category === category)
    : notifications;

  const items: DashboardNotificationItem[] = filtered.map(n => ({
    id: String(n.id),
    message: n.message,
    createdAt: new Date(n.created_at).getTime(),
    tone: n.tone as DashboardNotificationItem['tone'],
  }));

  return <DashboardNotifications items={items} emptyMessage={emptyMessage} />;
}
