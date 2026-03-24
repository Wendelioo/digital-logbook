import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, StatCard } from '../../components/Card';
import {
  Users,
  BookOpen,
  Clock,
  Calendar,
  Library,
  ClipboardCheck,
  PauseCircle,
} from 'lucide-react';
import { ArchiveIcon } from '../../components/icons/ArchiveIcons';
import {
  GetTeacherClassesByUserID,
  GetPendingPasswordResets,
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { BackendDashboardNotifications } from '../../components/DashboardNotifications';
import { Class } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';

function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessionsToday, setOpenSessionsToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Pending password reset count (for the quick-link card)
  const [pendingResetCount, setPendingResetCount] = useState(0);

  const loadResetCount = async () => {
    if (!user?.id) return;
    try {
      const data = await GetPendingPasswordResets(user.id);
      setPendingResetCount((data || []).length);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) {
        console.log('No teacher ID available');
        return;
      }

      setLoading(true);
      try {
        const classesData = await GetTeacherClassesByUserID(user.id);
        // Only update classes when we got a valid array (avoid clearing list on null/failed response)
        if (Array.isArray(classesData)) {
          setClasses(classesData);
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
      } catch (error) {
        console.error('Failed to load teacher classes:', error);
        setError('Unable to load your classes from server.');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadDashboard, 100);
    const refreshInterval = setInterval(loadDashboard, 15000);
    window.addEventListener('focus', loadDashboard);
    window.addEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);

    return () => {
      clearTimeout(timer);
      clearInterval(refreshInterval);
      window.removeEventListener('focus', loadDashboard);
      window.removeEventListener(AUTH_STATUS_CHANGED_EVENT, loadDashboard);
    };
  }, [user?.id]);

  // Poll reset count every 15 seconds
  useEffect(() => {
    loadResetCount();
    const interval = setInterval(loadResetCount, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolled_count, 0);
  const activeClasses = classes.filter(cls => cls.is_active && !cls.is_archived).length;
  const inactiveClasses = classes.filter(cls => !cls.is_active && !cls.is_archived).length;
  const archivedClasses = classes.filter(cls => cls.is_archived).length;

  return (
    <div className="p-6">
      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="mb-6 bg-primary-50 border border-primary-200 text-primary-700 px-4 py-3 rounded-md">
          <p>Loading your dashboard data...</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || user?.name}!</h2>
        <p className="text-sm text-gray-500">Here's what's going on today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
        {/* Quick Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Active Classes"
                value={activeClasses}
                icon={<Library />}
                color="green"
              />
              <StatCard
                title="Archived Classes"
                value={archivedClasses}
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

          {/* List of Schedule */}
          {activeClasses > 0 && (
            <Card>
              <CardHeader title="List of Schedule" />
              <CardBody>
                <div className="space-y-3">
                  {classes.filter(cls => cls.is_active).slice(0, 3).map(cls => (
                    <Link
                      key={cls.id}
                      to={`classes/${cls.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
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

        <div className="md:border-l md:border-gray-300 md:pl-6 space-y-6">
          {/* Password Reset Requests - link card */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Password Resets
                  {pendingResetCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning-600 text-white text-xs font-bold">
                      {pendingResetCount}
                    </span>
                  )}
                </span>
              }
            />
            <CardBody>
              {pendingResetCount > 0 ? (
                <p className="text-sm text-gray-600 mb-3">
                  You have <span className="font-semibold text-warning-600">{pendingResetCount}</span> student password reset request{pendingResetCount !== 1 ? 's' : ''} waiting for your approval.
                </p>
              ) : (
                <p className="text-sm text-gray-500 mb-3">No pending password reset requests.</p>
              )}
              <Link
                to="password-resets"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold bg-warning-50 text-warning-700 border border-warning-200 rounded-lg hover:bg-warning-100 transition-colors"
              >
                Manage Requests
              </Link>
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
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight break-words">Take Attendance</h3>
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Check and update today's attendance.</p>
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
                    <p className="hidden text-xs text-gray-500 mt-0.5 leading-snug break-words">Review your login and logout records.</p>
                  </div>
                </Link>

                <Link
                  to="class-management"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-primary-200 transition-colors p-3"
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

    </div>
  );
}

export default DashboardOverview;
