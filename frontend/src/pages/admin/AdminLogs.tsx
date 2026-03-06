import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import AdminArchiveModal from '../../components/AdminArchiveModal';
import { Badge } from '../../components/Badge';
import {
  Search,
  X,
  AlertCircle,
  Archive
} from 'lucide-react';
import {
  GetAllLogs,
  ArchiveSelectedLogs
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { LoginLog } from './types';

function ViewLogs() {
  const { user } = useAuth();
  
  // All logs
  const [logs, setLogs] = useState<LoginLog[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toast notification
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [archiving, setArchiving] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveModalTab, setArchiveModalTab] = useState<'archived-logs' | 'reports'>('archived-logs');
  const [selectedLogIDs, setSelectedLogIDs] = useState<Set<number>>(new Set());

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

  const handleArchiveSelected = async () => {
    const ids = Array.from(selectedLogIDs);
    if (ids.length === 0) {
      showToast('error', 'No log entries to archive.');
      return;
    }
    if (!user) return;
    
    setArchiving(true);
    try {
      await ArchiveSelectedLogs(ids, user.id);
      showToast('success', `${ids.length} log entr${ids.length === 1 ? 'y' : 'ies'} archived.`);
      setSelectedLogIDs(new Set());
      await loadLogs();
      setArchiveModalTab('archived-logs');
      setShowArchiveModal(true);
    } catch (error) {
      console.error('Failed to archive log:', error);
      showToast('error', 'Failed to archive log entry');
    } finally {
      setArchiving(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
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

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    if (!searchLower) return true;

    return (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.user_id_number?.toLowerCase().includes(searchLower) ||
      log.user_type?.toLowerCase().includes(searchLower) ||
      (log.pc_number || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredLogIDs = filteredLogs.map((log) => log.id);
  const allFilteredSelected = filteredLogIDs.length > 0 && filteredLogIDs.every((id) => selectedLogIDs.has(id));
  const someFilteredSelected = filteredLogIDs.some((id) => selectedLogIDs.has(id)) && !allFilteredSelected;

  const toggleSelectAllFiltered = () => {
    const next = new Set(selectedLogIDs);
    if (allFilteredSelected) {
      filteredLogIDs.forEach((id) => next.delete(id));
    } else {
      filteredLogIDs.forEach((id) => next.add(id));
    }
    setSelectedLogIDs(next);
  };

  const toggleSelectLog = (id: number) => {
    const next = new Set(selectedLogIDs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLogIDs(next);
  };

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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          toast.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-slideIn`}>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Log Entries</h1>
          {selectedLogIDs.size > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
              {selectedLogIDs.size} selected
            </span>
          )}
        </div>
        <Button
          onClick={() => setShowArchiveModal(true)}
          variant="outline"
          icon={<Archive className="h-4 w-4" />}
        >
          Archived Logs
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
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
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
          {selectedLogIDs.size > 0 && (
            <span className="text-xs text-gray-500">{selectedLogIDs.size} selected</span>
          )}
        </div>

        <Button
          onClick={handleArchiveSelected}
          variant="outline"
          size="sm"
          icon={<Archive className="h-4 w-4" />}
          disabled={selectedLogIDs.size === 0 || archiving}
        >
          Archive Selected
        </Button>
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
              key: 'select',
              label: 'Select',
              width: '90px',
              render: (log: LoginLog) => (
                <input
                  type="checkbox"
                  checked={selectedLogIDs.has(log.id)}
                  onChange={() => toggleSelectLog(log.id)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                />
              )
            },
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
        initialTab={archiveModalTab}
      />
    </div>
  );
}

export default ViewLogs;
