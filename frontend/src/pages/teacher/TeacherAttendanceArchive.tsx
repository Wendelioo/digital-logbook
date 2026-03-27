import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import {
  Eye,
  ArchiveRestore,
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';
import {
  ExportClasslistCSV,
  ExportClasslistPDF,
  ExportClasslistDOCX,
  ExportArchivedAttendanceCSVByDate,
  ExportArchivedAttendancePDFByDate,
  ExportArchivedAttendanceDOCXByDate,
  GetArchivedAttendanceSheets,
  UnarchiveAttendanceSession,
  GetArchivedClasses,
  UnarchiveClass,
} from '../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultClasslistFilename, defaultAttendanceFilename, type ExportFormat } from '../../utils/exportSaveDialog';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

export type AttendanceArchiveTab = 'attendance' | 'classes';

interface AttendanceArchiveProps {
  initialTab?: AttendanceArchiveTab;
  hideHeader?: boolean;
  onClassUnarchived?: () => void;
  onAttendanceUnarchived?: () => void;
}

function TeacherAttendanceArchive({ initialTab, hideHeader = false, onClassUnarchived, onAttendanceUnarchived }: AttendanceArchiveProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resolvedInitialTab: AttendanceArchiveTab = initialTab || (searchParams.get('tab') === 'classes' ? 'classes' : 'attendance');
  const [activeTab, setActiveTab] = useState<AttendanceArchiveTab>(resolvedInitialTab);
  
  // Attendance state
  const [archivedSheets, setArchivedSheets] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceEntriesPerPage, setAttendanceEntriesPerPage] = useState(10);
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const [filteredAttendance, setFilteredAttendance] = useState<any[]>([]);
  const [unarchivingAttendance, setUnarchivingAttendance] = useState<string | null>(null);
  const [downloadingAttendance, setDownloadingAttendance] = useState<string | null>(null);
  const [attendanceExportDropdown, setAttendanceExportDropdown] = useState<{ key: string; top: number; left: number } | null>(null);

  // Classes state
  const [archivedClasses, setArchivedClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [classEntriesPerPage, setClassEntriesPerPage] = useState(10);
  const [classCurrentPage, setClassCurrentPage] = useState(1);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [unarchivingClass, setUnarchivingClass] = useState<number | null>(null);
  const [downloadingClasslist, setDownloadingClasslist] = useState<number | null>(null);
  const [classExportDropdown, setClassExportDropdown] = useState<{ classId: number; top: number; left: number } | null>(null);

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
        const dateStr = new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).toLowerCase();
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

  const handleUnarchiveAttendance = async (classId: number, date: string, sessionId?: number) => {
    const key = sessionId ? `${classId}-${date}-${sessionId}` : `${classId}-${date}`;
    setUnarchivingAttendance(key);
    try {
      // Only unarchive the specific sheet (session) you chose — never by date, so we never restore others.
      const sid = sessionId != null ? Number(sessionId) : 0;
      if (sid > 0 && user?.id != null) {
        await UnarchiveAttendanceSession(sid, Number(user.id));
      } else {
        alert('Cannot restore: this sheet has no session. Only individual sheets can be restored.');
        return;
      }
      await loadArchivedSheets();
      onAttendanceUnarchived?.();
    } catch (error) {
      console.error('Failed to restore:', error);
      const msg = error instanceof Error ? error.message : 'Failed to unarchive attendance. Please try again.';
      alert(msg);
    } finally {
      setUnarchivingAttendance(null);
    }
  };

  const handleUnarchiveClass = async (classId: number) => {
    setUnarchivingClass(classId);
    try {
      await UnarchiveClass(classId);
      await loadArchivedClassesList();
      onClassUnarchived?.();
    } catch (error) {
      console.error('Failed to restore class:', error);
    } finally {
      setUnarchivingClass(null);
    }
  };

  const handleDownloadArchivedClasslist = async (cls: Class, format: ExportFormat) => {
    setDownloadingClasslist(cls.class_id);
    setClassExportDropdown(null);
    const savePath = await openExportSaveDialog('Save classlist', defaultClasslistFilename(format), format);
    if (!savePath) {
      setDownloadingClasslist(null);
      return;
    }
    try {
      let filePath: string;
      if (format === 'csv') {
        filePath = await ExportClasslistCSV(cls.class_id, savePath);
      } else if (format === 'pdf') {
        filePath = await ExportClasslistPDF(cls.class_id, savePath);
      } else {
        filePath = await ExportClasslistDOCX(cls.class_id, savePath);
      }
      alert(`Archived classlist exported successfully.\nFile saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to download archived classlist:', error);
      alert('Failed to download archived classlist. Please try again.');
    } finally {
      setDownloadingClasslist(null);
    }
  };

  const getSheetKey = (sheet: any) => (sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`);

  const handleDownloadArchivedAttendance = async (sheet: any, format: ExportFormat) => {
    const key = sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`;

    const defaultName = defaultAttendanceFilename(sheet.date, format, true);
    const savePath = await openExportSaveDialog('Save archived attendance', defaultName, format);
    if (!savePath) return;

    setDownloadingAttendance(key);
    setAttendanceExportDropdown(null);
    try {
      const sessionId = Number(sheet.session_id) || 0;
      let filePath: string;
      if (format === 'csv') {
        filePath = await ExportArchivedAttendanceCSVByDate(sheet.class_id, sheet.date, sessionId, savePath);
      } else if (format === 'pdf') {
        filePath = await ExportArchivedAttendancePDFByDate(sheet.class_id, sheet.date, sessionId, savePath);
      } else {
        filePath = await ExportArchivedAttendanceDOCXByDate(sheet.class_id, sheet.date, sessionId, savePath);
      }
      alert(`Archived attendance sheet exported successfully.\nFile saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to download archived attendance:', error);
      alert('Failed to download archived attendance. Please try again.');
    } finally {
      setDownloadingAttendance(null);
    }
  };

  const loading = activeTab === 'attendance' ? loadingAttendance : loadingClasses;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
        </div>
      </div>
    );
  }

  // Calculate pagination for attendance
  const attendanceIsShowingAll = attendanceEntriesPerPage === -1;
  const attendanceTotalPages = attendanceIsShowingAll ? 1 : Math.ceil(filteredAttendance.length / attendanceEntriesPerPage);
  const attendanceStartIndex = attendanceIsShowingAll ? 0 : (attendanceCurrentPage - 1) * attendanceEntriesPerPage;
  const attendanceEndIndex = attendanceIsShowingAll ? filteredAttendance.length : attendanceStartIndex + attendanceEntriesPerPage;
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
      {/* Fixed export dropdowns (so CSV/PDF/DOCX are not clipped by overflow) */}
      {attendanceExportDropdown && (() => {
        const sheet = filteredAttendance.find((s) => getSheetKey(s) === attendanceExportDropdown.key);
        if (!sheet) return null;
        return (
          <div
            style={{ position: 'fixed', top: attendanceExportDropdown.top, left: attendanceExportDropdown.left, zIndex: 9999 }}
            className="w-44 bg-white border border-gray-200 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setAttendanceExportDropdown(null); handleDownloadArchivedAttendance(sheet, 'csv'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-t-lg"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export CSV
            </button>
            <button
              onClick={() => { setAttendanceExportDropdown(null); handleDownloadArchivedAttendance(sheet, 'pdf'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              Export PDF
            </button>
            <button
              onClick={() => { setAttendanceExportDropdown(null); handleDownloadArchivedAttendance(sheet, 'docx'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-b-lg"
            >
              <FileType className="h-3.5 w-3.5 text-blue-600" />
              Export DOCX
            </button>
          </div>
        );
      })()}
      {classExportDropdown && (() => {
        const cls = filteredClasses.find((c) => c.class_id === classExportDropdown.classId);
        if (!cls) return null;
        return (
          <div
            style={{ position: 'fixed', top: classExportDropdown.top, left: classExportDropdown.left, zIndex: 9999 }}
            className="w-44 bg-white border border-gray-200 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setClassExportDropdown(null); handleDownloadArchivedClasslist(cls, 'csv'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-t-lg"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export CSV
            </button>
            <button
              onClick={() => { setClassExportDropdown(null); handleDownloadArchivedClasslist(cls, 'pdf'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              Export PDF
            </button>
            <button
              onClick={() => { setClassExportDropdown(null); handleDownloadArchivedClasslist(cls, 'docx'); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-b-lg"
            >
              <FileType className="h-3.5 w-3.5 text-blue-600" />
              Export DOCX
            </button>
          </div>
        );
      })()}

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
                  <option value={-1}>All</option>
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
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '160px' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentAttendanceRecords.map((sheet) => (
                      <tr key={sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
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
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => {
                                const sessionQuery = sheet.session_id ? `&sessionId=${sheet.session_id}` : '';
                                navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}${sessionQuery}`, {
                                  state: {
                                    fromArchiveModal: true,
                                    returnToArchiveTab: 'attendance',
                                  },
                                });
                              }}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 bg-gray-50 hover:bg-gray-100"
                              icon={<Eye className="h-3 w-3" />}
                              title="View Attendance"
                            />
                            <Button
                              onClick={() => handleUnarchiveAttendance(sheet.class_id, sheet.date, sheet.session_id)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:bg-green-50"
                              icon={<ArchiveRestore className="h-3 w-3" />}
                              title="Restore"
                              disabled={unarchivingAttendance === (sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`)}
                            />
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const key = getSheetKey(sheet);
                                setAttendanceExportDropdown(
                                  attendanceExportDropdown?.key === key
                                    ? null
                                    : { key, top: rect.bottom + 4, left: rect.right - 176 }
                                );
                              }}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-100"
                              icon={<Download className="h-3 w-3" />}
                              title="Export"
                              disabled={downloadingAttendance === getSheetKey(sheet)}
                            />
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
                    <h3 className="text-sm font-medium text-gray-900">No matching archived records found</h3>
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
                    <h3 className="text-sm font-medium text-gray-900">No archived attendance sheets</h3>
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
              {!attendanceIsShowingAll && (
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
              )}
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
                            <Button
                              onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=view`, {
                                state: {
                                  fromArchiveModal: true,
                                  returnToArchiveTab: 'classes',
                                },
                              })}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 bg-gray-50 hover:bg-gray-100"
                              icon={<Eye className="h-3 w-3" />}
                              title="View"
                            />
                            <Button
                              onClick={() => handleUnarchiveClass(cls.class_id)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:bg-green-50"
                              icon={<ArchiveRestore className="h-3 w-3" />}
                              title="Restore"
                              disabled={unarchivingClass === cls.class_id}
                            />
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setClassExportDropdown(
                                  classExportDropdown?.classId === cls.class_id
                                    ? null
                                    : { classId: cls.class_id, top: rect.bottom + 4, left: rect.right - 176 }
                                );
                              }}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-100"
                              icon={<Download className="h-3 w-3" />}
                              title="Export"
                              disabled={downloadingClasslist === cls.class_id}
                            />
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
                    <h3 className="text-sm font-medium text-gray-900">No matching archived classes found</h3>
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
                    <h3 className="text-sm font-medium text-gray-900">No archived classes</h3>
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

export default TeacherAttendanceArchive;
