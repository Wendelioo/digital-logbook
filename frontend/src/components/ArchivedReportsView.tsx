import React, { useState, useEffect } from 'react';
import { Card, CardBody } from './Card';
import Button from './Button';
import { Badge } from './Badge';
import { Archive, ChevronRight, ChevronDown, RotateCcw, Calendar, Eye } from 'lucide-react';

interface Feedback {
  id: number;
  student_id: number;
  student_name: string;
  student_id_str: string;
  pc_number: string;
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

  useEffect(() => {
    const grouped: GroupedReports = {};
    
    archivedReports.forEach(report => {
      const date = report.date_submitted.split(/[T\s]/)[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(report);
    });

    setGroupedReports(grouped);
    
    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    if (dates.length > 0) {
      setExpandedGroups(new Set([dates[0]]));
    }
  }, [archivedReports]);

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
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleRestore = async () => {
    if (selectedReports.size === 0) return;
    await onRestore(Array.from(selectedReports));
    setSelectedReports(new Set());
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
      {/* Header with Actions and Pagination */}
      <div className="flex items-center justify-between">
        {selectedReports.size > 0 ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRestore}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Restore ({selectedReports.size})
            </Button>
          </div>
        ) : (
          <div></div>
        )}

        {/* Pagination Controls at Top */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-gray-500">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {sortedDates.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Archive className="h-16 w-16 text-gray-300 mx-auto mb-4" />
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
                              PC Number
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant="info">{report.pc_number}</Badge>
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
