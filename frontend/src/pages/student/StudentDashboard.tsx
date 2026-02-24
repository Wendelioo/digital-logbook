import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardBody, StatCard, InfoCard } from '../../components/Card';
import Button from '../../components/Button';
import {
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  MapPin,
  Library,
} from 'lucide-react';
import {
  GetStudentDashboard,
  GetStudentLoginLogs,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { main } from '../../../wailsjs/go/models';
import DashboardNotifications, { DashboardNotificationItem } from '../../components/DashboardNotifications';
import { StudentDashboardData, LoginLog } from './types';

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: 'open' | 'closed';
  subject_code: string;
  subject_name: string;
  edp_code: string;
}

function DashboardOverview() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData>(new main.StudentDashboard({
    attendance: [],
    today_log: undefined
  }));
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [openSessions, setOpenSessions] = useState<AttendanceSession[]>([]);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const previousMetricsRef = useRef<{ absentCount: number; openSessions: number; currentlyLoggedIn: boolean } | null>(null);

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
            // Get the most recent completed login (one that has been logged out)
            // If no completed login exists, use the most recent login
            const completedLogs = loginLogs.filter(log => log.logout_time);
            const lastLog = completedLogs.length > 0 ? completedLogs[0] : loginLogs[0];
            setLastLogin(lastLog);
          }
        } catch (error) {
          console.error('Failed to load last login:', error);
        }

        let sessions: AttendanceSession[] = [];
        try {
          const fetchedSessions = await (window as any).go.main.App.GetStudentOpenAttendanceSessions(user.id);
          const normalizedSessions = fetchedSessions || [];
          setOpenSessions(normalizedSessions);
          sessions = normalizedSessions;
        } catch (error) {
          console.error('Failed to load open attendance sessions:', error);
        }

        const nextAbsentCount = (data.attendance || []).filter(a => a.status === 'Absent').length;
        const nextOpenSessions = sessions.length;
        const nextCurrentlyLoggedIn = !!data.currently_logged_in;
        const previous = previousMetricsRef.current;

        if (!previous) {
          pushNotification('Student dashboard is connected and receiving live updates.', 'success');
        } else {
          if (nextOpenSessions !== previous.openSessions) {
            if (nextOpenSessions > previous.openSessions) {
              pushNotification(`${nextOpenSessions} attendance session(s) are open for your classes.`, 'warning');
            } else {
              pushNotification('One or more attendance sessions have closed.', 'info');
            }
          }

          if (nextAbsentCount !== previous.absentCount) {
            if (nextAbsentCount > previous.absentCount) {
              pushNotification(`Absence count increased to ${nextAbsentCount}.`, 'warning');
            } else {
              pushNotification('Absence count has improved.', 'success');
            }
          }

          if (nextCurrentlyLoggedIn !== previous.currentlyLoggedIn) {
            pushNotification(nextCurrentlyLoggedIn ? 'Your account is now logged in on a lab PC.' : 'Your account is now logged out.', 'info');
          }
        }

        previousMetricsRef.current = {
          absentCount: nextAbsentCount,
          openSessions: nextOpenSessions,
          currentlyLoggedIn: nextCurrentlyLoggedIn,
        };
      } catch (error) {
        console.error('Failed to load student dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Auto-refresh every 30 seconds to keep dashboard data up-to-date
    const refreshInterval = setInterval(() => {
      if (user) loadDashboard();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const presentCount = (dashboardData.attendance || []).filter(a => a.status === 'Present').length;
  const absentCount = (dashboardData.attendance || []).filter(a => a.status === 'Absent').length;
  const seatInCount = (dashboardData.attendance || []).filter(a => a.status === 'Seat-in').length;
  const totalAttendance = dashboardData.attendance?.length || 0;

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;

    setTimingInSession(sessionId);
    try {
      await (window as any).go.main.App.StudentTimeIn(sessionId, user.id);
      const sessions = await (window as any).go.main.App.GetStudentOpenAttendanceSessions(user.id);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Attendance Rate"
              value={`${dashboardData.attendance_rate?.toFixed(1) || 0}%`}
              icon={<CheckCircle className="h-6 w-6" />}
              color="green"
            />
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
          </div>

          {lastLogin && (
            <Card>
              <CardHeader title="Account Information" />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoCard
                    icon={<Clock className="h-6 w-6" />}
                    label="Last Login"
                    value={lastLogin.login_time ? new Date(lastLogin.login_time).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }) : 'N/A'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Records</span>
                  <span className="text-lg font-semibold text-gray-900">{totalAttendance}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Attendance Today" />
            <CardBody>
              {openSessions.length > 0 ? (
                <div className="space-y-3">
                  {openSessions.map((session) => (
                    <div key={session.session_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{session.subject_code} - {session.subject_name}</p>
                        <p className="text-xs text-gray-500">{session.session_name || 'Attendance Session'} • EDP: {session.edp_code || '-'}</p>
                      </div>
                      <Button
                        onClick={() => handleTimeIn(session.session_id)}
                        variant="primary"
                        size="sm"
                        disabled={timingInSession === session.session_id}
                      >
                        {timingInSession === session.session_id ? 'Submitting...' : 'Time In'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No open attendance sessions for your classes today.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Notifications" />
          <CardBody>
            <DashboardNotifications
              items={notifications}
              emptyMessage="No new attendance notifications."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default DashboardOverview;
