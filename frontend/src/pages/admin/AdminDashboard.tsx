import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard } from '../../components/Card';
import {
  Users,
  User,
  ClipboardList,
  FileText,
  UserPlus,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import {
  GetAdminDashboard
} from '../../../wailsjs/go/backend/App';
import DashboardNotifications, { DashboardNotificationItem } from '../../components/DashboardNotifications';
import { DashboardStats } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    total_teachers: 0,
    working_students: 0,
    recent_logins: 0,
    active_users_now: 0,
    students_logged_in: 0,
    teachers_logged_in: 0,
    working_students_logged_in: 0,
    today_logins: 0,
    today_new_users: 0,
    locked_accounts: 0,
    pending_feedback: 0
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
  const upsertNotification = (id: string, message: string, tone: DashboardNotificationItem['tone'] = 'info') => {
    setNotifications((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return [
        {
          id,
          message,
          createdAt: Date.now(),
          tone,
        },
        ...next,
      ].slice(0, 10);
    });
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetAdminDashboard();
        setStats(data);
        upsertNotification('admin-active-users', `Active users now: ${data.active_users_now}.`, 'info');
        upsertNotification(
          'admin-pending-feedback',
          data.pending_feedback > 0
            ? `${data.pending_feedback} feedback report(s) pending action.`
            : 'No pending feedback reports.',
          data.pending_feedback > 0 ? 'warning' : 'success'
        );
        upsertNotification(
          'admin-locked-accounts',
          data.locked_accounts > 0
            ? `${data.locked_accounts} locked account(s) need review.`
            : 'No locked accounts awaiting review.',
          data.locked_accounts > 0 ? 'warning' : 'success'
        );
        upsertNotification('admin-today-logins', `Today's logins: ${data.today_logins}.`, 'info');

        const previous = previousStatsRef.current;
        if (!previous) {
          pushNotification('Admin dashboard is connected and receiving live updates.', 'success');
        } else {
          if (data.locked_accounts !== previous.locked_accounts) {
            if (data.locked_accounts > previous.locked_accounts) {
              pushNotification(`${data.locked_accounts} locked account(s) now require review.`, 'warning');
            } else {
              pushNotification('Locked account count decreased after review.', 'success');
            }
          }

          if (data.pending_feedback !== previous.pending_feedback) {
            if (data.pending_feedback > previous.pending_feedback) {
              pushNotification(`${data.pending_feedback} feedback report(s) are pending action.`, 'warning');
            } else {
              pushNotification('Pending feedback queue has been reduced.', 'success');
            }
          }

          if (data.active_users_now !== previous.active_users_now) {
            pushNotification(`Active users changed to ${data.active_users_now}.`, 'info');
          }
        }

        previousStatsRef.current = data;
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Students"
              value={stats.total_students}
              icon={<Users className="h-6 w-6" />}
              color="blue"
            />
            <StatCard
              title="Teachers"
              value={stats.total_teachers}
              icon={<Users className="h-6 w-6" />}
              color="green"
            />
            <StatCard
              title="Working Students"
              value={stats.working_students}
              icon={<Users className="h-6 w-6" />}
              color="indigo"
            />
          </div>

          <Card>
            <CardHeader title="Online Users" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Students Online</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.students_logged_in}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Teachers Online</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.teachers_logged_in}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-indigo-50 rounded-lg">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Working Students Online</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.working_students_logged_in}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Today's Activity" />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <ClipboardList className="h-5 w-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Total Logins</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.today_logins}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <UserPlus className="h-5 w-5 text-green-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">New Users</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.today_new_users}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <BarChart3 className="h-5 w-5 text-purple-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Recent Activity (24h)</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{stats.recent_logins}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Critical Alerts" />
              <CardBody>
                <div className="space-y-4">
                  <Link 
                    to="users"
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Locked Accounts</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">{stats.locked_accounts}</span>
                  </Link>
                  <Link
                    to="reports"
                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-yellow-600 mr-3" />
                      <span className="text-sm font-medium text-gray-700">Pending Feedback</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-600">{stats.pending_feedback}</span>
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                <Link
                  to="users"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary-50 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words">Manage Users</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-snug break-words">Create or update student and teacher accounts.</p>
                  </div>
                </Link>
                <Link
                  to="logs"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary-50 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words">View Logs</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-snug break-words">Monitor daily login and attendance activity.</p>
                  </div>
                </Link>
                <Link
                  to="reports"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words">Export Reports</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-snug break-words">Generate logs and feedback report files.</p>
                  </div>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="md:border-l md:border-gray-300 md:pl-6">
          <Card className="h-fit">
            <CardHeader title="Notifications" />
            <CardBody>
              <DashboardNotifications
                items={notifications}
                emptyMessage="No new admin alerts."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
