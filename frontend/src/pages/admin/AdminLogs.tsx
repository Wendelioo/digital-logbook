import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import { Badge } from '../../components/Badge';
import {
  Search,
  X,
  AlertCircle,
  Archive,
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
  Filter
} from 'lucide-react';
import {
  GetAllLogs,
  GetLogsRangeCount,
  ExportLogsCSVByRange,
  ExportLogsPDFByRange,
  ExportLogsDOCXByRange
} from '../../../wailsjs/go/backend/App';
import { LoginLog } from './types';

function ViewLogs() {
  // All logs
  const [logs, setLogs] = useState<LoginLog[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterUserType, setFilterUserType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportCountLoading, setExportCountLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

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
      month: 'short',
      day: 'numeric',
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

  const clearSearch = () => setSearchQuery('');

  const activeFilterCount = [filterUserType, filterDate].filter(Boolean).length;
  const clearFilters = () => { setFilterUserType(''); setFilterDate(''); };

  const applyExportRange = async () => {
    if (!exportStart || !exportEnd) return;
    setExportCountLoading(true);
    try {
      const count = await GetLogsRangeCount(exportStart, exportEnd);
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
      if (format === 'pdf') filename = await ExportLogsPDFByRange(exportStart, exportEnd);
      else if (format === 'csv') filename = await ExportLogsCSVByRange(exportStart, exportEnd);
      else filename = await ExportLogsDOCXByRange(exportStart, exportEnd);
      showExportToast('success', `Exported to Downloads: ${filename.split(/[\\/]/).pop()}`);
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
    const matchesDate = !filterDate || (log.login_time && log.login_time.split(/[T\s]/)[0] === filterDate);
    return matchesSearch && matchesType && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Log Entries</h1>
        </div>
        <Button
          onClick={() => setShowArchiveModal(true)}
          variant="outline"
          icon={<Archive className="h-4 w-4" />}
        >
          Archived Logs
        </Button>
      </div>

      {/* Search + Export Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-end gap-2">
          <div className="w-64 relative">
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">User Type</label>
                    <select
                      value={filterUserType}
                      onChange={(e) => setFilterUserType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All types</option>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="working_student">Working Student</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {filterDate && (
                        <button onClick={() => setFilterDate('')} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
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

      {/* Single Unified Table */}
      <div>
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
                  {log.logout_time ? formatTime(log.logout_time) : 'Active'}
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
        {filteredLogs.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  variant={currentPage === pageNum ? "primary" : "outline"}
                  size="sm"
                >
                  {pageNum}
                </Button>
              ))}
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
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Export Log Entries</h3>
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
                    ? `${exportCount} record${exportCount !== 1 ? 's' : ''} found in this range`
                    : 'No records found for this date range'}
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

export default ViewLogs;
