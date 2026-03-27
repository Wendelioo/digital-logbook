import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard, InfoCard } from '../../components/Card';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import {
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  MapPin,
  Library,
  ClipboardCheck,
  MessageSquare,
  Archive,
} from 'lucide-react';
import {
  GetStudentDashboard,
  GetStudentLoginLogs,
  GetStudentOpenAttendanceSessions,
  StudentTimeIn,
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { backend } from '../../../wailsjs/go/models';
import { BackendDashboardNotifications } from '../../components/DashboardNotifications';
import { StudentDashboardData, LoginLog } from './types';

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
  const DASHBOARD_POLL_INTERVAL_MS = 30000;
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData>(new backend.StudentDashboard({
    attendance: [],
    today_log: undefined
  }));
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase();

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
      if (!user) return;

      try {
        const data = await GetStudentDashboard(user.id);
        setDashboardData(data);

        // Fetch last login log
        try {
          const loginLogs = await GetStudentLoginLogs(user.id);
          if (loginLogs && loginLogs.length > 0) {
            // Prefer the latest completed session as "Last Login".
            // Fallback to the newest login record when no completed session exists yet.
            const completedLogs = loginLogs.filter((log) => !!log.logout_time);
            const selectedLog = completedLogs.length > 0 ? completedLogs[0] : loginLogs[0];
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
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Auto-refresh dashboard data periodically.
    const refreshInterval = setInterval(() => {
      if (user) loadDashboard();
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => clearInterval(refreshInterval);
  }, [user, DASHBOARD_POLL_INTERVAL_MS]);

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

  const presentCount = (dashboardData.attendance || []).filter(a => normalizeStatus(a.status) === 'present').length;
  const absentCount = (dashboardData.attendance || []).filter(a => normalizeStatus(a.status) === 'absent').length;
  const lateCount = (dashboardData.attendance || []).filter(a => normalizeStatus(a.status) === 'late').length;
  const totalAttendance = dashboardData.attendance?.length || 0;
  const recentAttendance = (dashboardData.attendance || []).slice(0, 5);

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;

    const targetSession = openSessions.find((session) => session.session_id === sessionId);
    const expectedStatus = getExpectedTimeInStatus(targetSession);

    setTimingInSession(sessionId);
    try {
      await StudentTimeIn(sessionId, user.id);

      // Refresh notifications so the bell icon picks up the backend-created notification
      refreshNotifications();

      const refreshedDashboard = await GetStudentDashboard(user.id);
      setDashboardData(refreshedDashboard);
      const sessions = await GetStudentOpenAttendanceSessions(user.id);
      setOpenSessions(sessions || []);
    } catch (error: any) {
      console.error('Failed to time in:', error);
      alert(error?.message || 'Failed to time in. Please try again.');
    } finally {
      setTimingInSession(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || user?.name}!</h2>
        <p className="text-sm text-gray-500">Here's what's going on today.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Current PC Used"
              value={dashboardData.currently_logged_in ? (dashboardData.current_pc_number || 'Logged In') : 'Not Logged In'}
              icon={<LogIn className="h-6 w-6" />}
              color={dashboardData.currently_logged_in ? 'blue' : 'indigo'}
            />
            <StatCard
              title="Enrolled Classes"
              value={dashboardData.enrolled_classes || 0}
              icon={<Library className="h-6 w-6" />}
              color="purple"
            />
            <StatCard
              title="Archived Classes"
              value={dashboardData.archived_classes || 0}
              icon={<Archive className="h-6 w-6" />}
              color="orange"
            />
          </div>

          {lastLogin && (
            <Card>
              <CardHeader title="Login Information" />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoCard
                    icon={<Clock className="h-6 w-6" />}
                    label="Last Login"
                    value={formatSqlDateTimeLocal(lastLogin.login_time)}
                    iconColor="blue"
                  />
                  <InfoCard
                    icon={<MapPin className="h-6 w-6" />}
                    label="Last PC Used"
                    value={lastLogin.pc_number || 'Unknown'}
                    iconColor="purple"
                  />
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Attendance Summary" />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard
                  title="Present"
                  value={presentCount}
                  icon={<CheckCircle className="h-6 w-6" />}
                  color="green"
                />
                <StatCard
                  title="Absent"
                  value={absentCount}
                  icon={<XCircle className="h-6 w-6" />}
                  color="red"
                />
                <StatCard
                  title="Late"
                  value={lateCount}
                  icon={<Clock className="h-6 w-6" />}
                  color="yellow"
                />
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Records</span>
                  <span className="text-lg font-semibold text-gray-900">{totalAttendance}</span>
                </div>
              </div>

              {recentAttendance.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Recent Records</p>
                  <div className="space-y-3">
                    {recentAttendance.map((record, index) => {
                      const status = (record.status || '').trim() || '—';
                      const statusColor =
                        status.toLowerCase() === 'present'
                          ? 'text-emerald-700 bg-emerald-50'
                          : status.toLowerCase() === 'late'
                            ? 'text-amber-700 bg-amber-50'
                            : status.toLowerCase() === 'absent'
                              ? 'text-red-700 bg-red-50'
                              : 'text-gray-600 bg-gray-100';
                      const displayDate = record.date
                        ? (() => {
                            const d = new Date(record.date + 'T12:00:00');
                            return Number.isNaN(d.getTime()) ? record.date : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                          })()
                        : record.date;
                      return (
                        <div
                          key={`${record.class_id}-${record.date}-${index}`}
                          className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {record.subject_code}
                            </p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor}`}>
                              {status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                            <span className="text-gray-500">Date</span>
                            <span className="text-gray-700">{displayDate}</span>
                            <span className="text-gray-500">Time in</span>
                            <span className="text-gray-700 font-medium tabular-nums">
                              {record.time_in || '—'}
                            </span>
                          </div>
                          {record.remarks && record.remarks.trim() && (
                            <p className="text-xs text-gray-500 pt-0.5 border-t border-gray-200/80">
                              {record.remarks.trim()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                <Link
                  to="attendance"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-green-100 rounded-lg flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-green-600 transition-colors">Attendance</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">View your attendance records.</p>
                  </div>
                </Link>
                <Link
                  to="classes"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Library className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-purple-600 transition-colors">My Classes</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Check your enrolled class schedule.</p>
                  </div>
                </Link>
                <Link
                  to="feedback"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">Feedback History</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Review submitted lab equipment reports.</p>
                  </div>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 md:border-l md:border-gray-300 md:pl-6">
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
                              <p className="text-[11px] text-amber-700 mt-1">Session is paused. Time In is temporarily disabled.</p>
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
                                  ? 'text-amber-700'
                                  : classRemaining <= 0
                                    ? 'text-red-700'
                                    : 'text-emerald-700'
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

          <Card className="h-fit">
            <CardHeader title="Notifications" />
            <CardBody>
              <BackendDashboardNotifications
                category="attendance"
                emptyMessage="No new notifications."
              />
            </CardBody>
          </Card>

        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
