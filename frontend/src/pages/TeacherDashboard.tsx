import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Calendar,
  MapPin,
  Calculator,
  Globe,
  FlaskConical,
  GraduationCap,
  Eye,
  Edit,
  Trash2,
  Plus,
  Library,
  CalendarPlus,
  AlertCircle,
  X,
  Archive
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  GetClassStudents,
  GetClassAttendance,
  InitializeAttendanceForClass,
  UpdateAttendanceRecord,
  RecordAttendance,
  ExportAttendanceCSV,
  UpdateClass,
  DeleteClass,
  GetAllStudentsForEnrollment,
  EnrollMultipleStudents,
  UnenrollStudentFromClassByIDs,
  GetAllClasses,
  CreateClass,
  CreateSubject,
  GetSubjects,
  GetAllTeachers,
  GenerateAttendanceFromLogs,
  GetTeacherClassesWithAttendance,
  GetArchivedAttendanceSheets,
  ArchiveAttendanceSheet,
  UnarchiveAttendanceSheet,
  GetArchivedClasses,
  ArchiveClass,
  UnarchiveClass,
  DeleteAttendanceSheet
} from '../../wailsjs/go/main/App';
import TeacherLoginHistory from './TeacherLoginHistory';
import { useAuth } from '../contexts/AuthContext';
import { main } from '../../wailsjs/go/models';

// Use the generated models from the backend
type Class = main.CourseClass;
type ClasslistEntry = main.ClasslistEntry;
type Attendance = main.Attendance;
type ClassStudent = main.ClassStudent;
type User = main.User;
type Subject = main.Subject;

// Helper function to get subject icon and color
function getSubjectIconAndColor(subjectCode: string, subjectName: string) {
  const code = subjectCode.toLowerCase();
  const name = subjectName.toLowerCase();

  if (code.includes('math') || name.includes('math')) {
    return {
      icon: <Calculator className="h-6 w-6" />,
      headerColor: 'bg-blue-600',
      iconColor: 'text-blue-200'
    };
  }
  if (code.includes('hist') || name.includes('history') || name.includes('civics')) {
    return {
      icon: <Globe className="h-6 w-6" />,
      headerColor: 'bg-green-600',
      iconColor: 'text-green-200'
    };
  }
  if (code.includes('sci') || name.includes('science') || name.includes('lab')) {
    return {
      icon: <FlaskConical className="h-6 w-6" />,
      headerColor: 'bg-green-600',
      iconColor: 'text-green-200'
    };
  }
  if (code.includes('eng') || name.includes('english') || name.includes('literature')) {
    return {
      icon: <BookOpen className="h-6 w-6" />,
      headerColor: 'bg-purple-600',
      iconColor: 'text-purple-200'
    };
  }
  // Default
  return {
    icon: null,
    headerColor: 'bg-indigo-600',
    iconColor: 'text-indigo-200'
  };
}

function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
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
      {/* Welcome Message */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.first_name || user?.name || 'Teacher'}!</h1>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Library className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Classes
                  </dt>
                  <dd className="text-3xl font-bold text-gray-900">
                    {activeClasses}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Students
                  </dt>
                  <dd className="text-3xl font-bold text-gray-900">
                    {totalStudents}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}

function ClassManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string>('');

  useEffect(() => {
    const loadClasses = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Get all classes for this teacher (not just those created by working students)
        const data = await GetTeacherClassesByUserID(user.id);
        setClasses(data || []);
        setFilteredClasses(data || []);
        setError('');
      } catch (error) {
        console.error('Failed to load classes:', error);
        setError('Unable to load classes from server.');
      } finally {
        setLoading(false);
      }
    };

    loadClasses();
  }, [user?.id]);

  useEffect(() => {
    let filtered = classes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(cls =>
        cls.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.school_year && cls.school_year.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.year_level && cls.year_level.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.section && cls.section.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredClasses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, classes]);

  const handleViewClassList = (classId: number) => {
    navigate(`/teacher/class-management/${classId}?mode=view`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredClasses.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentClasses = filteredClasses.slice(startIndex, endIndex);
  const startEntry = filteredClasses.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredClasses.length);

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Class Management</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/teacher/create-classlist')}
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
            >
              ADD NEW
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Controls Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder=""
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-x-auto">
        <div className="border-2 border-gray-300">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                  EDP Code
                </th>
                <th scope="col" className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                  Subject Code
                </th>
                <th scope="col" className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                  Descriptive Title
                </th>
                <th scope="col" className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                  Schedule
                </th>
                <th scope="col" className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {currentClasses.map((cls, index) => (
                <tr key={cls.class_id} className="hover:bg-gray-50">
                  <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {cls.edp_code || '-'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {cls.subject_code || '-'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {cls.descriptive_title || '-'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {cls.schedule || '-'}
                  </td>
                  <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleViewClassList(cls.class_id)}
                        variant="outline"
                        size="sm"
                        className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                        icon={<Eye className="h-3 w-3" />}
                        title="View"
                      />
                      <Button
                        onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=edit`)}
                        variant="primary"
                        size="sm"
                        icon={<Edit className="h-3 w-3" />}
                        title="Edit"
                      />
                      <Button
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to archive this class? It will be moved to the Archive section.')) {
                            try {
                              await ArchiveClass(cls.class_id);
                              // Reload classes
                              const data = await GetTeacherClassesByUserID(user?.id || 0);
                              setClasses(data || []);
                              setFilteredClasses(data || []);
                              alert('Class archived successfully!');
                            } catch (error) {
                              console.error('Failed to archive class:', error);
                              alert('Failed to archive class. Please try again.');
                            }
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="text-orange-600 hover:bg-orange-50"
                        icon={<Archive className="h-3 w-3" />}
                        title="Archive"
                      />
                      <Button
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
                            try {
                              await DeleteClass(cls.class_id);
                              // Reload classes
                              const data = await GetTeacherClassesByUserID(user?.id || 0);
                              setClasses(data || []);
                              setFilteredClasses(data || []);
                              alert('Class deleted successfully!');
                            } catch (error) {
                              console.error('Failed to delete class:', error);
                              alert('Failed to delete class. Please try again.');
                            }
                          }
                        }}
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="h-3 w-3" />}
                        title="Delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Section */}
      {filteredClasses.length > 0 && (
        <div className="flex-shrink-0 mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredClasses.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
            >
              Previous
            </Button>
            <Button
              variant="primary"
            >
              {currentPage}
            </Button>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredClasses.length === 0 && !error && (
        <div className="text-center py-12">
          {searchTerm ? (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No matching classes found</h3>
              <div className="mt-6">
                <Button
                  onClick={() => setSearchTerm('')}
                  variant="outline"
                >
                  Clear Search
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't created any classes yet.
              </p>
              <div className="mt-6">
                <Button
                  onClick={() => navigate('/teacher/create-classlist')}
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add New Class
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Generate Attendance Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Generate Attendance</h3>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedClassId(null);
                  setGenerateError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {generateError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {generateError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class
                </label>
                <select
                  value={selectedClassId || ''}
                  onChange={(e) => setSelectedClassId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={generating}
                >
                  <option value="">-- Select a class --</option>
                  {classes.map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.subject_code} - {cls.subject_name} {cls.schedule ? `(${cls.schedule})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Date is automatically set to today</p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setSelectedClassId(null);
                    setGenerateError('');
                  }}
                  disabled={generating}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedClassId) {
                      setGenerateError('Please select a class');
                      return;
                    }

                    setGenerating(true);
                    setGenerateError('');

                    try {
                      const today = new Date().toISOString().split('T')[0];
                      await GenerateAttendanceFromLogs(selectedClassId, today, user?.id || 0);

                      // Close modal and navigate to attendance management list
                      // The generated attendance will appear as an active attendance sheet
                      setShowGenerateModal(false);
                      setSelectedClassId(null);
                      navigate('/teacher/attendance');
                    } catch (error) {
                      console.error('Failed to generate attendance:', error);
                      setGenerateError('Failed to generate attendance. Please try again.');
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating || !selectedClassId}
                  variant="success"
                  loading={generating}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateClasslist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    schoolYear: '2024-2025',
    semester: '1st Semester',
    subjectCode: '',
    subjectName: '',
    descriptiveTitle: '',
    schedule: '',
    room: '',
    selectedDays: [] as string[],
    startHour: '9',
    startMinute: '00',
    startAmPm: 'AM',
    endHour: '10',
    endMinute: '00',
    endAmPm: 'AM'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const toggleDay = (day: string) => {
    setFormData(prev => {
      const newDays = prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day];
      return { ...prev, selectedDays: newDays };
    });
  };

  // Convert 12-hour format to 24-hour format (HH:MM)
  const convertTo24Hour = (hour: string, minute: string, ampm: string): string => {
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) {
      h += 12;
    } else if (ampm === 'AM' && h === 12) {
      h = 0;
    }
    return `${h.toString().padStart(2, '0')}:${minute}`;
  };

  // Format time for display (12-hour format)
  const formatTimeDisplay = (hour: string, minute: string, ampm: string): string => {
    return `${hour}:${minute} ${ampm}`;
  };

  const formatSchedule = (days: string[], startHour: string, startMinute: string, startAmPm: string, endHour: string, endMinute: string, endAmPm: string): string => {
    if (!days.length) return '';

    // Sort days in order
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sortedDays = [...days].sort((a, b) => {
      return dayOrder.indexOf(a) - dayOrder.indexOf(b);
    });

    // Format days (Mon, Tue -> MW or Mon, Wed, Fri -> MWF)
    const dayAbbrs: Record<string, string> = {
      'Mon': 'M',
      'Tue': 'T',
      'Wed': 'W',
      'Thu': 'TH',
      'Fri': 'F',
      'Sat': 'SAT',
      'Sun': 'SUN'
    };

    let dayString = '';
    if (sortedDays.length === 2 && sortedDays.includes('Tue') && sortedDays.includes('Thu')) {
      dayString = 'TTH';
    } else {
      dayString = sortedDays.map(d => dayAbbrs[d] || d).join('');
    }

    const startTimeStr = formatTimeDisplay(startHour, startMinute, startAmPm);
    const endTimeStr = formatTimeDisplay(endHour, endMinute, endAmPm);

    return `${dayString} ${startTimeStr}-${endTimeStr}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validate required fields
      if (!formData.subjectCode) {
        setMessage('EDP Code is required.');
        setLoading(false);
        return;
      }

      if (!formData.subjectName) {
        setMessage('Subject Code is required.');
        setLoading(false);
        return;
      }

      if (!formData.descriptiveTitle) {
        setMessage('Descriptive Title is required.');
        setLoading(false);
        return;
      }

      if (formData.selectedDays.length === 0) {
        setMessage('Please select at least one day of the week.');
        setLoading(false);
        return;
      }

      // Format schedule from selected days and time
      const formattedSchedule = formatSchedule(
        formData.selectedDays,
        formData.startHour,
        formData.startMinute,
        formData.startAmPm,
        formData.endHour,
        formData.endMinute,
        formData.endAmPm
      );

      // Use the manually entered EDP code
      const subjectCode = formData.subjectCode.toUpperCase().trim();

      // Create the subject using the Subject Code and Descriptive Title
      await CreateSubject(
        formData.subjectName, // Subject Code goes to subject_code
        formData.descriptiveTitle, // Descriptive Title goes to description
        user?.id || 0,
        ''
      );

      // Create the class (teacher creates it for themselves)
      await CreateClass(
        formData.subjectName, // Subject Code for the class
        user?.id || 0,
        formData.subjectCode, // EDP Code
        formattedSchedule,
        formData.room,
        '',
        '',
        formData.semester,
        formData.schoolYear,
        formData.descriptiveTitle, // Descriptive Title for the class
        user?.id || 0  // Teacher creates the class themselves
      );

      setNotification({ type: 'success', message: 'Class created successfully!' });
      setMessage('Class created successfully!');

      setTimeout(() => {
        navigate('/teacher/class-management');
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage(`Failed to create class: ${errorMessage}`);
      setNotification({ type: 'error', message: `Failed to create class: ${errorMessage}` });
      setTimeout(() => setNotification(null), 5000);
      console.error('Creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
          }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setNotification(null)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate('/teacher/class-management');
          }
        }}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 relative max-h-[90vh] flex flex-col">
          <button
            type="button"
            onClick={() => navigate('/teacher/class-management')}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
          >
            ×
          </button>

          <div className="p-3 pb-2 flex-shrink-0 border-b">
            <h2 className="text-lg font-bold text-gray-800">
              Class Information
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* School Year and Semester - Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="schoolYear" className="block text-sm font-medium text-gray-700 mb-1">
                      School Year
                    </label>
                    <select
                      id="schoolYear"
                      value={formData.schoolYear}
                      onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="2023-2024">2023-2024</option>
                      <option value="2024-2025">2024-2025</option>
                      <option value="2025-2026">2025-2026</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1">
                      Semester
                    </label>
                    <select
                      id="semester"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                    </select>
                  </div>
                </div>

                {/* EDP Code, Subject Code, and Descriptive Title - 3 columns */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700 mb-1">
                      EDP Code
                    </label>
                    <input
                      type="text"
                      id="subjectCode"
                      value={formData.subjectCode}
                      onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 mb-1">
                      Subject Code
                    </label>
                    <input
                      type="text"
                      id="subjectName"
                      value={formData.subjectName}
                      onChange={(e) => setFormData({ ...formData, subjectName: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="descriptiveTitle" className="block text-sm font-medium text-gray-700 mb-1">
                      Descriptive Title
                    </label>
                    <input
                      type="text"
                      id="descriptiveTitle"
                      value={formData.descriptiveTitle}
                      onChange={(e) => setFormData({ ...formData, descriptiveTitle: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Schedule Section - Days and Time side by side */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Days block */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'Mon', label: 'M' },
                        { value: 'Tue', label: 'T' },
                        { value: 'Wed', label: 'W' },
                        { value: 'Thu', label: 'TH' },
                        { value: 'Fri', label: 'F' },
                        { value: 'Sat', label: 'SAT' },
                        { value: 'Sun', label: 'SUN' }
                      ].map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          variant={formData.selectedDays.includes(day.value) ? 'primary' : 'outline'}
                          className="min-w-[40px] h-10 px-2 rounded-full"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Time block */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <div className="space-y-2">
                      {/* Start Time */}
                      <div className="flex items-center gap-2">
                        <select
                          id="startHour"
                          value={formData.startHour}
                          onChange={(e) => setFormData({ ...formData, startHour: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                            <option key={hour} value={hour.toString()}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-500">:</span>
                        <select
                          id="startMinute"
                          value={formData.startMinute}
                          onChange={(e) => setFormData({ ...formData, startMinute: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {['00', '15', '30', '45'].map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                        <select
                          id="startAmPm"
                          value={formData.startAmPm}
                          onChange={(e) => setFormData({ ...formData, startAmPm: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      {/* End Time */}
                      <div className="flex items-center gap-2">
                        <select
                          id="endHour"
                          value={formData.endHour}
                          onChange={(e) => setFormData({ ...formData, endHour: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                            <option key={hour} value={hour.toString()}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-500">:</span>
                        <select
                          id="endMinute"
                          value={formData.endMinute}
                          onChange={(e) => setFormData({ ...formData, endMinute: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {['00', '15', '30', '45'].map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                        <select
                          id="endAmPm"
                          value={formData.endAmPm}
                          onChange={(e) => setFormData({ ...formData, endAmPm: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Room - Aligned with School Year, Subject Code, and Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-1">
                      ROOM
                    </label>
                    <input
                      type="text"
                      id="room"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div></div>
                </div>
              </div>

              {message && (
                <div className={`mt-4 p-4 rounded-md ${message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                  {message}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex-shrink-0 border-t px-6 py-4 flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => navigate('/teacher/class-management')}
                variant="outline"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={loading}
                variant="primary"
                loading={loading}
              >
                SAVE
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function ClassManagementDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isEditMode = searchParams.get('mode') === 'edit';
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<ClasslistEntry[]>([]);
  const [availableStudents, setAvailableStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [editFormData, setEditFormData] = useState({
    schedule: '',
    room: '',
    yearLevel: '',
    section: '',
    semester: '',
    schoolYear: ''
  });
  const [saving, setSaving] = useState(false);

  const loadClassDetails = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const classes = await GetTeacherClassesByUserID(user?.id || 0);
      const selectedClass = classes.find((c: any) => c.class_id === parseInt(id));

      if (selectedClass) {
        setClassInfo(selectedClass);
        setEditFormData({
          schedule: selectedClass.schedule || '',
          room: selectedClass.room || '',
          yearLevel: selectedClass.year_level || '',
          section: selectedClass.section || '',
          semester: selectedClass.semester || '',
          schoolYear: selectedClass.school_year || ''
        });
      }

      const studentsData = await GetClassStudents(parseInt(id));
      setStudents(studentsData || []);

      setError('');
    } catch (error) {
      console.error('Failed to load class details:', error);
      setError('Unable to load class details from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassDetails();
  }, [id, user?.id]);

  const handleRemoveStudent = async (studentId: number, classId: number) => {
    if (!confirm('Are you sure you want to remove this student from the class?')) {
      return;
    }

    try {
      await UnenrollStudentFromClassByIDs(studentId, classId);
      await loadClassDetails();
      alert('Student removed successfully!');
    } catch (error) {
      console.error('Failed to remove student:', error);
      alert('Failed to remove student. Please try again.');
    }
  };

  const handleAddStudent = async () => {
    if (!id) return;

    try {
      const available = await GetAllStudentsForEnrollment(parseInt(id));
      setAvailableStudents(available || []);
      setShowAddModal(true);
      setSelectedStudents(new Set());
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to load available students:', error);
      alert('Failed to load students. Please try again.');
    }
  };

  const handleEnrollStudents = async () => {
    if (!id || selectedStudents.size === 0) return;

    setEnrolling(true);
    try {
      const studentIds = Array.from(selectedStudents);
      await EnrollMultipleStudents(studentIds, parseInt(id), user?.id || 0);

      setShowAddModal(false);
      await loadClassDetails();
      alert(`Successfully enrolled ${selectedStudents.size} student(s)!`);
    } catch (error) {
      console.error('Failed to enroll students:', error);
      alert('Failed to enroll some students. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleEditClass = () => {
    if (!classInfo) return;
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !classInfo) return;

    setSaving(true);
    try {
      await UpdateClass(
        parseInt(id),
        editFormData.schedule,
        editFormData.room,
        editFormData.yearLevel,
        editFormData.section,
        editFormData.semester,
        editFormData.schoolYear,
        classInfo.is_active
      );
      setShowEditModal(false);
      await loadClassDetails();
      alert('Class updated successfully!');
    } catch (error) {
      console.error('Failed to update class:', error);
      alert('Failed to update class. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      return;
    }

    try {
      await DeleteClass(parseInt(id));
      alert('Class deleted successfully!');
      navigate('/teacher/class-management');
    } catch (error) {
      console.error('Failed to delete class:', error);
      alert('Failed to delete class. Please try again.');
    }
  };

  const toggleStudentSelection = (studentId: number) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const filteredAvailableStudents = availableStudents.filter(student =>
    !student.is_enrolled && (
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.middle_name && student.middle_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const filteredStudents = students.filter(student => {
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.student_code.toLowerCase().includes(searchLower) ||
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      (student.middle_name && student.middle_name.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Class not found</p>
          <button
            onClick={() => navigate('/teacher/class-management')}
            className="mt-4 text-primary-600 hover:text-primary-900"
          >
            Back to Class Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Single Class List Sheet - Bond Paper Style */}
        <div className="bg-white max-w-4xl mx-auto my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
          {/* Close Button - Inside Sheet */}
          <button
            onClick={() => navigate('/teacher/class-management')}
            className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Sheet Title and Controls */}
          <div className="mb-6 pb-4 border-b border-gray-400">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 tracking-wide">CLASS LIST</h2>
              <p className="text-xs text-gray-600 mt-1">School Year {classInfo.school_year || 'N/A'} • {classInfo.semester || 'N/A'}</p>
            </div>
            <div className="flex justify-end items-center gap-2">
              <Button
                onClick={loadClassDetails}
                disabled={loading}
                variant="outline"
                size="sm"
                title="Refresh class list"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
              {isEditMode && (
                <>
                  <Button
                    onClick={handleEditClass}
                    variant="outline"
                    size="sm"
                    icon={<Edit className="h-4 w-4" />}
                  >
                    Edit Class
                  </Button>
                  <Button
                    onClick={handleAddStudent}
                    variant="primary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add Student
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Combined Class Info and Student List Table */}
          <div className="overflow-hidden">
            <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
              {/* Class Information Header */}
              <thead>
                <tr>
                  <th colSpan={6} className="px-4 py-2 text-left border-b-2 border-gray-900">
                    <div className="text-gray-900 font-bold text-sm tracking-wide">CLASS INFORMATION</div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white text-sm">
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>Subject Code:</td>
                  <td className="px-4 py-2 text-gray-900">{classInfo.subject_code || 'N/A'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '100px' }}>Schedule:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={3}>{classInfo.schedule || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Subject Name:</td>
                  <td className="px-4 py-2 text-gray-900">{classInfo.subject_name || 'N/A'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={3}>{classInfo.room || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Instructor:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={5}>{classInfo.teacher_name || 'N/A'}</td>
                </tr>
              </tbody>

              {/* Student List Header */}
              <thead>
                <tr>
                  <th colSpan={6} className="px-4 py-3 text-left border-b-2 border-gray-900">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 font-bold text-sm tracking-wide">STUDENTS LIST</span>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>Total: {filteredStudents.length}</span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '25px' }}>No.</th>
                  <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '70px' }}>Student ID</th>
                  <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '130px' }}>Name</th>
                  <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase">Email</th>
                  <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '85px' }}>Contact</th>
                  {isEditMode && (
                    <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '65px' }}>Actions</th>
                  )}
                  {!isEditMode && <th style={{ width: '10px' }}></th>}
                </tr>
              </thead>

              {/* Student Rows */}
              <tbody className="bg-white text-xs">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student, index) => (
                    <tr key={student.student_user_id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-1 py-1.5 text-center font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-1 py-1.5 font-medium text-gray-900 text-xs">
                        {student.student_code}
                      </td>
                      <td className="px-1 py-1.5 text-gray-900">
                        {student.last_name}, {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''}
                      </td>
                      <td className="px-1 py-1.5 text-gray-700">
                        {student.email || '—'}
                      </td>
                      <td className="px-1 py-1.5 text-gray-700">
                        {student.contact_number || '—'}
                      </td>
                      {isEditMode && (
                        <td className="px-3 py-1.5 text-center">
                          <Button
                            onClick={() => handleRemoveStudent(student.student_user_id, student.class_id)}
                            variant="danger"
                            size="sm"
                            icon={<Trash2 className="h-3 w-3" />}
                          >
                            Remove
                          </Button>
                        </td>
                      )}
                      {!isEditMode && <td></td>}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <Users className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">No students enrolled</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="text-center p-8 pb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-blue-600 mb-2">Add Students to Class</h2>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Select students to enroll in {classInfo?.subject_code}</p>
            </div>

            <div className="px-8 pb-8 flex-1 overflow-hidden flex flex-col">
              <div className="mb-4 flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder=""
                  />
                </div>
              </div>

              <div className="mb-2 text-sm text-gray-600 flex-shrink-0">
                {selectedStudents.size > 0 ? (
                  <span className="font-semibold text-blue-600">
                    {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span>Select students to enroll</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredAvailableStudents.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={filteredAvailableStudents.length > 0 && filteredAvailableStudents.every(s => selectedStudents.has(s.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents(new Set(filteredAvailableStudents.map(s => s.id)));
                              } else {
                                setSelectedStudents(new Set());
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAvailableStudents.map((student) => (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedStudents.has(student.id) ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.student_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.last_name}, {student.first_name} {student.middle_name || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No students available</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm ? 'No students match your search criteria.' : 'All students are already enrolled or there are no students in the system.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 flex-shrink-0">
                <Button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleEnrollStudents}
                  disabled={selectedStudents.size === 0 || enrolling}
                  variant="primary"
                  loading={enrolling}
                >
                  {`Enroll ${selectedStudents.size > 0 ? selectedStudents.size : ''} Student${selectedStudents.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="text-center p-8 pb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-blue-600 mb-2">Edit Class</h2>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
            </div>

            <div className="px-8 pb-8 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
                  <input
                    type="text"
                    value={editFormData.schoolYear}
                    onChange={(e) => setEditFormData({ ...editFormData, schoolYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={editFormData.semester}
                    onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Semester</option>
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <input
                    type="text"
                    value={editFormData.schedule}
                    onChange={(e) => setEditFormData({ ...editFormData, schedule: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={editFormData.room}
                    onChange={(e) => setEditFormData({ ...editFormData, room: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                  <input
                    type="text"
                    value={editFormData.yearLevel}
                    onChange={(e) => setEditFormData({ ...editFormData, yearLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={editFormData.section}
                    onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  variant="primary"
                  loading={saving}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function AttendanceClassSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [allTeacherClasses, setAllTeacherClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeAttendanceMap, setActiveAttendanceMap] = useState<Map<number, string>>(new Map());
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Load all teacher classes for the modal dropdown
  useEffect(() => {
    const loadAllClasses = async () => {
      if (!user?.id) return;
      try {
        const data = await GetTeacherClassesByUserID(user.id);
        setAllTeacherClasses(data || []);
      } catch (error) {
        console.error('Failed to load all teacher classes:', error);
      }
    };
    loadAllClasses();
  }, [user?.id, refreshKey]);

  // Refresh when navigating back to this page
  useEffect(() => {
    if (location.pathname === '/teacher/attendance') {
      setRefreshKey(prev => prev + 1);
    }
  }, [location.pathname]);

  // Check for active attendance sheets (attendance records for today or recent dates)
  useEffect(() => {
    const checkActiveAttendance = async () => {
      if (!user?.id || classes.length === 0) return;

      setLoadingAttendance(true);
      const activeMap = new Map<number, string>();
      const today = new Date().toISOString().split('T')[0];

      // Check last 7 days for active attendance
      const datesToCheck: string[] = [today];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        datesToCheck.push(date.toISOString().split('T')[0]);
      }

      for (const cls of classes) {
        for (const date of datesToCheck) {
          try {
            const records = await GetClassAttendance(cls.class_id, date);
            if (records && records.length > 0 && records.some(r => r.status)) {
              // Found active attendance - use the most recent date
              if (!activeMap.has(cls.class_id) || date > (activeMap.get(cls.class_id) || '')) {
                activeMap.set(cls.class_id, date);
              }
              break; // Found attendance for this class, move to next class
            }
          } catch (err) {
            continue;
          }
        }
      }

      setActiveAttendanceMap(activeMap);
      setLoadingAttendance(false);
    };

    checkActiveAttendance();
  }, [classes, user?.id, refreshKey]);

  useEffect(() => {
    const loadClasses = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Get only classes that have attendance records initialized
        const data = await GetTeacherClassesWithAttendance(user.id);
        setClasses(data || []);
        setFilteredClasses(data || []);
        setError('');
      } catch (error) {
        console.error('Failed to load classes:', error);
        setError('Unable to load classes from server.');
      } finally {
        setLoading(false);
      }
    };

    loadClasses();
  }, [user?.id, refreshKey]);

  useEffect(() => {
    let filtered = classes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(cls =>
        (cls.teacher_name && cls.teacher_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        cls.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.school_year && cls.school_year.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.year_level && cls.year_level.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredClasses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, classes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'excused':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredClasses.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentClasses = filteredClasses.slice(startIndex, endIndex);
  const startEntry = filteredClasses.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredClasses.length);

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Attendance Management</h2>
          <Button
            onClick={() => setShowGenerateModal(true)}
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            ADD ATTENDANCE
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm">
          <p>{error}</p>
        </div>
      )}

      {/* Controls Section */}
      <div className="flex-shrink-0 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={10}>10 entries</option>
              <option value={25}>25 entries</option>
              <option value={50}>50 entries</option>
              <option value={100}>100 entries</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700">Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder=""
            />
          </div>
        </div>
      </div>

      {/* Classes Table */}
      {filteredClasses.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="border-2 border-gray-300">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    EDP Code
                  </th>
                  <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    Subject Code
                  </th>
                  <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    Descriptive Title
                  </th>
                  <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    Schedule
                  </th>
                  <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    Date
                  </th>
                  <th className="border border-gray-400 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {currentClasses.map((cls) => {
                  // Use latest_attendance_date from the class directly, or fall back to activeAttendanceMap
                  const latestDate = (cls as any).latest_attendance_date || activeAttendanceMap.get(cls.class_id);
                  const hasActiveAttendance = !!latestDate;

                  return (
                    <tr
                      key={cls.class_id}
                      className={`hover:bg-gray-50 ${hasActiveAttendance ? 'bg-green-50' : ''}`}
                    >
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {cls.edp_code || '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {cls.subject_code || '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {cls.descriptive_title || cls.subject_name || '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {cls.schedule || '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {hasActiveAttendance ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => navigate(`/teacher/attendance/${cls.class_id}${hasActiveAttendance ? `?date=${latestDate}` : ''}`)}
                            variant="outline"
                            size="sm"
                            className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                            icon={<Eye className="h-3 w-3" />}
                            title="View"
                            disabled={!hasActiveAttendance}
                          />
                          <Button
                            onClick={async () => {
                              if (!hasActiveAttendance) return;
                              if (window.confirm('Are you sure you want to archive this attendance? It will be moved to the Archive section.')) {
                                try {
                                  await ArchiveAttendanceSheet(cls.class_id, latestDate);
                                  // Refresh the class list
                                  setRefreshKey(prev => prev + 1);
                                  alert('Attendance archived successfully!');
                                } catch (error) {
                                  console.error('Failed to archive attendance:', error);
                                  alert('Failed to archive attendance. Please try again.');
                                }
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:bg-orange-50"
                            icon={<Archive className="h-3 w-3" />}
                            title="Archive"
                            disabled={!hasActiveAttendance}
                          />
                          <Button
                            onClick={async () => {
                              if (!hasActiveAttendance) return;
                              if (window.confirm('Are you sure you want to delete this attendance? This action cannot be undone.')) {
                                try {
                                  await DeleteAttendanceSheet(cls.class_id, latestDate);
                                  // Refresh the class list
                                  setRefreshKey(prev => prev + 1);
                                  alert('Attendance deleted successfully!');
                                } catch (error) {
                                  console.error('Failed to delete attendance:', error);
                                  alert('Failed to delete attendance. Please try again.');
                                }
                              }
                            }}
                            variant="danger"
                            size="sm"
                            icon={<Trash2 className="h-3 w-3" />}
                            title="Delete"
                            disabled={!hasActiveAttendance}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Section */}
      {filteredClasses.length > 0 && (
        <div className="flex-shrink-0 mt-2 flex items-center justify-between">
          <div className="text-xs text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredClasses.length} entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredClasses.length === 0 && !error && (
        <div className="text-center py-6">
          {searchTerm ? (
            <>
              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-xs font-medium text-gray-900">No matching classes found</h3>
              <div className="mt-4">
                <Button
                  onClick={() => setSearchTerm('')}
                  variant="outline"
                  size="sm"
                >
                  Clear Search
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-xs font-medium text-gray-900">No classes found</h3>
              <p className="mt-1 text-xs text-gray-500">
                You don't have any assigned classes yet.
              </p>
            </>
          )}
        </div>
      )}

      {/* Generate Attendance Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Generate Attendance</h3>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedClassId(null);
                  setGenerateError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {generateError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {generateError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class
                </label>
                <select
                  value={selectedClassId || ''}
                  onChange={(e) => setSelectedClassId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={generating}
                >
                  <option value="">-- Select a class --</option>
                  {allTeacherClasses.map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.subject_code} - {cls.subject_name} {cls.schedule ? `(${cls.schedule})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Date is automatically set to today</p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setSelectedClassId(null);
                    setGenerateError('');
                  }}
                  disabled={generating}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedClassId) {
                      setGenerateError('Please select a class');
                      return;
                    }

                    setGenerating(true);
                    setGenerateError('');

                    try {
                      const today = new Date().toISOString().split('T')[0];
                      await GenerateAttendanceFromLogs(selectedClassId, today, user?.id || 0);

                      // Update the active attendance map immediately
                      setActiveAttendanceMap(prev => {
                        const newMap = new Map(prev);
                        newMap.set(selectedClassId, today);
                        return newMap;
                      });

                      // Close modal
                      setShowGenerateModal(false);
                      setSelectedClassId(null);
                      
                      // Navigate to the attendance detail page for the class
                      navigate(`/teacher/attendance/${selectedClassId}?date=${today}`);
                    } catch (error) {
                      console.error('Failed to generate attendance:', error);
                      const errorMessage = error instanceof Error ? error.message : 'Failed to generate attendance';
                      if (errorMessage.includes('schedule')) {
                        setGenerateError('Class schedule is not set. Please set the schedule first.');
                      } else {
                        setGenerateError(errorMessage);
                      }
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating || !selectedClassId}
                  variant="success"
                  loading={generating}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function StoredAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'attendance' | 'classes'>('attendance');
  
  // Attendance state
  const [archivedSheets, setArchivedSheets] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceEntriesPerPage, setAttendanceEntriesPerPage] = useState(10);
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const [filteredAttendance, setFilteredAttendance] = useState<any[]>([]);
  const [unarchivingAttendance, setUnarchivingAttendance] = useState<string | null>(null);
  
  // Classes state
  const [archivedClasses, setArchivedClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [classEntriesPerPage, setClassEntriesPerPage] = useState(10);
  const [classCurrentPage, setClassCurrentPage] = useState(1);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [unarchivingClass, setUnarchivingClass] = useState<number | null>(null);

  useEffect(() => {
    loadArchivedSheets();
    loadArchivedClassesList();
  }, [user?.id]);

  useEffect(() => {
    // Filter attendance records based on search term
    if (!attendanceSearchTerm) {
      setFilteredAttendance(archivedSheets);
    } else {
      const searchLower = attendanceSearchTerm.toLowerCase();
      const filtered = archivedSheets.filter((sheet) => {
        const subjectName = (sheet.subject_name || '').toLowerCase();
        const subjectCode = (sheet.subject_code || '').toLowerCase();
        const dateStr = new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase();
        return subjectName.includes(searchLower) || subjectCode.includes(searchLower) || dateStr.includes(searchLower);
      });
      setFilteredAttendance(filtered);
    }
    setAttendanceCurrentPage(1);
  }, [attendanceSearchTerm, archivedSheets]);

  useEffect(() => {
    // Filter classes based on search term
    if (!classSearchTerm) {
      setFilteredClasses(archivedClasses);
    } else {
      const searchLower = classSearchTerm.toLowerCase();
      const filtered = archivedClasses.filter((cls) => {
        const subjectName = (cls.subject_name || '').toLowerCase();
        const subjectCode = (cls.subject_code || '').toLowerCase();
        const schoolYear = (cls.school_year || '').toLowerCase();
        return subjectName.includes(searchLower) || subjectCode.includes(searchLower) || schoolYear.includes(searchLower);
      });
      setFilteredClasses(filtered);
    }
    setClassCurrentPage(1);
  }, [classSearchTerm, archivedClasses]);

  const loadArchivedSheets = async () => {
    if (!user?.id) return;
    setLoadingAttendance(true);
    try {
      const sheets = await GetArchivedAttendanceSheets(user.id);
      setArchivedSheets(sheets || []);
    } catch (error) {
      console.error('Failed to load archived sheets:', error);
      setArchivedSheets([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const loadArchivedClassesList = async () => {
    if (!user?.id) return;
    setLoadingClasses(true);
    try {
      const classes = await GetArchivedClasses(user.id);
      setArchivedClasses(classes || []);
    } catch (error) {
      console.error('Failed to load archived classes:', error);
      setArchivedClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleUnarchiveAttendance = async (classId: number, date: string) => {
    const key = `${classId}-${date}`;
    setUnarchivingAttendance(key);
    try {
      await UnarchiveAttendanceSheet(classId, date);
      await loadArchivedSheets();
    } catch (error) {
      console.error('Failed to unarchive:', error);
    } finally {
      setUnarchivingAttendance(null);
    }
  };

  const handleUnarchiveClass = async (classId: number) => {
    setUnarchivingClass(classId);
    try {
      await UnarchiveClass(classId);
      await loadArchivedClassesList();
    } catch (error) {
      console.error('Failed to unarchive class:', error);
    } finally {
      setUnarchivingClass(null);
    }
  };

  const loading = activeTab === 'attendance' ? loadingAttendance : loadingClasses;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  // Calculate pagination for attendance
  const attendanceTotalPages = Math.ceil(filteredAttendance.length / attendanceEntriesPerPage);
  const attendanceStartIndex = (attendanceCurrentPage - 1) * attendanceEntriesPerPage;
  const attendanceEndIndex = attendanceStartIndex + attendanceEntriesPerPage;
  const currentAttendanceRecords = filteredAttendance.slice(attendanceStartIndex, attendanceEndIndex);
  const attendanceStartEntry = filteredAttendance.length > 0 ? attendanceStartIndex + 1 : 0;
  const attendanceEndEntry = Math.min(attendanceEndIndex, filteredAttendance.length);

  // Calculate pagination for classes
  const classTotalPages = Math.ceil(filteredClasses.length / classEntriesPerPage);
  const classStartIndex = (classCurrentPage - 1) * classEntriesPerPage;
  const classEndIndex = classStartIndex + classEntriesPerPage;
  const currentClassRecords = filteredClasses.slice(classStartIndex, classEndIndex);
  const classStartEntry = filteredClasses.length > 0 ? classStartIndex + 1 : 0;
  const classEndEntry = Math.min(classEndIndex, filteredClasses.length);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Archive</h2>
        <p className="text-sm text-gray-500 mt-1">
          View archived attendance sheets and class lists.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'attendance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Attendance Sheets
            {archivedSheets.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                {archivedSheets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'classes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Class Lists
            {archivedClasses.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                {archivedClasses.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Attendance Tab Content */}
      {activeTab === 'attendance' && (
        <>
          {/* Controls Section */}
          <div className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={attendanceEntriesPerPage}
                  onChange={(e) => {
                    setAttendanceEntriesPerPage(Number(e.target.value));
                    setAttendanceCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Search</span>
                <input
                  type="text"
                  value={attendanceSearchTerm}
                  onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder=""
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="flex-1 overflow-x-auto">
            {filteredAttendance.length > 0 ? (
              <div className="border-2 border-gray-300">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Date
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Subject
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Summary
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {currentAttendanceRecords.map((sheet) => (
                      <tr key={`${sheet.class_id}-${sheet.date}`} className="hover:bg-gray-50">
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">{sheet.subject_name}</div>
                          <div className="text-xs text-gray-500">{sheet.subject_code}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {sheet.present_count} Present
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              {sheet.absent_count} Absent
                            </span>
                            {sheet.late_count > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                {sheet.late_count} Late
                              </span>
                            )}
                            {sheet.excused_count > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {sheet.excused_count} Excused
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{sheet.student_count} total students</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => {
                                navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}`);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-900"
                              icon={<Eye className="h-4 w-4" />}
                            >
                              View
                            </Button>
                            <Button
                              onClick={() => handleUnarchiveAttendance(sheet.class_id, sheet.date)}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-900"
                              disabled={unarchivingAttendance === `${sheet.class_id}-${sheet.date}`}
                            >
                              {unarchivingAttendance === `${sheet.class_id}-${sheet.date}` ? 'Removing...' : 'Unarchive'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                {attendanceSearchTerm ? (
                  <>
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No matching archived records found</h3>
                    <div className="mt-4">
                      <Button
                        onClick={() => setAttendanceSearchTerm('')}
                        variant="outline"
                        size="sm"
                      >
                        Clear Search
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Archive className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No archived attendance sheets</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Archive attendance sheets from the Attendance Management page to see them here.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Section */}
          {filteredAttendance.length > 0 && (
            <div className="flex-shrink-0 mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {attendanceStartEntry} to {attendanceEndEntry} of {filteredAttendance.length} entries
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setAttendanceCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={attendanceCurrentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                >
                  {attendanceCurrentPage}
                </Button>
                <Button
                  onClick={() => setAttendanceCurrentPage(prev => Math.min(attendanceTotalPages, prev + 1))}
                  disabled={attendanceCurrentPage === attendanceTotalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Classes Tab Content */}
      {activeTab === 'classes' && (
        <>
          {/* Controls Section */}
          <div className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={classEntriesPerPage}
                  onChange={(e) => {
                    setClassEntriesPerPage(Number(e.target.value));
                    setClassCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Search</span>
                <input
                  type="text"
                  value={classSearchTerm}
                  onChange={(e) => setClassSearchTerm(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder=""
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="flex-1 overflow-x-auto">
            {filteredClasses.length > 0 ? (
              <div className="border-2 border-gray-300">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Subject
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Schedule
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        School Year
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Students
                      </th>
                      <th className="border border-gray-400 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {currentClassRecords.map((cls) => (
                      <tr key={cls.class_id} className="hover:bg-gray-50">
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">{cls.subject_name}</div>
                          <div className="text-xs text-gray-500">{cls.subject_code}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {cls.schedule || '-'}
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div>{cls.school_year || '-'}</div>
                          <div className="text-xs text-gray-500">{cls.semester || ''}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                          {cls.enrolled_count} enrolled
                        </td>
                        <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=view`)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-900"
                              icon={<Eye className="h-4 w-4" />}
                            >
                              View
                            </Button>
                            <Button
                              onClick={() => handleUnarchiveClass(cls.class_id)}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-900"
                              disabled={unarchivingClass === cls.class_id}
                            >
                              {unarchivingClass === cls.class_id ? 'Restoring...' : 'Unarchive'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                {classSearchTerm ? (
                  <>
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No matching archived classes found</h3>
                    <div className="mt-4">
                      <Button
                        onClick={() => setClassSearchTerm('')}
                        variant="outline"
                        size="sm"
                      >
                        Clear Search
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Library className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No archived classes</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Archive classes from the Class Management page to see them here.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Section */}
          {filteredClasses.length > 0 && (
            <div className="flex-shrink-0 mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {classStartEntry} to {classEndEntry} of {filteredClasses.length} entries
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setClassCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={classCurrentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                >
                  {classCurrentPage}
                </Button>
                <Button
                  onClick={() => setClassCurrentPage(prev => Math.min(classTotalPages, prev + 1))}
                  disabled={classCurrentPage === classTotalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AttendanceManagementDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  // Initialize selectedDate from URL params immediately
  const initialDate = searchParams.get('date') || '';
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [error, setError] = useState<string>('');
  // Initialize hasSelectedDate based on URL params
  const [hasSelectedDate, setHasSelectedDate] = useState(!!initialDate);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadClass = async () => {
      if (!id || !user?.id) return;

      setLoading(true);
      try {
        const classes = await GetTeacherClassesByUserID(user.id);
        const foundClass = classes.find((c: any) => c.class_id === parseInt(id));
        setSelectedClass(foundClass || null);
        setError('');

        // Check if date is in query params (from attendance list or generated)
        const dateParam = searchParams.get('date');
        const generatedParam = searchParams.get('generated');
        if (dateParam) {
          setSelectedDate(dateParam);
          setHasSelectedDate(true);
          if (generatedParam === 'true') {
            setIsGenerated(true);
          }
        }
      } catch (error) {
        console.error('Failed to load class:', error);
        setError('Unable to load class from server.');
      } finally {
        setLoading(false);
      }
    };

    loadClass();
  }, [id, user?.id, searchParams]);

  useEffect(() => {
    if (selectedClass && selectedDate && hasSelectedDate) {
      loadAttendance();
    } else if (!selectedDate) {
      setAttendanceRecords([]);
      setHasSelectedDate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.class_id, selectedDate, hasSelectedDate]);

  const loadAttendance = async () => {
    if (!selectedClass || !selectedDate) return;

    setLoadingAttendance(true);
    setError('');
    try {
      const records = await GetClassAttendance(selectedClass.class_id, selectedDate);
      console.log('Loaded attendance records:', records?.length || 0);
      setAttendanceRecords(records || []);
      // If no records found but we have a class, it might mean no students are enrolled
      if ((!records || records.length === 0) && selectedClass) {
        console.log('No attendance records found. This might mean no students are enrolled.');
      }
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setError('Unable to load attendance records. Please try again.');
      setAttendanceRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleDateChange = async (date: string) => {
    if (date) {
      // Show modal to confirm generating attendance
      setPendingDate(date);
      setShowGenerateModal(true);
    } else {
      setSelectedDate('');
      setHasSelectedDate(false);
      setAttendanceRecords([]);
    }
  };

  const handleGenerateAttendance = async () => {
    if (!selectedClass || !pendingDate || !user?.id) return;

    setGenerating(true);
    try {
      // Initialize attendance for the selected date
      await InitializeAttendanceForClass(selectedClass.class_id, pendingDate, user.id);

      // Set the date and load attendance
      setSelectedDate(pendingDate);
      setHasSelectedDate(true);
      setShowGenerateModal(false);
      setPendingDate('');

      // Load attendance records
      await loadAttendance();
    } catch (error) {
      console.error('Failed to generate attendance:', error);
      setError('Failed to generate attendance. Please try again.');
      setShowGenerateModal(false);
      setPendingDate('');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelGenerate = () => {
    setShowGenerateModal(false);
    setPendingDate('');
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'excused':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !selectedClass) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!selectedClass) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Class not found</p>
          <button
            onClick={() => navigate('/teacher/attendance')}
            className="mt-4 text-primary-600 hover:text-primary-900"
          >
            Back to Class Selection
          </button>
        </div>
      </div>
    );
  }

  const handleSaveAll = async () => {
    // Save all attendance records
    if (!selectedClass || !selectedDate) return;

    setSaving(true);
    try {
      // Initialize attendance if not already done
      if (attendanceRecords.length === 0) {
        await InitializeAttendanceForClass(selectedClass.class_id, selectedDate, user?.id || 0);
        await loadAttendance();
      }

      // Small delay to ensure save completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back to attendance management - the attendance is now active/saved
      navigate('/teacher/attendance', { replace: true });
    } catch (error) {
      console.error('Failed to save attendance:', error);
      alert('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClick = () => {
    // Just navigate back directly without confirmation
    navigate('/teacher/attendance');
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    navigate('/teacher/attendance');
  };

  const handleArchive = async () => {
    if (!selectedClass || !selectedDate) return;

    setArchiving(true);
    try {
      await ArchiveAttendanceSheet(selectedClass.class_id, selectedDate);
      // Navigate to archive page after successful archive
      navigate('/teacher/stored-attendance', { replace: true });
    } catch (error) {
      console.error('Failed to archive attendance:', error);
      alert('Failed to archive attendance. Please try again.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md max-w-7xl mx-auto">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* No date picker needed - attendance is only created via ADD ATTENDANCE button */}
        {!loading && !hasSelectedDate && selectedClass && (
          <div className="bg-white shadow rounded-lg p-6 mb-6 border border-gray-300 max-w-4xl mx-auto relative">
            {/* Close Button */}
            <button
              onClick={() => navigate('/teacher/attendance')}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Attendance Selected</h3>
              <p className="text-sm text-gray-500 mb-4">Use the "ADD ATTENDANCE" button to create a new attendance sheet for this class.</p>
              <Button
                onClick={() => navigate('/teacher/attendance')}
                variant="outline"
              >
                Back to Attendance Management
              </Button>
            </div>
          </div>
        )}

        {/* Single Attendance Sheet - Bond Paper Style */}
        {!loading && selectedClass && hasSelectedDate && (
          <div className="bg-white max-w-4xl mx-auto my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
            {/* Close Button - Inside Sheet */}
            <button
              onClick={handleCancelClick}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Sheet Title */}
            <div className="mb-6 pb-4 border-b border-gray-400 text-center">
              <h2 className="text-xl font-bold text-gray-900 tracking-wide">ATTENDANCE SHEET</h2>
              <p className="text-xs text-gray-600 mt-1">
                {new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Combined Class Info and Attendance Table */}
            {loadingAttendance ? (
              <div className="px-6 py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading attendance records...</p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden">
                  <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                    {/* Class Information Header */}
                    <thead>
                      <tr>
                        <th colSpan={7} className="px-4 py-2 text-left border-b-2 border-gray-900">
                          <div className="text-gray-900 font-bold text-sm tracking-wide">CLASS INFORMATION</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-sm">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '90px' }}>Subject:</td>
                        <td className="px-3 py-2 text-gray-900" colSpan={2}>{selectedClass.subject_code} - {selectedClass.subject_name}</td>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '80px' }}>Schedule:</td>
                        <td className="px-3 py-2 text-gray-900" colSpan={3}>{selectedClass.schedule || '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Instructor:</td>
                        <td className="px-3 py-2 text-gray-900" colSpan={2}>{selectedClass.teacher_name || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                        <td className="px-3 py-2 text-gray-900" colSpan={3}>{selectedClass.room || '—'}</td>
                      </tr>
                    </tbody>

                    {/* Attendance List Header */}
                    <thead>
                      <tr>
                        <th colSpan={7} className="px-4 py-3 text-left border-b-2 border-gray-900">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold text-sm tracking-wide">DAILY ATTENDANCE RECORD</span>
                            <span className="text-xs text-gray-600">Total Students: {attendanceRecords.length}</span>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '40px' }}>No.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '90px' }}>Student ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Student Name</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '70px' }}>Time In</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '70px' }}>Time Out</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Status</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '100px' }}>Remarks</th>
                      </tr>
                    </thead>

                    {/* Student Attendance Rows */}
                    <tbody className="bg-white text-xs">
                      {attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record, index) => (
                          <tr key={`${record.class_id}-${record.student_user_id}-${record.date}`} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-2 py-1.5 text-center font-medium text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-gray-900">
                              {record.student_code}
                            </td>
                            <td className="px-3 py-1.5 text-gray-900">
                              {record.last_name}, {record.first_name} {record.middle_name ? record.middle_name.charAt(0) + '.' : ''}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {record.time_in ? (
                                <span className="text-green-700 font-medium">{record.time_in}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {record.time_out ? (
                                <span className="text-blue-700 font-medium">{record.time_out}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {record.status ? (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(record.status)}`}>
                                  {record.status === 'present' ? 'PRESENT' : record.status === 'absent' ? 'ABSENT' : record.status === 'late' ? 'LATE' : record.status.toUpperCase()}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-600">
                                  NO STATUS
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-gray-700">
                              {record.remarks || '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center">
                            <ClipboardList className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                            <p className="text-sm text-gray-500">No students enrolled in this class yet.</p>
                            <p className="text-xs text-gray-400 mt-1">Students will appear here once they are enrolled.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Summary Footer */}
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex gap-4 font-medium">
                              <span className="text-green-700">
                                Present: {attendanceRecords.filter(r => r.status === 'present').length}
                              </span>
                              <span className="text-yellow-700">
                                Late: {attendanceRecords.filter(r => r.status === 'late').length}
                              </span>
                              <span className="text-red-700">
                                Absent: {attendanceRecords.filter(r => r.status === 'absent').length}
                              </span>
                              <span className="text-gray-600">
                                No Status: {attendanceRecords.filter(r => !r.status || r.status === '').length}
                              </span>
                            </div>
                            <div className="font-bold text-gray-900">
                              Total: {attendanceRecords.length}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

      {/* Generate Attendance Modal */}
      {showGenerateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelGenerate();
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 relative">
            <button
              type="button"
              onClick={handleCancelGenerate}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Generate Attendance
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create attendance records for this date
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Class:</span>
                    <span className="font-medium text-gray-900">{selectedClass?.subject_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium text-gray-900">
                      {pendingDate ? new Date(pendingDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Schedule:</span>
                    <span className="font-medium text-gray-900">{selectedClass?.schedule || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    This will create an attendance sheet for the selected date.
                    Enrolled students will initially be marked as absent. You can still create an attendance sheet even if no students are enrolled yet.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={handleCancelGenerate}
                  disabled={generating}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerateAttendance}
                  disabled={generating}
                  variant="primary"
                  loading={generating}
                  icon={!generating ? <CheckCircle className="h-4 w-4" /> : undefined}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Attendance?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to cancel? Any unsaved changes will be lost.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => setShowCancelConfirm(false)}
                  variant="secondary"
                >
                  No
                </Button>
                <Button
                  onClick={handleConfirmCancel}
                  variant="danger"
                >
                  Yes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/teacher' },
    { name: 'Class Management', href: '/teacher/class-management', icon: <Library className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/class-management') },
    { name: 'Attendance', href: '/teacher/attendance', icon: <CalendarPlus className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/attendance') && !location.pathname.includes('/stored') },
    { name: 'Login History', href: '/teacher/login-history', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/teacher/login-history' },
    { name: 'Archive', href: '/teacher/stored-attendance', icon: <Archive className="h-5 w-5" />, current: location.pathname === '/teacher/stored-attendance' },
  ];

  return (
    <Layout navigationItems={navigationItems} title="Teacher Dashboard">
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="class-management" element={<ClassManagement />} />
        <Route path="create-classlist" element={<CreateClasslist />} />
        <Route path="class-management/:id" element={<ClassManagementDetail />} />
        <Route path="attendance/:id" element={<AttendanceManagementDetail />} />
        <Route path="attendance" element={<AttendanceClassSelection />} />
        <Route path="login-history" element={<TeacherLoginHistory />} />
        <Route path="stored-attendance" element={<StoredAttendance />} />
      </Routes>
    </Layout>
  );
}

export default TeacherDashboard;
