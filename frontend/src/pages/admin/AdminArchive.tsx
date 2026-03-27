import { useState, useEffect, useRef } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import { Badge } from '../../components/Badge';
import LoadingDots from '../../components/LoadingDots';
import {
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react';
import {
  GetArchivedLogs,
  GetArchivedFeedback,
  ExportArchivedLogSheetCSV,
  ExportArchivedLogSheetDOCX,
  ExportArchivedLogSheetPDF,
  ExportArchivedFeedbackSheetCSV,
  ExportArchivedFeedbackSheetDOCX,
  ExportArchivedFeedbackSheetPDF
} from '../../../wailsjs/go/backend/App';
import {
  openExportSaveDialog,
  defaultArchivedLogFilename,
  defaultArchivedFeedbackFilename,
  getDirectoryFromPath,
  type ExportFormat,
} from '../../utils/exportSaveDialog';
import { parseReportContext } from '../../utils/feedbackComments';
import { LoginLog, Feedback } from './types';
import { useAppUi } from '../../contexts/AppUiContext';

export type ArchiveTab = 'archived-logs' | 'reports';

interface ArchiveManagementProps {
  initialTab?: ArchiveTab;
  hideHeader?: boolean;
}

function ArchiveManagement({ initialTab = 'archived-logs', hideHeader = false }: ArchiveManagementProps) {
  const { toast } = useAppUi();
  const [activeTab, setActiveTab] = useState<ArchiveTab>(initialTab);
  const [archivedLogs, setArchivedLogs] = useState<LoginLog[]>([]);
  const [archivedFeedback, setArchivedFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [rangeExporting, setRangeExporting] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const downloadDropdownRef = useRef<HTMLDivElement | null>(null);

  // Per-tab search & filters (similar to active admin tables)
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logUserTypeFilter, setLogUserTypeFilter] = useState('');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'with_issue' | 'no_issue'>('all');

  // Archived logs: same filter/export pattern as active Log Entries (AdminLogs)
  const [logFilterDateFrom, setLogFilterDateFrom] = useState('');
  const [logFilterDateTo, setLogFilterDateTo] = useState('');
  const [logFilterUserType, setLogFilterUserType] = useState('');
  const [pendingLogFilterDateFrom, setPendingLogFilterDateFrom] = useState('');
  const [pendingLogFilterDateTo, setPendingLogFilterDateTo] = useState('');
  const [pendingLogFilterUserType, setPendingLogFilterUserType] = useState('');
  const [showLogFilters, setShowLogFilters] = useState(false);
  const [showLogExportModal, setShowLogExportModal] = useState(false);
  const [logExportStart, setLogExportStart] = useState('');
  const [logExportEnd, setLogExportEnd] = useState('');
  const [logExportCount, setLogExportCount] = useState<number | null>(null);
  const [logExporting, setLogExporting] = useState(false);
  const [logExportToast, setLogExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Archived reports (feedback): same filter/export pattern as active Equipment Reports (AdminReports)
  const [reportFilterDateFrom, setReportFilterDateFrom] = useState('');
  const [reportFilterDateTo, setReportFilterDateTo] = useState('');
  const [reportFilterStatus, setReportFilterStatus] = useState<'all' | 'with_issue' | 'no_issue'>('all');
  const [pendingReportFilterDateFrom, setPendingReportFilterDateFrom] = useState('');
  const [pendingReportFilterDateTo, setPendingReportFilterDateTo] = useState('');
  const [pendingReportFilterStatus, setPendingReportFilterStatus] = useState<'all' | 'with_issue' | 'no_issue'>('all');
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [showReportExportModal, setShowReportExportModal] = useState(false);
  const [reportExportStart, setReportExportStart] = useState('');
  const [reportExportEnd, setReportExportEnd] = useState('');
  const [reportExportCount, setReportExportCount] = useState<number | null>(null);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportExportToast, setReportExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isScopedModal = hideHeader;
  const allowReportsSection = !isScopedModal || initialTab === 'reports';
  const allowLogsSection = !isScopedModal || initialTab !== 'reports';

  useEffect(() => {
    if (isScopedModal) {
      setActiveTab(allowReportsSection ? 'reports' : 'archived-logs');
      return;
    }

    setActiveTab(initialTab);
  }, [initialTab, isScopedModal, allowReportsSection]);

  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logItemsPerPage = 10;

  const [feedbackCurrentPage, setFeedbackCurrentPage] = useState(1);
  const feedbackItemsPerPage = 10;

  useEffect(() => {
    loadArchivedData();
  }, []);

  useEffect(() => {
    if (!showFilterPanel && !showDownloadMenu) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFilterPanel(false);
      }

      if (
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDownloadMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFilterPanel, showDownloadMenu]);

  const loadArchivedData = async () => {
    setLoading(true);
    try {
      const [logs, feedback] = await Promise.all([
        GetArchivedLogs(),
        GetArchivedFeedback()
      ]);
      setArchivedLogs(logs || []);
      setArchivedFeedback(feedback || []);
      setError('');
    } catch (err) {
      console.error('Failed to load archived data:', err);
      setError('Failed to load archived data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatLogTime = (timeStr: string) => {
    if (!timeStr) return 'N/A';
    const date = new Date(timeStr.replace(' ', 'T'));
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateLogDuration = (loginTime: string, logoutTime?: string) => {
    if (!logoutTime) return '';
    const login = new Date(loginTime.replace(' ', 'T'));
    const logout = new Date(logoutTime.replace(' ', 'T'));
    const diffMs = logout.getTime() - login.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const normalizeDateOnly = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const splitDate = trimmed.split(/[T\s]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(splitDate)) {
      return splitDate;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toISOString().slice(0, 10);
  };

  const toInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyRangePreset = (preset: 'today' | 'last7' | 'thisMonth') => {
    const now = new Date();
    const end = toInputDate(now);

    if (preset === 'today') {
      setRangeStartDate(end);
      setRangeEndDate(end);
      return;
    }

    if (preset === 'last7') {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      setRangeStartDate(toInputDate(startDate));
      setRangeEndDate(end);
      return;
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setRangeStartDate(toInputDate(startOfMonth));
    setRangeEndDate(end);
  };

  const handleExportRange = async (format: ExportFormat) => {
    const isLogsTab = activeTab === 'archived-logs';
    const isReportsTab = activeTab === 'reports';

    if (!isLogsTab && !isReportsTab) {
      toast('Range export is available in Logs and Reports tabs only.', 'error');
      return;
    }

    const exportStart = appliedStartDate || rangeStartDate;
    const exportEnd = appliedEndDate || rangeEndDate;

    if (!exportStart || !exportEnd) {
      toast('Please apply a valid filter range before exporting.', 'error');
      return;
    }

    if (exportStart > exportEnd) {
      toast('Start date cannot be later than end date.', 'error');
      return;
    }

    if (appliedStartDate !== exportStart || appliedEndDate !== exportEnd) {
      setAppliedStartDate(exportStart);
      setAppliedEndDate(exportEnd);
      setLogCurrentPage(1);
      setFeedbackCurrentPage(1);
    }

    const filteredSourceDates = isLogsTab
      ? filteredLogRecords.map((record) => normalizeDateOnly(record.login_time))
      : filteredReportRecords.map((record) => normalizeDateOnly(record.date_submitted));

    const availableDates = Array.from(new Set(filteredSourceDates.filter(Boolean)))
      .filter((date) => date >= exportStart && date <= exportEnd)
      .sort((a, b) => a.localeCompare(b));

    if (availableDates.length === 0) {
      toast('No archived records found for the selected date range.', 'error');
      return;
    }

    const firstDate = availableDates[0];
    const defaultName = isLogsTab
      ? defaultArchivedLogFilename(firstDate, format)
      : defaultArchivedFeedbackFilename(firstDate, format);
    const title = isLogsTab ? 'Save archived log (first file)' : 'Save archived report (first file)';
    const savePath = await openExportSaveDialog(title, defaultName, format);
    if (!savePath) return;

    const dir = getDirectoryFromPath(savePath);
    const sep = savePath.includes('\\') ? '\\' : '/';

    setRangeExporting(true);
    try {
      for (let index = 0; index < availableDates.length; index++) {
        const date = availableDates[index];
        const fullPath = index === 0
          ? savePath
          : dir + sep + (isLogsTab
              ? defaultArchivedLogFilename(date, format)
              : defaultArchivedFeedbackFilename(date, format));
        if (isLogsTab) {
          if (format === 'csv') {
            await ExportArchivedLogSheetCSV(date, fullPath);
          } else if (format === 'pdf') {
            await ExportArchivedLogSheetPDF(date, fullPath);
          } else {
            await ExportArchivedLogSheetDOCX(date, fullPath);
          }
        } else {
          if (format === 'csv') {
            await ExportArchivedFeedbackSheetCSV(date, fullPath);
          } else if (format === 'pdf') {
            await ExportArchivedFeedbackSheetPDF(date, fullPath);
          } else {
            await ExportArchivedFeedbackSheetDOCX(date, fullPath);
          }
        }
      }

      toast(
        `Exported ${availableDates.length} date file(s) as ${format.toUpperCase()} for ${exportStart} to ${exportEnd}.`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Failed to export selected date range.', 'error');
    } finally {
      setRangeExporting(false);
    }
  };

  const handleApplyFilter = () => {
    if (!rangeStartDate || !rangeEndDate) {
      toast('Please select both start and end dates.', 'error');
      return;
    }

    if (rangeStartDate > rangeEndDate) {
      toast('Start date cannot be later than end date.', 'error');
      return;
    }

    setAppliedStartDate(rangeStartDate);
    setAppliedEndDate(rangeEndDate);
    setLogCurrentPage(1);
    setFeedbackCurrentPage(1);
  };

  const handleClearFilter = () => {
    setRangeStartDate('');
    setRangeEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setLogCurrentPage(1);
    setFeedbackCurrentPage(1);
  };

  const hasValidRangeFilter =
    Boolean(rangeStartDate) &&
    Boolean(rangeEndDate) &&
    rangeStartDate <= rangeEndDate;

  const hasActiveRangeFilter = Boolean(appliedStartDate) && Boolean(appliedEndDate);

  const hasAnyRangeInput = Boolean(rangeStartDate) || Boolean(rangeEndDate);

  // Archived logs: same filtering as active Log Entries (date range + search + user type)
  const activeLogFilterCount = [logFilterDateFrom, logFilterDateTo, logFilterUserType].filter(Boolean).length;
  const clearLogFilters = () => {
    setLogFilterDateFrom('');
    setLogFilterDateTo('');
    setLogFilterUserType('');
    setPendingLogFilterDateFrom('');
    setPendingLogFilterDateTo('');
    setPendingLogFilterUserType('');
    setLogCurrentPage(1);
  };

  const filteredLogRecords = (() => {
    let base = archivedLogs;
    const recordDateOk = (record: LoginLog) => {
      const d = normalizeDateOnly(record.login_time);
      return (!logFilterDateFrom || d >= logFilterDateFrom) && (!logFilterDateTo || d <= logFilterDateTo);
    };
    base = base.filter(recordDateOk);
    if (logSearchQuery) {
      const q = logSearchQuery.toLowerCase();
      base = base.filter((record) =>
        (record.user_name || '').toLowerCase().includes(q) ||
        (record.user_id_number || '').toLowerCase().includes(q) ||
        (record.user_type || '').toLowerCase().includes(q) ||
        (record.pc_number || '').toLowerCase().includes(q)
      );
    }
    if (logFilterUserType) {
      base = base.filter((record) => record.user_type === logFilterUserType);
    }
    return base;
  })();

  const applyLogExportRange = () => {
    if (!logExportStart || !logExportEnd) return;
    const inRange = archivedLogs.filter((record) => {
      const d = normalizeDateOnly(record.login_time);
      return d >= logExportStart && d <= logExportEnd;
    });
    setLogExportCount(inRange.length);
  };

  const showLogExportToast = (type: 'success' | 'error', message: string) => {
    setLogExportToast({ type, message });
    setTimeout(() => setLogExportToast(null), 5000);
  };

  const handleLogExport = async (format: ExportFormat) => {
    if (!logExportStart || !logExportEnd) return;
    const inRange = archivedLogs.filter((record) => {
      const d = normalizeDateOnly(record.login_time);
      return d >= logExportStart && d <= logExportEnd;
    });
    const dates = Array.from(new Set(inRange.map((r) => normalizeDateOnly(r.login_time)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) {
      showLogExportToast('error', 'No records found for this date range.');
      return;
    }
    const firstDate = dates[0];
    const defaultName = defaultArchivedLogFilename(firstDate, format);
    const savePath = await openExportSaveDialog('Save archived log entries', defaultName, format);
    if (!savePath) return;
    const dir = getDirectoryFromPath(savePath);
    const sep = savePath.includes('\\') ? '\\' : '/';
    setLogExporting(true);
    try {
      for (let index = 0; index < dates.length; index++) {
        const date = dates[index];
        const fullPath = index === 0 ? savePath : dir + sep + defaultArchivedLogFilename(date, format);
        if (format === 'csv') await ExportArchivedLogSheetCSV(date, fullPath);
        else if (format === 'pdf') await ExportArchivedLogSheetPDF(date, fullPath);
        else await ExportArchivedLogSheetDOCX(date, fullPath);
      }
      showLogExportToast('success', `Saved ${dates.length} file(s).`);
    } catch (err: any) {
      showLogExportToast('error', err?.message || 'Export failed. Please try again.');
    } finally {
      setLogExporting(false);
    }
  };

  // Helper to mirror active reports status semantics
  const isNoIssueReport = (record: Feedback) => {
    const allGood =
      (record.equipment_condition || '').toLowerCase() === 'good' &&
      (record.monitor_condition || '').toLowerCase() === 'good' &&
      (record.keyboard_condition || '').toLowerCase() === 'good' &&
      (record.mouse_condition || '').toLowerCase() === 'good';
    const hasComment = !!(record.comments && record.comments.trim());
    return allGood && !hasComment;
  };

  const countIssues = (record: Feedback): number =>
    [
      record.equipment_condition,
      record.monitor_condition,
      record.keyboard_condition,
      record.mouse_condition,
    ].filter(c => c && c.toLowerCase() !== 'good').length;

  // Archived reports: same filtering as active Equipment Reports (date range + search + status)
  const activeReportFilterCount = (reportFilterDateFrom || reportFilterDateTo ? 1 : 0) + (reportFilterStatus !== 'all' ? 1 : 0);
  const clearReportFilters = () => {
    setReportFilterDateFrom('');
    setReportFilterDateTo('');
    setReportFilterStatus('all');
    setPendingReportFilterDateFrom('');
    setPendingReportFilterDateTo('');
    setPendingReportFilterStatus('all');
    setFeedbackCurrentPage(1);
  };

  const filteredReportRecords = (() => {
    let base = archivedFeedback;
    const recordDateOk = (record: Feedback) => {
      const d = normalizeDateOnly(record.date_submitted);
      return (!reportFilterDateFrom || d >= reportFilterDateFrom) && (!reportFilterDateTo || d <= reportFilterDateTo);
    };
    base = base.filter(recordDateOk);
    if (reportSearchQuery) {
      const q = reportSearchQuery.toLowerCase();
      base = base.filter((record) =>
        (record.student_name || '').toLowerCase().includes(q) ||
        (record.student_id_str || '').toLowerCase().includes(q) ||
        (record.pc_number || '').toLowerCase().includes(q) ||
        (record.forwarded_by_name || '').toLowerCase().includes(q)
      );
    }
    if (reportFilterStatus !== 'all') {
      base = base.filter((record) => {
        const noIssue = isNoIssueReport(record);
        return reportFilterStatus === 'with_issue' ? !noIssue : noIssue;
      });
    }
    return base;
  })();

  const applyReportExportRange = () => {
    if (!reportExportStart || !reportExportEnd) return;
    const inRange = archivedFeedback.filter((record) => {
      const d = normalizeDateOnly(record.date_submitted);
      return d >= reportExportStart && d <= reportExportEnd;
    });
    setReportExportCount(inRange.length);
  };

  const showReportExportToast = (type: 'success' | 'error', message: string) => {
    setReportExportToast({ type, message });
    setTimeout(() => setReportExportToast(null), 5000);
  };

  const handleReportExport = async (format: ExportFormat) => {
    if (!reportExportStart || !reportExportEnd) return;
    const inRange = archivedFeedback.filter((record) => {
      const d = normalizeDateOnly(record.date_submitted);
      return d >= reportExportStart && d <= reportExportEnd;
    });
    const dates = Array.from(new Set(inRange.map((r) => normalizeDateOnly(r.date_submitted)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) {
      showReportExportToast('error', 'No reports found for this date range.');
      return;
    }
    const firstDate = dates[0];
    const defaultName = defaultArchivedFeedbackFilename(firstDate, format);
    const savePath = await openExportSaveDialog('Save archived feedback report', defaultName, format);
    if (!savePath) return;
    const dir = getDirectoryFromPath(savePath);
    const sep = savePath.includes('\\') ? '\\' : '/';
    setReportExporting(true);
    try {
      for (let index = 0; index < dates.length; index++) {
        const date = dates[index];
        const fullPath = index === 0 ? savePath : dir + sep + defaultArchivedFeedbackFilename(date, format);
        if (format === 'csv') await ExportArchivedFeedbackSheetCSV(date, fullPath);
        else if (format === 'pdf') await ExportArchivedFeedbackSheetPDF(date, fullPath);
        else await ExportArchivedFeedbackSheetDOCX(date, fullPath);
      }
      showReportExportToast('success', `Saved ${dates.length} file(s).`);
    } catch (err: any) {
      showReportExportToast('error', err?.message || 'Export failed. Please try again.');
    } finally {
      setReportExporting(false);
    }
  };

  const logTotalPages = Math.ceil(filteredLogRecords.length / logItemsPerPage);
  const logStartIndex = (logCurrentPage - 1) * logItemsPerPage;
  const logEndIndex = logStartIndex + logItemsPerPage;
  const paginatedLogRecords = filteredLogRecords.slice(logStartIndex, logEndIndex);

  const feedbackTotalPages = Math.ceil(filteredReportRecords.length / feedbackItemsPerPage);
  const feedbackStartIndex = (feedbackCurrentPage - 1) * feedbackItemsPerPage;
  const feedbackEndIndex = feedbackStartIndex + feedbackItemsPerPage;
  const paginatedReportRecords = filteredReportRecords.slice(feedbackStartIndex, feedbackEndIndex);

  const isLogsTab = activeTab === 'archived-logs' && allowLogsSection;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isScopedModal ? 'min-h-[620px]' : ''}`}>
      {!hideHeader && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === 'reports' ? 'Archived Feedback Reports' : 'Archived Log Entries'}
          </h2>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isScopedModal && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
          <div className={`grid grid-cols-1 ${allowLogsSection && allowReportsSection ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2`}>
            {allowLogsSection && (
              <button
                onClick={() => setActiveTab('archived-logs')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLogsTab
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Logs
              </button>
            )}
            {allowReportsSection && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Reports
              </button>
            )}
          </div>
        </div>
      )}

      {/* Archived Log Entries: same toolbar as active Log Entries (search bar, Filter, Export) */}
      {isLogsTab && (
        <>
          {logExportToast && (
            <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
              logExportToast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            } animate-slideIn`}>
              <span className="font-medium">{logExportToast.message}</span>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-end gap-2">
              <div className="w-64 max-w-full relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, ID, type, PC..."
                  value={logSearchQuery}
                  onChange={(e) => { setLogSearchQuery(e.target.value); setLogCurrentPage(1); }}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {logSearchQuery && (
                  <button
                    onClick={() => { setLogSearchQuery(''); setLogCurrentPage(1); }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowLogFilters(!showLogFilters);
                    if (!showLogFilters) {
                      setPendingLogFilterDateFrom(logFilterDateFrom);
                      setPendingLogFilterDateTo(logFilterDateTo);
                      setPendingLogFilterUserType(logFilterUserType);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                    showLogFilters || activeLogFilterCount > 0
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {activeLogFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                      {activeLogFilterCount}
                    </span>
                  )}
                </button>

                {showLogFilters && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">Filters</span>
                        {activeLogFilterCount > 0 && (
                          <button onClick={clearLogFilters} className="text-xs text-primary-600 hover:underline">Clear all</button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={pendingLogFilterDateFrom}
                              onChange={(e) => setPendingLogFilterDateFrom(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={pendingLogFilterDateTo}
                              onChange={(e) => setPendingLogFilterDateTo(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">User Type</label>
                        <select
                          value={pendingLogFilterUserType}
                          onChange={(e) => setPendingLogFilterUserType(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">All types</option>
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="working_student">Working Student</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingLogFilterUserType('');
                            setPendingLogFilterDateFrom('');
                            setPendingLogFilterDateTo('');
                            setLogFilterUserType('');
                            setLogFilterDateFrom('');
                            setLogFilterDateTo('');
                            setLogCurrentPage(1);
                            setShowLogFilters(false);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLogFilterUserType(pendingLogFilterUserType);
                            setLogFilterDateFrom(pendingLogFilterDateFrom);
                            setLogFilterDateTo(pendingLogFilterDateTo);
                            setLogCurrentPage(1);
                            setShowLogFilters(false);
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

              <button
                onClick={() => { setShowLogExportModal(true); setLogExportCount(null); }}
                title="Export"
                className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Export Modal (same structure and text as active Log Entries) */}
          {showLogExportModal && (
            <div className="modal-backdrop">
              <div className="modal-surface-2xl w-full max-w-md mx-2 sm:mx-4 overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-primary-200/80 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
                  <h3 className="text-lg font-semibold text-primary-950">Export Log Entries</h3>
                  <button onClick={() => setShowLogExportModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="date"
                          value={logExportStart}
                          onChange={(e) => { setLogExportStart(e.target.value); setLogExportCount(null); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <span className="text-gray-400 mt-4">—</span>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={logExportEnd}
                          onChange={(e) => { setLogExportEnd(e.target.value); setLogExportCount(null); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={applyLogExportRange}
                      disabled={!logExportStart || !logExportEnd}
                      className="mt-2 w-full py-2 rounded-lg border border-primary-500 text-primary-700 text-sm font-medium hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply Range
                    </button>
                  </div>
                  {logExportCount !== null && (
                    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                      logExportCount > 0 ? 'bg-primary-50 text-primary-800 border border-primary-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    }`}>
                      {logExportCount > 0
                        ? `${logExportCount} record${logExportCount !== 1 ? 's' : ''} found in this range`
                        : 'No records found for this date range'}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleLogExport('pdf')}
                        disabled={!logExportStart || !logExportEnd || logExporting || logExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">PDF</span>
                      </button>
                      <button
                        onClick={() => handleLogExport('csv')}
                        disabled={!logExportStart || !logExportEnd || logExporting || logExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">CSV</span>
                      </button>
                      <button
                        onClick={() => handleLogExport('docx')}
                        disabled={!logExportStart || !logExportEnd || logExporting || logExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">DOCX</span>
                      </button>
                    </div>
                    {logExporting && (
                      <p className="mt-2 text-xs text-center text-gray-500">Exporting, please wait...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Archived Feedback Reports: same toolbar as active Equipment Reports (search bar, Filter, Export) */}
      {activeTab === 'reports' && allowReportsSection && (
        <>
          {reportExportToast && (
            <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
              reportExportToast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            } animate-slideIn`}>
              <span className="font-medium">{reportExportToast.message}</span>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-end gap-2">
              <div className="w-64 max-w-full relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student, ID, PC..."
                  value={reportSearchQuery}
                  onChange={(e) => { setReportSearchQuery(e.target.value); setFeedbackCurrentPage(1); }}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {reportSearchQuery && (
                  <button
                    onClick={() => { setReportSearchQuery(''); setFeedbackCurrentPage(1); }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowReportFilters(!showReportFilters);
                    if (!showReportFilters) {
                      setPendingReportFilterDateFrom(reportFilterDateFrom);
                      setPendingReportFilterDateTo(reportFilterDateTo);
                      setPendingReportFilterStatus(reportFilterStatus);
                    }
                  }}
                  title="Filters"
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                    showReportFilters || activeReportFilterCount > 0
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {activeReportFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                      {activeReportFilterCount}
                    </span>
                  )}
                </button>

                {showReportFilters && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Date Range</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={pendingReportFilterDateFrom}
                              onChange={(e) => setPendingReportFilterDateFrom(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={pendingReportFilterDateTo}
                              onChange={(e) => setPendingReportFilterDateTo(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <div className="relative">
                          <select
                            value={pendingReportFilterStatus}
                            onChange={(e) => setPendingReportFilterStatus(e.target.value as 'all' | 'with_issue' | 'no_issue')}
                            className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                          >
                            <option value="all">All statuses</option>
                            <option value="with_issue">With Issue</option>
                            <option value="no_issue">No Issue</option>
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingReportFilterDateFrom('');
                            setPendingReportFilterDateTo('');
                            setPendingReportFilterStatus('all');
                            setReportFilterDateFrom('');
                            setReportFilterDateTo('');
                            setReportFilterStatus('all');
                            setFeedbackCurrentPage(1);
                            setShowReportFilters(false);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReportFilterDateFrom(pendingReportFilterDateFrom);
                            setReportFilterDateTo(pendingReportFilterDateTo);
                            setReportFilterStatus(pendingReportFilterStatus);
                            setFeedbackCurrentPage(1);
                            setShowReportFilters(false);
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

              <button
                onClick={() => { setShowReportExportModal(true); setReportExportCount(null); }}
                title="Export"
                className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Export Modal (same structure and text as active Equipment Reports, no icons in modal) */}
          {showReportExportModal && (
            <div className="modal-backdrop">
              <div className="modal-surface-2xl w-full max-w-md mx-2 sm:mx-4 overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-primary-200/80 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
                  <h3 className="text-lg font-semibold text-primary-950">Export Equipment Reports</h3>
                  <button onClick={() => setShowReportExportModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="date"
                          value={reportExportStart}
                          onChange={(e) => { setReportExportStart(e.target.value); setReportExportCount(null); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <span className="text-gray-400 mt-4">—</span>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={reportExportEnd}
                          onChange={(e) => { setReportExportEnd(e.target.value); setReportExportCount(null); }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={applyReportExportRange}
                      disabled={!reportExportStart || !reportExportEnd}
                      className="mt-2 w-full py-2 rounded-lg border border-primary-500 text-primary-700 text-sm font-medium hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply Range
                    </button>
                  </div>
                  {reportExportCount !== null && (
                    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                      reportExportCount > 0 ? 'bg-primary-50 text-primary-800 border border-primary-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    }`}>
                      {reportExportCount > 0
                        ? `${reportExportCount} report${reportExportCount !== 1 ? 's' : ''} found in this range`
                        : 'No reports found for this date range'}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleReportExport('pdf')}
                        disabled={!reportExportStart || !reportExportEnd || reportExporting || reportExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">PDF</span>
                      </button>
                      <button
                        onClick={() => handleReportExport('csv')}
                        disabled={!reportExportStart || !reportExportEnd || reportExporting || reportExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">CSV</span>
                      </button>
                      <button
                        onClick={() => handleReportExport('docx')}
                        disabled={!reportExportStart || !reportExportEnd || reportExporting || reportExportCount === 0}
                        className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="text-xs font-semibold">DOCX</span>
                      </button>
                    </div>
                    {reportExporting && (
                      <p className="mt-2 text-xs text-center text-gray-500">Exporting, please wait...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isLogsTab && (
        <div className={`flex-1 overflow-x-auto ${isScopedModal ? 'min-h-[460px]' : 'min-h-[380px]'}`}>
          {filteredLogRecords.length > 0 ? (
            <>
              <div className="border-2 border-gray-300">
              <Table
                columns={[
                  {
                    key: 'date',
                    label: 'Date',
                    render: (record: LoginLog) => (
                      <span className="text-sm text-gray-700">{formatDate(record.login_time)}</span>
                    )
                  },
                  {
                    key: 'user_name',
                    label: 'Name',
                    render: (record: LoginLog) => (
                      <span className="font-medium text-gray-900">{record.user_name}</span>
                    )
                  },
                  {
                    key: 'user_id_number',
                    label: 'ID Number',
                    render: (record: LoginLog) => (
                      <span className="text-gray-700">{record.user_id_number}</span>
                    )
                  },
                  {
                    key: 'user_type',
                    label: 'User Type',
                    render: (record: LoginLog) => (
                      <Badge variant={
                        record.user_type === 'admin' ? 'danger' :
                        record.user_type === 'teacher' ? 'warning' :
                        record.user_type === 'working_student' ? 'info' :
                        'success'
                      }>
                        {record.user_type.replace('_', ' ')}
                      </Badge>
                    )
                  },
                  {
                    key: 'pc_number',
                    label: 'PC Number',
                    render: (record: LoginLog) => (
                      <span className="text-gray-600">{record.pc_number || 'N/A'}</span>
                    )
                  },
                  {
                    key: 'login_time',
                    label: 'Login Time',
                    render: (record: LoginLog) => (
                      <span className="text-gray-600">{formatLogTime(record.login_time)}</span>
                    )
                  },
                  {
                    key: 'logout_time',
                    label: 'Logout Time',
                    render: (record: LoginLog) => (
                      <span className="text-gray-600">{record.logout_time ? formatLogTime(record.logout_time) : ''}</span>
                    )
                  },
                  {
                    key: 'duration',
                    label: 'Duration',
                    render: (record: LoginLog) => (
                      <span className="text-gray-600">{calculateLogDuration(record.login_time, record.logout_time)}</span>
                    )
                  }
                ]}
                data={paginatedLogRecords}
                loading={processing}
                emptyMessage="No login activity recorded"
              />
            </div>

            {logTotalPages > 1 && (
              <div className="mt-4 flex justify-center items-center gap-2">
                <button
                  onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={logCurrentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: logTotalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === logTotalPages ||
                      (page >= logCurrentPage - 1 && page <= logCurrentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setLogCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg ${
                            logCurrentPage === page
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === logCurrentPage - 2 || page === logCurrentPage + 2) {
                      return <span key={page} className="px-2 text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setLogCurrentPage(prev => Math.min(logTotalPages, prev + 1))}
                  disabled={logCurrentPage === logTotalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-sm font-medium text-gray-900">No archived logs found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting the date range filter or clear it to show all records.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && allowReportsSection && (
        <div className={`flex-1 overflow-x-auto ${isScopedModal ? 'min-h-[460px]' : 'min-h-[380px]'}`}>
          {filteredReportRecords.length > 0 ? (
            <>
              <Table
                columns={[
                  {
                    key: 'student_name',
                    label: 'Student',
                    width: '220px',
                    render: (record: Feedback) => (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{record.student_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{record.student_id_str || '—'}</div>
                      </div>
                    )
                  },
                  {
                    key: 'pc_origin',
                    label: 'PC / Origin',
                    width: '180px',
                    render: (record: Feedback) => (
                      (() => {
                        const { reportedForAnotherPC, submittedFrom } = parseReportContext(record.comments);
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium w-fit max-w-full truncate">
                              {record.pc_number || '—'}
                            </span>
                            {(reportedForAnotherPC || submittedFrom) && (
                              <span className="text-xs text-gray-500 truncate">
                                {submittedFrom ? `from ${submittedFrom}` : 'Other PC'}
                              </span>
                            )}
                          </div>
                        );
                      })()
                    )
                  },
                  {
                    key: 'date_submitted',
                    label: 'Date',
                    width: '120px',
                    render: (record: Feedback) => (
                      <span className="text-xs text-gray-600">
                        {record.date_submitted ? formatDate(record.date_submitted) : '—'}
                      </span>
                    )
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    width: '120px',
                    render: (record: Feedback) => {
                      const issueCount = countIssues(record);
                      if (issueCount === 0) {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">
                            No Issues
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 whitespace-nowrap">
                          {issueCount} {issueCount === 1 ? 'Issue' : 'Issues'}
                        </span>
                      );
                    }
                  },
                  {
                    key: 'forwarded_by',
                    label: 'Forwarded By',
                    width: '180px',
                    render: (record: Feedback) => (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{record.forwarded_by_name || 'Unknown'}</div>
                        {record.forwarded_at && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(record.forwarded_at).toLocaleString('en-US', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }
                ]}
                data={paginatedReportRecords}
                loading={processing}
                emptyMessage="No archived reports found"
              />

              {feedbackTotalPages > 1 && (
                <div className="mt-4 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setFeedbackCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={feedbackCurrentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: feedbackTotalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === feedbackTotalPages ||
                        (page >= feedbackCurrentPage - 1 && page <= feedbackCurrentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setFeedbackCurrentPage(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              feedbackCurrentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === feedbackCurrentPage - 2 || page === feedbackCurrentPage + 2) {
                        return <span key={page} className="px-2 text-gray-500">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => setFeedbackCurrentPage(prev => Math.min(feedbackTotalPages, prev + 1))}
                    disabled={feedbackCurrentPage === feedbackTotalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-sm font-medium text-gray-900">No archived reports found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting the date range filter or clear it to show all records.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default ArchiveManagement;
