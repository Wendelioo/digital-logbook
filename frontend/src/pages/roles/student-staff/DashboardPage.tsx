import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard, InfoCard } from '../../../components/Card';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  LogIn,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Send,
  ClipboardCheck,
} from 'lucide-react';
import { GetWorkingStudentDashboard, GetStudentDashboard, GetStudentOpenAttendanceSessions, GetStudentLoginLogs, StudentTimeIn, GetPendingFeedback, GetConfirmedFeedback } from '../../../../wailsjs/go/backend/App';
import { GetRejectedFeedback, GetFeedback } from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { backend } from '../../../../wailsjs/go/models';
import { DashboardStats } from './types';

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

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';
const DASHBOARD_POLL_INTERVAL_MS = 10000;

function DashboardOverview() {
  const { user } = useAuth();
  const { toast } = useAppUi();
  const [stats, setStats] = useState<DashboardStats>({
    students_registered: 0,
    pending_feedback: 0,
    issue_reports: 0,
    no_issue_reports: 0,
    forwarded_reports: 0,
    today_registrations: 0,
    active_students_now: 0,
    pending_registrations: 0,
  });
  const [todayReportOverview, setTodayReportOverview] = useState({
    issue: 0,
    verified: 0,
    rejected: 0,
    forwarded: 0,
  });
  const [studentDashboard, setStudentDashboard] = useState<backend.StudentDashboard>(new backend.StudentDashboard({
    attendance: [],
    attendance_rate: 0,
    currently_logged_in: false,
    enrolled_classes: 0
  }));
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const parseSessionDateTime = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  const isTodayDate = (value?: string): boolean => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const now = new Date();
    return (
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth() &&
      parsed.getDate() === now.getDate()
    );
  };

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
      const refreshedDashboard = await GetStudentDashboard(user.id);
      setStudentDashboard(refreshedDashboard);
      const next = await GetStudentOpenAttendanceSessions(user.id);
      setOpenSessions(next || []);
    } catch (error: any) {
      console.error('Failed to time in:', error);
      toast(error?.message || 'Failed to time in. Please try again.', 'error');
    } finally {
      setTimingInSession(null);
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [data, pendingFeedbackList, confirmedFeedbackList, rejectedFeedbackList, forwardedFeedbackList] = await Promise.all([
          GetWorkingStudentDashboard(),
          GetPendingFeedback(),
          GetConfirmedFeedback(),
          GetRejectedFeedback(),
          GetFeedback(),
        ]);
        const pendingIssues = (pendingFeedbackList || []).filter((feedback) => !feedback.verified_at);
        const pendingFeedbackCount = pendingIssues.length;
        setTodayReportOverview({
          issue: pendingIssues.filter((feedback) => isTodayDate(feedback.date_submitted)).length,
          verified: (confirmedFeedbackList || []).filter((feedback) => isTodayDate(feedback.date_submitted)).length,
          rejected: (rejectedFeedbackList || []).filter((feedback) => isTodayDate(feedback.date_submitted)).length,
          forwarded: (forwardedFeedbackList || []).filter((feedback) => isTodayDate(feedback.date_submitted)).length,
        });
        setStats({
          ...data,
          pending_feedback: pendingFeedbackCount,
          issue_reports: data.issue_reports ?? 0,
          no_issue_reports: data.no_issue_reports ?? 0,
          forwarded_reports: data.forwarded_reports ?? 0,
        });
        setError('');

        if (user?.id) {
          try {
            const studentData = await GetStudentDashboard(user.id);
            setStudentDashboard(studentData);
          } catch {
            // Not enrolled or not a student — leave attendance empty
          }
          try {
            const loginLogs = await GetStudentLoginLogs(user.id);
            if (loginLogs && loginLogs.length > 0) {
              const completedLogs = loginLogs.filter((log) => !!log.logout_time);
              const selectedLog = completedLogs.length > 0 ? completedLogs[0] : null;
              setLastLogin(selectedLog);
            } else {
              setLastLogin(null);
            }
          } catch {
            setLastLogin(null);
          }
          try {
            const sessions = await GetStudentOpenAttendanceSessions(user.id);
            setOpenSessions(sessions || []);
          } catch {
            setOpenSessions([]);
          }
        }

      } catch (error) {
        console.error('Failed to load working student dashboard:', error);
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

  useEffect(() => {
    if (openSessions.length === 0) return;
    const t = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(t);
  }, [openSessions.length]);

  const attendanceList = studentDashboard?.attendance || [];
  const recentAttendance = attendanceList.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

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
                  value={studentDashboard.currently_logged_in ? (studentDashboard.current_pc_number || '') : 'Not Logged In'}
                  iconColor={studentDashboard.currently_logged_in ? 'green' : 'yellow'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="sm:col-span-2 xl:col-span-4">
              <CardHeader title="Student Stats" />
              <CardBody className="p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 text-primary-700 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary-800">Students Registered</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-primary-700">{stats.students_registered}</span>
                  </div>
                  <div className="rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="h-4 w-4 text-success-700 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-success-800">Pending Registration</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-success-700">{stats.pending_registrations}</span>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 text-green-700 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-800">Students Online</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold text-green-700">{stats.active_students_now}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
        <div className="space-y-6 lg:border-l lg:border-gray-300 lg:pl-6">
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

          <Card className="h-fit">
            <CardHeader title="Feedback Reports (Today)" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="equipment-reports?tab=issues"
                  className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-warning-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-warning-800">Issue Reports</span>
                  </div>
                  <span className="text-xl font-bold text-warning-700">{todayReportOverview.issue}</span>
                </Link>

                <Link
                  to="equipment-reports?tab=ready_to_forward"
                  className="rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-success-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-success-800">Verified Reports</span>
                  </div>
                  <span className="text-xl font-bold text-success-700">{todayReportOverview.verified}</span>
                </Link>

                <Link
                  to="equipment-reports?tab=rejected"
                  className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-danger-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-danger-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-danger-800">Rejected Reports</span>
                  </div>
                  <span className="text-xl font-bold text-danger-700">{todayReportOverview.rejected}</span>
                </Link>

                <div className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary-800">Forwarded Reports</span>
                  </div>
                  <span className="text-xl font-bold text-primary-700">{todayReportOverview.forwarded}</span>
                </div>
              </div>
            </CardBody>
          </Card>

        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Summary — shown for all; empty if not enrolled in IT classes */}
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

        <div className="lg:border-l lg:border-gray-300 lg:pl-6 space-y-6">
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
                  to="equipment-reports"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Feedback</h3>
                      {stats.pending_feedback > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-warning-100 text-warning-800">
                          {stats.pending_feedback}
                        </span>
                      )}
                    </div>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Review student issue reports.</p>
                  </div>
                </Link>

                <Link
                  to="login-history"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
                >
                  <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">View Login History</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">View your login and logout records.</p>
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
