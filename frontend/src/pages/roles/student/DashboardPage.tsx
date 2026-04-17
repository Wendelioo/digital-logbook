import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, InfoCard, StatCard } from '../../../components/Card';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import {
  Clock,
  LogIn,
  MapPin,
  Library,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  GetStudentDashboard,
  GetStudentLoginLogs,
  GetStudentOpenAttendanceSessions,
  StudentTimeIn,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { backend } from '../../../../wailsjs/go/models';
import { StudentDashboardData, LoginLog } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';
const DASHBOARD_POLL_INTERVAL_MS = 10000;

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: string;
  class_duration_minutes?: number;
  grace_period_minutes?: number;
  opened_at?: string;
  paused_at?: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
}

function DashboardOverview() {
  const SESSION_POLL_INTERVAL_MS = 8000;
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const { toast } = useAppUi();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData>(new backend.StudentDashboard({
    attendance: [],
    today_log: undefined
  }));
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  const parseSessionDateTime = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

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
    if (!parsed) return '';
    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRemaining = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getExpectedTimeInStatus = (session?: AttendanceSession, referenceTimeMs?: number): 'present' | 'late' => {
    const openedAt = parseSessionDateTime(session?.opened_at);
    if (!openedAt) return 'present';

    const graceMinutes = Math.max(0, session?.grace_period_minutes || 0);
    const lateCutoff = openedAt.getTime() + graceMinutes * 60 * 1000;
    const nowMs = referenceTimeMs ?? Date.now();
    return nowMs >= lateCutoff ? 'late' : 'present';
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const data = await GetStudentDashboard(user.id);
        setDashboardData(data);
        setError('');

        // Fetch last login log
        try {
          const loginLogs = await GetStudentLoginLogs(user.id);
          if (loginLogs && loginLogs.length > 0) {
            // Prefer the latest completed session as "Last Login".
            const completedLogs = loginLogs.filter((log) => !!log.logout_time);
            const selectedLog = completedLogs.length > 0 ? completedLogs[0] : null;
            setLastLogin(selectedLog);
          } else {
            setLastLogin(null);
          }
        } catch (error) {
          console.error('Failed to load last login:', error);
        }

        let sessions: AttendanceSession[] = [];
        try {
          const fetchedSessions = await GetStudentOpenAttendanceSessions(user.id);
          const normalizedSessions = fetchedSessions || [];
          setOpenSessions(normalizedSessions);
          sessions = normalizedSessions;
        } catch (error) {
          console.error('Failed to load open attendance sessions:', error);
        }
      } catch (error) {
        console.error('Failed to load student dashboard:', error);
        setError('Unable to load dashboard data from server.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Auto-refresh dashboard data periodically.
    const refreshInterval = setInterval(loadDashboard, DASHBOARD_POLL_INTERVAL_MS);
    window.addEventListener('focus', loadDashboard);
    window.addEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', loadDashboard);
      window.removeEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);
    };
  }, [user?.id, DASHBOARD_POLL_INTERVAL_MS]);

  // Poll open attendance sessions more frequently so newly opened sessions
  // show up in the "Attendance Today" card with less delay.
  useEffect(() => {
    if (!user?.id) return;

    const pollOpenSessions = async () => {
      try {
        const sessions = await GetStudentOpenAttendanceSessions(user.id);
        setOpenSessions(sessions || []);
      } catch (error) {
        console.error('Failed to refresh open attendance sessions:', error);
      }
    };

    const interval = setInterval(pollOpenSessions, SESSION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id, SESSION_POLL_INTERVAL_MS]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(ticker);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  // Attendance Summary in this UI shows only "Recent Records" (per design).
  const recentAttendance = (dashboardData.attendance || []).slice(0, 5);

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;

    const targetSession = openSessions.find((session) => session.session_id === sessionId);
    const expectedStatus = getExpectedTimeInStatus(targetSession);

    setTimingInSession(sessionId);
    try {
      await StudentTimeIn(sessionId, user.id);
      toast(
        expectedStatus === 'late' ? 'Time In recorded successfully as Late.' : 'Time In recorded successfully as Present.',
        'success'
      );

      // Refresh notifications so the bell icon picks up the backend-created notification
      refreshNotifications();

      const refreshedDashboard = await GetStudentDashboard(user.id);
      setDashboardData(refreshedDashboard);
      const sessions = await GetStudentOpenAttendanceSessions(user.id);
      setOpenSessions(sessions || []);
    } catch (error: any) {
      console.error('Failed to time in:', error);
      toast(error?.message || 'Failed to time in. Please try again.', 'error');
    } finally {
      setTimingInSession(null);
    }
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
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h3>
      </div>
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-fit">
            <CardHeader title="Login Information" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InfoCard
                  icon={<LogIn className="h-6 w-6" />}
                  label="Current PC Used"
                  value={dashboardData.currently_logged_in ? (dashboardData.current_pc_number || '') : 'Not Logged In'}
                  iconColor={dashboardData.currently_logged_in ? 'green' : 'yellow'}
                />
                <InfoCard
                  icon={<MapPin className="h-6 w-6" />}
                  label="Last PC Used"
                  value={lastLogin?.pc_number || ''}
                  iconColor="purple"
                />
                <InfoCard
                  icon={<Clock className="h-6 w-6" />}
                  label="Last Login"
                  value={formatSqlDateTimeLocal(lastLogin?.login_time)}
                  iconColor="blue"
                />
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title="Enrolled Classes"
              value={dashboardData.enrolled_classes || 0}
              icon={<Library />}
              color="blue"
            />
            <StatCard
              title="Archived Classes"
              value={dashboardData.archived_classes || 0}
              icon={<ArchiveIcon />}
              color="yellow"
            />
          </div>
        </div>
        <div className="lg:border-l lg:border-gray-300 lg:pl-6">
          <Card className="h-fit">
            <CardHeader title="Attendance Today" />
            <CardBody>
            {openSessions.length > 0 ? (
              <div className="space-y-4">
                {openSessions.map((session) => {
                  const openedAt = parseSessionDateTime(session.opened_at);
                  const pausedAt = parseSessionDateTime(session.paused_at);
                  const effectiveNow = pausedAt ? pausedAt.getTime() : nowTimestamp;
                  const classMinutes = Math.max(0, session.class_duration_minutes || 0);
                  const graceMinutes = Math.max(0, session.grace_period_minutes || 0);
                  const classDeadline = openedAt ? new Date(openedAt.getTime() + classMinutes * 60 * 1000) : null;
                  const graceDeadline = openedAt ? new Date(openedAt.getTime() + graceMinutes * 60 * 1000) : null;
                  const classRemaining = classDeadline ? Math.max(0, Math.floor((classDeadline.getTime() - effectiveNow) / 1000)) : 0;
                  const graceRemaining = graceDeadline ? Math.max(0, Math.floor((graceDeadline.getTime() - effectiveNow) / 1000)) : 0;
                  const expectedStatus = getExpectedTimeInStatus(session, effectiveNow);
                  const statusMessage =
                    classRemaining <= 0
                      ? 'Session ended. Time in no longer available—you will be marked Absent if you did not time in.'
                      : graceRemaining > 0
                        ? 'Time in now to be marked Present.'
                        : 'Grace period over. You can still time in—you will be marked Late.';

                  return (
                    <div
                      key={session.session_id}
                      className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">
                            {session.subject_code}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {session.subject_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {session.session_name || 'Attendance'} · EDP {session.edp_code || '—'}
                          </p>
                          {session.paused_at && (
                            <p className="text-[11px] text-warning-700 mt-1">Session is paused. Time In is temporarily disabled.</p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleTimeIn(session.session_id)}
                          variant="primary"
                          size="sm"
                          disabled={timingInSession === session.session_id || !!session.paused_at}
                          className="flex-shrink-0"
                        >
                          {timingInSession === session.session_id
                            ? 'Submitting...'
                            : session.paused_at
                              ? 'Paused'
                              : 'Time In'}
                        </Button>
                      </div>

                      {openedAt && (
                        <div className="pt-2 border-t border-gray-200/80 space-y-2">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-gray-500">Class remaining</span>
                            <span className="font-medium tabular-nums text-gray-700">
                              {formatRemaining(classRemaining)}
                            </span>
                            <span className="text-gray-500">Grace remaining</span>
                            <span className="font-medium tabular-nums text-gray-700">
                              {formatRemaining(graceRemaining)}
                            </span>
                          </div>
                          <p
                            className={`text-xs font-medium ${
                              expectedStatus === 'late' && graceRemaining <= 0 && classRemaining > 0
                                ? 'text-warning-700'
                                : classRemaining <= 0
                                  ? 'text-danger-700'
                                  : 'text-success-700'
                            }`}
                          >
                            {statusMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">
                No open attendance sessions for your classes.
              </p>
            )}
            </CardBody>
          </Card>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Recent Records" />
            <CardBody>
              {recentAttendance.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="overflow-x-auto">
                    <table className="attendance-records-table w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Course/Subject
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentAttendance.map((record, index) => {
                          const status = (record.status || '').trim() || '—';
                          const statusColor =
                            status.toLowerCase() === 'present'
                              ? 'text-success-700 bg-success-50'
                              : status.toLowerCase() === 'late'
                                ? 'text-warning-700 bg-warning-50'
                                : status.toLowerCase() === 'absent'
                                  ? 'text-danger-700 bg-danger-50'
                                  : 'text-gray-600 bg-gray-100';
                          const displayDate = record.date
                            ? (() => {
                                const d = new Date(record.date + 'T12:00:00');
                                return Number.isNaN(d.getTime()) ? record.date : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                              })()
                            : record.date;
                          const tooltip = [
                            record.time_in ? `Time in: ${record.time_in}` : '',
                            record.remarks && record.remarks.trim() ? `Remarks: ${record.remarks.trim()}` : '',
                          ]
                            .filter(Boolean)
                            .join('\n');

                          return (
                            <tr
                              key={`${record.class_id}-${record.date}-${index}`}
                              className="hover:bg-gray-50/60"
                              title={tooltip || undefined}
                            >
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <div className="font-medium">{record.subject_code}</div>
                                {record.subject_name ? (
                                  <div className="text-xs text-gray-500">{record.subject_name}</div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                {displayDate}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor}`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:border-l lg:border-gray-300 lg:pl-6">
          <Card className="h-fit">
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="space-y-2">
                <Link
                  to="attendance"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Attendance</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">View your attendance records.</p>
                  </div>
                </Link>

                <Link
                  to="classes"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Library className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">My Classes</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Check your enrolled class schedule.</p>
                  </div>
                </Link>

                <Link
                  to="feedback"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Feedback History</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Review submitted lab equipment reports.</p>
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
