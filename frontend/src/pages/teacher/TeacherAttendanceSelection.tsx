import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import {
  Edit,
  Archive,
  Eye,
  Plus,
  X,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  GetActiveAttendanceSheets,
  OpenClassAttendance,
  ArchiveAttendanceSheet,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

// Attendance sheet summary from backend
interface AttendanceSheet {
  class_id: number;
  date: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
  schedule: string;
  student_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  is_archived: boolean;
  is_editable: boolean;
}

function AttendanceClassSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [allTeacherClasses, setAllTeacherClasses] = useState<Class[]>([]);
  const [attendanceSheets, setAttendanceSheets] = useState<AttendanceSheet[]>([]);
  const [filteredSheets, setFilteredSheets] = useState<AttendanceSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingAttendance, setOpeningAttendance] = useState<number | null>(null);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // Load all teacher classes for the "Add Attendance" dropdown
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

  // Load active attendance sheets
  useEffect(() => {
    const loadAttendanceSheets = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const data = await GetActiveAttendanceSheets(user.id);
        setAttendanceSheets(data || []);
        setFilteredSheets(data || []);
        setError('');
      } catch (error) {
        console.error('Failed to load attendance sheets:', error);
        setError('Unable to load attendance data from server.');
      } finally {
        setLoading(false);
      }
    };

    loadAttendanceSheets();
  }, [user?.id, refreshKey]);

  // Filter by search term
  useEffect(() => {
    let filtered = attendanceSheets;
    if (searchTerm) {
      filtered = filtered.filter(sheet =>
        sheet.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sheet.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sheet.edp_code && sheet.edp_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        sheet.date.includes(searchTerm)
      );
    }
    setFilteredSheets(filtered);
    setCurrentPage(1);
  }, [searchTerm, attendanceSheets]);

  // Add attendance for a class - auto-creates attendance for today
  const handleTakeAttendance = async (classId: number) => {
    setOpeningAttendance(classId);
    try {
      const today = new Date().toISOString().split('T')[0];
      // OpenClassAttendance auto-creates attendance if it doesn't exist
      await OpenClassAttendance(classId, today);
      // Navigate to the attendance detail page
      navigate(`/teacher/attendance/${classId}?date=${today}`);
    } catch (error) {
      console.error('Failed to open attendance:', error);
      alert('Failed to open attendance. Please try again.');
    } finally {
      setOpeningAttendance(null);
      setShowAddModal(false);
    }
  };

  // Handle modal submission
  const handleAddAttendanceSubmit = () => {
    if (selectedClassId) {
      handleTakeAttendance(selectedClassId);
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
  const totalPages = Math.ceil(filteredSheets.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentSheets = filteredSheets.slice(startIndex, endIndex);
  const startEntry = filteredSheets.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredSheets.length);

  const today = new Date().toISOString().split('T')[0];
  const activeClasses = allTeacherClasses.filter(cls => cls.is_active);

  return (
    <div className="flex flex-col">
      {/* Header Section with Add Button */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Attendance Management</h2>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
          >
            Add New
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

      {/* Attendance Sheets Table */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                  EDP Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '150px' }}>
                  Schedule
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                  Summary
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentSheets.length > 0 ? (
                currentSheets.map((sheet) => {
                  const isToday = sheet.date === today;

                  return (
                    <tr
                      key={`${sheet.class_id}-${sheet.date}`}
                      className={`hover:bg-gray-50 transition-colors ${isToday ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sheet.edp_code || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {sheet.subject_code} - {sheet.subject_name}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {sheet.schedule || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sheet.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="text-green-700 font-medium">P:{sheet.present_count}</span>
                          <span className="text-red-700 font-medium">A:{sheet.absent_count}</span>
                          <span className="text-yellow-700 font-medium">L:{sheet.late_count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {isToday ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Editable
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Read-only
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          {isToday ? (
                            <Button
                              onClick={() => navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}`)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                              icon={<Edit className="h-3 w-3" />}
                              title="Edit Attendance"
                            />
                          ) : (
                            <Button
                              onClick={() => navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}`)}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 bg-gray-50 hover:bg-gray-100"
                              icon={<Eye className="h-3 w-3" />}
                              title="View Attendance"
                            />
                          )}
                          {/* Archive button - only for past dates (not today) */}
                          {!isToday && (
                            <Button
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to archive this attendance? It will be moved to the Archive section.')) {
                                  try {
                                    await ArchiveAttendanceSheet(sheet.class_id, sheet.date);
                                    setRefreshKey(prev => prev + 1);
                                    alert('Attendance archived successfully!');
                                  } catch (error) {
                                    console.error('Failed to archive attendance:', error);
                                    alert('Failed to archive attendance. ' + (error instanceof Error ? error.message : 'Please try again.'));
                                  }
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:bg-orange-50"
                              icon={<Archive className="h-3 w-3" />}
                              title="Archive"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    {searchTerm ? (
                      <>
                        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No matching attendance records found</h3>
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
                        <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <h3 className="text-sm font-medium text-gray-900">No attendance records yet</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Click "Add New" to create attendance for your classes.
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Pagination Section */}
      {filteredSheets.length > 0 && (
        <div className="flex-shrink-0 mt-2 flex items-center justify-between">
          <div className="text-xs text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredSheets.length} entries
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

      {/* Add Attendance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Generate Attendance</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedClassId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Class
                </label>
                {activeClasses.length > 0 ? (
                  <select
                    value={selectedClassId || ''}
                    onChange={(e) => setSelectedClassId(Number(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select a class --</option>
                    {activeClasses.map((cls) => (
                      <option key={cls.class_id} value={cls.class_id}>
                        {cls.edp_code ? `${cls.edp_code} - ` : ''}{cls.subject_code} - {cls.subject_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    No active classes assigned. Contact the administrator to assign classes to your account.
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Attendance is generated for today's date.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedClassId(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAttendanceSubmit}
                variant="primary"
                disabled={!selectedClassId || openingAttendance !== null}
              >
                {openingAttendance ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceClassSelection;
