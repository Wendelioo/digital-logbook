import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import {
  CheckCircle,
  ClipboardList,
  Calendar,
  AlertCircle,
  X,
  Archive,
  Download,
} from 'lucide-react';
import {
  GetClassAttendance,
  InitializeAttendanceForClass,
  UpdateAttendanceRecord,
  ExportAttendanceCSV,
  GetTeacherClassesByUserID,
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
  // Initialize selectedDate from URL params immediately
  const initialDate = searchParams.get('date') || '';
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [attendanceReloadKey, setAttendanceReloadKey] = useState(0); // Force reload trigger
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
  const [updatingStatus, setUpdatingStatus] = useState<{[key: string]: boolean}>({});
  const [exportingAttendance, setExportingAttendance] = useState(false);

  const handleExportAttendance = async (classId: number, date: string) => {
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
    const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
    setUpdatingStatus(prev => ({ ...prev, [key]: true }));
    
    try {
      console.log('Updating status to:', newStatus, 'for student:', record.student_user_id);
      await UpdateAttendanceRecord(
        record.class_id,
        record.student_user_id,
        record.date,
        newStatus,
        record.remarks || ''
      );
      console.log('Status update successful');
      
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
      alert('Failed to update attendance. Please try again.');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [key]: false }));
    }
  };

  // Force reload attendance data when component mounts or id/date changes
  useEffect(() => {
    setAttendanceReloadKey(prev => prev + 1);
  }, [id, searchParams.get('date')]);

  useEffect(() => {
    const loadClass = async () => {
      if (!id || !user?.id) return;

      setLoading(true);
      try {
        // Try to get class by ID (works for both active and archived classes)
        try {
          const foundClass = await GetClassByID(parseInt(id));
          if (foundClass) {
            setSelectedClass(foundClass);
            setError('');
            setLoading(false);
            return;
          }
        } catch (err) {
          console.log('Class not found by ID, trying active classes list');
        }

        // Fallback: search through active classes
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
  }, [selectedClass?.class_id, selectedDate, hasSelectedDate, attendanceReloadKey]);

  const loadAttendance = async () => {
    if (!selectedClass || !selectedDate) return;

    setLoadingAttendance(true);
    setError('');
    try {
      console.log('Fetching attendance from database for class:', selectedClass.class_id, 'date:', selectedDate);
      const records = await GetClassAttendance(selectedClass.class_id, selectedDate);
      console.log('Loaded attendance records:', records?.length || 0, 'records');
      if (records && records.length > 0) {
        console.log('Sample record statuses:', records.slice(0, 3).map(r => ({ id: r.student_user_id, status: r.status })));
      }
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
    // Navigate back to archive if viewing archived class, otherwise attendance management
    if (selectedClass && selectedClass.is_archived) {
      navigate('/teacher/stored-attendance?tab=attendance');
    } else {
      navigate('/teacher/attendance');
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    if (selectedClass && selectedClass.is_archived) {
      navigate('/teacher/stored-attendance?tab=attendance');
    } else {
      navigate('/teacher/attendance');
    }
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
              onClick={() => navigate(selectedClass && selectedClass.is_archived ? '/teacher/stored-attendance?tab=attendance' : '/teacher/attendance')}
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
                onClick={() => navigate(selectedClass && selectedClass.is_archived ? '/teacher/stored-attendance?tab=attendance' : '/teacher/attendance')}
                variant="outline"
              >
                {selectedClass && selectedClass.is_archived ? 'Back to Archive' : 'Back to Attendance Management'}
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
                  {new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {attendanceRecords.length > 0 && attendanceRecords[0].is_archived && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleExportAttendance(selectedClass.class_id, selectedDate)}
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-4 w-4" />}
                    disabled={exportingAttendance}
                    title="Export to CSV"
                  >
                    Export CSV
                  </Button>
                </div>
              )}
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
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '40px' }}>No.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '90px' }}>Student ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Student Name</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '120px' }}>Status</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '150px' }}>Remarks</th>
                      </tr>
                    </thead>

                    {/* Student Attendance Rows */}
                    <tbody className="bg-white text-xs">
                      {attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record, index) => {
                          const key = `${record.class_id}-${record.student_user_id}-${record.date}`;
                          const isUpdating = updatingStatus[key];
                          const isArchived = record.is_archived;
                          const isDisabled = isUpdating || isArchived;
                          return (
                            <tr key={key} className="hover:bg-gray-50 border-b border-gray-100">
                              <td className="px-2 py-1.5 text-center font-medium text-gray-900">
                                {index + 1}
                              </td>
                              <td className="px-3 py-1.5 font-medium text-gray-900">
                                {record.student_code}
                              </td>
                              <td className="px-3 py-1.5 text-gray-900">
                                {record.last_name}, {record.first_name} {record.middle_name ? record.middle_name.charAt(0) + '.' : ''}
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex gap-3 justify-center items-center">
                                  {/* Present Checkbox */}
                                  <label 
                                    className={`flex items-center gap-1 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                    title={isArchived ? "Archived - cannot edit" : "Present"}
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
                                    title={isArchived ? "Archived - cannot edit" : "Absent"}
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
                                    title={isArchived ? "Archived - cannot edit" : "Late"}
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

                                  {/* Excused Checkbox */}
                                  <label 
                                    className={`flex items-center gap-1 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                    title={isArchived ? "Archived - cannot edit" : "Excused"}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={record.status === 'excused'}
                                      onChange={() => !isDisabled && handleStatusChange(record, 'excused')}
                                      disabled={isDisabled}
                                      className="attendance-checkbox checkbox-blue"
                                      style={{ color: '#2563eb' }}
                                    />
                                    <span className="text-xs font-medium text-blue-700">E</span>
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
                              <span className="text-blue-700">
                                Excused: {attendanceRecords.filter(r => r.status === 'excused').length}
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

export default AttendanceManagementDetail;
