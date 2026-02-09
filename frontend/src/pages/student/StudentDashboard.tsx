import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, StatCard, InfoCard } from '../../components/Card';
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
import { StudentDashboardData, LoginLog } from './types';

function DashboardOverview() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData>(new main.StudentDashboard({
    attendance: [],
    today_log: undefined
  }));
  const [lastLogin, setLastLogin] = useState<LoginLog | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const presentCount = (dashboardData.attendance || []).filter(a => a.status === 'Present').length;
  const absentCount = (dashboardData.attendance || []).filter(a => a.status === 'Absent').length;
  const seatInCount = (dashboardData.attendance || []).filter(a => a.status === 'Seat-in').length;
  const totalAttendance = dashboardData.attendance?.length || 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Last Login Information */}
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

      {/* Attendance Summary */}
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

          {/* Total Records */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total Records</span>
              <span className="text-lg font-semibold text-gray-900">{totalAttendance}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default DashboardOverview;
