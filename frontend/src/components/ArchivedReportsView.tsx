import React, { useState, useEffect } from 'react';
import { Card, CardBody } from './Card';
import Button from './Button';
import { Badge } from './Badge';
import LoadingDots from './LoadingDots';
import {
  ChevronRight,
  ChevronDown,
  ArchiveRestore,
  Calendar,
  Eye,
  Search,
  X,
  Filter,
} from 'lucide-react';
import { parseReportContext } from '../utils/feedbackComments';

interface Feedback {
  id: number;
  student_id: number;
  student_name: string;
  student_id_str: string;
  pc_number: string;
  comments?: string;
  computer_status: string;
  mouse_status: string;
  keyboard_status: string;
  monitor_status: string;
  computer_issue?: string;
  mouse_issue?: string;
  keyboard_issue?: string;
  monitor_issue?: string;
  additional_notes?: string;
  date_submitted: string;
  forwarded_by_name?: string;
  forwarded_at?: string;
}

interface ArchivedReportsViewProps {
  archivedReports: Feedback[];
  onRestore: (reportIDs: number[]) => Promise<void>;
  onView?: (date: string) => void;
  loading?: boolean;
}

interface GroupedReports {
  [archiveDate: string]: Feedback[];
}

const ArchivedReportsView: React.FC<ArchivedReportsViewProps> = ({
  archivedReports,
  onRestore,
  onView,
  loading = false
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedReports, setSelectedReports] = useState<Set<number>>(new Set());
  const [groupedReports, setGroupedReports] = useState<GroupedReports>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const activeFilterCount =
    (filterDateFrom || filterDateTo ? 1 : 0) + (filterStatus ? 1 : 0);

  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
    setShowFilters(false);
    setCurrentPage(1);
  };

  useEffect(() => {
    const grouped: GroupedReports = {};
    try {
      const searchLower = searchQuery.toLowerCase();

      (archivedReports || []).forEach((report) => {
        const matchesSearch =
          !searchLower ||
          report.student_name?.toLowerCase().includes(searchLower) ||
          report.student_id_str?.toLowerCase().includes(searchLower) ||
          report.pc_number?.toLowerCase().includes(searchLower) ||
          report.forwarded_by_name?.toLowerCase().includes(searchLower);

        const reportDate = report.date_submitted
          ? report.date_submitted.split(/[T\s]/)[0]
          : '';
        const matchesDate =
          (!filterDateFrom || reportDate >= filterDateFrom) &&
          (!filterDateTo || reportDate <= filterDateTo);

        let matchesStatus = true;
        if (filterStatus) {
          const hasIssue =
            (report.computer_status || '').toLowerCase() !== 'good' ||
            (report.mouse_status || '').toLowerCase() !== 'good' ||
            (report.keyboard_status || '').toLowerCase() !== 'good' ||
            (report.monitor_status || '').toLowerCase() !== 'good' ||
            !!(report.comments && report.comments.trim());
          matchesStatus =
            filterStatus === 'with_issue' ? hasIssue : !hasIssue;
        }

        if (!matchesSearch || !matchesDate || !matchesStatus) return;

        const raw = report?.date_submitted;
        const date = typeof raw === 'string' ? raw.split(/[T\s]/)[0] : '';
        if (!date) return;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(report);
      });

      setGroupedReports(grouped);

      const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      if (dates.length > 0) {
        setExpandedGroups(new Set([dates[0]]));
      } else {
        setExpandedGroups(new Set());
      }
      setCurrentPage(1);
    } catch (err) {
      console.error('ArchivedReportsView: failed to group reports', err);
      setGroupedReports({});
    }
  }, [archivedReports, searchQuery, filterDateFrom, filterDateTo, filterStatus]);

  const toggleGroup = (date: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedGroups(newExpanded);
  };

  const formatArchiveDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  const handleRestore = async () => {
    if (selectedReports.size === 0 || !onRestore) return;
    try {
      await onRestore(Array.from(selectedReports));
      setSelectedReports(new Set());
    } catch (err) {
      console.error('Failed to restore reports:', err);
    }
  };

  const toggleReportSelection = (reportId: number) => {
    const newSelection = new Set(selectedReports);
    if (newSelection.has(reportId)) {
      newSelection.delete(reportId);
    } else {
      newSelection.add(reportId);
    }
    setSelectedReports(newSelection);
  };

  const toggleGroupSelection = (reports: Feedback[]) => {
    const reportIds = reports.map(r => r.id);
    const allSelected = reportIds.every(id => selectedReports.has(id));
    
    const newSelection = new Set(selectedReports);
    if (allSelected) {
      reportIds.forEach(id => newSelection.delete(id));
    } else {
      reportIds.forEach(id => newSelection.add(id));
    }
    setSelectedReports(newSelection);
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'good' ? 'success' : 'warning';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-3" dotClassName="h-4 w-4" />
      </div>
    );
  }

  const sortedDates = Object.keys(groupedReports).sort((a, b) => b.localeCompare(a));

  // Pagination
  const totalPages = Math.ceil(sortedDates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDates = sortedDates.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header with Actions, Search, Filters, and Pagination */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {selectedReports.size > 0 ? (
            <div className="flex gap-3">
              <Button
                variant="success"
                onClick={handleRestore}
                icon={<ArchiveRestore className="h-4 w-4" />}
              >
                Restore ({selectedReports.size})
              </Button>
            </div>
          ) : (
            <div />
          )}

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

            <div className="relative">
              <button
                onClick={() => setShowFilters((v) => !v)}
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
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Filter by Date Range
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">
                          to
                        </span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Status
                      </label>
                      <div className="relative">
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                        >
                          <option value="">All statuses</option>
                          <option value="with_issue">With Issue</option>
                          <option value="no_issue">No Issue</option>
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFilters(false)}
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

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg ${
                            currentPage === page
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                )}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Archived Reports</h3>
              <p className="text-gray-500">
                Archived equipment reports will appear here organized by date
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedDates.map((date) => {
            const reports = groupedReports[date];
            const isExpanded = expandedGroups.has(date);
            const groupSelected = reports.every(r => selectedReports.has(r.id));
            const someSelected = reports.some(r => selectedReports.has(r.id)) && !groupSelected;

            return (
              <Card key={date} className="overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200">
                  <button
                    onClick={() => toggleGroup(date)}
                    className="flex items-center gap-4 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <Calendar className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">
                        {formatArchiveDate(date)}
                      </span>
                      <Badge variant="gray" className="ml-3">
                        {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                      </Badge>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    {onView && (
                      <button
                        onClick={() => onView(date)}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
                        title="View in Bond Paper Format"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    )}
                    <input
                      type="checkbox"
                      checked={groupSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someSelected;
                      }}
                      onChange={() => toggleGroupSelection(reports)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">Select all</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-12 px-6 py-3 text-left">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Full Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Reported for / Submitted from
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Computer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Mouse
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Keyboard
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Monitor
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reports.map((report) => (
                            <tr 
                              key={report.id}
                              className={`hover:bg-gray-50 transition-colors ${
                                selectedReports.has(report.id) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedReports.has(report.id)}
                                  onChange={() => toggleReportSelection(report.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {report.student_id_str}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {report.student_name}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="info">Reported for: {report.pc_number}</Badge>
                                  {(() => {
                                    const { reportedForAnotherPC, submittedFrom } = parseReportContext(report.comments);
                                    if (!reportedForAnotherPC && !submittedFrom) return null;
                                    return (
                                      <span className="text-xs text-gray-500">
                                        {reportedForAnotherPC && 'Reported for another PC'}
                                        {reportedForAnotherPC && submittedFrom && ' · '}
                                        {submittedFrom && `Submitted from: ${submittedFrom}`}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getStatusBadgeVariant(report.computer_status)}>
                                  {report.computer_status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getStatusBadgeVariant(report.mouse_status)}>
                                  {report.mouse_status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getStatusBadgeVariant(report.keyboard_status)}>
                                  {report.keyboard_status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getStatusBadgeVariant(report.monitor_status)}>
                                  {report.monitor_status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
};

export default ArchivedReportsView;
