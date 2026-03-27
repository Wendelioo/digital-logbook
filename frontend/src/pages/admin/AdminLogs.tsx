import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import { Badge } from '../../components/Badge';
import LoadingDots from '../../components/LoadingDots';
import {
  Search,
  X,
  AlertCircle,
  History,
  Download,
  Filter
} from 'lucide-react';
import {
  GetAllLogs,
  ExportLogsCSVByRowRange,
  ExportLogsPDFByRowRange,
  ExportLogsDOCXByRowRange
} from '../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultLogsRowRangeFilename, type ExportFormat } from '../../utils/exportSaveDialog';
import { LoginLog } from './types';

function ViewLogs() {
  const pageSizeOptions = [1, 25, 50, 100, 200, 300, 400, 500];

  // All logs
  const [logs, setLogs] = useState<LoginLog[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showArchiveModal, setShowArchiveModal] = useState(false);

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
  const [exportFromRow, setExportFromRow] = useState('1');
  const [exportToRow, setExportToRow] = useState('100');
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const parsedFromRow = Number.parseInt(exportFromRow, 10);
  const parsedToRow = Number.parseInt(exportToRow, 10);
  const isExportRangeValid =
    Number.isInteger(parsedFromRow) &&
    Number.isInteger(parsedToRow) &&
    parsedFromRow >= 1 &&
    parsedToRow >= 1 &&
    parsedFromRow <= parsedToRow &&
    parsedToRow <= 500;

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

  const formatTime = (timeStr: string) => {
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

  const calculateDuration = (loginTime: string, logoutTime?: string) => {
    if (!logoutTime) return '';
    
    const login = new Date(loginTime.replace(' ', 'T'));
    const logout = new Date(logoutTime.replace(' ', 'T'));
    const diffMs = logout.getTime() - login.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const clearSearch = () => { setSearchQuery(''); setCurrentPage(1); };

  const activeFilterCount = [filterUserType, filterDateFrom, filterDateTo].filter(Boolean).length;
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
      showExportToast('error', 'Enter a valid range from 1 to 500 (From must be less than or equal to To).');
      return;
    }

    const defaultName = defaultLogsRowRangeFilename(parsedFromRow, parsedToRow, format);
    const savePath = await openExportSaveDialog('Save log entries', defaultName, format);
    if (!savePath) return;
    setExporting(true);
    try {
      let filename = '';
      if (format === 'pdf') filename = await ExportLogsPDFByRowRange(parsedFromRow, parsedToRow, savePath);
      else if (format === 'csv') filename = await ExportLogsCSVByRowRange(parsedFromRow, parsedToRow, savePath);
      else filename = await ExportLogsDOCXByRowRange(parsedFromRow, parsedToRow, savePath);
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

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchLower || (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.user_id_number?.toLowerCase().includes(searchLower) ||
      log.user_type?.toLowerCase().includes(searchLower) ||
      (log.pc_number || '').toLowerCase().includes(searchLower)
    );
    const matchesType = !filterUserType || log.user_type === filterUserType;
    const logDate = log.login_time ? log.login_time.split(/[T\s]/)[0] : '';
    const matchesDate =
      (!filterDateFrom || logDate >= filterDateFrom) &&
      (!filterDateTo || logDate <= filterDateTo);
    return matchesSearch && matchesType && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

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
        <Button
          onClick={() => setShowArchiveModal(true)}
          variant="outline"
          icon={<History className="h-4 w-4" />}
        >
          Archived Logs
        </Button>
      </div>

      {/* Search + Export Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <div className="w-full sm:w-64 relative">
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
              onClick={() => setShowFilters(!showFilters)}
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
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-xs text-primary-600 hover:underline">Clear all</button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="date"
                          value={pendingFilterDateFrom}
                          onChange={(e) => {
                            setPendingFilterDateFrom(e.target.value);
                          }}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="date"
                          value={pendingFilterDateTo}
                          onChange={(e) => {
                            setPendingFilterDateTo(e.target.value);
                          }}
                          className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
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
                      <option value="working_student">Working Student</option>
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
              setExportFromRow('1');
              setExportToRow('100');
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
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
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

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        </div>
      )}

      {/* Responsive logs view: cards on mobile, table on md+ */}
      <div>
        <div className="md:hidden space-y-3">
          {paginatedLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
              No login activity recorded
            </div>
          ) : (
            paginatedLogs.map((log, index) => (
              <div key={`${log.user_id_number || 'user'}-${log.login_time}-${index}`} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{log.user_name}</p>
                    <p className="text-xs text-gray-500 truncate">{log.user_id_number}</p>
                  </div>
                  <Badge variant={
                    log.user_type === 'admin' ? 'danger' :
                    log.user_type === 'teacher' ? 'warning' :
                    log.user_type === 'working_student' ? 'info' :
                    'success'
                  }>
                    {log.user_type.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <span className="text-gray-500">PC</span>
                  <span className="text-gray-800 text-right truncate">{log.pc_number || 'N/A'}</span>
                  <span className="text-gray-500">Login</span>
                  <span className="text-gray-800 text-right">{formatTime(log.login_time)}</span>
                  <span className="text-gray-500">Logout</span>
                  <span className="text-gray-800 text-right">{log.logout_time ? formatTime(log.logout_time) : '-'}</span>
                  <span className="text-gray-500">Duration</span>
                  <span className="text-gray-800 text-right">{calculateDuration(log.login_time, log.logout_time) || '-'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <Table
            columns={[
              {
                key: 'user_name',
                label: 'Name',
                render: (log: LoginLog) => (
                  <span className="font-medium text-gray-900">{log.user_name}</span>
                )
              },
              {
                key: 'user_id_number',
                label: 'ID Number',
                render: (log: LoginLog) => (
                  <span className="text-gray-600">{log.user_id_number}</span>
                )
              },
              {
                key: 'user_type',
                label: 'User Type',
                render: (log: LoginLog) => (
                  <Badge variant={
                    log.user_type === 'admin' ? 'danger' :
                    log.user_type === 'teacher' ? 'warning' :
                    log.user_type === 'working_student' ? 'info' :
                    'success'
                  }>
                    {log.user_type.replace('_', ' ')}
                  </Badge>
                )
              },
              {
                key: 'pc_number',
                label: 'PC Number',
                render: (log: LoginLog) => (
                  <span className="text-gray-600">{log.pc_number || 'N/A'}</span>
                )
              },
              {
                key: 'login_time',
                label: 'Login Time',
                render: (log: LoginLog) => (
                  <span className="text-gray-600">{formatTime(log.login_time)}</span>
                )
              },
              {
                key: 'logout_time',
                label: 'Logout Time',
                render: (log: LoginLog) => (
                  <span className="text-gray-600">
                    {log.logout_time ? formatTime(log.logout_time) : ''}
                  </span>
                )
              },
              {
                key: 'duration',
                label: 'Duration',
                render: (log: LoginLog) => (
                  <span className="text-gray-600">
                    {calculateDuration(log.login_time, log.logout_time)}
                  </span>
                )
              }
            ]}
            data={paginatedLogs}
            loading={loading}
            emptyMessage="No login activity recorded"
            hideEmptyIcon
          />
        </div>
        {filteredLogs.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} entries
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

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
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
                })}

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

      {/* Archive Modal */}
      <AdminArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        initialTab="archived-logs"
      />

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Export Log Entries</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Row Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Record Range</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={exportFromRow}
                      onChange={(e) => setExportFromRow(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">to</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={exportToRow}
                      onChange={(e) => setExportToRow(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {isExportRangeValid ? (
                <div className="rounded-lg px-4 py-3 text-sm font-medium bg-primary-50 text-primary-800 border border-primary-200">
                  Exports rows {parsedFromRow} to {parsedToRow} (latest-first) from the active table (max 500 retained).
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3 text-sm font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
                  Enter a valid range from 1 to 500, and make sure From is less than or equal to To.
                </div>
              )}

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting || !isExportRangeValid}
                    className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-xs font-semibold">PDF</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exporting || !isExportRangeValid}
                    className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-xs font-semibold">CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    disabled={exporting || !isExportRangeValid}
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

export default ViewLogs;
