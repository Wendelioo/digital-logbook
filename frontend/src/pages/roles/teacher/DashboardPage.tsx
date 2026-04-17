import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, InfoCard, StatCard } from '../../../components/Card';
import LoadingDots from '../../../components/LoadingDots';
import {
  Users,
  BookOpen,
  Clock,
  LogIn,
  MapPin,
  Library,
  ClipboardCheck,
  PauseCircle,
} from 'lucide-react';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  GetTeacherClassesByUserID,
  GetArchivedClasses,
  GetStudentLoginLogs,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { Class } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';
const DASHBOARD_POLL_INTERVAL_MS = 5000;

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

function DashboardOverview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<Class[]>([]);
  const [openSessionsToday, setOpenSessionsToday] = useState(0);
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [currentLogin, setCurrentLogin] = useState<LoginLog | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) {
        console.log('No teacher ID available');
        setInitialLoading(false);
        return;
      }

      try {
        const classesData = await GetTeacherClassesByUserID(user.id);
        // Only update classes when we got a valid array (avoid clearing list on null/failed response)
        if (Array.isArray(classesData)) {
          setClasses(classesData);
        }

        try {
          const archivedData = await GetArchivedClasses(user.id);
          if (Array.isArray(archivedData)) {
            setArchivedClasses(archivedData);
          }
        } catch (archivedErr) {
          console.error('Failed to load archived classes:', archivedErr);
          setArchivedClasses([]);
        }

        let nextOpenSessionsToday = 0;
        try {
          const sessions = await (window as any).go.backend.App.GetTeacherAttendanceSessions(user.id);
          const today = new Date().toISOString().split('T')[0];
          const openToday = (sessions || []).filter((session: any) =>
            session.attendance_date === today && session.status === 'open'
          ).length;
          nextOpenSessionsToday = openToday;
          setOpenSessionsToday(openToday);
        } catch (sessionErr) {
          console.error('Failed to load attendance sessions:', sessionErr);
          nextOpenSessionsToday = 0;
          setOpenSessionsToday(0);
        }

        setError('');

        try {
          const loginLogs = await GetStudentLoginLogs(user.id);
          if (loginLogs && loginLogs.length > 0) {
            // Prefer latest completed session for "Last Login" consistency.
            const completedLogs = loginLogs.filter((log) => !!log.logout_time);
            const activeLogs = loginLogs.filter((log) => !log.logout_time);
            const selectedLog = completedLogs.length > 0 ? completedLogs[0] : null;
            setLastLogin(selectedLog);
            setCurrentLogin(activeLogs.length > 0 ? activeLogs[0] : null);
          } else {
            setLastLogin(null);
            setCurrentLogin(null);
          }
        } catch (loginErr) {
          console.error('Failed to load teacher last login:', loginErr);
          setLastLogin(null);
          setCurrentLogin(null);
        }
      } catch (error) {
        console.error('Failed to load teacher classes:', error);
        setError('Unable to load dashboard data from server.');
      } finally {
        setInitialLoading(false);
      }
    };

    const timer = setTimeout(loadDashboard, 100);
    const refreshInterval = setInterval(loadDashboard, DASHBOARD_POLL_INTERVAL_MS);
    window.addEventListener('focus', loadDashboard);
    window.addEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);

    return () => {
      clearTimeout(timer);
      clearInterval(refreshInterval);
      window.removeEventListener('focus', loadDashboard);
      window.removeEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);
    };
  }, [user?.id]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolled_count, 0);
  const activeClasses = classes.filter(cls => cls.is_active && !cls.is_archived).length;
  const inactiveClasses = classes.filter(cls => !cls.is_active && !cls.is_archived).length;
  const archivedClassesCount = archivedClasses.length;

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

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Error Message */}
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
                  value={currentLogin?.pc_number || (currentLogin ? '' : 'Not Logged In')}
                  iconColor={currentLogin ? 'green' : 'yellow'}
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
            <StatCard
              title="Active Classes"
              value={activeClasses}
              icon={<Library />}
              color="green"
            />
            <StatCard
              title="Archived Classes"
              value={archivedClassesCount}
              icon={<ArchiveIcon />}
              color="yellow"
            />
            <StatCard
              title="Inactive Classes"
              value={inactiveClasses}
              icon={<PauseCircle />}
              color="yellow"
            />
            <StatCard
              title="Total Students"
              value={totalStudents}
              icon={<Users />}
              color="blue"
            />
          </div>
        </div>
        <div className="lg:border-l lg:border-gray-300 lg:pl-6">
          <Card className="h-fit">
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-200">
              <Link
                to="attendance"
                className="flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors p-3"
              >
                <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Take Attendance</h3>
                  <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Check and update today's attendance.</p>
                </div>
              </Link>

              <Link
                to="login-history"
                className="flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors p-3"
              >
                <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">View Login History</h3>
                  <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Review your login and logout records.</p>
                </div>
              </Link>

              <Link
                to="class-management"
                className="flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors p-3"
              >
                <div className="hidden flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Library className="h-5 w-5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Manage Classes</h3>
                  <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">View and manage your classes.</p>
                </div>
              </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8 items-start">
        {/* Quick Stats */}
        <div className="space-y-6">
          {/* My Classes */}
          {activeClasses > 0 && (
            <Card>
              <CardHeader title="My Classes" />
              <CardBody>
                <div className="overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-200">
                  {classes.filter(cls => cls.is_active).slice(0, 3).map(cls => (
                    <Link
                      key={cls.class_id}
                      to={`classes/${cls.class_id}`}
                      className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{cls.subject_name}</h4>
                          <p className="text-sm text-gray-500">
                            {cls.section} • {cls.enrolled_count} students
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600">{cls.schedule || 'No schedule'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

        </div>
      </div>

    </div>
  );
}

export default DashboardOverview;
