import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard } from '../../components/Card';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { GetWorkingStudentDashboard } from '../../../wailsjs/go/main/App';
import DashboardNotifications, { DashboardNotificationItem } from '../../components/DashboardNotifications';
import { DashboardStats } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    students_registered: 0,
    pending_feedback: 0,
    today_registrations: 0,
    active_students_now: 0
  });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const previousStatsRef = useRef<DashboardStats | null>(null);

  const pushNotification = (message: string, tone: DashboardNotificationItem['tone'] = 'info') => {
    setNotifications((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        message,
        createdAt: Date.now(),
        tone,
      },
      ...prev,
    ].slice(0, 10));
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetWorkingStudentDashboard();
        setStats(data);

        const previous = previousStatsRef.current;
        if (!previous) {
          pushNotification('Working-student dashboard is connected and receiving live updates.', 'success');
        } else {
          if (data.pending_feedback !== previous.pending_feedback) {
            if (data.pending_feedback > previous.pending_feedback) {
              pushNotification(`${data.pending_feedback} feedback report(s) are waiting for review.`, 'warning');
            } else {
              pushNotification('Pending feedback queue has been reduced.', 'success');
            }
          }

          if (data.today_registrations !== previous.today_registrations) {
            pushNotification(`Today's registrations changed to ${data.today_registrations}.`, 'info');
          }

          if (data.active_students_now !== previous.active_students_now) {
            pushNotification(`Students online changed to ${data.active_students_now}.`, 'info');
          }
        }

        previousStatsRef.current = data;
      } catch (error) {
        console.error('Failed to load working student dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    const refreshInterval = setInterval(loadStats, 10000);
    window.addEventListener('focus', loadStats);
    window.addEventListener(AUTH_STATUS_CHANGED_EVENT, loadStats);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', loadStats);
      window.removeEventListener(AUTH_STATUS_CHANGED_EVENT, loadStats);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
        {/* Stats Cards */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Students Registered"
              value={stats.students_registered}
              icon={<Users className="h-6 w-6" />}
              color="blue"
            />
            <StatCard
              title="Pending Feedback"
              value={stats.pending_feedback}
              icon={<AlertCircle className="h-6 w-6" />}
              color="yellow"
            />
            <StatCard
              title="Active Students Now"
              value={stats.active_students_now}
              icon={<UserCheck className="h-6 w-6" />}
              color="green"
            />
          </div>

          {/* Today's Activity */}
          <Card>
            <CardHeader title="Today's Activity" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">New Registrations</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.today_registrations}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Students Online</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active_students_now}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Link
              to="manage-users"
              className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Users className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Student Management</h3>
              </div>
            </Link>
            <Link
              to="equipment-reports"
              className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Equipment Reports</h3>
                <p className="text-sm text-gray-500">Review student issue reports</p>
                {stats.pending_feedback > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-2">
                    {stats.pending_feedback}
                  </span>
                )}
              </div>
            </Link>
            <Link
              to="login-history"
              className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">View Login History</h3>
                <p className="text-sm text-gray-500">View your login and logout records</p>
              </div>
            </Link>
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader title="Notifications" />
          <CardBody>
            <DashboardNotifications
              items={notifications}
              emptyMessage="No new working-student alerts."
            />
          </CardBody>
        </Card>
      </div>

    </div>
  );
}

export default DashboardOverview;
