import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import LoadingDots from '../../../components/LoadingDots';
import { ArchiveRestoreIcon } from '../../../components/icons/ArchiveIcons';
import {
  Eye,
  Printer,
  Filter,
  Search,
} from 'lucide-react';
import {
  GetArchivedAttendanceSheets,
  GetTeacherClassesByUserID,
  UnarchiveAttendanceSession,
  GetArchivedClasses,
  UnarchiveClass,
  ExportArchivedAttendanceCSVByDate,
  ExportArchivedAttendancePDFByDate,
  ExportArchivedAttendanceDOCXByDate,
  ExportClasslistCSV,
  ExportClasslistPDF,
  ExportClasslistDOCX,
} from '../../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultClasslistFilename, defaultAttendanceFilename, type ExportFormat } from '../../../utils/exportSaveDialog';
import { getArchiveErrorMessage, getArchiveSuccessMessage } from '../../../utils/archiveNotifications';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
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
  const { toast, confirm } = useAppUi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resolvedInitialTab: AttendanceArchiveTab = initialTab || (searchParams.get('tab') === 'classes' ? 'classes' : 'attendance');
  const [activeTab, setActiveTab] = useState<AttendanceArchiveTab>(resolvedInitialTab);
  
  // Attendance state
  const [archivedSheets, setArchivedSheets] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [showAttendanceFilters, setShowAttendanceFilters] = useState(false);
  const [attendanceDateRangeStart, setAttendanceDateRangeStart] = useState('');
  const [attendanceDateRangeEnd, setAttendanceDateRangeEnd] = useState('');
  const [pendingAttendanceDateRangeStart, setPendingAttendanceDateRangeStart] = useState('');
  const [pendingAttendanceDateRangeEnd, setPendingAttendanceDateRangeEnd] = useState('');
  const [attendanceClassFilter, setAttendanceClassFilter] = useState<string>('all');
  const [pendingAttendanceClassFilter, setPendingAttendanceClassFilter] = useState<string>('all');
  const [attendanceSemesterFilter, setAttendanceSemesterFilter] = useState<string>('all');
  const [pendingAttendanceSemesterFilter, setPendingAttendanceSemesterFilter] = useState<string>('all');
  const [attendanceSchoolYearFilter, setAttendanceSchoolYearFilter] = useState<string>('all');
  const [pendingAttendanceSchoolYearFilter, setPendingAttendanceSchoolYearFilter] = useState<string>('all');
  const [attendanceEntriesPerPage, setAttendanceEntriesPerPage] = useState(10);
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const [filteredAttendance, setFilteredAttendance] = useState<any[]>([]);
  const [unarchivingAttendance, setUnarchivingAttendance] = useState<string | null>(null);
  const [downloadingAttendance, setDownloadingAttendance] = useState<string | null>(null);
  const [attendanceExportModalSheet, setAttendanceExportModalSheet] = useState<any | null>(null);

  // Classes state
  const [activeTeacherClasses, setActiveTeacherClasses] = useState<Class[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [showClassFilters, setShowClassFilters] = useState(false);
  const [classSemesterFilter, setClassSemesterFilter] = useState<string>('all');
  const [pendingClassSemesterFilter, setPendingClassSemesterFilter] = useState<string>('all');
  const [classSchoolYearFilter, setClassSchoolYearFilter] = useState<string>('all');
  const [pendingClassSchoolYearFilter, setPendingClassSchoolYearFilter] = useState<string>('all');
  const [classEntriesPerPage, setClassEntriesPerPage] = useState(10);
  const [classCurrentPage, setClassCurrentPage] = useState(1);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [unarchivingClass, setUnarchivingClass] = useState<number | null>(null);
  const [downloadingClasslist, setDownloadingClasslist] = useState<number | null>(null);
  const [classExportModalClass, setClassExportModalClass] = useState<Class | null>(null);

  const normalizeSemester = (value?: string | null): string => {
    if (!value) return '';
    const normalized = value.toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('1st') || normalized.includes('first') || normalized === '1') return '1';
    if (normalized.includes('2nd') || normalized.includes('second') || normalized === '2') return '2';
    return normalized;
  };

  const classMetadataById = useMemo(() => {
    const lookup = new Map<number, Class>();
    [...activeTeacherClasses, ...archivedClasses].forEach((cls) => {
      if (!lookup.has(cls.class_id)) {
        lookup.set(cls.class_id, cls);
      }
    });
    return lookup;
  }, [activeTeacherClasses, archivedClasses]);

  const attendanceClassOptions = useMemo(
    () =>
      Array.from(
        new Map(
          archivedSheets.map((sheet) => [
            String(sheet.class_id),
            {
              classId: String(sheet.class_id),
              label: `${sheet.subject_code || ''} - ${sheet.subject_name || ''}${sheet.join_code ? ` (Join: ${sheet.join_code})` : ''}`.trim().replace(/^\s*-\s*/, ''),
            },
          ])
        ).values()
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [archivedSheets]
  );

  const schoolYearOptions = useMemo(
    () =>
      Array.from(
        new Set(Array.from(classMetadataById.values()).map((cls) => (cls.school_year || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [classMetadataById]
  );

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
    loadActiveTeacherClasses();
  }, [user?.id]);

  useEffect(() => {
    const filtered = archivedSheets.filter((sheet) => {
      const searchLower = attendanceSearchTerm.toLowerCase();
      const sheetDate = String(sheet.date || '').slice(0, 10);
      const subjectName = (sheet.subject_name || '').toLowerCase();
      const subjectCode = (sheet.subject_code || '').toLowerCase();
      const edpCode = (sheet.edp_code || '').toLowerCase();
      const classMeta = classMetadataById.get(Number(sheet.class_id));
      const joinCode = (sheet.join_code || classMeta?.join_code || '').toLowerCase();
      const parsedDate = new Date(sheet.date);
      const displayDate = Number.isNaN(parsedDate.getTime())
        ? sheetDate
        : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).toLowerCase();
      const matchesSearch =
        !searchLower ||
        subjectName.includes(searchLower) ||
        subjectCode.includes(searchLower) ||
        edpCode.includes(searchLower) ||
        joinCode.includes(searchLower) ||
        sheetDate.includes(searchLower) ||
        displayDate.includes(searchLower);

      if (!matchesSearch) {
        return false;
      }

      if (attendanceDateRangeStart && sheetDate < attendanceDateRangeStart) {
        return false;
      }

      if (attendanceDateRangeEnd && sheetDate > attendanceDateRangeEnd) {
        return false;
      }

      if (attendanceClassFilter !== 'all' && String(sheet.class_id) !== attendanceClassFilter) {
        return false;
      }

      if (attendanceSemesterFilter !== 'all' && normalizeSemester(classMeta?.semester) !== attendanceSemesterFilter) {
        return false;
      }

      if (attendanceSchoolYearFilter !== 'all' && (classMeta?.school_year || '') !== attendanceSchoolYearFilter) {
        return false;
      }

      return true;
    });

    setFilteredAttendance(filtered);
    setAttendanceCurrentPage(1);
  }, [
    attendanceSearchTerm,
    attendanceDateRangeStart,
    attendanceDateRangeEnd,
    attendanceClassFilter,
    attendanceSemesterFilter,
    attendanceSchoolYearFilter,
    archivedSheets,
    classMetadataById,
  ]);

  useEffect(() => {
    const searchLower = classSearchTerm.toLowerCase();
    const filtered = archivedClasses.filter((cls) => {
      const subjectName = (cls.subject_name || '').toLowerCase();
      const subjectCode = (cls.subject_code || '').toLowerCase();
      const schoolYear = (cls.school_year || '').toLowerCase();
      const edpCode = (cls.edp_code || '').toLowerCase();
      const joinCode = (cls.join_code || '').toLowerCase();
      const matchesSearch = !searchLower || subjectName.includes(searchLower) || subjectCode.includes(searchLower) || schoolYear.includes(searchLower) || edpCode.includes(searchLower) || joinCode.includes(searchLower);
      if (!matchesSearch) {
        return false;
      }

      if (classSemesterFilter !== 'all' && normalizeSemester(cls.semester) !== classSemesterFilter) {
        return false;
      }

      if (classSchoolYearFilter !== 'all' && (cls.school_year || '') !== classSchoolYearFilter) {
        return false;
      }

      return true;
    });

    setFilteredClasses(filtered);
    setClassCurrentPage(1);
  }, [classSearchTerm, classSemesterFilter, classSchoolYearFilter, archivedClasses]);

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

  const loadActiveTeacherClasses = async () => {
    if (!user?.id) return;
    try {
      const classes = await GetTeacherClassesByUserID(user.id);
      setActiveTeacherClasses(classes || []);
    } catch (error) {
      console.error('Failed to load active classes for archive filters:', error);
      setActiveTeacherClasses([]);
    }
  };

  const handleUnarchiveAttendance = async (classId: number, date: string, sessionId?: number, subjectCode?: string) => {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const ok = await confirm({
      title: 'Unarchive attendance',
      message: `Are you sure you want to unarchive this attendance sheet (${subjectCode || 'Class'} - ${formattedDate})?`,
      confirmLabel: 'Unarchive',
      variant: 'default',
    });

    if (!ok) return;

    const key = sessionId ? `${classId}-${date}-${sessionId}` : `${classId}-${date}`;
    setUnarchivingAttendance(key);
    try {
      // Only unarchive the specific sheet (session) you chose — never by date, so we never restore others.
      const sid = sessionId != null ? Number(sessionId) : 0;
      if (sid > 0 && user?.id != null) {
        await UnarchiveAttendanceSession(sid, Number(user.id));
      } else {
        toast('Cannot restore: this sheet has no session. Only individual sheets can be restored.', 'error');
        return;
      }
      await loadArchivedSheets();
      toast(getArchiveSuccessMessage('attendance', 'restore'), 'success');
      onAttendanceUnarchived?.();
    } catch (error) {
      console.error('Failed to restore:', error);
      toast(getArchiveErrorMessage('attendance', 'restore', error), 'error');
    } finally {
      setUnarchivingAttendance(null);
    }
  };

  const handleUnarchiveClass = async (classId: number) => {
    const targetClass = archivedClasses.find((cls) => cls.class_id === classId);
    const label = targetClass?.subject_code || 'this class';
    const ok = await confirm({
      title: 'Unarchive class',
      message: `Are you sure you want to unarchive this classlist (${label})?`,
      confirmLabel: 'Unarchive',
      variant: 'default',
    });

    if (!ok) return;

    setUnarchivingClass(classId);
    try {
      await UnarchiveClass(classId);
      await loadArchivedClassesList();
      toast(getArchiveSuccessMessage('class', 'restore'), 'success');
      onClassUnarchived?.();
    } catch (error) {
      console.error('Failed to restore class:', error);
      toast(getArchiveErrorMessage('class', 'restore', error), 'error');
    } finally {
      setUnarchivingClass(null);
    }
  };

  const handleDownloadArchivedClasslist = async (cls: Class) => {
    setDownloadingClasslist(cls.class_id);
    try {
      const format: ExportFormat = 'csv';
      const savePath = await openExportSaveDialog('Save classlist', defaultClasslistFilename(format), format);
      if (!savePath) return;
      const filePath = await ExportClasslistCSV(cls.class_id, savePath);
      toast(`Saved: ${filePath.split(/[\\/]/).pop()}`, 'success');
    } catch (error) {
      console.error('Failed to export archived classlist:', error);
      toast('Failed to export classlist. Please try again.', 'error');
    } finally {
      setDownloadingClasslist(null);
    }
  };

  const getSheetKey = (sheet: any) => (sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`);

  const handleDownloadArchivedAttendance = async (sheet: any, format: ExportFormat) => {
    const key = sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`;

    setDownloadingAttendance(key);
    try {
      const savePath = await openExportSaveDialog('Save attendance report', defaultAttendanceFilename(sheet.date, format, true), format);
      if (!savePath) return;

      const sessionId = Number(sheet.session_id) || 0;
      let filePath = '';
      if (format === 'csv') filePath = await ExportArchivedAttendanceCSVByDate(sheet.class_id, sheet.date, sessionId, savePath);
      else if (format === 'pdf') filePath = await ExportArchivedAttendancePDFByDate(sheet.class_id, sheet.date, sessionId, savePath);
      else filePath = await ExportArchivedAttendanceDOCXByDate(sheet.class_id, sheet.date, sessionId, savePath);

      toast(`Saved: ${filePath.split(/[\\/]/).pop()}`, 'success');
    } catch (error) {
      console.error('Failed to export archived attendance:', error);
      toast('Failed to export attendance. Please try again.', 'error');
    } finally {
      setDownloadingAttendance(null);
    }
  };

  const handleDownloadArchivedClasslistByFormat = async (cls: Class, format: ExportFormat) => {
    setDownloadingClasslist(cls.class_id);
    try {
      const savePath = await openExportSaveDialog('Save classlist', defaultClasslistFilename(format), format);
      if (!savePath) return;

      let filePath = '';
      if (format === 'csv') filePath = await ExportClasslistCSV(cls.class_id, savePath);
      else if (format === 'pdf') filePath = await ExportClasslistPDF(cls.class_id, savePath);
      else filePath = await ExportClasslistDOCX(cls.class_id, savePath);

      toast(`Saved: ${filePath.split(/[\\/]/).pop()}`, 'success');
    } catch (error) {
      console.error('Failed to export archived classlist:', error);
      toast('Failed to export classlist. Please try again.', 'error');
    } finally {
      setDownloadingClasslist(null);
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
  const attendanceActiveFilterCount =
    (attendanceDateRangeStart || attendanceDateRangeEnd ? 1 : 0) +
    (attendanceClassFilter !== 'all' ? 1 : 0) +
    (attendanceSemesterFilter !== 'all' ? 1 : 0) +
    (attendanceSchoolYearFilter !== 'all' ? 1 : 0);
  const classActiveFilterCount =
    (classSemesterFilter !== 'all' ? 1 : 0) +
    (classSchoolYearFilter !== 'all' ? 1 : 0);

  return (
    <div className={hideHeader ? 'flex flex-col h-full' : 'flex flex-col h-full p-6'}>
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-700">Show</span>
                <select
                  value={attendanceEntriesPerPage}
                  onChange={(e) => {
                    setAttendanceEntriesPerPage(Number(e.target.value));
                    setAttendanceCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10 entries</option>
                  <option value={25}>25 entries</option>
                  <option value={50}>50 entries</option>
                  <option value={100}>100 entries</option>
                  <option value={-1}>All entries</option>
                </select>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <div className="relative w-72 max-w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={attendanceSearchTerm}
                    onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search attendance (subject, EDP, join code, date)..."
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      const nextOpen = !showAttendanceFilters;
                      if (nextOpen) {
                        setPendingAttendanceDateRangeStart(attendanceDateRangeStart);
                        setPendingAttendanceDateRangeEnd(attendanceDateRangeEnd);
                        setPendingAttendanceClassFilter(attendanceClassFilter);
                        setPendingAttendanceSemesterFilter(attendanceSemesterFilter);
                        setPendingAttendanceSchoolYearFilter(attendanceSchoolYearFilter);
                      }
                      setShowAttendanceFilters(nextOpen);
                    }}
                    className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      showAttendanceFilters || attendanceActiveFilterCount > 0
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                    {attendanceActiveFilterCount > 0 && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                        {attendanceActiveFilterCount}
                      </span>
                    )}
                  </button>

                  {showAttendanceFilters && (
                    <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">Filters</span>
                          {attendanceActiveFilterCount > 0 && (
                            <button
                              onClick={() => {
                                setAttendanceDateRangeStart('');
                                setAttendanceDateRangeEnd('');
                                setAttendanceClassFilter('all');
                                setAttendanceSemesterFilter('all');
                                setAttendanceSchoolYearFilter('all');
                                setPendingAttendanceDateRangeStart('');
                                setPendingAttendanceDateRangeEnd('');
                                setPendingAttendanceClassFilter('all');
                                setPendingAttendanceSemesterFilter('all');
                                setPendingAttendanceSchoolYearFilter('all');
                              }}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Date Range</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={pendingAttendanceDateRangeStart}
                              onChange={(e) => setPendingAttendanceDateRangeStart(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <span className="text-xs font-medium text-gray-500">to</span>
                            <input
                              type="date"
                              value={pendingAttendanceDateRangeEnd}
                              onChange={(e) => setPendingAttendanceDateRangeEnd(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                          <select
                            value={pendingAttendanceClassFilter}
                            onChange={(e) => setPendingAttendanceClassFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All classes</option>
                            {attendanceClassOptions.map((option) => (
                              <option key={option.classId} value={option.classId}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Semester</label>
                          <select
                            value={pendingAttendanceSemesterFilter}
                            onChange={(e) => setPendingAttendanceSemesterFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All semesters</option>
                            <option value="1">1st Semester</option>
                            <option value="2">2nd Semester</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">School Year</label>
                          <select
                            value={pendingAttendanceSchoolYearFilter}
                            onChange={(e) => setPendingAttendanceSchoolYearFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All school years</option>
                            {schoolYearOptions.map((schoolYear) => (
                              <option key={schoolYear} value={schoolYear}>{schoolYear}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPendingAttendanceDateRangeStart('');
                              setPendingAttendanceDateRangeEnd('');
                              setPendingAttendanceClassFilter('all');
                              setPendingAttendanceSemesterFilter('all');
                              setPendingAttendanceSchoolYearFilter('all');
                              setAttendanceDateRangeStart('');
                              setAttendanceDateRangeEnd('');
                              setAttendanceClassFilter('all');
                              setAttendanceSemesterFilter('all');
                              setAttendanceSchoolYearFilter('all');
                              setShowAttendanceFilters(false);
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAttendanceDateRangeStart(pendingAttendanceDateRangeStart);
                              setAttendanceDateRangeEnd(pendingAttendanceDateRangeEnd);
                              setAttendanceClassFilter(pendingAttendanceClassFilter);
                              setAttendanceSemesterFilter(pendingAttendanceSemesterFilter);
                              setAttendanceSchoolYearFilter(pendingAttendanceSchoolYearFilter);
                              setShowAttendanceFilters(false);
                            }}
                            className="rounded-lg border border-primary-600 bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
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

          {/* Table Section */}
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {filteredAttendance.length > 0 ? (
              <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    {currentAttendanceRecords.map((sheet) => (
                      <tr key={sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                          <div className="font-medium">{sheet.subject_code} - {sheet.subject_name}</div>
                          <div className="text-xs text-gray-500">EDP: {sheet.edp_code || '-'} | Join: {sheet.join_code || classMetadataById.get(Number(sheet.class_id))?.join_code || '-'}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{new Date(`${sheet.date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span className="text-green-700 font-medium">P:{sheet.present_count}</span>
                            <span className="text-red-700 font-medium">A:{sheet.absent_count}</span>
                            <span className="text-yellow-700 font-medium">L:{sheet.late_count}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">Total: {sheet.student_count}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                              onClick={() => handleUnarchiveAttendance(sheet.class_id, sheet.date, sheet.session_id, sheet.subject_code)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:bg-green-50"
                              icon={<ArchiveRestoreIcon size="xs" />}
                              title="Restore"
                              disabled={unarchivingAttendance === (sheet.session_id ? `${sheet.class_id}-${sheet.date}-${sheet.session_id}` : `${sheet.class_id}-${sheet.date}`)}
                            />
                            <Button
                              onClick={() => setAttendanceExportModalSheet(sheet)}
                              variant="outline"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-100"
                              icon={<Printer className="h-3 w-3" />}
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
              <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
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
                            <h3 className="text-sm font-medium text-gray-900">No archived attendance sheets</h3>
                          </>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
            <div className="flex justify-end">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-72 max-w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={classSearchTerm}
                    onChange={(e) => setClassSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search classes..."
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      const nextOpen = !showClassFilters;
                      if (nextOpen) {
                        setPendingClassSemesterFilter(classSemesterFilter);
                        setPendingClassSchoolYearFilter(classSchoolYearFilter);
                      }
                      setShowClassFilters(nextOpen);
                    }}
                    className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      showClassFilters || classActiveFilterCount > 0
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                    {classActiveFilterCount > 0 && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                        {classActiveFilterCount}
                      </span>
                    )}
                  </button>

                  {showClassFilters && (
                    <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">Filters</span>
                          {classActiveFilterCount > 0 && (
                            <button
                              onClick={() => {
                                setClassSemesterFilter('all');
                                setClassSchoolYearFilter('all');
                                setPendingClassSemesterFilter('all');
                                setPendingClassSchoolYearFilter('all');
                              }}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Semester</label>
                          <select
                            value={pendingClassSemesterFilter}
                            onChange={(e) => setPendingClassSemesterFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All semesters</option>
                            <option value="1">1st Semester</option>
                            <option value="2">2nd Semester</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">School Year</label>
                          <select
                            value={pendingClassSchoolYearFilter}
                            onChange={(e) => setPendingClassSchoolYearFilter(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All school years</option>
                            {schoolYearOptions.map((schoolYear) => (
                              <option key={schoolYear} value={schoolYear}>{schoolYear}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPendingClassSemesterFilter('all');
                              setPendingClassSchoolYearFilter('all');
                              setClassSemesterFilter('all');
                              setClassSchoolYearFilter('all');
                              setShowClassFilters(false);
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setClassSemesterFilter(pendingClassSemesterFilter);
                              setClassSchoolYearFilter(pendingClassSchoolYearFilter);
                              setShowClassFilters(false);
                            }}
                            className="rounded-lg border border-primary-600 bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
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

          {/* Table Section */}
          <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%] sm:w-auto">
                      Subject Code
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[30%] sm:w-auto">
                      Descriptive Title
                    </th>
                    <th className="hidden sm:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%] sm:w-auto">
                      Schedule
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%] sm:w-auto">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[24%] sm:w-auto">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentClassRecords.length > 0 ? (
                    currentClassRecords.map((cls) => (
                      <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                          {cls.subject_code || '-'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                          {cls.descriptive_title || cls.subject_name || '-'}
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                          {cls.schedule || '-'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-normal text-xs sm:text-sm align-top">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Archived
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-sm font-medium align-top">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <Button
                              onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=view`, {
                                state: {
                                  fromArchiveModal: true,
                                  returnToArchiveTab: 'classes',
                                },
                              })}
                              variant="outline"
                              size="xs"
                              className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                              icon={<Eye className="h-3 w-3" />}
                              title="View"
                            />
                            <Button
                              onClick={() => handleUnarchiveClass(cls.class_id)}
                              variant="outline"
                              size="xs"
                              className="text-green-600 hover:bg-green-50"
                              icon={<ArchiveRestoreIcon size="xs" />}
                              title="Restore"
                              disabled={unarchivingClass === cls.class_id}
                            />
                            <Button
                              onClick={() => setClassExportModalClass(cls)}
                              variant="outline"
                              size="xs"
                              className="text-gray-600 hover:bg-gray-100"
                              icon={<Printer className="h-3 w-3" />}
                              title="Export"
                              disabled={downloadingClasslist === cls.class_id}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        {classSearchTerm || classActiveFilterCount > 0 ? (
                          <>
                            <h3 className="text-sm font-medium text-gray-900">No matching archived classes found</h3>
                            <div className="mt-4">
                              <Button
                                onClick={() => {
                                  setClassSearchTerm('');
                                  setClassSemesterFilter('all');
                                  setClassSchoolYearFilter('all');
                                  setPendingClassSemesterFilter('all');
                                  setPendingClassSchoolYearFilter('all');
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Clear Filters
                              </Button>
                            </div>
                          </>
                        ) : (
                          <h3 className="text-sm font-medium text-gray-900">No archived classes</h3>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

      <Modal
        isOpen={!!attendanceExportModalSheet}
        onClose={() => setAttendanceExportModalSheet(null)}
        title="Export Attendance"
        size="sm"
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!attendanceExportModalSheet) return;
              const sheet = attendanceExportModalSheet;
              setAttendanceExportModalSheet(null);
              handleDownloadArchivedAttendance(sheet, 'csv');
            }}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!attendanceExportModalSheet) return;
              const sheet = attendanceExportModalSheet;
              setAttendanceExportModalSheet(null);
              handleDownloadArchivedAttendance(sheet, 'pdf');
            }}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!attendanceExportModalSheet) return;
              const sheet = attendanceExportModalSheet;
              setAttendanceExportModalSheet(null);
              handleDownloadArchivedAttendance(sheet, 'docx');
            }}
          >
            DOCX
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!classExportModalClass}
        onClose={() => setClassExportModalClass(null)}
        title="Export Classlist"
        size="sm"
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!classExportModalClass) return;
              const cls = classExportModalClass;
              setClassExportModalClass(null);
              handleDownloadArchivedClasslistByFormat(cls, 'csv');
            }}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!classExportModalClass) return;
              const cls = classExportModalClass;
              setClassExportModalClass(null);
              handleDownloadArchivedClasslistByFormat(cls, 'pdf');
            }}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (!classExportModalClass) return;
              const cls = classExportModalClass;
              setClassExportModalClass(null);
              handleDownloadArchivedClasslistByFormat(cls, 'docx');
            }}
          >
            DOCX
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default TeacherAttendanceArchive;
