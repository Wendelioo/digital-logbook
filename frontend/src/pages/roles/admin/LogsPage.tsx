import { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import Table from '../../../components/Table';
import { Badge } from '../../../components/Badge';
import LoadingDots from '../../../components/LoadingDots';
import {
  Search,
  X,
  AlertCircle,
  Printer,
  Filter,
  CornerUpLeft
} from 'lucide-react';
import {
  GetAllLogs,
  ExportLogsCSVByRange,
  ExportLogsPDFByRange,
  ExportLogsDOCXByRange,
} from '../../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultLogsRangeFilename, type ExportFormat } from '../../../utils/exportSaveDialog';
import { LoginLog } from './types';

function ViewLogs() {
  // All logs
  const [logs, setLogs] = useState<LoginLog[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterUserType, setFilterUserType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [pendingFilterUserType, setPendingFilterUserType] = useState('');
  const [pendingFilterDateFrom, setPendingFilterDateFrom] = useState('');
  const [pendingFilterDateTo, setPendingFilterDateTo] = useState('');

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

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

  const hasAnyLogs = logs.length > 0;
  const latestLogDate = hasAnyLogs ? normalizeDateOnly(logs[0]?.login_time) : '';
  const oldestLogDate = hasAnyLogs ? normalizeDateOnly(logs[logs.length - 1]?.login_time) : '';

  const isDateRangeValid = (from: string, to: string) => {
    if (!from || !to) return false;
    return from <= to;
  };

  const isExportRangeValid = isDateRangeValid(exportDateFrom, exportDateTo);

  // Load all logs on mount
  useEffect(() => {
    loadLogs();

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      loadLogs();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadLogs = async () => {
    try {
      const data = await GetAllLogs();
      setLogs(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load logs:', error);
      setError('Failed to load logs. Please check your database connection.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const parseLogDateTime = (value?: string | null): Date | null => {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    // Keep SQL-style DATETIME values in local time instead of relying on Date parsing quirks.
    const sqlMatch = trimmed.match(/^((\d{4})-(\d{2})-(\d{2}))[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (sqlMatch) {
      const year = Number(sqlMatch[2]);
      const month = Number(sqlMatch[3]);
      const day = Number(sqlMatch[4]);
      const hour = Number(sqlMatch[5]);
      const minute = Number(sqlMatch[6]);
      const second = Number(sqlMatch[7] || '0');
      const localDate = new Date(year, month - 1, day, hour, minute, second);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }

    const directParsed = new Date(trimmed);
    if (!Number.isNaN(directParsed.getTime())) return directParsed;

    const normalizedParsed = new Date(trimmed.replace(' ', 'T'));
    if (!Number.isNaN(normalizedParsed.getTime())) return normalizedParsed;

    return null;
  };

  const formatTime = (timeStr?: string | null) => {
    const date = parseLogDateTime(timeStr);
    if (!date) return 'N/A';

    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const clearSearch = () => { setSearchQuery(''); setCurrentPage(1); };

  const hasActiveDateRange = Boolean(filterDateFrom || filterDateTo);
  const activeFilterCount = (filterUserType ? 1 : 0) + (hasActiveDateRange ? 1 : 0);
  const clearFilters = () => {
    setFilterUserType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPendingFilterUserType('');
    setPendingFilterDateFrom('');
    setPendingFilterDateTo('');
    setCurrentPage(1);
  };

  const handleExport = async (format: ExportFormat) => {
    if (!isExportRangeValid) {
      showExportToast('error', 'Select a valid date range (From must be earlier than or equal to To).');
      return;
    }

    const defaultName = defaultLogsRangeFilename(exportDateFrom, exportDateTo, format);
    const savePath = await openExportSaveDialog('Save log entries', defaultName, format);
    if (!savePath) return;

    setExporting(true);
    try {
      let filename = '';
      if (format === 'pdf') filename = await ExportLogsPDFByRange(exportDateFrom, exportDateTo, savePath);
      else if (format === 'csv') filename = await ExportLogsCSVByRange(exportDateFrom, exportDateTo, savePath);
      else filename = await ExportLogsDOCXByRange(exportDateFrom, exportDateTo, savePath);
      showExportToast('success', `Saved: ${filename.split(/[\\/]/).pop()}`);
    } catch (err) {
      showExportToast('error', 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const showExportToast = (type: 'success' | 'error', message: string) => {
    setExportToast({ type, message });
    setTimeout(() => setExportToast(null), 5000);
  };

  const baseFilteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchLower || (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.user_id_number?.toLowerCase().includes(searchLower) ||
      log.user_type?.toLowerCase().includes(searchLower) ||
      (log.pc_number || '').toLowerCase().includes(searchLower)
    );
    const matchesType = !filterUserType || log.user_type === filterUserType;
    const logDate = normalizeDateOnly(log.login_time);
    const matchesFrom = !filterDateFrom || (logDate !== '' && logDate >= filterDateFrom);
    const matchesTo = !filterDateTo || (logDate !== '' && logDate <= filterDateTo);
    return matchesSearch && matchesType && matchesFrom && matchesTo;
  });

  const filteredLogs = baseFilteredLogs;

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }

    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
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

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Log Entries</h1>
        </div>
      </div>

      {/* Search + Export Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <div className="w-64 max-w-full relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, ID, type, PC..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
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
                    <span className="text-sm font-semibold text-gray-800">Filters</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="date"
                          placeholder="From"
                          value={pendingFilterDateFrom}
                          onChange={(e) => setPendingFilterDateFrom(e.target.value)}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="date"
                          placeholder="To"
                          value={pendingFilterDateTo}
                          onChange={(e) => setPendingFilterDateTo(e.target.value)}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">Filters by login date in the active table.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">User Type</label>
                    <select
                      value={pendingFilterUserType}
                      onChange={(e) => {
                        setPendingFilterUserType(e.target.value);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All types</option>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="working_student">Student Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {/* Clear & Apply */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFilterUserType('');
                        setPendingFilterDateFrom('');
                        setPendingFilterDateTo('');
                        setFilterUserType('');
                        setFilterDateFrom('');
                        setFilterDateTo('');
                        setCurrentPage(1);
                        setShowFilters(false);
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const hasDateRange = Boolean(pendingFilterDateFrom || pendingFilterDateTo);
                        if (hasDateRange && !isDateRangeValid(pendingFilterDateFrom, pendingFilterDateTo)) {
                          showExportToast('error', 'Select a valid date range (From must be earlier than or equal to To).');
                          return;
                        }

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

          <button
            onClick={() => {
              setShowExportModal(true);
              setExportDateFrom(filterDateFrom || oldestLogDate);
              setExportDateTo(filterDateTo || latestLogDate);
            }}
            title="Export"
            className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Export</span>
          </button>

        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        </div>
      )}

      {/* Responsive logs table */}
      <div>
        <Table
          compact
          columns={[
            {
              key: 'row_number',
              label: '#',
              width: '64px',
              align: 'center',
              render: (_log: LoginLog, index: number) => (
                <span className="font-medium text-gray-700 text-xs sm:text-sm">{startIndex + index + 1}</span>
              )
            },
            {
              key: 'user_name',
              label: 'Name',
              render: (log: LoginLog) => (
                <span className="font-medium text-gray-900 text-xs sm:text-sm break-words">{log.user_name}</span>
              )
            },
            {
              key: 'user_id_number',
              label: 'ID Number',
              render: (log: LoginLog) => (
                <span className="text-gray-600 text-xs sm:text-sm break-all">{log.user_id_number}</span>
              )
            },
            {
              key: 'user_type',
              label: 'User Type',
              render: (log: LoginLog) => (
                <Badge
                  variant={
                    log.user_type === 'admin'
                      ? 'danger'
                      : log.user_type === 'teacher'
                        ? 'warning'
                        : log.user_type === 'working_student'
                          ? 'info'
                          : 'success'
                  }
                  size="sm"
                  className="whitespace-normal leading-tight text-center"
                >
                  {log.user_type.replace('_', ' ')}
                </Badge>
              )
            },
            {
              key: 'pc_number',
              label: 'PC Number',
              render: (log: LoginLog) => (
                <span className="text-gray-600 text-xs sm:text-sm break-words">{log.pc_number || 'N/A'}</span>
              )
            },
            {
              key: 'login_time',
              label: 'Login',
              render: (log: LoginLog) => (
                <span className="text-gray-600 text-xs sm:text-sm break-words">{formatTime(log.login_time)}</span>
              )
            },
            {
              key: 'logout_time',
              label: 'Logout',
              render: (log: LoginLog) => (
                <span className="text-gray-600 text-xs sm:text-sm break-words">
                  {log.logout_time ? formatTime(log.logout_time) : '—'}
                </span>
              )
            }
          ]}
          data={paginatedLogs}
          loading={loading}
          emptyMessage="No login activity recorded"
          hideEmptyIcon
        />
        {filteredLogs.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <label className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                  <span>entries</span>
                </label>
                <span>
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} entries
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>

                {totalPages > 1 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          variant={currentPage === pageNum ? 'primary' : 'outline'}
                          size="sm"
                        >
                          {pageNum}
                        </Button>
                      );
                    }

                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-2 text-sm text-gray-500">...</span>;
                    }

                    return null;
                  })
                ) : (
                  <span className="px-2 text-sm text-gray-500">Page 1 of 1</span>
                )}

                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Modal */}
      {showExportModal && (
        <div className="modal-backdrop-export">
          <div className="modal-surface-2xl w-full max-w-md mx-2 sm:mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-primary-200/80 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
              <h3 className="text-lg font-semibold text-primary-950">Export Log Entries</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="modal-back-icon-btn"
                title="Back"
                aria-label="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
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
                      value={exportDateFrom}
                      onChange={(e) => setExportDateFrom(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">to</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={exportDateTo}
                      onChange={(e) => setExportDateTo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {isExportRangeValid ? (
                <div className="rounded-lg px-4 py-3 text-sm font-medium bg-primary-50 text-primary-800 border border-primary-200">
                  Exports active log entries from {exportDateFrom} to {exportDateTo}.
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3 text-sm font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
                  Select a valid date range before exporting.
                </div>
              )}

              {/* Export Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export As</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleExport('csv')} disabled={exporting || !isExportRangeValid} className="px-3 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="text-sm font-semibold">CSV</span>
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={exporting || !isExportRangeValid} className="px-3 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="text-sm font-semibold">PDF</span>
                  </button>
                  <button onClick={() => handleExport('docx')} disabled={exporting || !isExportRangeValid} className="px-3 py-3 rounded-xl border-2 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <span className="text-sm font-semibold">DOCX</span>
                  </button>
                </div>
                {exporting && (
                  <p className="mt-2 text-xs text-center text-gray-500">Exporting...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewLogs;
