import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import {
  X,
  Plus,
  Loader2,
  Users,
  Library,
  Eye,
  Archive,
} from 'lucide-react';
import {
  GetStudentClasses,
  GetClassesByEDPCode,
  JoinClassByEDPCode,
  GetClassStudents,
  ArchiveStudentEnrollment,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { CourseClass, ClasslistEntry } from './types';

function MyClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [edpCode, setEdpCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string>('');
  const [joinSuccess, setJoinSuccess] = useState<string>('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [viewingClasslist, setViewingClasslist] = useState<CourseClass | null>(null);
  const [classlistStudents, setClasslistStudents] = useState<ClasslistEntry[]>([]);
  const [loadingClasslist, setLoadingClasslist] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    loadClasses();
  }, [user]);

  useEffect(() => {
    let filtered = classes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(cls =>
        cls.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.subject_name && cls.subject_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.descriptive_title && cls.descriptive_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.edp_code && cls.edp_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.teacher_name && cls.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredClasses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, classes]);

  const loadClasses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await GetStudentClasses(user.id);
      setClasses(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load classes:', error);
      setError('Unable to load your classes from server.');
    } finally {
      setLoading(false);
    }
  };

  const loadClasslist = async (classInfo: CourseClass) => {
    setLoadingClasslist(true);
    try {
      const students = await GetClassStudents(classInfo.class_id);
      setClasslistStudents(students);
    } catch (error) {
      console.error('Failed to load classlist:', error);
      alert('Failed to load classlist. Please try again.');
    } finally {
      setLoadingClasslist(false);
    }
  };

  const handleViewClasslist = async (classInfo: CourseClass) => {
    setViewingClasslist(classInfo);
    await loadClasslist(classInfo);
  };

  const handleRefreshClasslist = async () => {
    if (viewingClasslist) {
      await loadClasslist(viewingClasslist);
    }
  };

  const handleArchiveClass = async (classInfo: CourseClass) => {
    if (!user) return;
    
    const confirmArchive = window.confirm(
      `Are you sure you want to archive "${classInfo.subject_code}"? This will move it to your Archived Classes.`
    );
    
    if (!confirmArchive) return;
    
    try {
      await ArchiveStudentEnrollment(user.id, classInfo.class_id);
      await loadClasses(); // Refresh the list
    } catch (error) {
      console.error('Failed to archive class:', error);
      alert('Failed to archive class. Please try again.');
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !edpCode.trim()) {
      setJoinError('Please enter an EDP code.');
      return;
    }

    // Validate EDP code format
    const cleanedCode = edpCode.trim().toUpperCase();
    if (cleanedCode.length > 50) {
      setJoinError('EDP code is too long. Maximum 50 characters allowed.');
      return;
    }

    // Check for invalid characters
    const validPattern = /^[A-Z0-9_-]+$/;
    if (!validPattern.test(cleanedCode)) {
      setJoinError('Invalid EDP code format. Only letters, numbers, dashes (-), and underscores (_) are allowed.');
      return;
    }

    setJoining(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      // First check if classes exist for this EDP code
      const availableClasses = await GetClassesByEDPCode(cleanedCode);

      if (!availableClasses || !Array.isArray(availableClasses) || availableClasses.length === 0) {
        setJoinError('No classes found for this EDP code. Please verify the code and try again.');
        setJoining(false);
        return;
      }

      // Join the class
      await JoinClassByEDPCode(user.id, cleanedCode);

      // Reload classes to show the new enrollment
      await loadClasses();

      // Close modal and clear form immediately
      setShowJoinForm(false);
      setEdpCode('');
      setJoinError('');
      setJoinSuccess('');
    } catch (error: any) {
      console.error('Failed to join class:', error);
      const errorMessage = error.message || 'Failed to join class. Please try again.';
      
      if (errorMessage.includes('already enrolled')) {
        setJoinError('You are already enrolled in this class.');
      } else if (errorMessage.includes('no classes found')) {
        setJoinError('No classes found for this EDP code.');
      } else if (errorMessage.includes('invalid EDP code format')) {
        setJoinError('Invalid EDP code. Only letters, numbers, dashes, and underscores are allowed.');
      } else if (errorMessage.includes('too long')) {
        setJoinError('EDP code is too long. Maximum 50 characters allowed.');
      } else if (errorMessage.includes('cannot be empty')) {
        setJoinError('Please enter an EDP code.');
      } else {
        setJoinError(errorMessage);
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredClasses.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentClasses = filteredClasses.slice(startIndex, endIndex);
  const startEntry = filteredClasses.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredClasses.length);

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">My Classes</h2>
          <Button
            onClick={() => {
              setShowJoinForm(true);
              setEdpCode('');
              setJoinError('');
              setJoinSuccess('');
            }}
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            Join Class
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Controls Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder=""
            />
          </div>
        </div>
      </div>

      {/* Join Class Modal */}
      {showJoinForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowJoinForm(false);
              setEdpCode('');
              setJoinError('');
              setJoinSuccess('');
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 relative">
            <Button
              type="button"
              onClick={() => {
                setShowJoinForm(false);
                setEdpCode('');
                setJoinError('');
                setJoinSuccess('');
              }}
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4"
            >
              ×
            </Button>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Join a Class</h3>
                <p className="text-sm text-gray-600">Enter the EDP Code to join a class</p>
              </div>

              <form onSubmit={handleJoinClass} className="space-y-4">
                <div>
                  <label htmlFor="edpCode" className="block text-sm font-medium text-gray-700 mb-2">
                    EDP Code
                  </label>
                  <input
                    id="edpCode"
                    type="text"
                    value={edpCode}
                    onChange={(e) => setEdpCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>

                {joinError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {joinError}
                  </div>
                )}

                {joinSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    {joinSuccess}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowJoinForm(false);
                      setEdpCode('');
                      setJoinError('');
                      setJoinSuccess('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={joining}
                    loading={joining}
                    variant="primary"
                    className="flex-1"
                  >
                    Join Class
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      {currentClasses.length > 0 ? (
        <div className="flex-1 overflow-x-auto">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    EDP Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descriptive Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentClasses.map((cls) => (
                  <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.edp_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.subject_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.descriptive_title || cls.subject_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.teacher_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.schedule || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.room || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {cls.enrolled_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewClasslist(cls)}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                          title="View Class List"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleArchiveClass(cls)}
                          className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                          title="Archive Class"
                        >
                          <Archive className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Pagination Section */}
      {filteredClasses.length > 0 && (
        <div className="flex-shrink-0 mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredClasses.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
            >
              Previous
            </Button>
            <Button
              variant="primary"
            >
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

      {filteredClasses.length === 0 && !error && (
        <div className="text-center py-12">
          {searchTerm ? (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No matching classes found</h3>
              <div className="mt-6">
                <Button
                  onClick={() => setSearchTerm('')}
                  variant="outline"
                >
                  Clear Search
                </Button>
              </div>
            </>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <Library className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">No classes enrolled</p>
            </div>
          )}
        </div>
      )}

      {/* Classlist Modal */}
      {viewingClasslist && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
          <div className="min-h-screen p-4 md:p-8">
            {/* Bond Paper Style Class List Sheet */}
            <div className="bg-white max-w-4xl mx-auto my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
              {/* Close Button */}
              <button
                onClick={() => {
                  setViewingClasslist(null);
                  setClasslistStudents([]);
                }}
                className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
                title="Close"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Header */}
              <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Class List</h1>
                <p className="text-sm text-gray-600 mt-1">Academic Year 2024-2025</p>
              </div>

              {/* Combined Class Info and Student List Table */}
              <div className="overflow-hidden">
                <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                  {/* Class Information Header */}
                  <thead>
                    <tr>
                      <th colSpan={5} className="px-4 py-2 text-left border-b-2 border-gray-900">
                        <div className="text-gray-900 font-bold text-sm tracking-wide">CLASS INFORMATION</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-sm">
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>Subject Code:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.subject_code || 'N/A'}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '100px' }}>EDP Code:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={2}>{viewingClasslist.edp_code || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700">Descriptive Title:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={4}>{viewingClasslist.descriptive_title || viewingClasslist.subject_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700">Schedule:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.schedule || 'N/A'}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700">Room:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={2}>{viewingClasslist.room || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700">Teacher:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={4}>{viewingClasslist.teacher_name || 'N/A'}</td>
                    </tr>
                  </tbody>

                  {/* Student List Header */}
                  <thead>
                    <tr>
                      <th colSpan={5} className="px-4 py-3 text-left border-b-2 border-t-2 border-gray-900">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 font-bold text-sm tracking-wide">STUDENTS LIST</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-600">Total: {classlistStudents.length}</span>
                            {loadingClasslist && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                            )}
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  {/* Student List Column Headers */}
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '25px' }}>No.</th>
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '100px' }}>Student ID</th>
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '200px' }}>Email</th>
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Status</th>
                    </tr>
                  </thead>

                  {/* Student Rows */}
                  <tbody className="bg-white text-xs">
                    {loadingClasslist && classlistStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-600 mb-2" />
                          <p className="text-gray-500 text-sm">Loading students...</p>
                        </td>
                      </tr>
                    ) : classlistStudents.length > 0 ? (
                      classlistStudents.map((student, index) => (
                        <tr key={student.student_user_id} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-1 py-1.5 text-center font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-1 py-1.5 font-medium text-gray-900 text-xs">
                            {student.student_code}
                          </td>
                          <td className="px-1 py-1.5 text-gray-900">
                            {student.last_name}, {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''}
                          </td>
                          <td className="px-1 py-1.5 text-gray-700">
                            {student.email || '—'}
                          </td>
                          <td className="px-1 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {student.status || 'active'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center">
                          <Users className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                          <p className="text-gray-500 text-sm">No students enrolled</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600 flex justify-between">
                <span>Printed: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>Digital Logbook System</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { MyClasses };
export default MyClasses;
