import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import {
  Search,
  X,
  SlidersHorizontal,
  Archive,
  AlertCircle
} from 'lucide-react';
import {
  GetFeedback,
  ArchiveFeedback
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { parseReportContext } from '../../utils/feedbackComments';
import { Feedback } from './types';

function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const reportsPerPage = 10;

  // General search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Date filter only
  const [dateFilter, setDateFilter] = useState('');

  // Archive functionality
  const [archiving, setArchiving] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveModalTab, setArchiveModalTab] = useState<'archived-logs' | 'reports'>('reports');
  const [selectedReportIDs, setSelectedReportIDs] = useState<Set<number>>(new Set());

  // Toast
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

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

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleArchiveSelected = async () => {
    const ids = Array.from(selectedReportIDs);
    if (ids.length === 0) {
      showToast('error', 'No reports to archive.');
      return;
    }
    if (!user) return;
    
    setArchiving(true);
    try {
      await ArchiveFeedback(ids, user.id);
      showToast('success', `${ids.length} report${ids.length === 1 ? '' : 's'} archived.`);
      setSelectedReportIDs(new Set());
      await loadReports();
      setArchiveModalTab('reports');
      setShowArchiveModal(true);
    } catch (error) {
      console.error('Failed to archive report:', error);
      showToast('error', 'Failed to archive equipment report');
    } finally {
      setArchiving(false);
    }
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

    const noIssue = isNoIssueReport(report);
    const matchesView =
      reportView === 'all' ? true :
      reportView === 'no_issue' ? noIssue :
      !noIssue; // 'issues' view

    return matchesSearch && matchesDate && matchesView;
  });

  // Pagination
  const totalReportPages = Math.ceil(filteredReports.length / reportsPerPage);
  const reportsStartIndex = (reportsPage - 1) * reportsPerPage;
  const reportsEndIndex = reportsStartIndex + reportsPerPage;
  const paginatedReports = filteredReports.slice(reportsStartIndex, reportsEndIndex);

  const filteredReportIDs = filteredReports.map((report) => report.id);
  const allFilteredSelected = filteredReportIDs.length > 0 && filteredReportIDs.every((id) => selectedReportIDs.has(id));
  const someFilteredSelected = filteredReportIDs.some((id) => selectedReportIDs.has(id)) && !allFilteredSelected;

  const toggleSelectAllFiltered = () => {
    const next = new Set(selectedReportIDs);
    if (allFilteredSelected) {
      filteredReportIDs.forEach((id) => next.delete(id));
    } else {
      filteredReportIDs.forEach((id) => next.add(id));
    }
    setSelectedReportIDs(next);
  };

  const toggleSelectReport = (id: number) => {
    const next = new Set(selectedReportIDs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedReportIDs(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
            {selectedReportIDs.size > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                {selectedReportIDs.size} selected
              </span>
            )}
          </div>
          <Button
            onClick={() => setShowArchiveModal(true)}
            variant="outline"
            icon={<Archive className="h-4 w-4" />}
          >
            Archived Reports
          </Button>
        </div>

        {/* Search Toolbar + View Toggle */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
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

            <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${showFilters
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              {dateFilter && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  1
                </span>
              )}
            </button>

            {/* Dropdown Filters Panel */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
            </div>

            {(searchQuery || dateFilter) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear All
              </button>
            )}
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
        {/* Batch action bar — shown when rows are selected */}
        {selectedReportIDs.size > 0 && (
          <div className="px-4 py-3 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              <span className="font-semibold text-primary-900">{selectedReportIDs.size}</span> report{selectedReportIDs.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReportIDs(new Set())}
              >
                Clear Selection
              </Button>
              <Button
                onClick={handleArchiveSelected}
                variant="primary"
                size="sm"
                icon={<Archive className="h-4 w-4" />}
                disabled={archiving}
              >
                Archive ({selectedReportIDs.size})
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <colgroup>
                <col style={{ width: '40px' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(input) => { if (input) input.indeterminate = someFilteredSelected; }}
                      onChange={toggleSelectAllFiltered}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                    />
                  </th>
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
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 font-medium">
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
                          <input
                            type="checkbox"
                            checked={selectedReportIDs.has(report.id)}
                            onChange={() => toggleSelectReport(report.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
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

      {/* Archive Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          toast.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-slideIn`}>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <AdminArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        initialTab={archiveModalTab}
      />
    </div>
  );
}

export default Reports;
