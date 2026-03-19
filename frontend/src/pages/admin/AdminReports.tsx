import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import LoadingDots from '../../components/LoadingDots';
import {
  Search,
  X,
  History,
  AlertCircle,
  Download,
  Filter,
  Eye
} from 'lucide-react';
import {
  GetFeedback,
  GetFeedbackRangeCount,
  ExportFeedbackCSVByRange,
  ExportFeedbackPDFByRange,
  ExportFeedbackDOCXByRange,
  SetFeedbackAdminStatus
} from '../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultFeedbackRangeFilename, type ExportFormat } from '../../utils/exportSaveDialog';
import { parseReportContext } from '../../utils/feedbackComments';
import { StatusBadge } from '../../components/Badge';
import { Feedback } from './types';
import { useAuth } from '../../contexts/AuthContext';

function Reports() {
  const pageSizeOptions = [1, 25, 50, 100, 200, 300, 400, 500];

  const { user } = useAuth();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPerPage, setReportsPerPage] = useState(25);

  // General search
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [pendingDateRangeStart, setPendingDateRangeStart] = useState('');
  const [pendingDateRangeEnd, setPendingDateRangeEnd] = useState('');
  const [pendingFilterStatus, setPendingFilterStatus] = useState('');

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Feedback | null>(null);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportCountLoading, setExportCountLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Pending issues modal visibility
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Reset to page 1 whenever any filter/search changes
  useEffect(() => {
    setReportsPage(1);
  }, [searchQuery, dateRangeStart, dateRangeEnd, filterStatus]);

  useEffect(() => {
    loadReports();

    // Auto-refresh every 30 seconds to show new feedback reports
    const refreshInterval = setInterval(() => {
      loadReports();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadReports = async () => {
    try {
      const data = await GetFeedback();
      if (data && Array.isArray(data)) {
        setReports(data);
      } else {
        setReports([]);
      }
      setError('');
    } catch (error) {
      console.error('Failed to load reports:', error);
      setError('Failed to load reports. Please check your database connection.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = (dateRangeStart || dateRangeEnd ? 1 : 0) + (filterStatus ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setFilterStatus('');
    setShowFilters(false);
    setPendingDateRangeStart('');
    setPendingDateRangeEnd('');
    setPendingFilterStatus('');
  };

  const applyExportRange = async () => {
    if (!exportStart || !exportEnd) return;
    setExportCountLoading(true);
    try {
      const count = await GetFeedbackRangeCount(exportStart, exportEnd);
      setExportCount(count);
    } catch {
      setExportCount(0);
    } finally {
      setExportCountLoading(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!exportStart || !exportEnd) return;
    const defaultName = defaultFeedbackRangeFilename(exportStart, exportEnd, format);
    const savePath = await openExportSaveDialog('Save feedback report', defaultName, format);
    if (!savePath) return;
    setExporting(true);
    try {
      let filename = '';
      if (format === 'pdf') filename = await ExportFeedbackPDFByRange(exportStart, exportEnd, savePath);
      else if (format === 'csv') filename = await ExportFeedbackCSVByRange(exportStart, exportEnd, savePath);
      else filename = await ExportFeedbackDOCXByRange(exportStart, exportEnd, savePath);
      showExportToast('success', `Saved: ${filename.split(/[\\/]/).pop()}`);
    } catch {
      showExportToast('error', 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const showExportToast = (type: 'success' | 'error', message: string) => {
    setExportToast({ type, message });
    setTimeout(() => setExportToast(null), 5000);
  };

  const isNoIssueReport = (report: Feedback) => {
    const allGood =
      (report.equipment_condition || '').toLowerCase() === 'good' &&
      (report.monitor_condition || '').toLowerCase() === 'good' &&
      (report.keyboard_condition || '').toLowerCase() === 'good' &&
      (report.mouse_condition || '').toLowerCase() === 'good';
    const hasComment = !!(report.comments && report.comments.trim());
    return allGood && !hasComment;
  };

  const countIssues = (report: Feedback): number =>
    [
      report.equipment_condition,
      report.monitor_condition,
      report.keyboard_condition,
      report.mouse_condition,
    ].filter(c => c && c.toLowerCase() !== 'good').length;

  const filteredReports = reports.filter(report => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      report.student_name?.toLowerCase().includes(searchLower) ||
      report.student_id_str?.toLowerCase().includes(searchLower) ||
      report.pc_number?.toString().toLowerCase().includes(searchLower) ||
      report.forwarded_by_name?.toLowerCase().includes(searchLower)
    );

    const reportDate = report.date_submitted ? report.date_submitted.split(/[T\s]/)[0] : '';
    const matchesDate = !dateRangeStart && !dateRangeEnd ? true : (
      reportDate &&
      (!dateRangeStart || reportDate >= dateRangeStart) &&
      (!dateRangeEnd || reportDate <= dateRangeEnd)
    );

    const isResolved = (report.admin_status || '').toLowerCase() === 'resolved';
    const matchesStatus = !filterStatus ||
      (filterStatus === 'resolved'
        ? isResolved
        : filterStatus === 'with_issue'
          ? !isNoIssueReport(report)
          : isNoIssueReport(report));

    return matchesSearch && matchesDate && matchesStatus;
  });

  const pendingReports = filteredReports.filter(
    (report) =>
      (report.admin_status || '').toLowerCase() !== 'resolved' &&
      !isNoIssueReport(report)
  );

  // Main table should only show:
  // 1) no-issue reports, or
  // 2) issue reports already resolved by admin.
  const tableReports = filteredReports.filter((report) => {
    const isResolved = (report.admin_status || '').toLowerCase() === 'resolved';
    return isNoIssueReport(report) || isResolved;
  });

  const handleAdminStatusToggle = async (report: Feedback, nextStatus: 'pending' | 'resolved') => {
    if (!user) return;
    try {
      await SetFeedbackAdminStatus(report.id, user.id, nextStatus);
      // update local state optimistically
      setReports(prev =>
        prev.map(r =>
          r.id === report.id
            ? {
                ...r,
                admin_status: nextStatus,
                admin_resolved_at: nextStatus === 'resolved'
                  ? new Date().toISOString().replace('T', ' ').slice(0, 19)
                  : undefined,
              }
            : r
        )
      );
    } catch (e) {
      console.error('Failed to update admin status', e);
      setExportToast({ type: 'error', message: 'Failed to update status. Please try again.' });
      setTimeout(() => setExportToast(null), 5000);
    }
  };

  // Pagination
  const totalReportPages = Math.ceil(tableReports.length / reportsPerPage);
  const reportsStartIndex = (reportsPage - 1) * reportsPerPage;
  const reportsEndIndex = reportsStartIndex + reportsPerPage;
  const paginatedReports = tableReports.slice(reportsStartIndex, reportsEndIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div>
      {/* Export Toast */}
      {exportToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          exportToast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-slideIn`}>
          <span className="font-medium">{exportToast.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
          </div>
          <Button
            onClick={() => setShowArchiveModal(true)}
            variant="outline"
            icon={<History className="h-4 w-4" />}
          >
            Archived Reports
          </Button>
        </div>

        {/* Search + Export Toolbar + View Toggle */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Pending issues button */}
            <button
              onClick={() => setShowPendingModal(true)}
              title="View pending issues"
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                pendingReports.length > 0
                  ? 'border-red-400 bg-red-50 text-red-800 hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-800'
              }`}
            >
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white px-1">
                {pendingReports.length}
              </span>
              <span>Pending Issues</span>
            </button>

            {/* Right: search, filters, export */}
            <div className="flex items-center gap-2">
              <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search student, ID, PC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              </div>

              {/* Filter button */}
              <div className="relative">
              <button
              onClick={() => {
                const nextOpen = !showFilters;
                if (nextOpen) {
                  setPendingDateRangeStart(dateRangeStart);
                  setPendingDateRangeEnd(dateRangeEnd);
                  setPendingFilterStatus(filterStatus);
                }
                setShowFilters(nextOpen);
              }}
                title="Filters"
                className={`relative flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
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
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingDateRangeEnd}
                            onChange={(e) => setPendingDateRangeEnd(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <div className="relative">
                        <select
                          value={pendingFilterStatus}
                          onChange={(e) => setPendingFilterStatus(e.target.value)}
                          className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                        >
                          <option value="">All statuses</option>
                          <option value="resolved">Resolved</option>
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

                    {/* Apply & Clear */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDateRangeStart('');
                          setPendingDateRangeEnd('');
                          setPendingFilterStatus('');
                          setDateRangeStart('');
                          setDateRangeEnd('');
                          setFilterStatus('');
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
                          setFilterStatus(pendingFilterStatus);
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

              <button
                onClick={() => {
                  setExportStart(dateRangeStart || '');
                  setExportEnd(dateRangeEnd || '');
                  setShowExportModal(true);
                  setExportCount(null);
                }}
                title="Export"
                className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>

              <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
                <span className="text-gray-500">Show</span>
                <select
                  value={reportsPerPage}
                  onChange={(e) => {
                    setReportsPerPage(Number(e.target.value));
                    setReportsPage(1);
                  }}
                  className="bg-transparent border-none p-0 pr-6 text-sm font-medium text-gray-900 focus:outline-none focus:ring-0"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-gray-500">entries</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Issues Modal */}
      <Modal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        title="Pending Equipment Issues"
        size="lg"
      >
        {pendingReports.length === 0 ? (
          <div className="py-6 text-sm text-gray-600">
            No pending issues right now. New forwarded reports from working students will appear here.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
            {pendingReports.map((report) => {
              const { reportedForAnotherPC, submittedFrom } = parseReportContext(report.comments);
              const issues = countIssues(report);
              return (
                <div key={report.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900 truncate">{report.student_name}</span>
                      <span className="text-[11px] text-gray-500 truncate">{report.student_id_str}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                        {report.pc_number}
                      </span>
                      {submittedFrom && (
                        <span className="text-gray-500">from {submittedFrom}</span>
                      )}
                      <span className="text-gray-500">
                        {report.date_submitted
                          ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                              month: '2-digit', day: '2-digit', year: 'numeric'
                            })
                          : '—'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
                        {issues === 0 ? 'No Issues' : `${issues} ${issues === 1 ? 'Issue' : 'Issues'}`}
                      </span>
                    </div>
                    {report.comments && (
                      <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                        {report.comments}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full hover:bg-primary-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View details
                    </button>
                    <button
                      onClick={() => handleAdminStatusToggle(report, 'resolved')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Mark as Resolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
        Unresolved reports with issues are managed in Pending Issues and will appear in this table once marked as resolved.
      </div>

      {/* Single Unified Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <colgroup>
                <col style={{ width: '27%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="pl-4 pr-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PC / Origin</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Forwarded By</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 font-medium">
                      No equipment reports submitted
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => {
                    const { reportedForAnotherPC, submittedFrom } = parseReportContext(report.comments);
                    const issues = countIssues(report);
                    const hasIssues = issues > 0;
                    const isResolved = (report.admin_status || '').toLowerCase() === 'resolved';
                    return (
                      <tr
                        key={report.id}
                        className={`transition-colors ${
                          isNoIssueReport(report) ? 'bg-white hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'
                        }`}
                      >
                        <td className="pl-4 pr-3 py-3 align-top">
                          <div className="text-sm font-medium text-gray-900 leading-tight break-words">{report.student_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-tight break-words">{report.student_id_str}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium w-fit truncate max-w-full">
                              {report.pc_number}
                            </span>
                            {(reportedForAnotherPC || submittedFrom) && (
                              <span className="text-xs text-gray-500 truncate">
                                {submittedFrom ? `from ${submittedFrom}` : 'Other PC'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs text-gray-600">
                            {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                              month: '2-digit', day: '2-digit', year: 'numeric'
                            }) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            if (isResolved) {
                              const resolvedAt = report.admin_resolved_at
                                ? new Date(report.admin_resolved_at)
                                : null;
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-100 text-emerald-800">
                                    Resolved
                                  </span>
                                  {resolvedAt && !Number.isNaN(resolvedAt.getTime()) && (
                                    <span className="text-[11px] text-emerald-700 whitespace-nowrap">
                                      {resolvedAt.toLocaleString('en-US', {
                                        month: '2-digit',
                                        day: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            const baseLabel = hasIssues ? `${issues} ${issues === 1 ? 'Issue' : 'Issues'}` : 'No Issues';

                            return (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  hasIssues
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {baseLabel}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate">{report.forwarded_by_name || 'Unknown'}</div>
                          {report.forwarded_at && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(report.forwarded_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <button
                              onClick={() => setSelectedReport(report)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            {!isResolved && hasIssues ? (
                              <button
                                onClick={() => handleAdminStatusToggle(report, 'resolved')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                Mark Resolved
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>
        {tableReports.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {reportsStartIndex + 1} to {Math.min(reportsEndIndex, tableReports.length)} of {tableReports.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setReportsPage(prev => Math.max(1, prev - 1))}
                disabled={reportsPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              {Array.from({ length: totalReportPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  onClick={() => setReportsPage(pageNum)}
                  variant={reportsPage === pageNum ? "primary" : "outline"}
                  size="sm"
                >
                  {pageNum}
                </Button>
              ))}
              <Button
                onClick={() => setReportsPage(prev => Math.min(totalReportPages, prev + 1))}
                disabled={reportsPage >= totalReportPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback View Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Equipment Report Details"
        size="md"
      >
        {selectedReport && (() => {
          const conditionBadge = (label: string, value: string) => {
            const isGood = value?.toLowerCase() === 'good';
            return (
              <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {value || '—'}
                </span>
              </div>
            );
          };
          return (
            <div className="space-y-5">
              {/* Student Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Student</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedReport.student_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">ID Number</p>
                    <p className="text-sm text-gray-800">{selectedReport.student_id_str}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">PC Number</p>
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {selectedReport.pc_number}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Date Submitted</p>
                    <p className="text-sm text-gray-800">
                      {selectedReport.date_submitted
                        ? new Date(selectedReport.date_submitted).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Equipment Conditions */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Equipment Conditions</p>
                <div className="border border-gray-200 rounded-lg px-4 divide-y divide-gray-100">
                  {conditionBadge('Equipment / CPU', selectedReport.equipment_condition)}
                  {conditionBadge('Monitor', selectedReport.monitor_condition)}
                  {conditionBadge('Keyboard', selectedReport.keyboard_condition)}
                  {conditionBadge('Mouse', selectedReport.mouse_condition)}
                </div>
              </div>

              {/* Comments */}
              {selectedReport.comments && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Comments</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedReport.comments}</p>
                </div>
              )}

              {/* Working Student Notes */}
              {selectedReport.working_student_notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Working Student Notes</p>
                  <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">{selectedReport.working_student_notes}</p>
                </div>
              )}

              {/* Forwarded By */}
              {selectedReport.forwarded_by_name && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Forwarded By</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedReport.forwarded_by_name}</p>
                  {selectedReport.forwarded_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(selectedReport.forwarded_at).toLocaleString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <AdminArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        initialTab="reports"
      />
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Export Equipment Reports</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={exportStart}
                      onChange={(e) => { setExportStart(e.target.value); setExportCount(null); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <span className="text-gray-400 mt-4">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={exportEnd}
                      onChange={(e) => { setExportEnd(e.target.value); setExportCount(null); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <button
                  onClick={applyExportRange}
                  disabled={!exportStart || !exportEnd || exportCountLoading}
                  className="mt-2 w-full py-2 rounded-lg border border-primary-500 text-primary-700 text-sm font-medium hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {exportCountLoading ? 'Checking...' : 'Apply Range'}
                </button>
              </div>

              {/* Record count preview */}
              {exportCount !== null && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  exportCount > 0 ? 'bg-primary-50 text-primary-800 border border-primary-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}>
                  {exportCount > 0
                    ? `${exportCount} report${exportCount !== 1 ? 's' : ''} found in this range`
                    : 'No reports found for this date range'}
                </div>
              )}

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={!exportStart || !exportEnd || exporting || exportCount === 0}
                    className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-xs font-semibold">PDF</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={!exportStart || !exportEnd || exporting || exportCount === 0}
                    className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-xs font-semibold">CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    disabled={!exportStart || !exportEnd || exporting || exportCount === 0}
                    className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-xs font-semibold">DOCX</span>
                  </button>
                </div>
                {exporting && (
                  <p className="mt-2 text-xs text-center text-gray-500">Exporting, please wait...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
