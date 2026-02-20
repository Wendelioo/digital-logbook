import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import {
  Users,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import {
  GetActiveStudentsForArchiving,
  ArchiveStudent,
  GetArchivedStudents,
  UnarchiveStudent,
  DeleteExpiredStudents,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { User, ArchivedStudent } from './types';

function ArchivedStudentsManagement() {
  const { user } = useAuth();
  const [activeStudents, setActiveStudents] = useState<User[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [studentToArchive, setStudentToArchive] = useState<User | null>(null);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [studentToUnarchive, setStudentToUnarchive] = useState<ArchivedStudent | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedTab === 'active') {
        const data = await GetActiveStudentsForArchiving();
        setActiveStudents(data || []);
      } else {
        const data = await GetArchivedStudents();
        setArchivedStudents(data || []);
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
  }, [selectedTab]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleArchiveStudent = async () => {
    if (!studentToArchive || !user) return;

    try {
      await ArchiveStudent(studentToArchive.id);
      showNotification('success', 'Student archived successfully. Account will be deleted after 360 days.');
      setShowArchiveModal(false);
      setStudentToArchive(null);
      loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to archive student');
    }
  };

  const handleUnarchiveStudent = async () => {
    if (!studentToUnarchive) return;

    try {
      await UnarchiveStudent(studentToUnarchive.user_id);
      showNotification('success', 'Student account restored successfully');
      setShowUnarchiveModal(false);
      setStudentToUnarchive(null);
      loadData();
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to restore student');
    }
  };

  const handleDeleteExpired = async () => {
    if (!window.confirm('This will permanently delete all students whose accounts have passed the 360-day retention period. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      const count = await DeleteExpiredStudents();
      if (count > 0) {
        showNotification('success', `Successfully deleted ${count} expired student account(s)`);
        loadData();
      } else {
        showNotification('success', 'No expired accounts to delete');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to delete expired accounts');
    }
  };

  const filteredActiveStudents = activeStudents.filter(student =>
    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArchivedStudents = archivedStudents.filter(student =>
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
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

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Archive Management</h2>
      </div>

      {/* Tabs */}
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
            <Archive className="h-4 w-4" />
            Archived Students ({archivedStudents.length})
          </button>
        </nav>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {selectedTab === 'archived' && (
          <Button
            variant="danger"
            onClick={handleDeleteExpired}
            icon={<Trash2 className="h-4 w-4" />}
          >
            Delete Expired Accounts
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {selectedTab === 'active' ? (
            // Active Students Table
            filteredActiveStudents.length > 0 ? (
              <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                <thead className="bg-blue-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Student Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                      Full Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Contact
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredActiveStudents.map((student) => (
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
                          onClick={() => {
                            setStudentToArchive(student);
                            setShowArchiveModal(true);
                          }}
                          icon={<Archive className="h-4 w-4" />}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">No active students found</p>
              </div>
            )
          ) : (
            // Archived Students Table
            filteredArchivedStudents.length > 0 ? (
              <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                <thead className="bg-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Student Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                      Full Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Archived Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Deletion Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                      Days Left
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredArchivedStudents.map((student) => (
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
                          onClick={() => {
                            setStudentToUnarchive(student);
                            setShowUnarchiveModal(true);
                          }}
                          icon={<ArchiveRestore className="h-4 w-4" />}
                        >
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <Archive className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">No archived students found</p>
              </div>
            )
          )}
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && studentToArchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Archive className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Archive Student Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to archive <strong>{studentToArchive.first_name} {studentToArchive.last_name}</strong> ({studentToArchive.student_id}).
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> The student's account will be deactivated and scheduled for permanent deletion after 360 days. 
                You can restore the account before the deletion date if needed.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveModal(false);
                  setStudentToArchive(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                onClick={handleArchiveStudent}
                icon={<Archive className="h-4 w-4" />}
              >
                Archive Student
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveModal && studentToUnarchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <ArchiveRestore className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Restore Student Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to restore <strong>{studentToUnarchive.first_name} {studentToUnarchive.last_name}</strong> ({studentToUnarchive.student_id}).
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                The student's account will be reactivated and removed from the deletion schedule. 
                They will be able to log in again immediately.
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
                icon={<ArchiveRestore className="h-4 w-4" />}
              >
                Restore Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchivedStudentsManagement;
