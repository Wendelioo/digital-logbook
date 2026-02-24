import React, { useEffect, useMemo, useState } from 'react';
import { Bell, AlertCircle, CheckCircle2, Info } from 'lucide-react';

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

function ToneIcon({ tone }: { tone: DashboardNotificationItem['tone'] }) {
  if (tone === 'warning') {
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  }

  if (tone === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }

  return <Info className="h-4 w-4 text-primary-600" />;
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
          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-2 pr-3">
              <span className="mt-0.5">
                <ToneIcon tone={item.tone} />
              </span>
              <span className="text-sm text-gray-700">{item.message}</span>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{getRelativeTime(item.createdAt, now)}</span>
          </div>
        ))
      )}
    </div>
  );
}
