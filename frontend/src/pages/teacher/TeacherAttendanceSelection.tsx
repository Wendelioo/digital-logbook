import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import TeacherStoredArchiveModal from '../../components/TeacherStoredArchiveModal';
import { ConfirmModal } from '../../components/Modal';
import {
  Edit,
  Archive,
  Trash2,
  Eye,
  Lock,
  Unlock,
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

interface PendingArchiveSheet {
  class_id: number;
  date: string;
  subject_code: string;
  subject_name: string;
}

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: 'open' | 'closed';
  subject_code: string;
  subject_name: string;
  edp_code: string;
  present_count: number;
  absent_count: number;
  late_count: number;
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
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingArchiveSheet, setPendingArchiveSheet] = useState<PendingArchiveSheet | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [sessionBusyId, setSessionBusyId] = useState<number | null>(null);
  const [lateThreshold, setLateThreshold] = useState('10');

  useEffect(() => {
    const state = location.state as { openArchiveModal?: boolean; archiveTab?: 'attendance' | 'classes' } | null;
    if (state?.openArchiveModal && state.archiveTab === 'attendance') {
      setShowArchiveModal(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

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

  // Load attendance sessions for open/close/rename actions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.id) return;
      try {
        const sessions = await (window as any).go.main.App.GetTeacherAttendanceSessions(user.id);
        setAttendanceSessions(sessions || []);
      } catch (err) {
        console.error('Failed to load attendance sessions:', err);
      }
    };

    loadSessions();
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

  // Create/open attendance session for a class today
  const handleTakeAttendance = async (classId: number) => {
    setOpeningAttendance(classId);
    setNotice(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const hasOpenTodaySession = attendanceSessions.some(
        (session) => session.class_id === classId && session.attendance_date === today && session.status === 'open'
      );
      const hasClosedTodaySession = attendanceSessions.some(
        (session) => session.class_id === classId && session.attendance_date === today && session.status === 'closed'
      );

      const threshold = Number(lateThreshold);
      const createdSession = await (window as any).go.main.App.CreateAttendanceSession(
        classId,
        today,
        '',
        user?.id || 0,
        Number.isNaN(threshold) ? 10 : threshold
      );

      if (!hasOpenTodaySession && hasClosedTodaySession) {
        setNotice({ type: 'success', text: 'New attendance session created for this class today.' });
      } else if (hasOpenTodaySession) {
        setNotice({ type: 'success', text: 'Current open attendance session loaded.' });
      } else {
        setNotice({ type: 'success', text: 'Attendance sheet is open and ready for editing.' });
      }

      // Keep existing behavior to open the sheet view.
      await OpenClassAttendance(classId, today);
      // Navigate to the attendance detail page
      if (createdSession?.session_id) {
        navigate(`/teacher/attendance/${classId}?date=${today}&sessionId=${createdSession.session_id}`);
      } else {
        navigate(`/teacher/attendance/${classId}?date=${today}`);
      }
    } catch (error) {
      console.error('Failed to open attendance:', error);
      setNotice({ type: 'error', text: 'Failed to create/open attendance session. Please try again.' });
    } finally {
      setOpeningAttendance(null);
      setShowAddModal(false);
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleToggleSession = async (session: AttendanceSession, nextStatus: 'open' | 'closed') => {
    setSessionBusyId(session.session_id);
    setNotice(null);
    try {
      if (nextStatus === 'closed') {
        await (window as any).go.main.App.CloseAttendanceSession(session.session_id, user?.id || 0);
      } else {
        await (window as any).go.main.App.OpenAttendanceSession(session.session_id, user?.id || 0);
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to update session status:', error);
      setNotice({ type: 'error', text: 'Failed to update attendance session status.' });
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleRenameSession = async (session: AttendanceSession) => {
    const newName = window.prompt('Rename attendance session:', session.session_name || '');
    if (!newName || !newName.trim()) return;

    setSessionBusyId(session.session_id);
    setNotice(null);
    try {
      await (window as any).go.main.App.RenameAttendanceSession(session.session_id, newName.trim(), user?.id || 0);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to rename session:', error);
      setNotice({ type: 'error', text: 'Failed to rename attendance session.' });
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleArchiveClick = (sheet: AttendanceSheet) => {
    setNotice(null);
    setPendingArchiveSheet({
      class_id: sheet.class_id,
      date: sheet.date,
      subject_code: sheet.subject_code,
      subject_name: sheet.subject_name,
    });
  };

  const handleConfirmArchive = async () => {
    if (!pendingArchiveSheet) return;

    setArchiving(true);
    setNotice(null);
    try {
      await ArchiveAttendanceSheet(pendingArchiveSheet.class_id, pendingArchiveSheet.date);
      setPendingArchiveSheet(null);
      setRefreshKey(prev => prev + 1);
      setNotice({ type: 'success', text: 'Attendance archived successfully.' });
    } catch (error) {
      console.error('Failed to archive attendance:', error);
      setNotice({
        type: 'error',
        text: 'Failed to archive attendance. ' + (error instanceof Error ? error.message : 'Please try again.'),
      });
    } finally {
      setArchiving(false);
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
  const todaySessions = attendanceSessions.filter(
    session => session.attendance_date === today && session.status === 'open'
  );
  const sessionStatusByKey = new Map<string, 'open' | 'closed'>();
  attendanceSessions.forEach((session) => {
    const key = `${session.class_id}-${session.attendance_date}`;
    if (!sessionStatusByKey.has(key)) {
      sessionStatusByKey.set(key, session.status);
    }
  });

  return (
    <div className="flex flex-col">
      {/* Header Section with Add Button */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Attendance Management</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="outline"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
            >
              Archive
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              variant="primary"
              size="sm"
            >
              Take Attendance
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm">
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className={`flex-shrink-0 mb-2 px-3 py-2 rounded-md text-sm border ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <p>{notice.text}</p>
        </div>
      )}

      {/* Attendance Sessions (Today) */}
      <div className="flex-shrink-0 mb-3 bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Active Attendance Sheet</h3>
          <span className="text-xs text-gray-500">{todaySessions.length} session(s)</span>
        </div>
        {todaySessions.length > 0 ? (
          <div className="space-y-2">
            {todaySessions.map((session) => (
              <div key={session.session_id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                <div>
                  <p className="text-sm font-medium text-gray-900">{session.session_name || `${session.subject_code} Attendance`}</p>
                  <p className="text-xs text-gray-500">{session.subject_code} • P:{session.present_count} A:{session.absent_count} L:{session.late_count}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => navigate(`/teacher/attendance/${session.class_id}?date=${session.attendance_date}`)}
                    variant="outline"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<Eye className="h-3 w-3" />}
                    title="View Session"
                  />
                  <Button
                    onClick={() => handleRenameSession(session)}
                    variant="outline"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<Edit className="h-3 w-3" />}
                    title="Rename Session"
                  />
                  {session.status === 'open' ? (
                    <Button
                      onClick={() => handleToggleSession(session, 'closed')}
                      variant="outline"
                      size="sm"
                      disabled={sessionBusyId === session.session_id}
                      icon={<Lock className="h-3 w-3" />}
                      title="Close Session"
                    />
                  ) : (
                    <Button
                      onClick={() => handleToggleSession(session, 'open')}
                      variant="outline"
                      size="sm"
                      disabled={sessionBusyId === session.session_id}
                      icon={<Unlock className="h-3 w-3" />}
                      title="Reopen Session"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No sessions created for today yet. Click "Take Attendance" to create one.</p>
        )}
      </div>

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
              placeholder="Subject code, name, EDP, or date"
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                  Summary
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
                  const sessionStatus = sessionStatusByKey.get(`${sheet.class_id}-${sheet.date}`);
                  const canArchive = !isToday || sessionStatus === 'closed';

                  return (
                    <tr
                      key={`${sheet.class_id}-${sheet.date}`}
                      className={`hover:bg-gray-50 transition-colors ${isToday ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        <div className="font-medium">{sheet.subject_code} - {sheet.subject_name}</div>
                        <div className="text-xs text-gray-500">EDP: {sheet.edp_code || '-'}</div>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            onClick={() => navigate(`/teacher/attendance/${sheet.class_id}?date=${sheet.date}`)}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 bg-gray-50 hover:bg-gray-100"
                            icon={<Eye className="h-3 w-3" />}
                            title="View Attendance"
                          />
                          {/* Archive button - past dates, or today's saved/closed session */}
                          {canArchive && (
                            <Button
                              onClick={() => handleArchiveClick(sheet)}
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
                  <td colSpan={4} className="px-6 py-12 text-center">
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
                          Attendance is generated from your active classlist. Students submit attendance by tapping Time In while a session is open.
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
              <h3 className="text-lg font-semibold text-gray-900">Take Attendance Today</h3>
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
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Late Threshold (minutes)</label>
                <input
                  type="number"
                  min={0}
                  value={lateThreshold}
                  onChange={(e) => setLateThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                {openingAttendance ? 'Loading...' : 'Open Class'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TeacherStoredArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        initialTab="attendance"
      />

      <ConfirmModal
        isOpen={!!pendingArchiveSheet}
        onClose={() => {
          if (!archiving) setPendingArchiveSheet(null);
        }}
        onConfirm={handleConfirmArchive}
        title="Archive attendance sheet?"
        message={pendingArchiveSheet
          ? `${pendingArchiveSheet.subject_code} - ${pendingArchiveSheet.subject_name} (${new Date(pendingArchiveSheet.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}) will be moved to the Archive section.`
          : 'This attendance sheet will be moved to the Archive section.'}
        variant="warning"
        confirmText="Archive"
        cancelText="Cancel"
        loading={archiving}
      />
    </div>
  );
}

export default AttendanceClassSelection;
