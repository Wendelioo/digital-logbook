import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import {
  ClipboardList,
  Calendar,
  X,
  Archive,
  Download,
  Lock,
} from 'lucide-react';
import {
  OpenClassAttendance,
  GetClassAttendance,
  UpdateAttendanceRecord,
  ExportAttendanceCSV,
  ArchiveAttendanceSheet,
  GetClassByID,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class, Attendance } from './types';

function AttendanceManagementDetail() {
  const navigate = useNavigate();
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
  const [archiving, setArchiving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<{[key: string]: boolean}>({});
  const [exportingAttendance, setExportingAttendance] = useState(false);

  // Computed: is the selected date today?
  const today = new Date().toISOString().split('T')[0];
  const isEditable = selectedDate === today && attendanceRecords.length > 0 && !attendanceRecords[0]?.is_archived;

  const handleExportAttendance = async (classId: number) => {
    setExportingAttendance(true);
    try {
      const filePath = await ExportAttendanceCSV(classId);
      alert(`Attendance exported successfully!\nFile saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to export attendance:', error);
      alert('Failed to export attendance. Please try again.');
    } finally {
      setExportingAttendance(false);
    }
  };

  const handleStatusChange = async (record: Attendance, newStatus: string) => {
    // Enforce same-day only editing
    if (!isEditable) {
      alert('Attendance can only be edited on the same day.');
      return;
    }

    const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
    setUpdatingStatus(prev => ({ ...prev, [key]: true }));
    
    try {
      await UpdateAttendanceRecord(
        record.class_id,
        record.student_user_id,
        record.date,
        newStatus,
        record.remarks || ''
      );
      
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
      alert('Failed to update attendance. ' + (error instanceof Error ? error.message : 'Please try again.'));
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
      // For today, use OpenClassAttendance (auto-creates if needed)
      // For past dates, use GetClassAttendance (read-only)
      if (selectedDate === today) {
        records = await OpenClassAttendance(selectedClass.class_id, selectedDate);
      } else {
        records = await GetClassAttendance(selectedClass.class_id, selectedDate);
      }
      setAttendanceRecords(records || []);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setError('Unable to load attendance records. Please try again.');
      setAttendanceRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleCancelClick = () => {
    if (selectedClass && selectedClass.is_archived) {
      navigate('/teacher/stored-attendance?tab=attendance');
    } else {
      navigate('/teacher/attendance');
    }
  };

  const handleArchive = async () => {
    if (!selectedClass || !selectedDate) return;
    
    // Cannot archive today's attendance
    if (selectedDate === today) {
      alert("Cannot archive today's attendance. Only past attendance can be archived.");
      return;
    }

    setArchiving(true);
    try {
      await ArchiveAttendanceSheet(selectedClass.class_id, selectedDate);
      navigate('/teacher/stored-attendance', { replace: true });
    } catch (error) {
      console.error('Failed to archive attendance:', error);
      alert('Failed to archive attendance. ' + (error instanceof Error ? error.message : 'Please try again.'));
    } finally {
      setArchiving(false);
    }
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
              <p className="text-sm text-gray-500 mb-4">Use the "Add Attendance" buttons on the Attendance Management page to create attendance for today.</p>
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

            {/* Read-only Banner for past dates */}
            {!isEditable && attendanceRecords.length > 0 && !attendanceRecords[0].is_archived && selectedDate !== today && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md px-4 py-2 flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">Past attendance is read-only. Only today's attendance can be edited.</span>
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
                  {isEditable && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      EDITABLE
                    </span>
                  )}
                  {!isEditable && attendanceRecords.length > 0 && !attendanceRecords[0].is_archived && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      READ-ONLY
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {/* Export and Archive actions */}
              <div className="flex justify-end gap-2">
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
                {/* Archive button - only for past dates */}
                {selectedDate !== today && attendanceRecords.length > 0 && !attendanceRecords[0].is_archived && (
                  <Button
                    onClick={handleArchive}
                    variant="outline"
                    size="sm"
                    className="text-orange-600 hover:bg-orange-50"
                    icon={<Archive className="h-4 w-4" />}
                    disabled={archiving}
                    title="Archive this attendance"
                  >
                    Archive
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
                        <th colSpan={5} className="px-4 py-2 text-left border-b-2 border-gray-900">
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
                        <th colSpan={5} className="px-4 py-3 text-left border-b-2 border-gray-900">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold text-sm tracking-wide">DAILY ATTENDANCE RECORD</span>
                            <span className="text-xs text-gray-600">Total Students: {attendanceRecords.length}</span>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '50px' }}>No.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Student ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '180px' }}>Student Name</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '160px' }}>Status</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '150px' }}>Remarks</th>
                      </tr>
                    </thead>

                    {/* Student Attendance Rows */}
                    <tbody className="bg-white text-xs">
                      {attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record, index) => {
                          const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
                          const isUpdating = updatingStatus[key];
                          const isDisabled = isUpdating || !isEditable;
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
                              <td className="px-3 py-1.5">
                                <div className="flex gap-3 justify-center items-center">
                                  {/* Present Checkbox */}
                                  <label 
                                    className={`flex items-center gap-1 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                    title={!isEditable ? "Read-only" : "Present"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={record.status === 'present'}
                                      onChange={() => !isDisabled && handleStatusChange(record, 'present')}
                                      disabled={isDisabled}
                                      className="attendance-checkbox checkbox-green"
                                      style={{ color: '#16a34a' }}
                                    />
                                    <span className="text-xs font-medium text-green-700">P</span>
                                  </label>

                                  {/* Absent Checkbox */}
                                  <label 
                                    className={`flex items-center gap-1 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                    title={!isEditable ? "Read-only" : "Absent"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={record.status === 'absent'}
                                      onChange={() => !isDisabled && handleStatusChange(record, 'absent')}
                                      disabled={isDisabled}
                                      className="attendance-checkbox checkbox-red"
                                      style={{ color: '#dc2626' }}
                                    />
                                    <span className="text-xs font-medium text-red-700">A</span>
                                  </label>

                                  {/* Late Checkbox */}
                                  <label 
                                    className={`flex items-center gap-1 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                    title={!isEditable ? "Read-only" : "Late"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={record.status === 'late'}
                                      onChange={() => !isDisabled && handleStatusChange(record, 'late')}
                                      disabled={isDisabled}
                                      className="attendance-checkbox checkbox-yellow"
                                      style={{ color: '#ca8a04' }}
                                    />
                                    <span className="text-xs font-medium text-yellow-700">L</span>
                                  </label>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-gray-700">
                                {record.remarks || '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
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
