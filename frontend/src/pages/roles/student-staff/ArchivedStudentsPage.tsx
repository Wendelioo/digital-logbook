import { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import {
  Users,
  Trash2,
  X,
  Filter,
  Search,
} from 'lucide-react';
import { ArchiveIcon, ArchiveRestoreIcon } from '../../../components/icons/ArchiveIcons';
import {
  GetActiveStudentsForArchiving,
  ArchiveStudent,
  GetArchivedStudents,
  UnarchiveStudent,
  DeleteExpiredStudents,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { User, ArchivedStudent } from './types';

interface ArchivedStudentsManagementProps {
  hideHeader?: boolean;
  archivedOnly?: boolean;
}

function ArchivedStudentsManagement({ hideHeader = false, archivedOnly = false }: ArchivedStudentsManagementProps) {
  const { user } = useAuth();
  const { confirm: confirmDialog } = useAppUi();
  const [activeStudents, setActiveStudents] = useState<User[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'active' | 'archived'>(archivedOnly ? 'archived' : 'active');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'with_email' | 'without_email' | 'urgent' | 'warning' | 'safe'>('all');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [studentToUnarchive, setStudentToUnarchive] = useState<ArchivedStudent | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (archivedOnly || selectedTab === 'archived') {
        const data = await GetArchivedStudents();
        setArchivedStudents(data || []);
      } else {
        const data = await GetActiveStudentsForArchiving();
        setActiveStudents(data || []);
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      showNotification('error', 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTab, archivedOnly]);

  useEffect(() => {
    setStudentFilter('all');
    setCurrentPage(1);
  }, [selectedTab, archivedOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, studentFilter, entriesPerPage]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleArchiveStudent = async (student: User) => {
    if (!user) return;

    try {
      await ArchiveStudent(student.id);
      showNotification('success', 'Student archived successfully. Deletion is scheduled after 360 days.');
      await loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to archive student. Please try again.');
    }
  };

  const handleUnarchiveStudent = async () => {
    if (!studentToUnarchive) return;

    try {
      await UnarchiveStudent(studentToUnarchive.user_id);
      showNotification('success', 'Student restored successfully.');
      setShowUnarchiveModal(false);
      setStudentToUnarchive(null);
      await loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to restore student. Please try again.');
    }
  };

  const handleDeleteExpired = async () => {
    const ok = await confirmDialog({
      title: 'Delete expired accounts',
      message:
        'This will permanently delete all students whose accounts have passed the 360-day retention period. This action cannot be undone. Continue?',
      variant: 'danger',
      confirmLabel: 'Delete permanently',
    });
    if (!ok) return;

    try {
      const count = await DeleteExpiredStudents();
      if (count > 0) {
        showNotification('success', `Deleted ${count} expired student account(s).`);
        loadData();
      } else {
        showNotification('success', 'No expired accounts to delete.');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to delete expired accounts');
    }
  };

  const filteredActiveStudents = activeStudents.filter(student => {
    const matchesSearch =
      student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (studentFilter === 'with_email') return !!student.email;
    if (studentFilter === 'without_email') return !student.email;
    return true;
  });

  const filteredArchivedStudents = archivedStudents.filter(student => {
    const matchesSearch =
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (studentFilter === 'urgent') return student.days_until_deletion <= 30;
    if (studentFilter === 'warning') return student.days_until_deletion > 30 && student.days_until_deletion <= 90;
    if (studentFilter === 'safe') return student.days_until_deletion > 90;
    return true;
  });

  const isArchivedView = archivedOnly || selectedTab === 'archived';
  const records = isArchivedView ? filteredArchivedStudents : filteredActiveStudents;
  const totalPages = Math.max(1, Math.ceil(records.length / entriesPerPage));
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentRecords = records.slice(startIndex, endIndex);
  const startEntry = records.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, records.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className={hideHeader ? 'flex flex-col h-full' : 'p-6'}>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => setNotification(null)}
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hideHeader && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Student Archive Management</h2>
        </div>
      )}

      {!archivedOnly && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setSelectedTab('active')}
              className={`${
                selectedTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Users className="h-4 w-4" />
              Active Students
            </button>
            <button
              onClick={() => setSelectedTab('archived')}
              className={`${
                selectedTab === 'archived'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <ArchiveIcon />
              Archived Students ({archivedStudents.length})
            </button>
          </nav>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Show</span>
          <select
            value={entriesPerPage}
            onChange={(e) => setEntriesPerPage(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-sm text-gray-700">entries</span>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className={`flex h-10 w-full items-center gap-2 rounded-lg px-3 sm:w-56 ${
            studentFilter !== 'all'
              ? 'bg-primary-50 border border-primary-500 text-primary-700'
              : 'bg-white border border-gray-300 text-gray-700'
          }`}>
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filter</span>
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value as typeof studentFilter)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium focus:outline-none"
            >
              {isArchivedView ? (
                <>
                  <option value="all">Filter: All archived students</option>
                  <option value="urgent">Filter: Urgent (30 days or less)</option>
                  <option value="warning">Filter: Warning (31-90 days)</option>
                  <option value="safe">Filter: Safe (91+ days)</option>
                </>
              ) : (
                <>
                  <option value="all">Filter: All active students</option>
                  <option value="with_email">Filter: With email</option>
                  <option value="without_email">Filter: Without email</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!archivedOnly && selectedTab === 'active' ? (
            // Active Students Table
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Student Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                    Full Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Contact
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRecords.length > 0 ? (
                  (currentRecords as User[]).map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.student_id}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {student.last_name}, {student.first_name} {student.middle_name || ''}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {student.email || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.contact_number || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleArchiveStudent(student)}
                          icon={<ArchiveIcon />}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No active students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            // Archived Students Table
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Student Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                    Full Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Archived Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Deletion Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                    Days Left
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRecords.length > 0 ? (
                  (currentRecords as ArchivedStudent[]).map((student) => (
                    <tr key={student.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.student_id}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {student.last_name}, {student.first_name} {student.middle_name || ''}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(student.archived_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(student.deletion_scheduled_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          student.days_until_deletion <= 30
                            ? 'bg-red-100 text-red-800'
                            : student.days_until_deletion <= 90
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {student.days_until_deletion} days
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="success"
                          size="sm"
                          className="h-9 w-9 px-0 py-0"
                          onClick={() => {
                            setStudentToUnarchive(student);
                            setShowUnarchiveModal(true);
                          }}
                          icon={<ArchiveRestoreIcon />}
                          title="Restore"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No archived students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {records.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
            >
              Previous
            </Button>
            <Button variant="primary">
              {currentPage}
            </Button>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showUnarchiveModal && studentToUnarchive && (
        <div className="modal-backdrop">
          <div className="modal-surface w-full max-w-md mx-2 sm:mx-4 p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <ArchiveRestoreIcon size="lg" className="text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Restore Student Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to restore <strong>{studentToUnarchive.first_name} {studentToUnarchive.last_name}</strong> ({studentToUnarchive.student_id}).
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                The account will be active again and removed from the deletion schedule.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnarchiveModal(false);
                  setStudentToUnarchive(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleUnarchiveStudent}
                icon={<ArchiveRestoreIcon />}
              >
                Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchivedStudentsManagement;
