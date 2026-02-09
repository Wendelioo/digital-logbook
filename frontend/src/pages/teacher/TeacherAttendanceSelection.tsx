import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import {
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Plus,
  Archive,
  X,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  GetClassAttendance,
  GetTeacherClassesWithAttendance,
  ArchiveAttendanceSheet,
  DeleteAttendanceSheet,
  GenerateAttendanceFromLogs,
  FinalizeAttendanceSheet,
  UnfinalizeAttendanceSheet,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

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
      console.log('Navigated back to attendance management - refreshing data');
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
        console.log('Loading classes with attendance... (refreshKey:', refreshKey, ')');
        // Get only classes that have attendance records initialized
        const data = await GetTeacherClassesWithAttendance(user.id);
        console.log('Loaded', data?.length || 0, 'classes with attendance');
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
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    EDP Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descriptive Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentClasses.map((cls) => {
                  // Use latest_attendance_date from the class directly, or fall back to activeAttendanceMap
                  const latestDate = (cls as any).latest_attendance_date || activeAttendanceMap.get(cls.class_id);
                  const hasActiveAttendance = !!latestDate;

                  return (
                    <tr
                      key={cls.class_id}
                      className={`hover:bg-gray-50 transition-colors ${hasActiveAttendance ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cls.edp_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cls.subject_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cls.descriptive_title || cls.subject_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cls.schedule || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hasActiveAttendance ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {hasActiveAttendance ? (
                          <button
                            onClick={async () => {
                              try {
                                if (cls.is_attendance_finalized) {
                                  await UnfinalizeAttendanceSheet(cls.class_id, latestDate);
                                } else {
                                  await FinalizeAttendanceSheet(cls.class_id, latestDate);
                                }
                                // Refresh the class list
                                setRefreshKey(prev => prev + 1);
                              } catch (error) {
                                console.error('Failed to update attendance status:', error);
                                alert('Failed to update attendance status. Please try again.');
                              }
                            }}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                              cls.is_attendance_finalized
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            }`}
                            title={cls.is_attendance_finalized ? 'Click to mark as Active' : 'Click to mark as Done'}
                          >
                            {cls.is_attendance_finalized ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Done
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Active
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            No Attendance
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => navigate(`/teacher/attendance/${cls.class_id}${hasActiveAttendance ? `?date=${latestDate}` : ''}`)}
                            variant="outline"
                            size="sm"
                            className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                            icon={<Edit className="h-3 w-3" />}
                            title="Edit"
                            disabled={!hasActiveAttendance}
                          />
                          <Button
                            onClick={async () => {
                              if (!hasActiveAttendance) return;
                              if (window.confirm('Are you sure you want to archive this attendance? It will be moved to the Archive section.')) {
                                try {
                                  await ArchiveAttendanceSheet(cls.class_id, latestDate);
                                  // Refresh the class list immediately
                                  setRefreshKey(prev => prev + 1);
                                  // Give a brief moment for the state to update
                                  setTimeout(() => {
                                    alert('Attendance archived successfully!');
                                  }, 100);
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
                      console.log('Generating attendance for class', selectedClassId, 'on', today);
                      await GenerateAttendanceFromLogs(selectedClassId, today, user?.id || 0);
                      console.log('Attendance generated successfully');

                      // Close modal first
                      setShowGenerateModal(false);
                      const classIdToNavigate = selectedClassId;
                      setSelectedClassId(null);

                      // Update the active attendance map immediately
                      setActiveAttendanceMap(prev => {
                        const newMap = new Map(prev);
                        newMap.set(classIdToNavigate, today);
                        return newMap;
                      });

                      // Reload the class list to include the newly generated attendance
                      console.log('Reloading class list after generation...');
                      const data = await GetTeacherClassesWithAttendance(user?.id || 0);
                      console.log('Reloaded classes:', data?.length || 0, 'classes found');
                      setClasses(data || []);
                      setFilteredClasses(data || []);
                      
                      // Navigate to the attendance detail page for the class
                      navigate(`/teacher/attendance/${classIdToNavigate}?date=${today}&generated=true`);
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

export default AttendanceClassSelection;
