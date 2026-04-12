import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, InfoCard, StatCard } from '../../components/Card';
import LoadingDots from '../../components/LoadingDots';
import {
  Users,
  User,
  Clock,
  MapPin,
  ClipboardList,
  FileText,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import {
  GetAdminDashboard,
  GetStudentLoginLogs,
} from '../../../wailsjs/go/backend/App';
import { DashboardStats, LoginLog } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';
const DASHBOARD_POLL_INTERVAL_MS = 10000;

function DashboardOverview() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
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
    today_teacher_logins: 0,
    today_admin_logins: 0,
    last_teacher_login_at: undefined,
    last_teacher_pc_number: undefined,
    last_admin_login_at: undefined,
    last_admin_pc_number: undefined,
    today_new_users: 0,
    pending_feedback: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetAdminDashboard();
        setStats(data);
        setError('');

        if (user?.id) {
          try {
            const loginLogs = await GetStudentLoginLogs(user.id);
            if (loginLogs && loginLogs.length > 0) {
              // Prefer the latest completed session for "Last Login".
              const completedLogs = loginLogs.filter((log) => !!log.logout_time);
              const selectedLog = completedLogs.length > 0 ? completedLogs[0] : loginLogs[0];
              setLastLogin(selectedLog);
            } else {
              setLastLogin(null);
            }
          } catch (error) {
            console.error('Failed to load admin last login:', error);
            setLastLogin(null);
          }
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        setError('Unable to load dashboard data from server.');
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    const refreshInterval = setInterval(loadStats, DASHBOARD_POLL_INTERVAL_MS);
    window.addEventListener('focus', loadStats);
    window.addEventListener(AUTH_STATUS_CHANGED_EVENT, loadStats);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', loadStats);
      window.removeEventListener(AUTH_STATUS_CHANGED_EVENT, loadStats);
    };
  }, [user?.id]);

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

  const parseSqlDateTimeLocal = (value?: string): Date | null => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || '0');

    const localDate = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  };

  const formatSqlDateTimeLocal = (value?: string): string => {
    const parsed = parseSqlDateTimeLocal(value);
    if (!parsed) return 'N/A';
    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div>
      {error && (
        <div className="mb-6 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || user?.name}!</h2>
        <p className="text-sm text-gray-500">Here's what's going on today.</p>
      </div>
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <Card className="h-fit">
            <CardHeader title="Login Information" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                  icon={<Clock className="h-6 w-6" />}
                  label="Last Login"
                  value={formatSqlDateTimeLocal(lastLogin?.login_time)}
                  iconColor="blue"
                />
                <InfoCard
                  icon={<MapPin className="h-6 w-6" />}
                  label="Last PC Used"
                  value={lastLogin?.pc_number || 'Unknown'}
                  iconColor="purple"
                />
              </div>
            </CardBody>
          </Card>
        </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
                            <Users className="h-5 w-5 text-success-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Teacher Logins</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.today_teacher_logins}</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary-600" />
                          </span>
                          <span className="text-sm font-medium text-gray-800">Admin Logins</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums">{stats.today_admin_logins}</span>
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

        <div className="lg:border-l lg:border-gray-300 lg:pl-6 space-y-6">
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

        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
