import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatCard } from '../../components/Card';
import { Card, CardHeader, CardBody } from '../../components/Card';
import {
  Users,
  BookOpen,
  Clock,
  Calendar,
  Library,
  ClipboardCheck,
  PauseCircle,
  Archive,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import DashboardNotifications, { DashboardNotificationItem } from '../../components/DashboardNotifications';
import { Class } from './types';

const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';

function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessionsToday, setOpenSessionsToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const previousMetricsRef = useRef<{ activeClasses: number; totalStudents: number; openSessionsToday: number } | null>(null);

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
    const loadDashboard = async () => {
      if (!user?.id) {
        console.log('No teacher ID available');
        return;
      }

      setLoading(true);
      try {
        // Note: user.id should be the teacher's database ID from teachers table
        console.log('Loading classes for teacher ID:', user.id);
        const classesData = await GetTeacherClassesByUserID(user.id);
        console.log('Classes data received:', classesData);
        const nextClasses = classesData || [];
        setClasses(nextClasses);

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

        const nextActiveClasses = nextClasses.filter(cls => cls.is_active).length;
        const nextTotalStudents = nextClasses.reduce((sum, cls) => sum + cls.enrolled_count, 0);
        upsertNotification(
          'teacher-open-sessions',
          `Open attendance sessions today: ${nextOpenSessionsToday}.`,
          nextOpenSessionsToday > 0 ? 'warning' : 'success'
        );
        upsertNotification('teacher-active-classes', `Active classes: ${nextActiveClasses}.`, 'info');
        upsertNotification('teacher-total-students', `Enrolled students: ${nextTotalStudents}.`, 'info');
        const previous = previousMetricsRef.current;

        if (!previous) {
          pushNotification('Teacher dashboard is connected and receiving live updates.', 'success');
        } else {
          if (nextOpenSessionsToday !== previous.openSessionsToday) {
            if (nextOpenSessionsToday > previous.openSessionsToday) {
              pushNotification(`${nextOpenSessionsToday} attendance session(s) are now open.`, 'warning');
            } else {
              pushNotification('Open attendance sessions were closed or completed.', 'success');
            }
          }

          if (nextActiveClasses !== previous.activeClasses) {
            pushNotification(`Active classes changed to ${nextActiveClasses}.`, 'info');
          }

          if (nextTotalStudents !== previous.totalStudents) {
            pushNotification(`Enrolled students updated to ${nextTotalStudents}.`, 'info');
          }
        }

        previousMetricsRef.current = {
          activeClasses: nextActiveClasses,
          totalStudents: nextTotalStudents,
          openSessionsToday: nextOpenSessionsToday,
        };

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

  const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolled_count, 0);
  const activeClasses = classes.filter(cls => cls.is_active && !cls.is_archived).length;
  const inactiveClasses = classes.filter(cls => !cls.is_active && !cls.is_archived).length;
  const archivedClasses = classes.filter(cls => cls.is_archived).length;

  return (
    <div className="p-6">
      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md">
          <p>Loading your dashboard data...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
        {/* Quick Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Classes"
              value={activeClasses}
              icon={<Library className="h-6 w-6" />}
              color="blue"
            />
            <StatCard
              title="Total Students"
              value={totalStudents}
              icon={<Users className="h-6 w-6" />}
              color="green"
            />
            <StatCard
              title="Inactive Classes"
              value={inactiveClasses}
              icon={<PauseCircle className="h-6 w-6" />}
              color="yellow"
            />
            <StatCard
              title="Archived Classes"
              value={archivedClasses}
              icon={<Archive className="h-6 w-6" />}
              color="indigo"
            />
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
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-blue-600" />
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

          {/* Quick Actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                <Link
                  to="attendance"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 transition-colors duration-200">
                    <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-indigo-600 transition-colors">Take Attendance</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Check and update today's attendance.</p>
                  </div>
                </Link>
                <Link
                  to="login-history"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-200">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-blue-600 transition-colors">View Login History</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">Review your login and logout records.</p>
                  </div>
                </Link>
                <Link
                  to="class-management"
                  className="group min-w-0 flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors duration-200">
                    <Library className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight break-words group-hover:text-green-600 transition-colors">Manage Classes</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug break-words">View and manage your classes.</p>
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
                emptyMessage="No new class or attendance updates."
              />
            </CardBody>
          </Card>
        </div>
      </div>

    </div>
  );
}

export default DashboardOverview;
