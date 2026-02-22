import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatCard } from '../../components/Card';
import { Card, CardHeader, CardBody } from '../../components/Card';
import {
  Users,
  BookOpen,
  Clock,
  Calendar,
  Library,
  Bell,
  ClipboardCheck,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessionsToday, setOpenSessionsToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

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

        if (classesData) {
          setClasses(classesData);
        }

        try {
          const sessions = await (window as any).go.main.App.GetTeacherAttendanceSessions(user.id);
          const today = new Date().toISOString().split('T')[0];
          const openToday = (sessions || []).filter((session: any) =>
            session.attendance_date === today && session.status === 'open'
          ).length;
          setOpenSessionsToday(openToday);
        } catch (sessionErr) {
          console.error('Failed to load attendance sessions:', sessionErr);
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
    return () => clearTimeout(timer);
  }, [user?.id]);

  const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolled_count, 0);
  const activeClasses = classes.filter(cls => cls.is_active).length;

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          title="Classes"
          value={activeClasses}
          icon={<Calendar className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* List of Schedule */}
      {activeClasses > 0 && (
        <Card className="mb-8">
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

      <Card className="mb-8">
        <CardHeader title="Notifications" />
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <Bell className="h-5 w-5 text-primary-600 mr-3" />
                <span className="text-sm text-gray-700">Your dashboard data is up to date.</span>
              </div>
              <span className="text-xs text-gray-500">Now</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{activeClasses > 0 ? `${activeClasses} active class(es) with automated attendance enabled.` : 'No active classes assigned yet.'}</span>
              <span className="text-xs text-gray-500">Today</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{openSessionsToday > 0 ? `${openSessionsToday} attendance session(s) currently open.` : 'No open attendance sessions right now.'}</span>
              <span className="text-xs text-gray-500">Sessions</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{totalStudents > 0 ? `${totalStudents} enrolled student(s); review attendance to validate exceptions.` : 'No enrolled students found yet.'}</span>
              <span className="text-xs text-gray-500">Today</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Attendance is synced from active classlist and student Time In submissions during open sessions. You can still update today's attendance when needed.</span>
              <span className="text-xs text-gray-500">Info</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="attendance"
          className="group flex items-center p-5 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all duration-200"
        >
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 transition-colors duration-200">
            <ClipboardCheck className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors duration-200" />
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Take Attendance</h3>
            <p className="text-sm text-gray-500 mt-0.5">Check and update today's attendance</p>
          </div>
        </Link>
        <Link
          to="login-history"
          className="group flex items-center p-5 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200"
        >
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-200">
            <Clock className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors duration-200" />
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">View Login History</h3>
            <p className="text-sm text-gray-500 mt-0.5">View your login and logout records</p>
          </div>
        </Link>
        <Link
          to="classes"
          className="group flex items-center p-5 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all duration-200"
        >
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors duration-200">
            <Library className="h-6 w-6 text-green-600 group-hover:text-white transition-colors duration-200" />
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors">Manage Classes</h3>
            <p className="text-sm text-gray-500 mt-0.5">View and manage your classes</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default DashboardOverview;
