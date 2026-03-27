import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard } from '../../components/Card';
import LoadingDots from '../../components/LoadingDots';
import {
  Users,
  User,
  ClipboardList,
  FileText,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import {
  GetAdminDashboard
} from '../../../wailsjs/go/backend/App';
import { BackendDashboardNotifications } from '../../components/DashboardNotifications';
import { DashboardStats } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';

function DashboardOverview() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
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
    pending_feedback: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetAdminDashboard();
        setStats(data);
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
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  const totalUserAccounts =
    stats.total_students + stats.total_teachers + stats.working_students;

  const isToday = (isoDate: string) => {
    const d = new Date(isoDate);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const todaysFeedback = notifications.filter(
    (notification) =>
      notification.category === 'feedback' &&
      isToday(notification.created_at)
  );

  const issueFeedbackCount = todaysFeedback.filter(
    (notification) => notification.tone === 'warning'
  ).length;

  const nonIssueFeedbackCount = todaysFeedback.filter(
    (notification) => notification.tone !== 'warning'
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || user?.name}!</h2>
        <p className="text-sm text-gray-500">Here's what's going on today.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h3>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="All User Accounts"
                value={totalUserAccounts}
                icon={<Users />}
                color="blue"
              />
              <StatCard
                title="Students"
                value={stats.total_students}
                icon={<Users />}
                color="blue"
              />
              <StatCard
                title="Teachers"
                value={stats.total_teachers}
                icon={<Users />}
                color="green"
              />
              <StatCard
                title="Working Students"
                value={stats.working_students}
                icon={<Users />}
                color="yellow"
              />
            </div>
          </div>

          <Card>
            <CardHeader title="Online Users" />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Students Online</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.students_logged_in}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
                            <User className="h-5 w-5 text-success-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Teachers Online</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.teachers_logged_in}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
                            <User className="h-5 w-5 text-warning-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Working Students Online</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.working_students_logged_in}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Today's Activity" />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Activity
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                            <ClipboardList className="h-5 w-5 text-primary-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Total Logins</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.today_logins}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-success-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">New Users</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.today_new_users}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-warning-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Recent Activity (24h)</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.recent_logins}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="md:border-l md:border-gray-300 md:pl-6 space-y-6">
          <Card className="h-fit">
            <CardHeader title="Notifications" />
            <CardBody>
              <BackendDashboardNotifications
                emptyMessage="No new notifications."
              />
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="space-y-2">
                <Link
                  to="users"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Manage Users</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Create or update student and teacher accounts.</p>
                  </div>
                </Link>

                <Link
                  to="logs"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">View Logs</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Monitor daily login and attendance activity.</p>
                  </div>
                </Link>

                <Link
                  to="reports"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Export Reports</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Generate logs and feedback report files.</p>
                  </div>
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Critical Alerts (Today)" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className={`p-3 rounded-lg border ${
                    nonIssueFeedbackCount > 0
                      ? 'bg-success-50 border-success-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {nonIssueFeedbackCount > 0 ? 'No Issue (All Working)' : 'No Issue Feedback'}
                    </span>
                    <span
                      className={`text-2xl font-bold ${
                        nonIssueFeedbackCount > 0 ? 'text-success-700' : 'text-gray-500'
                      }`}
                    >
                      {nonIssueFeedbackCount > 0 ? nonIssueFeedbackCount : '0'}
                    </span>
                  </div>
                </div>

                <Link
                  to="reports"
                  className="flex flex-col p-3 bg-warning-50 rounded-lg hover:bg-warning-100 border border-warning-200 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-800 mb-2">
                    Issue Feedback
                  </span>
                  <span className="text-2xl font-bold text-warning-700">
                    {issueFeedbackCount}
                  </span>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
