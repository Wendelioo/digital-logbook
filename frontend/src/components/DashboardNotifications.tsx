import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, type BackendNotification } from '../contexts/NotificationContext';

export interface DashboardNotificationItem {
  id: string;
  title?: string;
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

  const toneAccent = (tone?: DashboardNotificationItem['tone']) => {
    switch (tone) {
      case 'success':
        return 'border-success-200';
      case 'warning':
        return 'border-warning-200';
      case 'info':
      default:
        return 'border-primary-200';
    }
  };

  return (
    <div className="space-y-3">
      {visibleItems.length === 0 ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
            className={`flex items-start justify-between p-3 bg-white rounded-xl border border-gray-200 border-l-4 ${toneAccent(item.tone)} shadow-sm`}
          >
            <div className="flex-1 pr-3">
              {item.title && (
                <p className="text-sm font-semibold text-gray-900">
                  {item.title}
                </p>
              )}
              <p
                className={`text-xs ${item.title ? 'text-gray-600 mt-0.5' : 'text-gray-800 font-medium'}`}
              >
                {item.message}
              </p>
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
    title: n.title,
    message: n.message,
    createdAt: new Date(n.created_at).getTime(),
    tone: n.tone as DashboardNotificationItem['tone'],
  }));

  return <DashboardNotifications items={items} emptyMessage={emptyMessage} />;
}
