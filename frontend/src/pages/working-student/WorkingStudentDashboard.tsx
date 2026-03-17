import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard } from '../../components/Card';
import Button from '../../components/Button';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  ClipboardCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { GetWorkingStudentDashboard, GetStudentDashboard, GetStudentOpenAttendanceSessions, GetStudentLoginLogs, StudentTimeIn } from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { backend } from '../../../wailsjs/go/models';
import { BackendDashboardNotifications } from '../../components/DashboardNotifications';
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

function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    students_registered: 0,
    pending_feedback: 0,
    today_registrations: 0,
    active_students_now: 0,
    pending_registrations: 0,
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

  const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase();
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

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;
    setTimingInSession(sessionId);
    try {
      await StudentTimeIn(sessionId, user.id);
      const refreshedDashboard = await GetStudentDashboard(user.id);
      setStudentDashboard(refreshedDashboard);
      const next = await GetStudentOpenAttendanceSessions(user.id);
      setOpenSessions(next || []);
    } catch (error) {
      console.error('Failed to time in:', error);
    } finally {
      setTimingInSession(null);
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetWorkingStudentDashboard();
        setStats(data);

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
              const selectedLog = completedLogs.length > 0 ? completedLogs[0] : loginLogs[0];
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
  }, [user?.id]);

  useEffect(() => {
    if (openSessions.length === 0) return;
    const t = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(t);
  }, [openSessions.length]);

  const attendanceList = studentDashboard?.attendance || [];
  const presentCount = attendanceList.filter(a => normalizeStatus(a.status) === 'present').length;
  const absentCount = attendanceList.filter(a => normalizeStatus(a.status) === 'absent').length;
  const lateCount = attendanceList.filter(a => normalizeStatus(a.status) === 'late').length;
  const totalAttendance = attendanceList.length;
  const recentAttendance = attendanceList.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || user?.name}!</h2>
        <p className="text-sm text-gray-500">Here's what's going on today.</p>
      </div>
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
              title="Pending Registrations"
              value={stats.pending_registrations}
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

          {lastLogin && (
            <Card>
              <CardHeader title="Login Information" />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last Login</p>
                      <p className="text-sm font-semibold text-gray-900">{formatSqlDateTimeLocal(lastLogin.login_time)}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                      <MapPin className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last PC Used</p>
                      <p className="text-sm font-semibold text-gray-900">{lastLogin.pc_number || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Attendance Summary — shown for all; empty if not enrolled in IT classes */}
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

          {/* Quick Actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                <Link
                  to="attendance"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">Attendance</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">View your attendance records.</p>
                  </div>
                </Link>
                <Link
                  to="manage-users"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">Student Management</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Approve and manage student registrations.</p>
                  </div>
                </Link>
                <Link
                  to="equipment-reports"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">Feedback</h3>
                      {stats.pending_feedback > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-red-100 text-red-800">
                          {stats.pending_feedback}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Review student issue reports.</p>
                  </div>
                </Link>
                <Link
                  to="login-history"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">View Login History</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">View your login and logout records.</p>
                  </div>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="md:border-l md:border-gray-300 md:pl-6 space-y-6">
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
