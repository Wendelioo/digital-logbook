import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  Calendar,
  CornerUpLeft,
  Printer,
  RotateCw,
} from 'lucide-react';
import {
  OpenClassAttendance,
  GetClassAttendance,
  UpdateAttendanceRecord,
  GetClassByID,
  ExportAttendanceCSVByDate,
  ExportAttendancePDFByDate,
  ExportAttendanceDOCXByDate,
  ExportAttendanceCSVBySession,
  ExportAttendancePDFBySession,
  ExportAttendanceDOCXBySession,
  ExportArchivedAttendanceCSVByDate,
  ExportArchivedAttendancePDFByDate,
  ExportArchivedAttendanceDOCXByDate,
} from '../../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultAttendanceFilename, type ExportFormat } from '../../../utils/exportSaveDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { Class, Attendance } from './types';

function AttendanceManagementDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useAppUi();
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const initialDate = searchParams.get('date') || '';
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasSelectedDate, setHasSelectedDate] = useState(!!initialDate);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'open' | 'closed' | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<{[key: string]: boolean}>({});
  const [exportingAttendance, setExportingAttendance] = useState(false);
  const [exportDropdown, setExportDropdown] = useState<{ top: number; left: number } | null>(null);

  // Computed: is the selected date today?
  const today = new Date().toISOString().split('T')[0];
  const isEditable = selectedDate === today && attendanceRecords.length > 0 && !attendanceRecords[0]?.is_archived && sessionStatus !== 'closed';

  const loadSessionMeta = async (classId: number, date: string) => {
    if (!user?.id) {
      setSessionId(null);
      setSessionStatus(null);
      return { sessionId: null as number | null, status: null as 'open' | 'closed' | null };
    }

    try {
      const sessions = await (window as any).go.backend.App.GetTeacherAttendanceSessions(user.id);
      const routeSessionId = Number(searchParams.get('sessionId') || '');
      const hasRouteSessionId = !Number.isNaN(routeSessionId) && routeSessionId > 0;

      let matched = null;
      if (hasRouteSessionId) {
        matched = (sessions || []).find((session: any) => session.session_id === routeSessionId && session.class_id === classId && session.attendance_date === date);
      }

      if (!matched) {
        const sameClassDate = (sessions || []).filter((session: any) => session.class_id === classId && session.attendance_date === date);
        matched = sameClassDate.find((session: any) => session.status === 'open') || sameClassDate[0];
      }

      if (matched) {
        setSessionId(matched.session_id);
        setSessionStatus(matched.status);
        return { sessionId: matched.session_id as number, status: matched.status as 'open' | 'closed' };
      }

      if (hasRouteSessionId) {
        setSessionId(routeSessionId);
        setSessionStatus('closed');
        return { sessionId: routeSessionId, status: 'closed' };
      }

      setSessionId(null);
      setSessionStatus(null);
      return { sessionId: null as number | null, status: null as 'open' | 'closed' | null };
    } catch (err) {
      console.error('Failed to load session metadata:', err);
      setSessionId(null);
      setSessionStatus(null);
      return { sessionId: null as number | null, status: null as 'open' | 'closed' | null };
    }
  };

  const handleExportAttendance = async (classId: number, format: ExportFormat) => {
    if (!selectedDate) {
      toast('Select a date before exporting attendance.', 'error');
      return;
    }

    const isArchivedView = attendanceRecords.length > 0 && attendanceRecords[0]?.is_archived;

    setExportingAttendance(true);
    try {
      const savePath = await openExportSaveDialog('Save attendance report', defaultAttendanceFilename(selectedDate, format, isArchivedView), format);
      if (!savePath) return;

      if (isArchivedView) {
        if (format === 'csv') {
          await ExportArchivedAttendanceCSVByDate(classId, selectedDate, sessionId && sessionId > 0 ? sessionId : 0, savePath);
        } else if (format === 'pdf') {
          await ExportArchivedAttendancePDFByDate(classId, selectedDate, sessionId && sessionId > 0 ? sessionId : 0, savePath);
        } else {
          await ExportArchivedAttendanceDOCXByDate(classId, selectedDate, sessionId && sessionId > 0 ? sessionId : 0, savePath);
        }
      } else if (sessionId && sessionId > 0) {
        if (format === 'csv') {
          await ExportAttendanceCSVBySession(classId, selectedDate, sessionId, savePath);
        } else if (format === 'pdf') {
          await ExportAttendancePDFBySession(classId, selectedDate, sessionId, savePath);
        } else {
          await ExportAttendanceDOCXBySession(classId, selectedDate, sessionId, savePath);
        }
      } else {
        if (format === 'csv') {
          await ExportAttendanceCSVByDate(classId, selectedDate, savePath);
        } else if (format === 'pdf') {
          await ExportAttendancePDFByDate(classId, selectedDate, savePath);
        } else {
          await ExportAttendanceDOCXByDate(classId, selectedDate, savePath);
        }
      }

      toast(`Saved: ${savePath.split(/[\\/]/).pop()}`, 'success');
    } catch (error) {
      console.error('Failed to export attendance:', error);
      toast('Failed to export attendance. Please try again.', 'error');
    } finally {
      setExportingAttendance(false);
    }
  };

  useEffect(() => {
    const closeDropdown = () => setExportDropdown(null);
    if (exportDropdown) {
      document.addEventListener('click', closeDropdown);
    }

    return () => {
      document.removeEventListener('click', closeDropdown);
    };
  }, [exportDropdown]);

  const handleStatusChange = async (record: Attendance, newStatus: string) => {
    // Enforce same-day only editing
    if (!isEditable) {
      toast('Attendance can only be edited on the same day.', 'error');
      return;
    }

    const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
    setUpdatingStatus(prev => ({ ...prev, [key]: true }));
    
    try {
      if (sessionId && user?.id) {
        await (window as any).go.backend.App.UpdateSessionAttendanceRecord(
          sessionId,
          record.student_user_id,
          user.id,
          newStatus,
          record.remarks || ''
        );
      } else {
        await UpdateAttendanceRecord(
          record.class_id,
          record.student_user_id,
          record.date,
          newStatus,
          record.remarks || ''
        );
      }
      
      // Update local state
      setAttendanceRecords(prev => 
        prev.map(r => 
          r.class_id === record.class_id && 
          r.student_user_id === record.student_user_id && 
          r.date === record.date
            ? { ...r, status: newStatus }
            : r
        )
      );
    } catch (error) {
      console.error('Failed to update attendance:', error);
      toast('Failed to update attendance. ' + (error instanceof Error ? error.message : 'Please try again.'), 'error');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [key]: false }));
    }
  };

  // Load class info
  useEffect(() => {
    const loadClass = async () => {
      if (!id || !user?.id) return;

      setLoading(true);
      try {
        const foundClass = await GetClassByID(parseInt(id));
        setSelectedClass(foundClass || null);
        setError('');

        // Check if date is in query params
        const dateParam = searchParams.get('date');
        if (dateParam) {
          setSelectedDate(dateParam);
          setHasSelectedDate(true);
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

  // Load attendance when class and date are set
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
      let records;
      const meta = await loadSessionMeta(selectedClass.class_id, selectedDate);

      if (meta.sessionId && user?.id) {
        records = await (window as any).go.backend.App.GetSessionAttendance(meta.sessionId, user.id);
      } else if (selectedDate === today) {
        records = await OpenClassAttendance(selectedClass.class_id, selectedDate);
      } else {
        records = await GetClassAttendance(selectedClass.class_id, selectedDate);
      }
      setAttendanceRecords(records || []);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setError('Unable to load attendance records. Please try again.');
      setAttendanceRecords([]);
      setSessionId(null);
      setSessionStatus(null);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleCancelClick = () => {
    const state = location.state as { fromArchiveModal?: boolean; returnToArchiveTab?: 'attendance' | 'classes' } | null;
    if (state?.fromArchiveModal && state.returnToArchiveTab === 'attendance') {
      navigate('/teacher/attendance', {
        replace: true,
        state: { openArchiveModal: true, archiveTab: 'attendance' },
      });
      return;
    }

    navigate('/teacher/attendance');
  };

  if (loading && !selectedClass) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
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
            Back to Attendance Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0 min-h-0 overflow-x-hidden">
      {exportDropdown && selectedClass && (
        <div
          style={{ position: 'fixed', top: exportDropdown.top, left: exportDropdown.left, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { setExportDropdown(null); handleExportAttendance(selectedClass.class_id, 'csv'); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-t-lg">CSV</button>
          <button onClick={() => { setExportDropdown(null); handleExportAttendance(selectedClass.class_id, 'pdf'); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">PDF</button>
          <button onClick={() => { setExportDropdown(null); handleExportAttendance(selectedClass.class_id, 'docx'); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-b-lg">DOCX</button>
        </div>
      )}
      <div className="p-3 sm:p-4 md:p-6">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md max-w-7xl mx-auto">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <LoadingDots className="justify-center gap-3" dotClassName="h-4 w-4" />
          </div>
        )}

        {/* No date selected state */}
        {!loading && !hasSelectedDate && selectedClass && (
          <div className="bg-white shadow rounded-lg p-6 mb-6 border border-gray-300 max-w-4xl mx-auto relative">
            <button
              onClick={handleCancelClick}
              className="absolute top-4 right-4 modal-back-icon-btn"
              title="Back"
            >
              <CornerUpLeft className="h-5 w-5" />
            </button>
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Attendance Selected</h3>
              <Button
                onClick={handleCancelClick}
                variant="outline"
              >
                Back to Attendance Management
              </Button>
            </div>
          </div>
        )}

        {!loading && selectedClass && hasSelectedDate && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-w-7xl mx-auto my-2 sm:my-4 p-4 sm:p-6 relative">
            <button
              onClick={handleCancelClick}
              className="absolute top-4 right-4 modal-back-icon-btn"
              title="Back"
            >
              <CornerUpLeft className="h-5 w-5" />
            </button>

            {/* Archived Banner */}
            {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-md px-4 py-2 flex items-center gap-2">
                <ArchiveIcon className="text-warning-600" />
                <span className="text-sm font-medium text-orange-700">This attendance is archived and cannot be edited</span>
              </div>
            )}

            <div className="mb-6 pb-4 border-b border-gray-200">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">Attendance</h2>
                  {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      ARCHIVED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
              </div>
              {/* Export actions */}
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => loadAttendance()}
                  variant="outline"
                  size="sm"
                  icon={<RotateCw className="h-4 w-4" />}
                  disabled={loadingAttendance}
                  title="Refresh attendance sheet"
                >
                  Refresh
                </Button>
                {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setExportDropdown(
                        exportDropdown
                          ? null
                          : { top: rect.bottom + 4, left: rect.right - 176 }
                      );
                    }}
                    variant="outline"
                    size="sm"
                    icon={<Printer className="h-4 w-4" />}
                    disabled={exportingAttendance}
                    title="Export"
                  >
                    Export
                  </Button>
                )}
              </div>
            </div>

            {/* Combined Class Info and Attendance Table */}
            {loadingAttendance ? (
              <div className="px-6 py-12 text-center">
                <LoadingDots className="justify-center mx-auto gap-2" dotClassName="h-3 w-3" />
                <p className="mt-2 text-sm text-gray-500">Loading attendance records...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th colSpan={5} className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50">
                          <div className="text-gray-900 font-semibold text-sm">Class Information</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-sm">
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>Subject Code:</td>
                        <td className="px-4 py-2 text-gray-900">{selectedClass.subject_code || 'N/A'}</td>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '100px' }}>Schedule:</td>
                        <td className="px-4 py-2 text-gray-900" colSpan={2}>{selectedClass.schedule || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Subject Name:</td>
                        <td className="px-4 py-2 text-gray-900">{selectedClass.subject_name || 'N/A'}</td>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                        <td className="px-4 py-2 text-gray-900" colSpan={2}>{selectedClass.room || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">EDP Code:</td>
                        <td className="px-4 py-2 text-gray-900">{selectedClass.edp_code || 'N/A'}</td>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Join Code:</td>
                        <td className="px-4 py-2 text-gray-900 font-medium" colSpan={2}>{selectedClass.join_code || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Semester:</td>
                        <td className="px-4 py-2 text-gray-900">{selectedClass.semester || 'N/A'}</td>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">School Year:</td>
                        <td className="px-4 py-2 text-gray-900" colSpan={2}>{selectedClass.school_year || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Instructor:</td>
                        <td className="px-4 py-2 text-gray-900" colSpan={4}>{selectedClass.teacher_name || 'N/A'}</td>
                      </tr>
                    </tbody>

                    <thead>
                      <tr>
                        <th colSpan={5} className="px-4 py-3 text-left border-b border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-semibold text-sm">Daily Attendance Record</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-600">Total Students: {attendanceRecords.length}</span>
                            </div>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '50px' }}>No.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Student ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '180px' }}>Student Name</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '160px' }}>Time In</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '180px' }}>Remarks</th>
                      </tr>
                    </thead>

                    {/* Student Attendance Rows */}
                    <tbody className="bg-white text-xs">
                      {attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record, index) => {
                          const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
                          return (
                            <tr key={key} className="hover:bg-gray-50 border-b border-gray-100">
                              <td className="px-2 py-1.5 text-center font-medium text-gray-900 whitespace-nowrap">
                                {index + 1}
                              </td>
                              <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                                {record.student_code}
                              </td>
                              <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
                                {record.last_name}, {record.first_name} {record.middle_name ? record.middle_name.charAt(0) + '.' : ''}
                              </td>
                              <td className="px-3 py-1.5 text-center text-gray-900 whitespace-nowrap">
                                {record.time_in || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-gray-900">
                                {record.remarks || '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <p className="text-sm text-gray-500">No students enrolled in this class yet.</p>
                            <p className="text-xs text-gray-400 mt-1">Students will appear here once they are enrolled.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50/50">
                        <td colSpan={5} className="px-4 py-3">
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
      </div>
    </div>
  );
}

export default AttendanceManagementDetail;
