import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
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
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
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

  const parseWorkingStudentMeta = (notes?: string) => {
    if (!notes) {
      return {
        verification: 'N/A',
        recommendation: 'N/A'
      };
    }

    const lines = notes.split('\n').map((line) => line.trim());
    const verificationLine = lines.find((line) => line.toLowerCase().startsWith('verification:'));
    const recommendationLine = lines.find((line) => line.toLowerCase().startsWith('recommendation:'));

    return {
      verification: verificationLine ? verificationLine.replace(/^verification:\s*/i, '').trim() || 'N/A' : 'N/A',
      recommendation: recommendationLine ? recommendationLine.replace(/^recommendation:\s*/i, '').trim() || 'N/A' : 'N/A'
    };
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

  // Filter reports
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

    return matchesSearch && matchesDate;
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
        <div className="flex justify-between items-start mb-6">
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

        {/* Search Toolbar */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
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
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            ref={(input) => {
              if (input) input.indeterminate = someFilteredSelected;
            }}
            onChange={toggleSelectAllFiltered}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-700">Select all visible</span>
          {selectedReportIDs.size > 0 && (
            <span className="text-xs text-gray-500">{selectedReportIDs.size} selected</span>
          )}
        </div>

        <Button
          onClick={handleArchiveSelected}
          variant="outline"
          size="sm"
          icon={<Archive className="h-4 w-4" />}
          disabled={selectedReportIDs.size === 0 || archiving}
        >
          Archive Selected
        </Button>
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
      <div>
        <Table
          columns={[
            {
              key: 'select',
              label: 'Select',
              width: '90px',
              render: (report: Feedback) => (
                <input
                  type="checkbox"
                  checked={selectedReportIDs.has(report.id)}
                  onChange={() => toggleSelectReport(report.id)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                />
              )
            },
            {
              key: 'student_id_str',
              label: 'Student ID',
              render: (report: Feedback) => (
                <span className="text-gray-700">{report.student_id_str}</span>
              )
            },
            {
              key: 'student_name',
              label: 'Full Name',
              render: (report: Feedback) => (
                <span className="font-medium text-gray-900">{report.student_name}</span>
              )
            },
            {
              key: 'pc_number',
              label: 'PC Number',
              render: (report: Feedback) => (
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {report.pc_number}
                </span>
              )
            },
            {
              key: 'date_submitted',
              label: 'Date',
              render: (report: Feedback) => (
                <span className="text-gray-600">
                  {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'N/A'}
                </span>
              )
            },
            {
              key: 'verification',
              label: 'Verification',
              render: (report: Feedback) => {
                const meta = parseWorkingStudentMeta(report.working_student_notes);
                const normalized = meta.verification.toLowerCase();

                let badgeClass = 'bg-gray-100 text-gray-700';
                if (normalized.includes('confirmed')) {
                  badgeClass = 'bg-green-100 text-green-700';
                }
                if (normalized.includes('not confirmed')) {
                  badgeClass = 'bg-red-100 text-red-700';
                }

                return (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                    {meta.verification}
                  </span>
                );
              }
            },
            {
              key: 'recommendation',
              label: 'Recommendation',
              render: (report: Feedback) => {
                const meta = parseWorkingStudentMeta(report.working_student_notes);
                return (
                  <span className="text-sm text-gray-700">
                    {meta.recommendation}
                  </span>
                );
              }
            },
            {
              key: 'forwarded_by_name',
              label: 'Forwarded By',
              render: (report: Feedback) => (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{report.forwarded_by_name || 'Unknown'}</span>
                  {report.forwarded_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(report.forwarded_at).toLocaleString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              )
            }
          ]}
          data={paginatedReports}
          loading={loading}
          emptyMessage="No equipment reports submitted"
          hideEmptyIcon
        />
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
