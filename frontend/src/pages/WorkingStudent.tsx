import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { Card, CardHeader, CardBody, StatCard } from '../components/Card';
import Table from '../components/Table';
import { Badge, StatusBadge } from '../components/Badge';
import PendingRegistrations from '../components/PendingRegistrations';
import { MyClasses, ArchivedClasses } from './Student';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Save,
  UserCheck,
  ArrowLeft,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  MapPin,
  AlertCircle,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  X,
  BarChart3,
  ClipboardList,
  Archive,
  ArchiveRestore,
  UserX,
  Library
} from 'lucide-react';
import { 
  GetWorkingStudentDashboard,
  GetAllRegisteredStudents,
  GetPendingFeedback,
  ForwardFeedbackToAdmin,
  ForwardMultipleFeedbackToAdmin,
  GetActiveStudentsForArchiving,
  ArchiveStudent,
  GetArchivedStudents,
  UnarchiveStudent,
  DeleteExpiredStudents
} from '../../wailsjs/go/main/App';
import LoginHistory from '../components/LoginHistory';
import { useAuth } from '../contexts/AuthContext';
import { main } from '../../wailsjs/go/models';

// Use generated types
type ClassStudent = main.ClassStudent;
type Department = main.Department;
type User = main.User;
type Feedback = main.Feedback;

// ArchivedStudent represents a graduated student scheduled for deletion
interface ArchivedStudent {
  user_id: number;
  student_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  contact_number?: string;
  archived_at: string;
  deletion_scheduled_at: string;
  days_until_deletion: number;
}

interface DashboardStats {
  students_registered: number;
  pending_feedback: number;
  today_registrations: number;
  active_students_now: number;
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    students_registered: 0,
    pending_feedback: 0,
    today_registrations: 0,
    active_students_now: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetWorkingStudentDashboard();
        setStats(data);
      } catch (error) {
        console.error('Failed to load working student dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Auto-refresh every 30 seconds to keep stats up-to-date
    const refreshInterval = setInterval(() => {
      loadStats();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          title="Active Students Now"
          value={stats.active_students_now}
          icon={<UserCheck className="h-6 w-6" />}
          color="green"
        />
      </div>

      {/* Today's Activity */}
      <Card className="mb-8">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="manage-users"
          className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Student Management</h3>
          </div>
        </Link>
        <Link
          to="feedback"
          className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Pending Feedback</h3>
            {stats.pending_feedback > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-2">
                {stats.pending_feedback}
              </span>
            )}
          </div>
        </Link>
        <Link
          to="login-history"
          className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">View Login History</h3>
            <p className="text-sm text-gray-500">View your login and logout records</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

interface StudentRow {
  id: string;
  ctrlNo: number;
  studentId: string;
  fullName: string;
  yearLevel: string;
}

function ManageUsers() {
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingStudent, setViewingStudent] = useState<ClassStudent | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadStudents = async () => {
    try {
      const data = await GetAllRegisteredStudents('All', 'All');
      setStudents(data || []);
      setFilteredStudents(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load students:', error);
      setError('Unable to load students from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.middle_name && student.middle_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredStudents(filtered);
    }
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, students]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);
  const startEntry = filteredStudents.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredStudents.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
      </div>

      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Show <select 
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1 mx-1"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select> entries
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="overflow-x-auto">
          {currentStudents.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Number
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.student_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.last_name}, {student.first_name} {student.middle_name || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {(student as any).email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {(student as any).contact_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        onClick={() => setViewingStudent(student)}
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm text-gray-500 font-medium">No data available.</p>
              </div>
            </div>
          )}
        </div>
        {currentStudents.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {startEntry} to {endEntry} of {filteredStudents.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="primary"
                size="sm"
              >
                {currentPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Student Details Modal */}
      <ViewStudentDetailsModal
        student={viewingStudent}
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
      />
    </div>
  );
}

interface ViewStudentDetailsModalProps {
  student: ClassStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

function ViewStudentDetailsModal({ student, isOpen, onClose }: ViewStudentDetailsModalProps) {
  if (!isOpen || !student) return null;

  const getFullName = () => {
    return `${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''} ${student.last_name}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Eye className="h-5 w-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Student Details</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Left Section - Profile Picture */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-black rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {(student as any).profile_photo || (student as any).profilePhoto ? (
                  <img 
                    src={(student as any).profile_photo || (student as any).profilePhoto} 
                    alt={getFullName()} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <Users className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Section - Details */}
            <div className="flex-1 space-y-3">
              <div>
                <span className="text-sm font-semibold text-gray-700">Fullname:</span>
                <span className="text-sm text-gray-900 ml-2">{getFullName()}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Contact:</span>
                <span className="text-sm text-gray-900 ml-2">{(student as any).contact_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Email:</span>
                <span className="text-sm text-gray-900 ml-2">{(student as any).email || ''}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Username:</span>
                <span className="text-sm text-gray-900 ml-2">{student.student_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Close Button */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            icon={<X className="h-4 w-4" />}
          >
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}

function EquipmentReports() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Set<number>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showBatchForwardModal, setShowBatchForwardModal] = useState(false);
  const [forwardNotes, setForwardNotes] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<Feedback | null>(null);

  useEffect(() => {
    loadPendingFeedback();

    // Auto-refresh every 30 seconds to show new feedback submissions
    const refreshInterval = setInterval(() => {
      loadPendingFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadPendingFeedback = async () => {
    try {
      const data = await GetPendingFeedback();
      setFeedbackList(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load pending feedback:', error);
      setError('Unable to load pending feedback. Make sure you are connected to the database.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleForwardClick = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setForwardNotes('');
    setShowForwardModal(true);
  };

  const handleForwardSubmit = async () => {
    if (!selectedFeedback || !user) return;

    setForwarding(true);
    try {
      await ForwardFeedbackToAdmin(selectedFeedback.id, user.id, forwardNotes);
      showNotification('success', 'Feedback forwarded to admin successfully!');
      setShowForwardModal(false);
      setSelectedFeedback(null);
      setForwardNotes('');
      await loadPendingFeedback(); // Refresh the list
    } catch (error) {
      console.error('Failed to forward feedback:', error);
      showNotification('error', 'Failed to forward feedback. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleBatchForwardClick = () => {
    if (selectedFeedbackIds.size === 0) {
      showNotification('error', 'Please select at least one report to forward.');
      return;
    }
    setForwardNotes('');
    setShowBatchForwardModal(true);
  };

  const handleBatchForwardSubmit = async () => {
    if (selectedFeedbackIds.size === 0 || !user) return;

    setForwarding(true);
    try {
      const feedbackIdsArray = Array.from(selectedFeedbackIds);
      const count = await ForwardMultipleFeedbackToAdmin(feedbackIdsArray, user.id, forwardNotes);
      showNotification('success', `Successfully forwarded ${count} report${count !== 1 ? 's' : ''} to admin!`);
      setShowBatchForwardModal(false);
      setSelectedFeedbackIds(new Set());
      setForwardNotes('');
      await loadPendingFeedback(); // Refresh the list
    } catch (error) {
      console.error('Failed to forward feedback:', error);
      showNotification('error', 'Failed to forward feedback. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFeedbackIds(new Set(feedbackList.map(f => f.id)));
    } else {
      setSelectedFeedbackIds(new Set());
    }
  };

  const handleSelectFeedback = (feedbackId: number, checked: boolean) => {
    const newSelected = new Set(selectedFeedbackIds);
    if (checked) {
      newSelected.add(feedbackId);
    } else {
      newSelected.delete(feedbackId);
    }
    setSelectedFeedbackIds(newSelected);
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
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotification(null)}
                  className="bg-white text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {feedbackList.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 font-medium">No reports available</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Batch Actions Bar */}
          {selectedFeedbackIds.size > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-blue-900">{selectedFeedbackIds.size}</span> report{selectedFeedbackIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFeedbackIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBatchForwardClick}
                  icon={<Send className="h-4 w-4" />}
                >
                  Forward ({selectedFeedbackIds.size})
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedFeedbackIds.size === feedbackList.length && feedbackList.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      PC Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedbackList.map((feedback) => (
                    <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFeedbackIds.has(feedback.id)}
                          onChange={(e) => handleSelectFeedback(feedback.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.student_id_str}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {feedback.student_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {feedback.pc_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.date_submitted ? new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReportForDetails(feedback);
                              setShowDetailsModal(true);
                            }}
                            icon={<Eye className="h-4 w-4" />}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleForwardClick(feedback)}
                            icon={<Send className="h-4 w-4" />}
                          >
                            Forward
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{feedbackList.length}</span> pending report{feedbackList.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && selectedFeedback && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForwardModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-8 pb-4">
              <Send className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Forward to Admin
              </h3>
              <p className="text-gray-600">
                Review the equipment report and add notes before forwarding to admin
              </p>
            </div>

            <div className="px-8 pb-8">
              {/* Feedback Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Report Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Student:</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.student_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">PC Number:</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.pc_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedFeedback.date_submitted).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedFeedback.date_submitted).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs text-gray-600">Equipment</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.equipment_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.equipment_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.equipment_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Monitor</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.monitor_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.monitor_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.monitor_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Keyboard</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.keyboard_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.keyboard_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.keyboard_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Mouse</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.mouse_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.mouse_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.mouse_condition}
                    </p>
                  </div>
                </div>
                {selectedFeedback.comments && (
                  <div className="mt-4">
                    <span className="text-xs text-gray-600">Student Comments:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedFeedback.comments}</p>
                  </div>
                )}
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any observations or recommendations for the admin..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowForwardModal(false)}
                  disabled={forwarding}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleForwardSubmit}
                  loading={forwarding}
                >
                  Forward to Admin
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Forward Modal */}
      {showBatchForwardModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBatchForwardModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-8 pb-4">
              <Send className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Forward Multiple Reports to Admin
              </h3>
              <p className="text-gray-600">
                You are about to forward <span className="font-semibold text-blue-600">{selectedFeedbackIds.size}</span> report{selectedFeedbackIds.size !== 1 ? 's' : ''} to admin
              </p>
            </div>

            <div className="px-8 pb-8">
              {/* Selected Reports Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Selected Reports</h4>
                <div className="space-y-2">
                  {feedbackList
                    .filter(f => selectedFeedbackIds.has(f.id))
                    .map((feedback) => (
                      <div key={feedback.id} className="text-sm text-gray-700 flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                        <span className="font-medium">{feedback.student_name}</span>
                        <span className="text-gray-500">PC {feedback.pc_number}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label htmlFor="batch-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  id="batch-notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any observations or recommendations for the admin (applies to all selected reports)..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowBatchForwardModal(false)}
                  disabled={forwarding}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBatchForwardSubmit}
                  loading={forwarding}
                >
                  Forward {selectedFeedbackIds.size} Report{selectedFeedbackIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {showDetailsModal && selectedReportForDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10"
            >
              ×
            </Button>
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Equipment Report Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Full report submitted by student</p>
                </div>
              </div>

              {/* Report Information */}
              <div className="space-y-6">
                {/* Student Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.student_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Student ID:</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.student_id_str}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PC Number:</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.pc_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Date Submitted:</span>
                      <p className="font-medium text-gray-900">
                        {selectedReportForDetails.date_submitted ? new Date(selectedReportForDetails.date_submitted).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Equipment Conditions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Equipment Conditions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Equipment</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.equipment_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.equipment_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.equipment_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Monitor</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.monitor_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.monitor_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.monitor_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Keyboard</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.keyboard_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.keyboard_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.keyboard_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Mouse</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.mouse_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.mouse_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.mouse_condition}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Student Comments */}
                {selectedReportForDetails.comments && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Comments</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReportForDetails.comments}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// ARCHIVED STUDENTS MANAGEMENT
// ==============================================================================

function ArchivedStudentsManagement() {
  const { user } = useAuth();
  const [activeStudents, setActiveStudents] = useState<User[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [studentToArchive, setStudentToArchive] = useState<User | null>(null);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [studentToUnarchive, setStudentToUnarchive] = useState<ArchivedStudent | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedTab === 'active') {
        const data = await GetActiveStudentsForArchiving();
        setActiveStudents(data || []);
      } else {
        const data = await GetArchivedStudents();
        setArchivedStudents(data || []);
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      showNotification('error', 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleArchiveStudent = async () => {
    if (!studentToArchive || !user) return;

    try {
      await ArchiveStudent(studentToArchive.id);
      showNotification('success', 'Student archived successfully. Account will be deleted after 360 days.');
      setShowArchiveModal(false);
      setStudentToArchive(null);
      loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to archive student');
    }
  };

  const handleUnarchiveStudent = async () => {
    if (!studentToUnarchive) return;

    try {
      await UnarchiveStudent(studentToUnarchive.user_id);
      showNotification('success', 'Student account restored successfully');
      setShowUnarchiveModal(false);
      setStudentToUnarchive(null);
      loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to restore student');
    }
  };

  const handleDeleteExpired = async () => {
    if (!window.confirm('This will permanently delete all students whose accounts have passed the 360-day retention period. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      const count = await DeleteExpiredStudents();
      if (count > 0) {
        showNotification('success', `Successfully deleted ${count} expired student account(s)`);
        loadData();
      } else {
        showNotification('success', 'No expired accounts to delete');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to delete expired accounts');
    }
  };

  const filteredActiveStudents = activeStudents.filter(student =>
    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArchivedStudents = archivedStudents.filter(student =>
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => setNotification(null)}
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Archive Management</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab('active')}
            className={`${
              selectedTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Users className="h-4 w-4" />
            Active Students
          </button>
          <button
            onClick={() => setSelectedTab('archived')}
            className={`${
              selectedTab === 'archived'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Archive className="h-4 w-4" />
            Archived Students ({archivedStudents.length})
          </button>
        </nav>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {selectedTab === 'archived' && (
          <Button
            variant="danger"
            onClick={handleDeleteExpired}
            icon={<Trash2 className="h-4 w-4" />}
          >
            Delete Expired Accounts
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {selectedTab === 'active' ? (
            // Active Students Table
            filteredActiveStudents.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Student Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredActiveStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.student_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.last_name}, {student.first_name} {student.middle_name || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.contact_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => {
                            setStudentToArchive(student);
                            setShowArchiveModal(true);
                          }}
                          icon={<Archive className="h-4 w-4" />}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">No active students found</p>
              </div>
            )
          ) : (
            // Archived Students Table
            filteredArchivedStudents.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Student Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Archived Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Deletion Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Days Left
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredArchivedStudents.map((student) => (
                    <tr key={student.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.student_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.last_name}, {student.first_name} {student.middle_name || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(student.archived_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(student.deletion_scheduled_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          student.days_until_deletion <= 30 
                            ? 'bg-red-100 text-red-800' 
                            : student.days_until_deletion <= 90
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {student.days_until_deletion} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => {
                            setStudentToUnarchive(student);
                            setShowUnarchiveModal(true);
                          }}
                          icon={<ArchiveRestore className="h-4 w-4" />}
                        >
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <Archive className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">No archived students found</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && studentToArchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Archive className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Archive Student Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to archive <strong>{studentToArchive.first_name} {studentToArchive.last_name}</strong> ({studentToArchive.student_id}).
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> The student's account will be deactivated and scheduled for permanent deletion after 360 days. 
                You can restore the account before the deletion date if needed.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveModal(false);
                  setStudentToArchive(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                onClick={handleArchiveStudent}
                icon={<Archive className="h-4 w-4" />}
              >
                Archive Student
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveModal && studentToUnarchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <ArchiveRestore className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Restore Student Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to restore <strong>{studentToUnarchive.first_name} {studentToUnarchive.last_name}</strong> ({studentToUnarchive.student_id}).
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                The student's account will be reactivated and removed from the deletion schedule. 
                They will be able to log in again immediately.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnarchiveModal(false);
                  setStudentToUnarchive(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleUnarchiveStudent}
                icon={<ArchiveRestore className="h-4 w-4" />}
              >
                Restore Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkingStudentDashboard() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Navigation items organized into sections:
  // 1. Working Student duties (lab management)
  // 2. Student features (classes, personal records) - since working students are also students
  // Note: Working students don't submit feedback - they FORWARD student feedback to admin
  const navigationItems = [
    // Working Student Section
    { name: 'Dashboard', href: '/working-student', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/working-student' },
    { name: 'Pending Registrations', href: '/working-student/pending-registrations', icon: <ClipboardList className="h-5 w-5" />, current: location.pathname === '/working-student/pending-registrations' },
    { name: 'Student Management', href: '/working-student/manage-users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/working-student/manage-users' },
    { name: 'Archived Students', href: '/working-student/archived-students', icon: <Archive className="h-5 w-5" />, current: location.pathname === '/working-student/archived-students' },
    { name: 'Equipment Reports', href: '/working-student/equipment-reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/working-student/equipment-reports' },
    
    // Divider label for student features
    { name: 'divider', href: '', icon: null, current: false, isDivider: true, label: 'My Student Records' },
    
    // Student Features Section - for when working students need to access their own student features
    // Note: No "My Feedback History" because working students forward feedback, they don't submit it
    { name: 'My Classes', href: '/working-student/my-classes', icon: <Library className="h-5 w-5" />, current: location.pathname === '/working-student/my-classes' },
    { name: 'My Archived Classes', href: '/working-student/my-archived-classes', icon: <Archive className="h-5 w-5" />, current: location.pathname === '/working-student/my-archived-classes' },
    { name: 'Login History', href: '/working-student/login-history', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/working-student/login-history' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        {/* Working Student Routes */}
        <Route index element={<DashboardOverview />} />
        <Route path="pending-registrations" element={<PendingRegistrations workingStudentUserId={user?.id || 0} />} />
        <Route path="manage-users" element={<ManageUsers />} />
        <Route path="archived-students" element={<ArchivedStudentsManagement />} />
        <Route path="equipment-reports" element={<EquipmentReports />} />
        
        {/* Student Feature Routes - for working students to access their own student features */}
        <Route path="my-classes" element={<MyClasses />} />
        <Route path="my-archived-classes" element={<ArchivedClasses />} />
        <Route path="login-history" element={<LoginHistory showStatus={false} />} />
      </Routes>
    </Layout>
  );
}

export default WorkingStudentDashboard;
