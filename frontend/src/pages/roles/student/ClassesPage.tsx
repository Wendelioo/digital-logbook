import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '../../../components/Button';
import StudentArchivedClassesModal from '../../../components/StudentArchivedClassesModal';
import LoadingDots from '../../../components/LoadingDots';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  CornerUpLeft,
  Plus,
  Loader2,
  Eye,
  Filter,
  LogOut,
} from 'lucide-react';
import {
  GetStudentClasses,
  GetClassesByJoinCode,
  GetClassStudents,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { getArchiveErrorMessage, getArchiveSuccessMessage } from '../../../utils/archiveNotifications';
import { CourseClass, ClasslistEntry } from './types';

function MyClasses() {
  const location = useLocation();
  const { user } = useAuth();
  const { toast, confirm } = useAppUi();
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
  const [teacherFilter, setTeacherFilter] = useState<string>('');
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [pendingTeacherFilter, setPendingTeacherFilter] = useState<string>('');
  const [pendingSemesterFilter, setPendingSemesterFilter] = useState<string>('');
  const [pendingSchoolYearFilter, setPendingSchoolYearFilter] = useState<string>('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  const activeFilterCount = [teacherFilter, semesterFilter, schoolYearFilter].filter(Boolean).length;
  const teacherOptions = React.useMemo(
    () => Array.from(new Set(classes.map(c => c.teacher_name).filter(Boolean))).sort(),
    [classes]
  );
  const semesterOptions = React.useMemo(
    () => Array.from(new Set(classes.map(c => (c.semester || '').trim()).filter(Boolean))).sort(),
    [classes]
  );
  const schoolYearOptions = React.useMemo(
    () => Array.from(new Set(classes.map(c => (c.school_year || '').trim()).filter(Boolean))).sort(),
    [classes]
  );

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
    // Filter by teacher
    if (teacherFilter) {
      filtered = filtered.filter(cls =>
        (cls.teacher_name || '').toLowerCase() === teacherFilter.toLowerCase()
      );
    }

    // Filter by semester
    if (semesterFilter) {
      filtered = filtered.filter(cls =>
        (cls.semester || '').toLowerCase() === semesterFilter.toLowerCase()
      );
    }

    // Filter by school year
    if (schoolYearFilter) {
      filtered = filtered.filter(cls =>
        (cls.school_year || '').toLowerCase() === schoolYearFilter.toLowerCase()
      );
    }

    setFilteredClasses(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, teacherFilter, semesterFilter, schoolYearFilter, classes]);

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
      setClasslistStudents(Array.isArray(students) ? students : []);
    } catch (error) {
      console.error('Failed to load classlist:', error);
      toast('Failed to load classlist. Please try again.', 'error');
      setClasslistStudents([]);
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

    const ok = await confirm({
      title: 'Archive class',
      message: `Are you sure you want to archive this class (${classInfo.subject_code})?`,
      variant: 'default',
      confirmLabel: 'Archive',
    });

    if (!ok) return;

    try {
      const appBridge = (window as any)?.go?.backend?.App;
      if (appBridge && typeof appBridge.ArchiveJoinedClassByStudent === 'function') {
        await appBridge.ArchiveJoinedClassByStudent(user.id, classInfo.class_id);
      } else {
        throw new Error('Archive class method is not available in this app build.');
      }
      await loadClasses(); // Refresh the list
      toast(getArchiveSuccessMessage('class', 'archive'), 'success');
    } catch (error) {
      console.error('Failed to archive class:', error);
      toast(getArchiveErrorMessage('class', 'archive', error), 'error');
    }
  };

  const handleLeaveClass = async (classInfo: CourseClass) => {
    if (!user) return;

    const ok = await confirm({
      title: 'Leave class',
      message: `Are you sure you want to leave this class (${classInfo.subject_code})?`,
      variant: 'default',
      confirmLabel: 'Leave',
    });

    if (!ok) return;

    try {
      const appBridge = (window as any)?.go?.backend?.App;
      if (appBridge && typeof appBridge.LeaveClassByStudent === 'function') {
        await appBridge.LeaveClassByStudent(user.id, classInfo.class_id);
      } else if (appBridge && typeof appBridge.RemoveStudentFromJoinClassByIDs === 'function') {
        await appBridge.RemoveStudentFromJoinClassByIDs(user.id, classInfo.class_id);
      } else {
        throw new Error('Leave class method is not available in this app build.');
      }
      await loadClasses(); // Refresh the list
      toast('You have left the class.', 'success');
    } catch (error) {
      console.error('Failed to leave class:', error);
      toast('Failed to leave class. Please try again.', 'error');
    }
  };

  const normalizeJoinClassError = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error || '');
    return raw
      .replace(/^failed to join class:\s*/i, '')
      .replace(/^cannot join classlist:\s*/i, '')
      .trim();
  };

  const isExpectedJoinClassError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('already joined') ||
      normalized.includes('cannot rejoin') ||
      normalized.includes('after leaving') ||
      normalized.includes('department') ||
      normalized.includes('no classes found') ||
      normalized.includes('invalid join code format') ||
      normalized.includes('too long') ||
      normalized.includes('cannot be empty')
    );
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !edpCode.trim()) {
      setJoinError('Please enter a code.');
      return;
    }

    // Validate join code format
    const cleanedCode = edpCode.trim().toUpperCase();
    if (cleanedCode.length > 50) {
      setJoinError('Code is too long. Maximum 50 characters allowed.');
      return;
    }

    // Check for invalid characters
    const validPattern = /^[A-Z0-9_-]+$/;
    if (!validPattern.test(cleanedCode)) {
      setJoinError('Invalid code format. Only letters, numbers, dashes (-), and underscores (_) are allowed.');
      return;
    }

    setJoining(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      // First check if classes exist for this join code
      const availableClasses = await GetClassesByJoinCode(cleanedCode);

      if (!availableClasses || !Array.isArray(availableClasses) || availableClasses.length === 0) {
        setJoinError('No classes found for this code. Please verify the code and try again.');
        setJoining(false);
        return;
      }

      // Join the class
      const appBridge = (window as any)?.go?.backend?.App;
      if (appBridge && typeof appBridge.JoinClassByJoinCode === 'function') {
        await appBridge.JoinClassByJoinCode(user.id, cleanedCode);
      } else {
        throw new Error('Join class method is not available in this app build.');
      }

      // Reload classes to show the new joined class
      await loadClasses();

      toast('You have joined the class.', 'success');

      // Close modal and clear form immediately
      setShowJoinForm(false);
      setEdpCode('');
      setJoinError('');
      setJoinSuccess('');
    } catch (error: unknown) {
      const errorMessage = normalizeJoinClassError(error) || 'Failed to join class. Please try again.';
      if (!isExpectedJoinClassError(errorMessage)) {
        console.error('Failed to join class:', error);
      }
      
      if (errorMessage.includes('already joined')) {
        setJoinError('You already joined this class.');
      } else if (errorMessage.toLowerCase().includes('cannot rejoin') || errorMessage.toLowerCase().includes('after leaving')) {
        setJoinError('You cannot rejoin this class after leaving. Please ask your teacher to add you back.');
      } else if (errorMessage.toLowerCase().includes('department')) {
        setJoinError('Cannot join class. Your department does not match the class department.');
      } else if (errorMessage.includes('no classes found')) {
        setJoinError('Cannot join class. The class may be inactive or the code is incorrect. Please verify with your teacher.');
      } else if (errorMessage.toLowerCase().includes('invalid join code format')) {
        setJoinError('Invalid code. Only letters, numbers, dashes, and underscores are allowed.');
      } else if (errorMessage.includes('too long')) {
        setJoinError('Code is too long. Maximum 50 characters allowed.');
      } else if (errorMessage.includes('cannot be empty')) {
        setJoinError('Please enter a code.');
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
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-900">My Classes</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="outline"
              size="sm"
              icon={<ArchiveIcon />}
            >
              Archive
            </Button>
            <Button
              onClick={() => {
                setShowJoinForm(true);
                setEdpCode('');
                setJoinError('');
                setJoinSuccess('');
              }}
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              Join Class
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <StudentArchivedClassesModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onClassRestored={loadClasses}
      />

      {/* Controls Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
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
              placeholder="Subject, teacher, EDP..."
            />
            <div className="relative">
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingTeacherFilter(teacherFilter);
                    setPendingSemesterFilter(semesterFilter);
                    setPendingSchoolYearFilter(schoolYearFilter);
                  }
                  setShowFilters(nextOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
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
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">Filters</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Teacher</label>
                      <select
                        value={pendingTeacherFilter}
                        onChange={(e) => setPendingTeacherFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        <option value="">All teachers</option>
                        {teacherOptions.map(name => (
                          <option key={name} value={name!}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                      <select
                        value={pendingSemesterFilter}
                        onChange={(e) => setPendingSemesterFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        <option value="">All semesters</option>
                        {semesterOptions.map(semester => (
                          <option key={semester} value={semester}>{semester}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">School Year</label>
                      <select
                        value={pendingSchoolYearFilter}
                        onChange={(e) => setPendingSchoolYearFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        <option value="">All school years</option>
                        {schoolYearOptions.map((schoolYear) => (
                          <option key={schoolYear} value={schoolYear}>{schoolYear}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingTeacherFilter('');
                          setPendingSemesterFilter('');
                          setPendingSchoolYearFilter('');
                          setTeacherFilter('');
                          setSemesterFilter('');
                          setSchoolYearFilter('');
                          setShowFilters(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherFilter(pendingTeacherFilter);
                          setSemesterFilter(pendingSemesterFilter);
                          setSchoolYearFilter(pendingSchoolYearFilter);
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
        </div>
      </div>

      {/* Join Class Modal */}
      {showJoinForm && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowJoinForm(false);
              setEdpCode('');
              setJoinError('');
              setJoinSuccess('');
            }
          }}
        >
          <div className="modal-surface w-full max-w-md mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
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
              className="absolute top-4 right-4 modal-back-icon-btn"
              title="Back"
              aria-label="Back"
            >
              <CornerUpLeft className="h-5 w-5" />
            </Button>

            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Join a Class</h3>
                <p className="text-sm text-gray-600">Enter the code to join a class</p>
              </div>

              <form onSubmit={handleJoinClass} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="edpCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Code
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
        <div className="flex-1">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentClasses.map((cls) => (
                  <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.subject_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.descriptive_title || cls.subject_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cls.teacher_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-normal break-words">
                      {cls.schedule || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
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
                          type="button"
                        >
                          <ArchiveIcon size="md" />
                        </button>
                        <button
                          onClick={() => handleLeaveClass(cls)}
                          className="text-red-600 hover:text-red-700 transition-colors p-1"
                          title="Leave Class"
                          type="button"
                        >
                          <LogOut className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
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
          {searchTerm || activeFilterCount > 0 ? (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No matching classes found</h3>
              <div className="mt-6">
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setTeacherFilter('');
                    setSemesterFilter('');
                    setSchoolYearFilter('');
                    setPendingTeacherFilter('');
                    setPendingSemesterFilter('');
                    setPendingSchoolYearFilter('');
                  }}
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </div>
            </>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <p className="text-gray-500 font-medium">No classes joined</p>
            </div>
          )}
        </div>
      )}

      {/* Classlist Modal */}
      {viewingClasslist && (
        <div className="modal-backdrop">
          <div className="modal-surface w-full max-w-6xl mx-2 sm:mx-4 p-4 sm:p-6 relative max-h-[calc(100vh-2rem)] overflow-auto">
              {/* Close Button */}
              <button
                onClick={() => {
                  setViewingClasslist(null);
                  setClasslistStudents([]);
                }}
                className="absolute top-4 right-4 modal-back-icon-btn"
                title="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="text-center mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">Class List</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {(viewingClasslist.semester || 'N/A')} - {(viewingClasslist.school_year || 'N/A')}
                </p>
              </div>

              {/* Combined Class Info and Student List Table */}
              <div className="overflow-hidden">
                <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                  {/* Class Information Header */}
                  <thead>
                    <tr>
                      <th colSpan={4} className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50">
                        <div className="text-gray-900 font-semibold text-sm">Class Information</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-sm">
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '140px' }}>Subject Code:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.subject_code || 'N/A'}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>EDP Code:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.edp_code || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Descriptive Title:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={3}>{viewingClasslist.descriptive_title || viewingClasslist.subject_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Schedule:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.schedule || 'N/A'}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.room || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Teacher:</td>
                      <td className="px-4 py-2 text-gray-900" colSpan={3}>{viewingClasslist.teacher_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Semester:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.semester || 'N/A'}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">School Year:</td>
                      <td className="px-4 py-2 text-gray-900">{viewingClasslist.school_year || 'N/A'}</td>
                    </tr>
                  </tbody>

                  {/* Student List Header */}
                  <thead>
                    <tr>
                      <th colSpan={user?.role === 'teacher' || user?.role === 'admin' ? 5 : 4} className="px-4 py-3 text-left border-y border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 font-semibold text-sm">Students List</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-600">Total: {classlistStudents.length}</span>
                            {loadingClasslist && (
                              <LoadingDots dotClassName="h-2.5 w-2.5" />
                            )}
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  {/* Student List Column Headers */}
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '72px' }}>No.</th>
                      {(user?.role === 'teacher' || user?.role === 'admin') && (
                        <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '100px' }}>Student ID</th>
                      )}
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" colSpan={user?.role === 'teacher' || user?.role === 'admin' ? 1 : 3}>Name</th>
                      {(user?.role === 'teacher' || user?.role === 'admin') && (
                        <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '200px' }}>Email</th>
                      )}
                      {(user?.role === 'teacher' || user?.role === 'admin') && (
                        <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Status</th>
                      )}
                    </tr>
                  </thead>

                  {/* Student Rows */}
                  <tbody className="bg-white text-xs">
                    {loadingClasslist && classlistStudents.length === 0 ? (
                      <tr>
                        <td colSpan={user?.role === 'teacher' || user?.role === 'admin' ? 5 : 4} className="px-6 py-12 text-center">
                          <LoadingDots className="justify-center mb-2 gap-2" dotClassName="h-3 w-3" />
                          <p className="text-gray-500 text-sm">Loading students...</p>
                        </td>
                      </tr>
                    ) : classlistStudents.length > 0 ? (
                      classlistStudents.map((student, index) => (
                        <tr key={student.student_user_id} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-1 py-1.5 text-center font-medium text-gray-900">
                            {index + 1}
                          </td>
                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <td className="px-1 py-1.5 font-medium text-gray-900 text-xs">
                              {student.student_code}
                            </td>
                          )}
                          <td className="px-1 py-1.5 text-gray-900" colSpan={user?.role === 'teacher' || user?.role === 'admin' ? 1 : 3}>
                            {student.last_name}, {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''}
                          </td>
                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <td className="px-1 py-1.5 text-gray-700">
                              {student.email || '—'}
                            </td>
                          )}
                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <td className="px-1 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(student.status === 'join' || student.status === 'added') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {student.status || 'join'}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={user?.role === 'teacher' || user?.role === 'admin' ? 5 : 4} className="px-6 py-8 text-center">
                          <p className="text-gray-500 text-sm">No students in class</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { MyClasses };
export default MyClasses;
