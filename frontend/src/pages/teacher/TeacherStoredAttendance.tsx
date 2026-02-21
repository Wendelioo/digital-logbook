import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import {
  Eye,
  Archive,
  Library,
  Download,
} from 'lucide-react';
import {
  ExportAttendanceCSV,
  ExportClasslistCSV,
  GetArchivedAttendanceSheets,
  UnarchiveAttendanceSheet,
  GetArchivedClasses,
  UnarchiveClass,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

export type StoredAttendanceTab = 'attendance' | 'classes';

interface StoredAttendanceProps {
  initialTab?: StoredAttendanceTab;
  hideHeader?: boolean;
}

function StoredAttendance({ initialTab, hideHeader = false }: StoredAttendanceProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resolvedInitialTab: StoredAttendanceTab = initialTab || (searchParams.get('tab') === 'classes' ? 'classes' : 'attendance');
  const [activeTab, setActiveTab] = useState<StoredAttendanceTab>(resolvedInitialTab);
  
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
  
  // Export state
  const [exportingAttendance, setExportingAttendance] = useState<string | null>(null);
  const [exportingClasslist, setExportingClasslist] = useState<number | null>(null);

  const handleExportAttendance = async (classId: number, date: string) => {
    const key = `${classId}-${date}`;
    setExportingAttendance(key);
    try {
      const filePath = await ExportAttendanceCSV(classId);
      alert(`Attendance exported successfully!\nFile saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to export attendance:', error);
      alert('Failed to export attendance. Please try again.');
    } finally {
      setExportingAttendance(null);
    }
  };

  const handleExportClasslist = async (classId: number) => {
    setExportingClasslist(classId);
    try {
      const filePath = await ExportClasslistCSV(classId);
      alert(`Classlist exported successfully!\nFile saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to export classlist:', error);
      alert('Failed to export classlist. Please try again.');
    } finally {
      setExportingClasslist(null);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'classes' ? 'classes' : 'attendance');
  }, [initialTab, searchParams]);

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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
      {!hideHeader && (
        <div className="flex-shrink-0 mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === 'classes' ? 'Archived Classlist' : 'Archived Attendance'}
          </h2>
        </div>
      )}

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
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredAttendance.length > 0 ? (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                        Summary
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentAttendanceRecords.map((sheet) => (
                      <tr key={`${sheet.class_id}-${sheet.date}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">{sheet.subject_name}</div>
                          <div className="text-xs text-gray-500">{sheet.subject_code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{sheet.student_count} total students</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Archived
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}`, {
                                  state: {
                                    fromArchiveModal: true,
                                    returnToArchiveTab: 'attendance',
                                  },
                                });
                              }}
                              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleUnarchiveAttendance(sheet.class_id, sheet.date)}
                              className="p-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                              disabled={unarchivingAttendance === `${sheet.class_id}-${sheet.date}`}
                              title="Unarchive"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
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
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredClasses.length > 0 ? (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '150px' }}>
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                        School Year
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentClassRecords.map((cls) => (
                      <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">{cls.subject_name}</div>
                          <div className="text-xs text-gray-500">{cls.subject_code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {cls.schedule || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{cls.school_year || '-'}</div>
                          <div className="text-xs text-gray-500">{cls.semester || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=view`, {
                                state: {
                                  fromArchiveModal: true,
                                  returnToArchiveTab: 'classes',
                                },
                              })}
                              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleUnarchiveClass(cls.class_id)}
                              className="p-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                              disabled={unarchivingClass === cls.class_id}
                              title="Unarchive"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
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

export default StoredAttendance;
