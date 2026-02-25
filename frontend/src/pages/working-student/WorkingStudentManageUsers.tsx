import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import WorkingStudentArchivedStudentsModal from '../../components/WorkingStudentArchivedStudentsModal';
import {
  Users,
  Eye,
  X,
  Archive,
  Settings,
} from 'lucide-react';
import { ArchiveStudent, GetAllRegisteredStudents, ResetPasswordByRole } from '../../../wailsjs/go/main/App';
import { ClassStudent, ViewStudentDetailsModalProps } from './types';
import { useAuth } from '../../contexts/AuthContext';

interface StudentRow {
  id: string;
  ctrlNo: number;
  studentId: string;
  fullName: string;
}

function ViewStudentDetailsModal({ student, isOpen, onClose }: ViewStudentDetailsModalProps) {
  if (!isOpen || !student) return null;

  const getFullName = () => {
    return `${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''} ${student.last_name}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Eye className="h-5 w-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Student Details</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Left Section - Profile Picture */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-black rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {(student as any).photo_url ? (
                  <img 
                    src={(student as any).photo_url} 
                    alt={getFullName()} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <Users className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Section - Details */}
            <div className="flex-1 space-y-3">
              <div>
                <span className="text-sm font-semibold text-gray-700">Fullname:</span>
                <span className="text-sm text-gray-900 ml-2">{getFullName()}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Contact:</span>
                <span className="text-sm text-gray-900 ml-2">{(student as any).contact_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Email:</span>
                <span className="text-sm text-gray-900 ml-2">{(student as any).email || ''}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Username:</span>
                <span className="text-sm text-gray-900 ml-2">{student.student_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Close Button */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            icon={<X className="h-4 w-4" />}
          >
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManageUsers() {
  const { user: currentUser } = useAuth();
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingStudent, setViewingStudent] = useState<ClassStudent | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  const loadStudents = async () => {
    try {
      const data = await GetAllRegisteredStudents();
      setStudents(data || []);
      setFilteredStudents(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load students:', error);
      setError('Unable to load students from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveStudent = async (student: ClassStudent) => {
    try {
      await ArchiveStudent(student.id);
      await loadStudents();
    } catch (error) {
      console.error('Failed to archive student:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive student.';
      setError(errorMessage);
    }
  };

  const handleResetStudentPassword = async (student: ClassStudent) => {
    if (!currentUser) {
      setError('Current session not found. Please login again.');
      return;
    }

    const newPassword = window.prompt(`Set new password for ${student.first_name} ${student.last_name}:`);
    if (newPassword === null) return;

    const trimmedPassword = newPassword.trim();
    if (!trimmedPassword) {
      setError('New password is required.');
      return;
    }

    const confirmPassword = window.prompt('Confirm new password:');
    if (confirmPassword === null) return;

    if (trimmedPassword !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await ResetPasswordByRole(currentUser.id, student.id, trimmedPassword);
      setError('');
      alert('Password reset successful.');
    } catch (error) {
      console.error('Failed to reset student password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password.';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.middle_name && student.middle_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredStudents(filtered);
    }
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, students]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);
  const startEntry = filteredStudents.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredStudents.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
        <Button
          onClick={() => setShowArchiveModal(true)}
          variant="outline"
          icon={<Archive className="h-4 w-4" />}
        >
          Archive
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Show <select 
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1 mx-1"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select> entries
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {currentStudents.length > 0 ? (
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                    Student ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                    Full Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                    Contact Number
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.student_id}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                      {student.last_name}, {student.first_name} {student.middle_name || ''}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700" style={{ wordBreak: 'break-word' }}>
                      {(student as any).email || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {(student as any).contact_number || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setViewingStudent(student)}
                          variant="outline"
                          size="sm"
                          icon={<Eye className="h-3 w-3" />}
                          title="View"
                        />
                        <Button
                          onClick={() => handleArchiveStudent(student)}
                          variant="outline"
                          size="sm"
                          icon={<Archive className="h-3 w-3" />}
                          title="Archive"
                        />
                        <Button
                          onClick={() => handleResetStudentPassword(student)}
                          variant="outline"
                          size="sm"
                          icon={<Settings className="h-3 w-3" />}
                          title="Reset Password"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm text-gray-500 font-medium">No data available.</p>
              </div>
            </div>
          )}
        </div>
        {currentStudents.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {startEntry} to {endEntry} of {filteredStudents.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="primary"
                size="sm"
              >
                {currentPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Student Details Modal */}
      <ViewStudentDetailsModal
        student={viewingStudent}
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
      />

      <WorkingStudentArchivedStudentsModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
      />
    </div>
  );
}

export default ManageUsers;
