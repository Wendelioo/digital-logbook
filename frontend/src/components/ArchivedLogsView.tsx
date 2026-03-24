import React, { useState, useEffect, useMemo } from 'react';
import { useAppUi } from '../contexts/AppUiContext';
import { Card, CardBody } from './Card';
import Button from './Button';
import { Badge } from './Badge';
import LoadingDots from './LoadingDots';
import { ArchiveRestoreIcon } from './icons/ArchiveIcons';
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  Calendar,
  Eye,
  Search,
  X,
  Filter,
} from 'lucide-react';

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
  const { confirm } = useAppUi();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterUserType, setFilterUserType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [pendingFilterUserType, setPendingFilterUserType] = useState('');
  const [pendingFilterDateFrom, setPendingFilterDateFrom] = useState('');
  const [pendingFilterDateTo, setPendingFilterDateTo] = useState('');

  const activeFilterCount = [filterUserType, filterDateFrom, filterDateTo].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setFilterUserType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPendingFilterUserType('');
    setPendingFilterDateFrom('');
    setPendingFilterDateTo('');
    setShowFilters(false);
    setCurrentPage(1);
  };

  const groupedLogs = useMemo(() => {
    const grouped: GroupedLogs = {};
    const searchLower = searchQuery.toLowerCase();

    (archivedLogs || []).forEach((log) => {
      const matchesSearch =
        !searchLower ||
        log.user_name?.toLowerCase().includes(searchLower) ||
        log.user_id_number?.toLowerCase().includes(searchLower) ||
        log.user_type?.toLowerCase().includes(searchLower) ||
        (log.pc_number || '').toLowerCase().includes(searchLower);

      const logDate = log.login_time ? log.login_time.split(/[T\s]/)[0] : '';
      const matchesDate =
        (!filterDateFrom || logDate >= filterDateFrom) &&
        (!filterDateTo || logDate <= filterDateTo);

      const matchesType = !filterUserType || log.user_type === filterUserType;

      if (!matchesSearch || !matchesDate || !matchesType) return;

      const raw = log?.login_time;
      const date = typeof raw === 'string' ? raw.split(' ')[0] : '';
      if (!date) return;

      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    });

    return grouped;
  }, [archivedLogs, searchQuery, filterUserType, filterDateFrom, filterDateTo]);

  const sortedDates = useMemo(
    () => Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a)),
    [groupedLogs]
  );

  useEffect(() => {
    const validDates = new Set(sortedDates);

    setExpandedGroups((prev) => {
      const next = new Set<string>();
      prev.forEach((date) => {
        if (validDates.has(date)) next.add(date);
      });

      if (next.size === 0 && sortedDates.length > 0) {
        next.add(sortedDates[0]);
      }

      return next;
    });
  }, [sortedDates]);

  useEffect(() => {
    const allVisibleIDs = new Set<number>();
    Object.values(groupedLogs).forEach((logs) => {
      logs.forEach((log) => allVisibleIDs.add(log.id));
    });

    setSelectedLogs((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (allVisibleIDs.has(id)) next.add(id);
      });
      return next;
    });
  }, [groupedLogs]);

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
    if (!logoutTime) return '';
    
    const login = new Date(loginTime.replace(' ', 'T'));
    const logout = new Date(logoutTime.replace(' ', 'T'));
    const diffMs = logout.getTime() - login.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const handleRestore = async () => {
    if (selectedLogs.size === 0 || !onRestore) return;
    try {
      await onRestore(Array.from(selectedLogs));
      setSelectedLogs(new Set());
    } catch (err) {
      console.error('Failed to restore logs:', err);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || selectedLogs.size === 0) return;
    const ok = await confirm({
      title: 'Delete logs',
      message: `Are you sure you want to permanently delete ${selectedLogs.size} log(s)?`,
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await onDelete(Array.from(selectedLogs));
      setSelectedLogs(new Set());
    } catch (err) {
      console.error('Failed to delete logs:', err);
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
        <LoadingDots className="justify-center gap-3" dotClassName="h-4 w-4" />
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(sortedDates.length / itemsPerPage);

  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
      return;
    }
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDates = sortedDates.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Search + Filter Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {selectedLogs.size > 0 ? (
            <div className="flex gap-3">
              <Button
                variant="success"
                onClick={handleRestore}
                icon={<ArchiveRestoreIcon />}
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
            <div />
          )}

          <div className="flex items-center gap-2">
            <div className="w-64 max-w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, ID, type, PC..."
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
              onClick={() => {
                const nextOpen = !showFilters;
                if (nextOpen) {
                  setPendingFilterUserType(filterUserType);
                  setPendingFilterDateFrom(filterDateFrom);
                  setPendingFilterDateTo(filterDateTo);
                }
                setShowFilters(nextOpen);
              }}
                className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">
                        Filters
                      </span>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Date Range
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingFilterDateFrom}
                            onChange={(e) => setPendingFilterDateFrom(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">
                          to
                        </span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingFilterDateTo}
                            onChange={(e) => setPendingFilterDateTo(e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        User Type
                      </label>
                      <select
                        value={pendingFilterUserType}
                        onChange={(e) => setPendingFilterUserType(e.target.value)}
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
                          clearFilters();
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterUserType(pendingFilterUserType);
                          setFilterDateFrom(pendingFilterDateFrom);
                          setFilterDateTo(pendingFilterDateTo);
                          setCurrentPage(1);
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

          {/* Pagination Controls at Top */}
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

      {/* Archive Groups */}
      {sortedDates.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
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
                      <table className="min-w-full table-fixed divide-y divide-gray-200">
                        <colgroup>
                          <col style={{ width: '44px' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '8%' }} />
                        </colgroup>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate" title={log.user_name}>
                                {log.user_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 truncate" title={log.user_id_number}>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 truncate" title={log.pc_number || 'N/A'}>
                                {log.pc_number || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatTime(log.login_time)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {log.logout_time ? formatTime(log.logout_time) : ''}
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
