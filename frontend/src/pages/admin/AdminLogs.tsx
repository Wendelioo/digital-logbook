import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import { Badge } from '../../components/Badge';
import {
  CheckSquare,
  AlertCircle,
  Archive
} from 'lucide-react';
import {
  GetAllLogs,
  ArchiveSelectedLogs
} from '../../../wailsjs/go/main/App';
import ArchiveConfirmationModal from '../../components/ArchiveConfirmationModal';
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
  
  // Toast notification
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Archive confirmation modal
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [logToArchive, setLogToArchive] = useState<LoginLog | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

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

  const handleArchiveClick = (log: LoginLog) => {
    setLogToArchive(log);
    setShowArchiveConfirm(true);
    setOpenMenuId(null);
  };

  const confirmArchive = async () => {
    if (!logToArchive || !user) return;
    
    setArchiving(true);
    try {
      await ArchiveSelectedLogs([logToArchive.id], user.id);
      showToast('success', `Log entry for ${logToArchive.user_name} archived successfully!`);
      setShowArchiveConfirm(false);
      setLogToArchive(null);
      loadLogs();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          toast.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-slideIn`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckSquare className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Log Entries</h1>
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
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (log: LoginLog) => (
                <button
                  onClick={() => handleArchiveClick(log)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Archive Entry"
                >
                  <Archive className="h-5 w-5 text-gray-600" />
                </button>
              )
            }
          ]}
          data={paginatedLogs}
          loading={loading}
          emptyMessage="No login activity recorded"
        />
        {logs.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, logs.length)} of {logs.length} entries
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

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && logToArchive && (
        <ArchiveConfirmationModal
          isOpen={showArchiveConfirm}
          onClose={() => {
            setShowArchiveConfirm(false);
            setLogToArchive(null);
          }}
          onConfirm={confirmArchive}
          loading={archiving}
          itemType="log entry"
          itemDescription={`${logToArchive.user_name} (${logToArchive.user_id_number}) - ${formatTime(logToArchive.login_time)}`}
        />
      )}
    </div>
  );
}

export default ViewLogs;
