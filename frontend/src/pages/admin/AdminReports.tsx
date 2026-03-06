import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import {
  Search,
  X,
  Archive,
  AlertCircle,
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
  Filter
} from 'lucide-react';
import {
  GetFeedback,
  GetFeedbackRangeCount,
  ExportFeedbackCSVByRange,
  ExportFeedbackPDFByRange,
  ExportFeedbackDOCXByRange
} from '../../../wailsjs/go/backend/App';
import { parseReportContext } from '../../utils/feedbackComments';
import { Feedback } from './types';

function Reports() {
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const reportsPerPage = 10;

  // General search
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportCountLoading, setExportCountLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // View toggle: all, issue reports, or no-issue (compliance) reports
  const [reportView, setReportView] = useState<'all' | 'issues' | 'no_issue'>('issues');

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

  const activeFilterCount = [dateFilter, filterStatus].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setFilterStatus('');
    setShowFilters(false);
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

  const handleExport = async (format: 'pdf' | 'csv' | 'docx') => {
    if (!exportStart || !exportEnd) return;
    setExporting(true);
    try {
      let filename = '';
      if (format === 'pdf') filename = await ExportFeedbackPDFByRange(exportStart, exportEnd);
      else if (format === 'csv') filename = await ExportFeedbackCSVByRange(exportStart, exportEnd);
      else filename = await ExportFeedbackDOCXByRange(exportStart, exportEnd);
      showExportToast('success', `Exported to Downloads: ${filename.split(/[\\/]/).pop()}`);
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

  const filteredReports = reports.filter(report => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      report.student_name?.toLowerCase().includes(searchLower) ||
      report.student_id_str?.toLowerCase().includes(searchLower) ||
      report.pc_number?.toString().toLowerCase().includes(searchLower) ||
      report.forwarded_by_name?.toLowerCase().includes(searchLower)
    );

    const matchesDate = !dateFilter || (
      report.date_submitted && report.date_submitted.split(/[T\s]/)[0] === dateFilter
    );

    const matchesStatus = !filterStatus || report.status === filterStatus;

    const noIssue = isNoIssueReport(report);
    const matchesView =
      reportView === 'all' ? true :
      reportView === 'no_issue' ? noIssue :
      !noIssue; // 'issues' view

    return matchesSearch && matchesDate && matchesStatus && matchesView;
  });

  // Pagination
  const totalReportPages = Math.ceil(filteredReports.length / reportsPerPage);
  const reportsStartIndex = (reportsPage - 1) * reportsPerPage;
  const reportsEndIndex = reportsStartIndex + reportsPerPage;
  const paginatedReports = filteredReports.slice(reportsStartIndex, reportsEndIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
            icon={<Archive className="h-4 w-4" />}
          >
            Archived Reports
          </Button>
        </div>

        {/* Search + Export Toolbar + View Toggle */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-end gap-2">
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
                onClick={() => setShowFilters(v => !v)}
                title="Filters"
                className={`relative flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setDateFilter(''); setFilterStatus(''); }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  {/* Date filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pr-8 py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      {dateFilter && (
                        <button
                          onClick={() => setDateFilter('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                      <option value="forwarded">Forwarded</option>
                    </select>
                  </div>

                </div>
              )}
            </div>

            <button
              onClick={() => { setShowExportModal(true); setExportCount(null); }}
              title="Export"
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>

          {/* View toggle: Issues vs No-issue compliance */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-gray-600 mr-1">Show:</span>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium border-r border-gray-300 ${
                  reportView === 'issues'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setReportView('issues')}
              >
                Issue reports
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium border-r border-gray-300 ${
                  reportView === 'no_issue'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setReportView('no_issue')}
              >
                No-issue logs
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium ${
                  reportView === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setReportView('all')}
              >
                All
              </button>
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

      {/* Single Unified Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PC / Origin</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Verified at</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Forwarded By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 font-medium">
                      No equipment reports submitted
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => {
                    const { reportedForAnotherPC, submittedFrom } = parseReportContext(report.comments);
                    return (
                      <tr
                        key={report.id}
                        className={`transition-colors ${
                          isNoIssueReport(report) ? 'bg-white hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'
                        }`}
                      >
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate">{report.student_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{report.student_id_str}</div>
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
                        <td className="px-3 py-3">
                          <span className="text-xs text-gray-600">
                            {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: '2-digit'
                            }) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {isNoIssueReport(report) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">
                              All Working
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 whitespace-nowrap">
                              Has Issues
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-gray-600">
                            {report.verified_at
                              ? new Date(report.verified_at).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })
                              : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate">{report.forwarded_by_name || 'Unknown'}</div>
                          {report.forwarded_at && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(report.forwarded_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {filteredReports.length > 0 && totalReportPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {reportsStartIndex + 1} to {Math.min(reportsEndIndex, filteredReports.length)} of {filteredReports.length} entries
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
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Export Equipment Reports</h3>
              </div>
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
                <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                  exportCount > 0 ? 'bg-primary-50 text-primary-800 border border-primary-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}>
                  <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
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
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-xs font-semibold">PDF</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={!exportStart || !exportEnd || exporting || exportCount === 0}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileSpreadsheet className="h-6 w-6" />
                    <span className="text-xs font-semibold">CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    disabled={!exportStart || !exportEnd || exporting || exportCount === 0}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileType className="h-6 w-6" />
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
