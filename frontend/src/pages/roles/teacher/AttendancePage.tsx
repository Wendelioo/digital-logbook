import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import TeacherStoredArchiveModal from '../../../components/TeacherStoredArchiveModal';
import LoadingDots from '../../../components/LoadingDots';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  Edit,
  Eye,
  Save,
  Plus,
  X,
  CornerUpLeft,
  Pause,
  Play,
  RotateCw,
  Filter,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  GetActiveAttendanceSheets,
  OpenClassAttendance,
  ExportAttendanceCSVByDate,
  ExportAttendancePDFByDate,
  ExportAttendanceDOCXByDate,
  ExportAttendanceCSVBySession,
  ExportAttendancePDFBySession,
  ExportAttendanceDOCXBySession,
  DeleteAttendanceSession,
} from '../../../../wailsjs/go/backend/App';
import { formatBackendError } from '../../../utils/actionErrors';
import { openExportSaveDialog, defaultAttendanceFilename, type ExportFormat } from '../../../utils/exportSaveDialog';
import { getArchiveErrorMessage, getArchiveSuccessMessage } from '../../../utils/archiveNotifications';
import { useAppUi } from '../../../contexts/AppUiContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Class } from './types';

// Attendance sheet summary from backend
interface AttendanceSheet {
  session_id?: number;
  class_id: number;
  date: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
  join_code?: string;
  schedule: string;
  status?: 'open' | 'closed';
  opened_at?: string;
  student_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  is_archived: boolean;
  is_editable: boolean;
}

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: 'open' | 'closed';
  class_duration_minutes?: number;
  grace_period_minutes?: number;
  opened_at?: string;
  paused_at?: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
  join_code?: string;
  present_count: number;
  absent_count: number;
  late_count: number;
}

type TimerMode = 'running' | 'paused';

function AttendanceClassSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { confirm, toast } = useAppUi();
  const [allTeacherClasses, setAllTeacherClasses] = useState<Class[]>([]);
  const [attendanceSheets, setAttendanceSheets] = useState<AttendanceSheet[]>([]);
  const [filteredSheets, setFilteredSheets] = useState<AttendanceSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [pendingDateRangeStart, setPendingDateRangeStart] = useState('');
  const [pendingDateRangeEnd, setPendingDateRangeEnd] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [pendingClassFilter, setPendingClassFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [pendingSemesterFilter, setPendingSemesterFilter] = useState<string>('all');
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('all');
  const [pendingSchoolYearFilter, setPendingSchoolYearFilter] = useState<string>('all');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingAttendance, setOpeningAttendance] = useState<number | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [openExportModal, setOpenExportModal] = useState<{ classId: number; date: string; sessionId?: number } | null>(null);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [sessionBusyId, setSessionBusyId] = useState<number | null>(null);
  const [deletingAttendanceKey, setDeletingAttendanceKey] = useState<string | null>(null);
  const [sessionToRename, setSessionToRename] = useState<AttendanceSession | null>(null);
  const [renameSessionName, setRenameSessionName] = useState('');
  const [classDuration, setClassDuration] = useState('90');
  const [gracePeriod, setGracePeriod] = useState('10');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  const normalizeSemester = (value?: string | null): string => {
    if (!value) return '';
    const normalized = value.toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('1st') || normalized.includes('first') || normalized === '1') return '1';
    if (normalized.includes('2nd') || normalized.includes('second') || normalized === '2') return '2';
    return normalized;
  };

  const parseSessionDateTime = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRemaining = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const truncateDropdownPart = (value: string, maxLength: number): string => {
    const normalized = value.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
  };

  const formatClassDropdownLabel = (cls: Class): string => {
    const subjectCode = truncateDropdownPart(cls.subject_code || '-', 18);
    const title = truncateDropdownPart(cls.descriptive_title || cls.subject_name || '-', 40);
    const schedule = truncateDropdownPart(cls.schedule || '-', 28);
    return `${subjectCode} - ${title} - ${schedule}`;
  };

  const handleSessionTimerMode = async (session: AttendanceSession, mode: TimerMode) => {
    if (!user?.id) return;

    setSessionBusyId(session.session_id);
    try {
      if (mode === 'paused') {
        await (window as any).go.backend.App.PauseAttendanceSession(session.session_id, user.id);
        toast('Attendance timer paused.', 'success');
      } else {
        await (window as any).go.backend.App.ResumeAttendanceSession(session.session_id, user.id);
        toast('Attendance timer resumed.', 'success');
      }

      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to update attendance timer mode:', error);
      toast('Failed to update attendance session timer.', 'error');
    } finally {
      setSessionBusyId(null);
    }
  };

  useEffect(() => {
    const state = location.state as { openArchiveModal?: boolean; archiveTab?: 'attendance' | 'classes' } | null;
    if (state?.openArchiveModal && state.archiveTab === 'attendance') {
      setShowArchiveModal(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(ticker);
  }, []);

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

  useEffect(() => {
    const loadAttendanceSheets = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const data = await GetActiveAttendanceSheets(user.id);
        const rows = (data || []) as unknown as AttendanceSheet[];
        setAttendanceSheets(rows);
        setFilteredSheets(rows);
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

  // Load attendance sessions for view/save/rename actions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.id) return;
      try {
        const sessions = await (window as any).go.backend.App.GetTeacherAttendanceSessions(user.id);
        setAttendanceSessions(sessions || []);
      } catch (err) {
        console.error('Failed to load attendance sessions:', err);
      }
    };

    loadSessions();
  }, [user?.id, refreshKey]);

  useEffect(() => {
    let filtered = attendanceSheets;
    const classByID = new Map(allTeacherClasses.map((cls) => [cls.class_id, cls]));

    if (searchTerm) {
      filtered = filtered.filter(sheet =>
        sheet.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sheet.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sheet.edp_code && sheet.edp_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (((sheet.join_code || classByID.get(sheet.class_id)?.join_code || '')).toLowerCase().includes(searchTerm.toLowerCase())) ||
        sheet.date.includes(searchTerm)
      );
    }
    if (dateRangeStart || dateRangeEnd) {
      filtered = filtered.filter(sheet => {
        if (dateRangeStart && sheet.date < dateRangeStart) return false;
        if (dateRangeEnd && sheet.date > dateRangeEnd) return false;
        return true;
      });
    }
    if (classFilter !== 'all') {
      filtered = filtered.filter(sheet => String(sheet.class_id) === classFilter);
    }

    if (semesterFilter !== 'all') {
      filtered = filtered.filter((sheet) => normalizeSemester(classByID.get(sheet.class_id)?.semester || '') === semesterFilter);
    }

    if (schoolYearFilter !== 'all') {
      filtered = filtered.filter((sheet) => (classByID.get(sheet.class_id)?.school_year || '') === schoolYearFilter);
    }

    setFilteredSheets(filtered);
    setCurrentPage(1);
  }, [searchTerm, dateRangeStart, dateRangeEnd, classFilter, semesterFilter, schoolYearFilter, attendanceSheets, allTeacherClasses]);

  const activeFilterCount =
    (dateRangeStart || dateRangeEnd ? 1 : 0) +
    (classFilter !== 'all' ? 1 : 0) +
    (semesterFilter !== 'all' ? 1 : 0) +
    (schoolYearFilter !== 'all' ? 1 : 0);

  const schoolYearOptions = Array.from(
    new Set(allTeacherClasses.map((cls) => (cls.school_year || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const handleTakeAttendance = async (classId: number) => {
    const today = new Date().toISOString().split('T')[0];
    setOpeningAttendance(classId);
    try {
      const hasOpenTodaySession = attendanceSessions.some(
        (session) => session.class_id === classId && session.attendance_date === today && session.status === 'open'
      );
      const hasClosedTodaySession = attendanceSessions.some(
        (session) => session.class_id === classId && session.attendance_date === today && session.status === 'closed'
      );

      const durationMinutes = Number(classDuration);
      const graceMinutes = Number(gracePeriod);
      const createdSession = await (window as any).go.backend.App.CreateAttendanceSession(
        classId,
        today,
        '',
        user?.id || 0,
        Number.isNaN(durationMinutes) ? 90 : durationMinutes,
        Number.isNaN(graceMinutes) ? 10 : graceMinutes
      );

      if (!hasOpenTodaySession && hasClosedTodaySession) {
        toast('New attendance session created for this class today.', 'success');
      } else if (hasOpenTodaySession) {
        toast('Current active attendance session loaded.', 'success');
      } else {
        toast('Attendance sheet is active and ready for editing.', 'success');
      }

      // Keep existing behavior to open the sheet view.
      await OpenClassAttendance(classId, today);
      if (createdSession?.session_id) {
        navigate(`/teacher/attendance/${classId}?date=${today}&sessionId=${createdSession.session_id}`);
      } else {
        navigate(`/teacher/attendance/${classId}?date=${today}`);
      }
    } catch (error) {
      console.error('Failed to start attendance:', error);

      const errorMessage = error instanceof Error ? error.message : String(error || '');
      if (errorMessage.toLowerCase().includes('cannot open another attendance sheet for this class list')) {
        toast('You cannot open two attendance sheets for the same class list. Opening the current active sheet instead.', 'error');

        try {
          const sessions = await (window as any).go.backend.App.GetTeacherAttendanceSessions(user?.id || 0);
          const activeSession = (sessions || []).find(
            (session: AttendanceSession) => session.class_id === classId && session.attendance_date === today && session.status === 'open'
          );

          if (activeSession?.session_id) {
            navigate(`/teacher/attendance/${classId}?date=${today}&sessionId=${activeSession.session_id}`);
          }
        } catch (sessionError) {
          console.error('Failed to locate active attendance session after duplicate-open attempt:', sessionError);
        }

        return;
      }

      toast('Failed to create attendance session. Please try again.', 'error');
    } finally {
      setOpeningAttendance(null);
      setShowAddModal(false);
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleSaveSession = async (session: AttendanceSession) => {
    setSessionBusyId(session.session_id);
    try {
      await (window as any).go.backend.App.SaveAttendanceSession(session.session_id, user?.id || 0);
      if (session.status === 'open') {
        toast('Active attendance session saved successfully.', 'success');
      } else {
        toast('Attendance session saved successfully.', 'success');
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to save session:', error);
      toast(`Could not save attendance session. ${formatBackendError(error)}`, 'error');
    } finally {
      setSessionBusyId(null);
    }
  };

  const openRenameSessionModal = (session: AttendanceSession) => {
    setSessionToRename(session);
    setRenameSessionName(session.session_name || '');
  };

  const closeRenameSessionModal = () => {
    setSessionToRename(null);
    setRenameSessionName('');
  };

  const submitRenameSession = async () => {
    if (!sessionToRename || !user?.id) return;
    const trimmed = renameSessionName.trim();
    if (!trimmed) {
      toast('Session name is required.', 'error');
      return;
    }

    setSessionBusyId(sessionToRename.session_id);
    try {
      await (window as any).go.backend.App.RenameAttendanceSession(
        sessionToRename.session_id,
        trimmed,
        user.id
      );
      closeRenameSessionModal();
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to rename session:', error);
      toast(`Could not rename session. ${formatBackendError(error)}`, 'error');
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleArchiveClick = async (
    sheet: AttendanceSheet,
    context: { sessionId?: number; sessionLabel?: string }
  ) => {
    if (!user?.id) {
      toast('You must be signed in to archive attendance.', 'error');
      return;
    }

    const formattedDate = new Date(sheet.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const sessionIDToArchive = context.sessionId ?? sheet.session_id;
    if (sessionIDToArchive == null || sessionIDToArchive <= 0) {
      toast('This attendance row has no saved session ID. Please refresh and try again.', 'error');
      return;
    }

    const sessionLine = `Session: ${context.sessionLabel?.trim() || `ID ${sessionIDToArchive}`} (Session ID ${sessionIDToArchive})`;

    const summaryLine = `Counts on this sheet: Present ${sheet.present_count}, Absent ${sheet.absent_count}, Late ${sheet.late_count}.`;

    const ok = await confirm({
      title: 'Archive attendance',
      message:
        `The sheet will move to Stored archives and can be restored later.\n\n` +
        `Class: ${sheet.subject_code} — ${sheet.subject_name}\n` +
        `Date: ${formattedDate}\n` +
        `${sessionLine}\n` +
        `${summaryLine}\n\n` +
        `If you chose the wrong row, click Cancel. To fix wrong names or counts before archiving, open View and adjust while the session is still open for today.`,
      confirmLabel: 'Archive',
      variant: 'default',
    });

    if (!ok) return;

    try {
      await (window as any).go.backend.App.ArchiveAttendanceSession(sessionIDToArchive, user.id);
      setRefreshKey(prev => prev + 1);
      toast(getArchiveSuccessMessage('attendance', 'archive'), 'success');
    } catch (error) {
      console.error('Failed to archive attendance:', error);
      toast(getArchiveErrorMessage('attendance', 'archive', error), 'error');
    }
  };

  const handleDeleteSavedAttendance = async (
    sheet: AttendanceSheet,
    sessionId: number | undefined,
    sessionLabel: string | undefined
  ) => {
    if (!user?.id) {
      toast('You must be signed in to delete attendance.', 'error');
      return;
    }
    if (sessionId == null || sessionId <= 0) {
      toast(
        'This row cannot be deleted because it is not linked to a single saved session. Try Archive instead, or use the attendance detail screen.',
        'warning'
      );
      return;
    }

    const formattedDate = new Date(sheet.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const sessionTitle = sessionLabel?.trim() || `Session ${sessionId}`;
    const deleteKey = `${sheet.class_id}-${sheet.date}-${sessionId}`;

    const ok = await confirm({
      title: 'Delete saved attendance permanently',
      message:
        `This removes the session and all attendance marks for it from the database. It cannot be undone.\n\n` +
        `Class: ${sheet.subject_code} — ${sheet.subject_name}\n` +
        `Date: ${formattedDate}\n` +
        `Session: ${sessionTitle} (Session ID ${sessionId})\n` +
        `Counts: Present ${sheet.present_count}, Absent ${sheet.absent_count}, Late ${sheet.late_count}\n\n` +
        `Cancel if this is the wrong class or date. Use Rename while the session is still open if you only need to fix the session title.`,
      variant: 'danger',
      confirmLabel: 'Delete permanently',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setDeletingAttendanceKey(deleteKey);
    try {
      await DeleteAttendanceSession(sessionId, user.id);
      setRefreshKey((prev) => prev + 1);
      toast('Attendance session deleted permanently.', 'success');
    } catch (error) {
      console.error('Failed to delete attendance session:', error);
      toast(`Could not delete attendance. ${formatBackendError(error)}`, 'error');
    } finally {
      setDeletingAttendanceKey(null);
    }
  };

  const handleAddAttendanceSubmit = () => {
    if (selectedClassId) {
      handleTakeAttendance(selectedClassId);
    }
  };

  const handleExportAttendance = async (classId: number, date: string, format: ExportFormat, sessionId?: number) => {
    const key = sessionId ? `${classId}-${date}-${sessionId}-${format}` : `${classId}-${date}-${format}`;
    setExportingKey(key);
    try {
      const savePath = await openExportSaveDialog('Save attendance report', defaultAttendanceFilename(date, format), format);
      if (!savePath) return;

      let filename = '';
      if (sessionId && sessionId > 0) {
        if (format === 'csv') filename = await ExportAttendanceCSVBySession(classId, date, sessionId, savePath);
        else if (format === 'pdf') filename = await ExportAttendancePDFBySession(classId, date, sessionId, savePath);
        else filename = await ExportAttendanceDOCXBySession(classId, date, sessionId, savePath);
      } else {
        if (format === 'csv') filename = await ExportAttendanceCSVByDate(classId, date, savePath);
        else if (format === 'pdf') filename = await ExportAttendancePDFByDate(classId, date, savePath);
        else filename = await ExportAttendanceDOCXByDate(classId, date, savePath);
      }
      toast(`Saved: ${filename.split(/[\\/]/).pop()}`, 'success');
    } catch (err) {
      toast(`Export failed. ${formatBackendError(err)}`, 'error');
    } finally {
      setExportingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const activeClasses = allTeacherClasses.filter(cls => cls.is_active);
  const todaySessions = attendanceSessions
    .filter((session) => session.attendance_date === today && session.status === 'open')
    .sort((left, right) => right.session_id - left.session_id);

  const tableSheets = filteredSheets.filter((sheet) => {
    const matchedSession = sheet.session_id
      ? attendanceSessions.find((session) => session.session_id === sheet.session_id)
      : undefined;
    const effectiveStatus = sheet.status || matchedSession?.status;
    return effectiveStatus !== 'open';
  });

  const totalPages = Math.ceil(tableSheets.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentSheets = tableSheets.slice(startIndex, endIndex);
  const startEntry = tableSheets.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, tableSheets.length);
  const classMetadataById = new Map(allTeacherClasses.map((cls) => [Number(cls.class_id), cls]));

  const preferredSessionByKey = new Map<string, AttendanceSession>();
  attendanceSessions.forEach((session) => {
    const key = `${session.class_id}-${session.attendance_date}`;
    const existing = preferredSessionByKey.get(key);

    if (!existing) {
      preferredSessionByKey.set(key, session);
      return;
    }

    if (existing.status === 'closed' && session.status === 'open') {
      preferredSessionByKey.set(key, session);
      return;
    }

    if (existing.status === session.status && session.session_id > existing.session_id) {
      preferredSessionByKey.set(key, session);
    }
  });

  return (
    <div className="flex flex-col">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Attendance Management</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="outline"
              size="sm"
              icon={<ArchiveIcon />}
            >
              Archive
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              Attendance
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm">
          <p>{error}</p>
        </div>
      )}

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
                  <p className="text-xs text-gray-500">{session.subject_code} - P:{session.present_count} A:{session.absent_count} L:{session.late_count}</p>
                  {(() => {
                    const openedAt = parseSessionDateTime(session.opened_at);
                    if (!openedAt) {
                      return null;
                    }

                    const pausedAt = parseSessionDateTime(session.paused_at);
                    const isPaused = !!pausedAt;
                    const classMinutes = Math.max(0, session.class_duration_minutes || 0);
                    const graceMinutes = Math.max(0, session.grace_period_minutes || 0);
                    const classDeadline = new Date(openedAt.getTime() + classMinutes * 60 * 1000);
                    const graceDeadline = new Date(openedAt.getTime() + graceMinutes * 60 * 1000);
                    const effectiveNow = isPaused && pausedAt
                      ? pausedAt.getTime()
                      : nowTimestamp;
                    const classRemaining = Math.max(0, Math.floor((classDeadline.getTime() - effectiveNow) / 1000));
                    const graceRemaining = Math.max(0, Math.floor((graceDeadline.getTime() - effectiveNow) / 1000));

                    return (
                      <>
                        {isPaused && (
                          <p className="text-[11px] text-amber-600">Timer paused</p>
                        )}
                        <p className="text-[11px] text-gray-500">
                          Class remaining: {formatRemaining(classRemaining)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Grace period remaining: {formatRemaining(graceRemaining)}
                        </p>
                      </>
                    );
                  })()}
                  {session.opened_at && (
                    <p className="text-[11px] text-gray-400">Generated: {new Date(session.opened_at.replace(' ', 'T')).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setRefreshKey((prev) => prev + 1)}
                    variant="outline"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<RotateCw className="h-3 w-3" />}
                    title="Refresh active attendance sheet"
                  />
                  {(() => {
                    const isPaused = !!session.paused_at;
                    const isBusy = sessionBusyId === session.session_id;
                    return (
                      <>
                  <Button
                    onClick={() => handleSessionTimerMode(session, 'paused')}
                    variant="outline"
                    size="sm"
                    disabled={isPaused || isBusy}
                    icon={<Pause className="h-3 w-3" />}
                    title="Pause Timer"
                  />
                  <Button
                    onClick={() => handleSessionTimerMode(session, 'running')}
                    variant="outline"
                    size="sm"
                    disabled={!isPaused || isBusy}
                    icon={<Play className="h-3 w-3" />}
                    title="Play Timer"
                  />
                      </>
                    );
                  })()}
                  <Button
                    onClick={() => navigate(`/teacher/attendance/${session.class_id}?date=${session.attendance_date}&sessionId=${session.session_id}`)}
                    variant="outline"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<Eye className="h-3 w-3" />}
                    title="View Session"
                  />
                  <Button
                    onClick={() => openRenameSessionModal(session)}
                    variant="outline"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<Edit className="h-3 w-3" />}
                    title="Rename Session"
                  />
                  <Button
                    onClick={() => handleSaveSession(session)}
                    variant="primary"
                    size="sm"
                    disabled={sessionBusyId === session.session_id}
                    icon={<Save className="h-3 w-3" />}
                    title="Save Attendance"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No sessions created for today yet. Click "Take Attendance" to create one.</p>
        )}
      </div>

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
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Subject code, name, EDP, Join Code, or date"
            />
            <div className="relative">
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingDateRangeStart(dateRangeStart);
                    setPendingDateRangeEnd(dateRangeEnd);
                    setPendingClassFilter(classFilter);
                    setPendingSemesterFilter(semesterFilter);
                    setPendingSchoolYearFilter(schoolYearFilter);
                  }
                  setShowFilters(nextOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="p-4 space-y-3">
                    {/* Filter by Date Range: [from] to [to] with calendar icons */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Date Range</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingDateRangeStart}
                            onChange={(e) => setPendingDateRangeStart(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingDateRangeEnd}
                            onChange={(e) => setPendingDateRangeEnd(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                      <div className="relative">
                        <select
                          value={pendingClassFilter}
                          onChange={(e) => setPendingClassFilter(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                        >
                          <option value="all">All classes</option>
                          {allTeacherClasses.map(cls => (
                            <option key={cls.class_id} value={String(cls.class_id)}>
                              {formatClassDropdownLabel(cls)}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                      <div className="relative">
                        <select
                          value={pendingSemesterFilter}
                          onChange={(e) => setPendingSemesterFilter(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                        >
                          <option value="all">All semesters</option>
                          <option value="1">1st Sem</option>
                          <option value="2">2nd Sem</option>
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">School Year</label>
                      <div className="relative">
                        <select
                          value={pendingSchoolYearFilter}
                          onChange={(e) => setPendingSchoolYearFilter(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                        >
                          <option value="all">All school years</option>
                          {schoolYearOptions.map((schoolYear) => (
                            <option key={schoolYear} value={schoolYear}>
                              {schoolYear}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Apply & Clear */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDateRangeStart('');
                          setPendingDateRangeEnd('');
                          setPendingClassFilter('all');
                          setPendingSemesterFilter('all');
                          setPendingSchoolYearFilter('all');
                          setDateRangeStart('');
                          setDateRangeEnd('');
                          setClassFilter('all');
                          setSemesterFilter('all');
                          setSchoolYearFilter('all');
                          setShowFilters(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateRangeStart(pendingDateRangeStart);
                          setDateRangeEnd(pendingDateRangeEnd);
                          setClassFilter(pendingClassFilter);
                          setSemesterFilter(pendingSemesterFilter);
                          setSchoolYearFilter(pendingSchoolYearFilter);
                          setShowFilters(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-lg hover:bg-primary-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
                <>
                  {currentSheets.map((sheet) => {
                    const isToday = sheet.date === today;
                    const sheetKey = `${sheet.class_id}-${sheet.date}`;
                    const classMetadata = classMetadataById.get(Number(sheet.class_id));
                    const preferredSession = preferredSessionByKey.get(sheetKey);
                    const preferredSessionId = preferredSession?.session_id;
                    const sheetSessionId = sheet.session_id || preferredSessionId;
                    const generatedAt = sheet.opened_at || preferredSession?.opened_at;
                    const sessionStatus = sheet.status || preferredSession?.status;
                    const canArchive = !isToday || sessionStatus === 'closed';
                    const sessionForLabel = sheet.session_id
                      ? attendanceSessions.find((s) => s.session_id === sheet.session_id)
                      : preferredSession;
                    const archiveContext = {
                      sessionId: sheetSessionId ?? undefined,
                      sessionLabel: sessionForLabel?.session_name,
                    };
                    const rowDeleteKey =
                      sheetSessionId != null && sheetSessionId > 0
                        ? `${sheet.class_id}-${sheet.date}-${sheetSessionId}`
                        : '';

                    return (
                      <tr
                        key={sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`}
                        className={`hover:bg-gray-50 transition-colors ${isToday ? 'bg-green-50' : ''}`}
                      >
                        <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                          <div className="font-medium">{sheet.subject_code} - {sheet.subject_name}</div>
                          <div className="text-xs text-gray-500">EDP: {sheet.edp_code || '-'} | Join: {sheet.join_code || classMetadata?.join_code || '-'}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{new Date(sheet.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                          {generatedAt && (
                            <div className="text-[11px] text-gray-500">
                              Generated: {new Date(generatedAt.replace(' ', 'T')).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          )}
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
                              onClick={() => navigate(
                                sheetSessionId
                                  ? `/teacher/attendance/${sheet.class_id}?date=${sheet.date}&sessionId=${sheetSessionId}`
                                  : `/teacher/attendance/${sheet.class_id}?date=${sheet.date}`
                              )}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 bg-gray-50 hover:bg-gray-100"
                              icon={<Eye className="h-3 w-3" />}
                              title="Open this attendance sheet (verify class and date before changing records)"
                            />
                            {/* Archive button - past dates, or today's saved session */}
                            {canArchive && (
                              <Button
                                onClick={() => handleArchiveClick(sheet, archiveContext)}
                                variant="outline"
                                size="sm"
                                className="text-orange-600 hover:bg-orange-50"
                                icon={<ArchiveIcon size="xs" />}
                                title="Move this saved sheet to Stored archives (restore later)"
                              />
                            )}
                            <Button
                              onClick={() =>
                                handleDeleteSavedAttendance(sheet, sheetSessionId ?? undefined, sessionForLabel?.session_name)
                              }
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              icon={<Trash2 className="h-3 w-3" />}
                              title="Delete this saved session permanently (wrong row? click Cancel in the confirmation dialog)"
                              disabled={
                                !rowDeleteKey ||
                                (deletingAttendanceKey !== null && deletingAttendanceKey === rowDeleteKey)
                              }
                            />
                            <Button
                              onClick={() => setOpenExportModal({ classId: sheet.class_id, date: sheet.date, sessionId: sheetSessionId || undefined })}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-100"
                              icon={<Printer className="h-3 w-3" />}
                              title="Download attendance report (CSV, PDF, or DOCX)"
                              disabled={exportingKey !== null && exportingKey.startsWith(`${sheet.class_id}-${sheet.date}`)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
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
                        <h3 className="text-sm font-medium text-gray-900">No attendance sheets exist yet</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          No saved attendance sheets are available. Active sheets appear here only after you click Save.
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

      {tableSheets.length > 0 && (
        <div className="flex-shrink-0 mt-2 flex items-center justify-between">
          <div className="text-xs text-gray-700">
            Showing {startEntry} to {endEntry} of {tableSheets.length} entries
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

      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-surface w-full max-w-md mx-2 sm:mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Take Attendance Today</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedClassId(null);
                }}
                className="modal-back-icon-btn"
                title="Back"
                aria-label="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5">
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
                        {formatClassDropdownLabel(cls)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    No active classes assigned.
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={classDuration}
                  onChange={(e) => setClassDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period / Time Allocation (minutes)</label>
                <input
                  type="number"
                  min={0}
                  value={gracePeriod}
                  onChange={(e) => setGracePeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t bg-gray-50">
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
                {openingAttendance ? 'Loading...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TeacherStoredArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        initialTab="attendance"
        onAttendanceUnarchived={() => setRefreshKey((prev) => prev + 1)}
      />

      <Modal
        isOpen={!!openExportModal}
        onClose={() => setOpenExportModal(null)}
        title="Export Attendance"
        size="sm"
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!openExportModal) return;
              const target = openExportModal;
              setOpenExportModal(null);
              handleExportAttendance(target.classId, target.date, 'csv', target.sessionId);
            }}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!openExportModal) return;
              const target = openExportModal;
              setOpenExportModal(null);
              handleExportAttendance(target.classId, target.date, 'pdf', target.sessionId);
            }}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!openExportModal) return;
              const target = openExportModal;
              setOpenExportModal(null);
              handleExportAttendance(target.classId, target.date, 'docx', target.sessionId);
            }}
          >
            DOCX
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!sessionToRename}
        onClose={closeRenameSessionModal}
        title="Rename attendance session"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeRenameSessionModal} disabled={sessionBusyId !== null}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitRenameSession}
              disabled={sessionBusyId !== null || !sessionToRename}
            >
              {sessionBusyId === sessionToRename?.session_id ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="rename-session-name">
            Session name
          </label>
          <input
            id="rename-session-name"
            type="text"
            value={renameSessionName}
            onChange={(e) => setRenameSessionName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>
      </Modal>

    </div>
  );
}

export default AttendanceClassSelection;
