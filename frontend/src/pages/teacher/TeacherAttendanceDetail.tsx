import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import {
  Calendar,
  X,
  Archive,
  Download,
} from 'lucide-react';
import {
  OpenClassAttendance,
  GetClassAttendance,
  UpdateAttendanceRecord,
  GetClassByID,
  ExportAttendanceCSVByDate,
  ExportAttendanceCSVBySession,
  ExportArchivedAttendanceCSVByDate,
} from '../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultAttendanceFilename } from '../../utils/exportSaveDialog';
import { useAuth } from '../../contexts/AuthContext';
import { Class, Attendance } from './types';

function AttendanceManagementDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
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
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleExportAttendance = async (classId: number) => {
    if (!selectedDate) {
      setNotice({ type: 'error', text: 'Select a date before exporting attendance.' });
      return;
    }

    const isArchivedView = attendanceRecords.length > 0 && attendanceRecords[0]?.is_archived;
    const defaultName = defaultAttendanceFilename(selectedDate, 'csv', isArchivedView);
    const savePath = await openExportSaveDialog('Save attendance', defaultName, 'csv');
    if (!savePath) return;

    setExportingAttendance(true);
    setNotice(null);
    try {
      const filePath = isArchivedView
        ? sessionId && sessionId > 0
          ? await ExportArchivedAttendanceCSVByDate(classId, selectedDate, sessionId, savePath)
          : await ExportArchivedAttendanceCSVByDate(classId, selectedDate, 0, savePath)
        : sessionId && sessionId > 0
          ? await ExportAttendanceCSVBySession(classId, selectedDate, sessionId, savePath)
          : await ExportAttendanceCSVByDate(classId, selectedDate, savePath);
      setNotice({ type: 'success', text: `Attendance exported successfully. File saved to: ${filePath}` });
    } catch (error) {
      console.error('Failed to export attendance:', error);
      setNotice({ type: 'error', text: 'Failed to export attendance. Please try again.' });
    } finally {
      setExportingAttendance(false);
    }
  };

  const handleStatusChange = async (record: Attendance, newStatus: string) => {
    // Enforce same-day only editing
    if (!isEditable) {
      setNotice({ type: 'error', text: 'Attendance can only be edited on the same day.' });
      return;
    }

    const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
    setUpdatingStatus(prev => ({ ...prev, [key]: true }));
    setNotice(null);
    
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
      setNotice({
        type: 'error',
        text: 'Failed to update attendance. ' + (error instanceof Error ? error.message : 'Please try again.'),
      });
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md max-w-7xl mx-auto">
            {error}
          </div>
        )}

        {notice && (
          <div className={`mb-6 px-4 py-3 rounded-md max-w-7xl mx-auto border ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {notice.text}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* No date selected state */}
        {!loading && !hasSelectedDate && selectedClass && (
          <div className="bg-white shadow rounded-lg p-6 mb-6 border border-gray-300 max-w-4xl mx-auto relative">
            <button
              onClick={handleCancelClick}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
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

        {/* Attendance Sheet - Bond Paper Style */}
        {!loading && selectedClass && hasSelectedDate && (
          <div className="bg-white max-w-4xl mx-auto my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
            {/* Close Button */}
            <button
              onClick={handleCancelClick}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Archived Banner */}
            {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-md px-4 py-2 flex items-center gap-2">
                <Archive className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">This attendance is archived and cannot be edited</span>
              </div>
            )}

            {/* Sheet Title */}
            <div className="mb-6 pb-4 border-b border-gray-400">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 tracking-wide">ATTENDANCE SHEET</h2>
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
                {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
                  <Button
                    onClick={() => handleExportAttendance(selectedClass.class_id)}
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-4 w-4" />}
                    disabled={exportingAttendance}
                    title="Export to CSV"
                  >
                    Export CSV
                  </Button>
                )}
              </div>
            </div>

            {/* Combined Class Info and Attendance Table */}
            {loadingAttendance ? (
              <div className="px-6 py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading attendance records...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                    {/* Class Information Header */}
                    <thead>
                      <tr>
                        <th colSpan={4} className="px-4 py-2 text-left border-b-2 border-gray-900">
                          <div className="text-gray-900 font-bold text-sm tracking-wide">CLASS INFORMATION</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white text-sm">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '90px' }}>Subject:</td>
                        <td className="px-3 py-2 text-gray-900">{selectedClass.subject_code} - {selectedClass.subject_name}</td>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '80px' }}>Schedule:</td>
                        <td className="px-3 py-2 text-gray-900">{selectedClass.schedule || '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Instructor:</td>
                        <td className="px-3 py-2 text-gray-900">{selectedClass.teacher_name || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                        <td className="px-3 py-2 text-gray-900">{selectedClass.room || '—'}</td>
                      </tr>
                    </tbody>

                    {/* Attendance List Header */}
                    <thead>
                      <tr>
                        <th colSpan={5} className="px-4 py-3 text-left border-b-2 border-gray-900">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold text-sm tracking-wide">DAILY ATTENDANCE RECORD</span>
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

                    {/* Summary Footer */}
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
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
