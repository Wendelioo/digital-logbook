import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from './Card';
import Table from './Table';
import Button from './Button';
import { Badge } from './Badge';
import { Archive, ChevronRight, ChevronDown, RotateCcw, Trash2, Download, Calendar, Eye } from 'lucide-react';

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_id_number: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

interface ArchivedLogsViewProps {
  archivedLogs: LoginLog[];
  onRestore: (logIDs: number[]) => Promise<void>;
  onDelete?: (logIDs: number[]) => Promise<void>;
  onExport?: (logIDs: number[], format: 'csv' | 'pdf') => Promise<void>;
  onView?: (date: string) => void;
  loading?: boolean;
}

interface GroupedLogs {
  [archiveDate: string]: LoginLog[];
}

const ArchivedLogsView: React.FC<ArchivedLogsViewProps> = ({
  archivedLogs,
  onRestore,
  onDelete,
  onExport,
  onView,
  loading = false
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Group logs by archive date (we'll extract from login_time for demo)
  useEffect(() => {
    const grouped: GroupedLogs = {};
    
    archivedLogs.forEach(log => {
      // Extract date from login_time (format: "2006-01-02 15:04:05")
      const date = log.login_time.split(' ')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(log);
    });

    setGroupedLogs(grouped);
    
    // Auto-expand first group
    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    if (dates.length > 0) {
      setExpandedGroups(new Set([dates[0]]));
    }
  }, [archivedLogs]);

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

  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'N/A';
    const date = new Date(timeStr.replace(' ', 'T'));
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateDuration = (loginTime: string, logoutTime?: string) => {
    if (!logoutTime) return 'Active';
    
    const login = new Date(loginTime.replace(' ', 'T'));
    const logout = new Date(logoutTime.replace(' ', 'T'));
    const diffMs = logout.getTime() - login.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const handleRestore = async () => {
    if (selectedLogs.size === 0) return;
    await onRestore(Array.from(selectedLogs));
    setSelectedLogs(new Set());
  };

  const handleDelete = async () => {
    if (!onDelete || selectedLogs.size === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedLogs.size} log(s)?`)) {
      await onDelete(Array.from(selectedLogs));
      setSelectedLogs(new Set());
    }
  };

  const toggleLogSelection = (logId: number) => {
    const newSelection = new Set(selectedLogs);
    if (newSelection.has(logId)) {
      newSelection.delete(logId);
    } else {
      newSelection.add(logId);
    }
    setSelectedLogs(newSelection);
  };

  const toggleGroupSelection = (logs: LoginLog[]) => {
    const logIds = logs.map(l => l.id);
    const allSelected = logIds.every(id => selectedLogs.has(id));
    
    const newSelection = new Set(selectedLogs);
    if (allSelected) {
      logIds.forEach(id => newSelection.delete(id));
    } else {
      logIds.forEach(id => newSelection.add(id));
    }
    setSelectedLogs(newSelection);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // Pagination
  const totalPages = Math.ceil(sortedDates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDates = sortedDates.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header with Actions and Pagination */}
      <div className="flex items-center justify-between">
        {selectedLogs.size > 0 ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRestore}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Restore ({selectedLogs.size})
            </Button>
            {onDelete && (
              <Button
                variant="danger"
                onClick={handleDelete}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete ({selectedLogs.size})
              </Button>
            )}
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

      {/* Archive Groups */}
      {sortedDates.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Archive className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Archived Logs</h3>
              <p className="text-gray-500">
                Archived log entries will appear here organized by date
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedDates.map((date) => {
            const logs = groupedLogs[date];
            const isExpanded = expandedGroups.has(date);
            const groupSelected = logs.every(l => selectedLogs.has(l.id));
            const someSelected = logs.some(l => selectedLogs.has(l.id)) && !groupSelected;

            return (
              <Card key={date} className="overflow-hidden">
                {/* Group Header */}
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
                        {logs.length} {logs.length === 1 ? 'log' : 'logs'}
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
                      onChange={() => toggleGroupSelection(logs)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">Select all</span>
                  </div>
                </div>

                {/* Group Content */}
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
                              Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ID Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              PC Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Login Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Logout Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {logs.map((log) => (
                            <tr 
                              key={log.id}
                              className={`hover:bg-gray-50 transition-colors ${
                                selectedLogs.has(log.id) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedLogs.has(log.id)}
                                  onChange={() => toggleLogSelection(log.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {log.user_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {log.user_id_number}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={
                                  log.user_type === 'admin' ? 'danger' :
                                  log.user_type === 'teacher' ? 'warning' :
                                  log.user_type === 'working_student' ? 'info' :
                                  'success'
                                }>
                                  {log.user_type.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {log.pc_number || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatTime(log.login_time)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {log.logout_time ? formatTime(log.logout_time) : 'Active'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {calculateDuration(log.login_time, log.logout_time)}
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

export default ArchivedLogsView;
