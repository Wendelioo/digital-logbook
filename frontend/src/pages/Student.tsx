import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { Card, CardHeader, CardBody, StatCard, InfoCard } from '../components/Card';
import Table from '../components/Table';
import { Badge, StatusBadge } from '../components/Badge';
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  SlidersHorizontal,
  X,
  Search,
  BookOpen,
  Plus,
  Loader2,
  Users,
  LogIn,
  MapPin,
  Library
} from 'lucide-react';
import {
  GetStudentDashboard,
  RecordAttendance,
  GetStudentFeedback,
  GetStudentLoginLogs,
  GetStudentClasses,
  GetClassesByEDPCode,
  JoinClassByEDPCode,
  GetClassStudents
} from '../../wailsjs/go/main/App';
import { useAuth } from '../contexts/AuthContext';
import { main } from '../../wailsjs/go/models';

// Use the generated models from the backend
type Attendance = main.Attendance;
type StudentDashboardData = main.StudentDashboard;
type Feedback = main.Feedback;
type CourseClass = main.CourseClass;
type ClasslistEntry = main.ClasslistEntry;

// LoginLog interface matching the JSON structure from backend
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

function LoginHistory() {
  const { user } = useAuth();
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadLoginLogs = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log('Loading login logs for user ID:', user.id);
        const data = await GetStudentLoginLogs(user.id);
        console.log('Received login logs data:', data);
        console.log('Number of logs:', data?.length || 0);

        if (data && Array.isArray(data)) {
          setLoginLogs(data);
          setFilteredLogs(data);
          setError('');
        } else {
          setLoginLogs([]);
          setFilteredLogs([]);
          setError('');
        }
      } catch (error) {
        console.error('Failed to load login logs:', error);
        setError(`Unable to load login history: ${error}`);
        setLoginLogs([]);
        setFilteredLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadLoginLogs();

    // Auto-refresh every 30 seconds to show updated login history
    const refreshInterval = setInterval(() => {
      if (user) loadLoginLogs();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  // Filter logs based on date and search
  useEffect(() => {
    let filtered = loginLogs;

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(log => {
        if (!log.login_time) return false;

        const logDate = new Date(log.login_time);
        const selected = new Date(selectedDate);

        // Compare only the date part (ignore time)
        return logDate.toDateString() === selected.toDateString();
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        (log.pc_number && log.pc_number.toLowerCase().includes(query)) ||
        (log.login_time && new Date(log.login_time).toLocaleString().toLowerCase().includes(query))
      );
    }

    setFilteredLogs(filtered);
  }, [loginLogs, selectedDate, searchQuery]);

  const clearFilters = () => {
    setSelectedDate(null);
    setSearchQuery('');
  };

  const activeFilterCount = selectedDate ? 1 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Login History</h2>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery('')}
                variant="secondary"
                size="sm"
                icon={<X className="h-5 w-5" />}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 !p-0"
              />
            )}
          </div>
          <div className="relative">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'primary' : 'outline'}
              icon={<SlidersHorizontal className="h-5 w-5" />}
              className={showFilters ? 'bg-primary-50 border-primary-500 text-primary-700' : ''}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Dropdown with Date Picker */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Select Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    {selectedDate && (
                      <Button
                        onClick={() => setSelectedDate(null)}
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs text-gray-600 hover:text-gray-900 underline text-left !p-1"
                      >
                        Clear Date Filter
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {(searchQuery || selectedDate) && (
            <Button
              onClick={clearFilters}
              variant="outline"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Logout Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {log.pc_number || <span className="text-gray-400 italic">Unknown</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.login_time ? new Date(log.login_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.logout_time ? (
                        new Date(log.logout_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.login_time ? new Date(log.login_time).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.logout_time ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <span className="w-2 h-2 mr-1.5 bg-green-600 rounded-full animate-pulse"></span>
                          Active Session
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackHistory() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadFeedback = async () => {
      if (!user) return;

      try {
        const data = await GetStudentFeedback(user.id);
        setFeedbackList(data || []);
        setFilteredFeedback(data || []);
        setError('');
      } catch (error) {
        console.error('Failed to load feedback:', error);
        setError('Unable to load feedback history. Make sure you are connected to the database.');
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();

    // Auto-refresh every 30 seconds to show updated feedback history
    const refreshInterval = setInterval(() => {
      if (user) loadFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  // Filter feedback based on date and search
  useEffect(() => {
    let filtered = feedbackList;

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(feedback => {
        if (!feedback.date_submitted) return false;

        const feedbackDate = new Date(feedback.date_submitted);
        const selected = new Date(selectedDate);

        // Compare only the date part (ignore time)
        return feedbackDate.toDateString() === selected.toDateString();
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(feedback =>
        (feedback.pc_number && feedback.pc_number.toLowerCase().includes(query)) ||
        (feedback.comments && feedback.comments.toLowerCase().includes(query)) ||
        (feedback.date_submitted && new Date(feedback.date_submitted).toLocaleString().toLowerCase().includes(query))
      );
    }

    setFilteredFeedback(filtered);
  }, [feedbackList, selectedDate, searchQuery]);

  const clearFilters = () => {
    setSelectedDate(null);
    setSearchQuery('');
  };

  const activeFilterCount = selectedDate ? 1 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Feedback History</h2>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery('')}
                variant="secondary"
                size="sm"
                icon={<X className="h-5 w-5" />}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 !p-0"
              />
            )}
          </div>
          <div className="relative">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'primary' : 'outline'}
              icon={<SlidersHorizontal className="h-5 w-5" />}
              className={showFilters ? 'bg-primary-50 border-primary-500 text-primary-700' : ''}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Dropdown with Date Picker */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Select Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    {selectedDate && (
                      <Button
                        onClick={() => setSelectedDate(null)}
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs text-gray-600 hover:text-gray-900 underline text-left !p-1"
                      >
                        Clear Date Filter
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {(searchQuery || selectedDate) && (
            <Button
              onClick={clearFilters}
              variant="outline"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {filteredFeedback.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No reports available</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Computer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keyboard
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monitor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFeedback.map((feedback, index) => (
                  <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {filteredFeedback.length - index}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(feedback.date_submitted).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        {feedback.pc_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.equipment_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.equipment_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.equipment_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.mouse_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.mouse_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.mouse_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.keyboard_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.keyboard_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.keyboard_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.monitor_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.monitor_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.monitor_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="max-w-xs overflow-hidden">
                        {feedback.comments ? (
                          <span className="text-gray-600">{feedback.comments}</span>
                        ) : (
                          <span className="text-gray-400 italic">No comments</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MyClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [edpCode, setEdpCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string>('');
  const [joinSuccess, setJoinSuccess] = useState<string>('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [viewingClasslist, setViewingClasslist] = useState<CourseClass | null>(null);
  const [classlistStudents, setClasslistStudents] = useState<ClasslistEntry[]>([]);
  const [loadingClasslist, setLoadingClasslist] = useState(false);

  useEffect(() => {
    loadClasses();
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await GetStudentClasses(user.id);
      setClasses(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load classes:', error);
      setError('Unable to load your classes from server.');
    } finally {
      setLoading(false);
    }
  };

  const loadClasslist = async (classInfo: CourseClass) => {
    setLoadingClasslist(true);
    try {
      const students = await GetClassStudents(classInfo.class_id);
      setClasslistStudents(students);
    } catch (error) {
      console.error('Failed to load classlist:', error);
      alert('Failed to load classlist. Please try again.');
    } finally {
      setLoadingClasslist(false);
    }
  };

  const handleViewClasslist = async (classInfo: CourseClass) => {
    setViewingClasslist(classInfo);
    await loadClasslist(classInfo);
  };

  const handleRefreshClasslist = async () => {
    if (viewingClasslist) {
      await loadClasslist(viewingClasslist);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !edpCode.trim()) {
      setJoinError('Please enter an EDP code.');
      return;
    }

    // Validate EDP code format
    const cleanedCode = edpCode.trim().toUpperCase();
    if (cleanedCode.length > 50) {
      setJoinError('EDP code is too long. Maximum 50 characters allowed.');
      return;
    }

    // Check for invalid characters
    const validPattern = /^[A-Z0-9_-]+$/;
    if (!validPattern.test(cleanedCode)) {
      setJoinError('Invalid EDP code format. Only letters, numbers, dashes (-), and underscores (_) are allowed.');
      return;
    }

    setJoining(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      // First check if classes exist for this EDP code
      const availableClasses = await GetClassesByEDPCode(cleanedCode);

      if (availableClasses.length === 0) {
        setJoinError('No classes found for this EDP code.');
        setJoining(false);
        return;
      }

      // Join the class
      await JoinClassByEDPCode(user.id, cleanedCode);

      // Reload classes to show the new enrollment
      await loadClasses();

      // Close modal and clear form immediately
      setShowJoinForm(false);
      setEdpCode('');
      setJoinError('');
      setJoinSuccess('');
    } catch (error: any) {
      console.error('Failed to join class:', error);
      const errorMessage = error.message || 'Failed to join class. Please try again.';
      
      if (errorMessage.includes('already enrolled')) {
        setJoinError('You are already enrolled in this class.');
      } else if (errorMessage.includes('no classes found')) {
        setJoinError('No classes found for this EDP code.');
      } else if (errorMessage.includes('invalid EDP code format')) {
        setJoinError('Invalid EDP code. Only letters, numbers, dashes, and underscores are allowed.');
      } else if (errorMessage.includes('too long')) {
        setJoinError('EDP code is too long. Maximum 50 characters allowed.');
      } else if (errorMessage.includes('cannot be empty')) {
        setJoinError('Please enter an EDP code.');
      } else {
        setJoinError(errorMessage);
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">My Classes</h2>
          <Button
            onClick={() => {
              setShowJoinForm(true);
              setEdpCode('');
              setJoinError('');
              setJoinSuccess('');
            }}
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            Join Class
          </Button>
        </div>
      </div>

      {/* Join Class Modal */}
      {showJoinForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowJoinForm(false);
              setEdpCode('');
              setJoinError('');
              setJoinSuccess('');
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 relative">
            <Button
              type="button"
              onClick={() => {
                setShowJoinForm(false);
                setEdpCode('');
                setJoinError('');
                setJoinSuccess('');
              }}
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4"
            >
              ×
            </Button>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Join a Class</h3>
                <p className="text-sm text-gray-600">Enter the EDP Code to join a class</p>
              </div>

              <form onSubmit={handleJoinClass} className="space-y-4">
                <div>
                  <label htmlFor="edpCode" className="block text-sm font-medium text-gray-700 mb-2">
                    EDP Code
                  </label>
                  <input
                    id="edpCode"
                    type="text"
                    value={edpCode}
                    onChange={(e) => setEdpCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>

                {joinError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {joinError}
                  </div>
                )}

                {joinSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    {joinSuccess}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowJoinForm(false);
                      setEdpCode('');
                      setJoinError('');
                      setJoinSuccess('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={joining}
                    loading={joining}
                    variant="primary"
                    className="flex-1"
                  >
                    Join Class
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <Library className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 font-medium">No classes enrolled</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EDP Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descriptive Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.map((cls) => (
                <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{cls.edp_code || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-gray-900">{cls.subject_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cls.descriptive_title || cls.subject_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cls.teacher_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cls.schedule || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cls.room || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {cls.enrolled_count || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      onClick={() => handleViewClasslist(cls)}
                      variant="outline"
                      size="sm"
                      icon={<Users className="h-4 w-4" />}
                    >
                      View Classlist
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Classlist Modal */}
      {viewingClasslist && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingClasslist(null);
              setClasslistStudents([]);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 relative max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {viewingClasslist.descriptive_title || viewingClasslist.subject_name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {viewingClasslist.subject_code} {viewingClasslist.edp_code ? `• ${viewingClasslist.edp_code}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRefreshClasslist}
                  variant="outline"
                  size="sm"
                  disabled={loadingClasslist}
                  icon={loadingClasslist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                >
                  Refresh
                </Button>
                <Button
                  onClick={() => {
                    setViewingClasslist(null);
                    setClasslistStudents([]);
                  }}
                  variant="secondary"
                  size="sm"
                >
                  ×
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingClasslist && classlistStudents.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : classlistStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No students enrolled yet</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollment Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {classlistStudents.map((student, index) => (
                        <tr key={student.student_user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{student.student_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-gray-900">
                            {student.last_name}, {student.first_name}
                            {student.middle_name ? ` ${student.middle_name}` : ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.email || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.enrollment_date}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={student.status === 'active' ? 'active' : 'inactive'} label={student.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Total Students: <span className="font-semibold">{classlistStudents.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/student', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/student' },
    { name: 'My Classes', href: '/student/classes', icon: <Library className="h-5 w-5" />, current: location.pathname === '/student/classes' },
    { name: 'Login History', href: '/student/attendance', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/student/attendance' },
    { name: 'Feedback History', href: '/student/feedback', icon: <MessageSquare className="h-5 w-5" />, current: location.pathname === '/student/feedback' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="classes" element={<MyClasses />} />
        <Route path="attendance" element={<LoginHistory />} />
        <Route path="feedback" element={<FeedbackHistory />} />
      </Routes>
    </Layout>
  );
}

export default StudentDashboard;

