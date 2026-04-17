import React, { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import {
  CornerUpLeft,
  Search,
  Loader2,
  Eye,
  Filter
} from 'lucide-react';
import { ArchiveIcon, ArchiveRestoreIcon } from '../../../components/icons/ArchiveIcons';
import {
  GetStudentArchivedClasses,
  GetClassStudents,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { getArchiveErrorMessage, getArchiveSuccessMessage } from '../../../utils/archiveNotifications';
import { CourseClass, ClasslistEntry } from './types';

const yearSuffix = (year: number): string => {
  if (year === 1) return 'st';
  if (year === 2) return 'nd';
  if (year === 3) return 'rd';
  return 'th';
};

const toYearLevelLabel = (section?: string | null): string => {
  const raw = (section || '').trim();
  if (!raw) return '';

  const match = raw.match(/(?:^|[^0-9])([1-6])(?:st|nd|rd|th)?(?:\s*year)?(?:[^0-9]|$)/i);
  if (!match) return '';

  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1) return '';
  return `${year}${yearSuffix(year)} Year`;
};

const getYearLevelSortValue = (label: string): number => {
  const match = label.match(/^(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

interface ArchivedClassesProps {
  hideHeader?: boolean;
  onClassRestored?: () => void;
}

function ArchivedClasses({ hideHeader = false, onClassRestored }: ArchivedClassesProps) {
  const { user } = useAuth();
  const { toast, confirm } = useAppUi();
  const [archivedClasses, setArchivedClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState<string>('');
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [pendingTeacherFilter, setPendingTeacherFilter] = useState<string>('');
  const [pendingSemesterFilter, setPendingSemesterFilter] = useState<string>('');
  const [pendingSchoolYearFilter, setPendingSchoolYearFilter] = useState<string>('');
  const [pendingYearLevelFilter, setPendingYearLevelFilter] = useState<string>('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewingClasslist, setViewingClasslist] = useState<CourseClass | null>(null);
  const [classlistStudents, setClasslistStudents] = useState<ClasslistEntry[]>([]);
  const [loadingClasslist, setLoadingClasslist] = useState(false);

  const activeFilterCount = [teacherFilter, semesterFilter, schoolYearFilter, yearLevelFilter].filter(Boolean).length;

  const teacherOptions = React.useMemo(
    () => Array.from(new Set(archivedClasses.map(c => c.teacher_name).filter(Boolean))).sort(),
    [archivedClasses]
  );
  const semesterOptions = React.useMemo(
    () => Array.from(new Set(archivedClasses.map(c => (c.semester || '').trim()).filter(Boolean))).sort(),
    [archivedClasses]
  );
  const schoolYearOptions = React.useMemo(
    () => Array.from(new Set(archivedClasses.map(c => (c.school_year || '').trim()).filter(Boolean))).sort(),
    [archivedClasses]
  );
  const yearLevelOptions = React.useMemo(
    () => Array.from(new Set(archivedClasses.map(c => toYearLevelLabel(c.section)).filter(Boolean))).sort((a, b) => getYearLevelSortValue(a) - getYearLevelSortValue(b)),
    [archivedClasses]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, teacherFilter, semesterFilter, schoolYearFilter, yearLevelFilter, archivedClasses, entriesPerPage]);

  useEffect(() => {
    loadArchivedClasses();
  }, [user]);

  const loadArchivedClasses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await GetStudentArchivedClasses(user.id);
      setArchivedClasses(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load archived classes:', error);
      setError('Unable to load archived classes from server.');
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

  const handleUnarchiveClass = async (classInfo: CourseClass) => {
    if (!user) return;
    
    const ok = await confirm({
      title: 'Unarchive class',
      message: `Are you sure you want to unarchive this class (${classInfo.subject_code})?`,
      variant: 'default',
      confirmLabel: 'Unarchive',
    });

    if (!ok) return;
    
    try {
      const appBridge = (window as any)?.go?.backend?.App;
      if (appBridge && typeof appBridge.RestoreArchivedJoinedClassByStudent === 'function') {
        await appBridge.RestoreArchivedJoinedClassByStudent(user.id, classInfo.class_id);
      } else {
        throw new Error('Restore class method is not available in this app build.');
      }
      await loadArchivedClasses(); // Refresh the list
      toast(getArchiveSuccessMessage('class', 'restore'), 'success');
      onClassRestored?.();
    } catch (error) {
      console.error('Failed to restore class:', error);
      toast(getArchiveErrorMessage('class', 'restore', error), 'error');
    }
  };

  const filteredClasses = React.useMemo(() => {
    let filtered = archivedClasses;

    if (teacherFilter) {
      filtered = filtered.filter(cls =>
        (cls.teacher_name || '').toLowerCase() === teacherFilter.toLowerCase()
      );
    }

    if (semesterFilter) {
      filtered = filtered.filter(cls =>
        (cls.semester || '').toLowerCase() === semesterFilter.toLowerCase()
      );
    }

    if (schoolYearFilter) {
      filtered = filtered.filter(cls =>
        (cls.school_year || '').toLowerCase() === schoolYearFilter.toLowerCase()
      );
    }

    if (yearLevelFilter) {
      filtered = filtered.filter(cls =>
        toYearLevelLabel(cls.section).toLowerCase() === yearLevelFilter.toLowerCase()
      );
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(cls =>
        cls.subject_code.toLowerCase().includes(query) ||
        (cls.subject_name && cls.subject_name.toLowerCase().includes(query)) ||
        (cls.descriptive_title && cls.descriptive_title.toLowerCase().includes(query)) ||
        (cls.edp_code && cls.edp_code.toLowerCase().includes(query)) ||
        (cls.teacher_name && cls.teacher_name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [archivedClasses, searchTerm, teacherFilter, semesterFilter, schoolYearFilter, yearLevelFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / entriesPerPage));
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, endIndex);
  const startEntry = filteredClasses.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredClasses.length);

  useEffect(() => {
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
    <div className="flex flex-col">
      {/* Header Section */}
      {!hideHeader && (
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArchiveIcon size="lg" className="text-gray-600" />
              <h2 className="text-2xl font-bold text-gray-900">Archived Classes</h2>
            </div>
            <div className="text-sm text-gray-500">
              {archivedClasses.length} {archivedClasses.length === 1 ? 'class' : 'classes'}
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Teacher-archived classes are read-only. Archived classes can be restored to My Classes.
          </p>
        </div>
      )}

      {error && (
        <div className="flex-shrink-0 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search classes..."
              />
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingTeacherFilter(teacherFilter);
                    setPendingSemesterFilter(semesterFilter);
                    setPendingSchoolYearFilter(schoolYearFilter);
                    setPendingYearLevelFilter(yearLevelFilter);
                  }
                  setShowFilters(nextOpen);
                }}
                className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">Filters</span>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Teacher</label>
                      <select
                        value={pendingTeacherFilter}
                        onChange={(e) => setPendingTeacherFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All teachers</option>
                        {teacherOptions.map(name => (
                          <option key={name} value={name!}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Semester</label>
                      <select
                        value={pendingSemesterFilter}
                        onChange={(e) => setPendingSemesterFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All semesters</option>
                        {semesterOptions.map(semester => (
                          <option key={semester} value={semester}>{semester}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">School Year</label>
                      <select
                        value={pendingSchoolYearFilter}
                        onChange={(e) => setPendingSchoolYearFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All school years</option>
                        {schoolYearOptions.map((schoolYear) => (
                          <option key={schoolYear} value={schoolYear}>{schoolYear}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Year Level</label>
                      <select
                        value={pendingYearLevelFilter}
                        onChange={(e) => setPendingYearLevelFilter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All year levels</option>
                        {yearLevelOptions.map(level => (
                          <option key={level} value={level}>{level}</option>
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
                          setPendingYearLevelFilter('');
                          setTeacherFilter('');
                          setSemesterFilter('');
                          setSchoolYearFilter('');
                          setYearLevelFilter('');
                          setShowFilters(false);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherFilter(pendingTeacherFilter);
                          setSemesterFilter(pendingSemesterFilter);
                          setSchoolYearFilter(pendingSchoolYearFilter);
                          setYearLevelFilter(pendingYearLevelFilter);
                          setShowFilters(false);
                        }}
                        className="rounded-lg border border-primary-600 bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
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

      {/* Archived Classes */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject Code
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descriptive Title
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedClasses.length > 0 ? (
                paginatedClasses.map((cls) => (
                  <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {cls.subject_code || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {cls.descriptive_title || cls.subject_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {cls.teacher_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {cls.schedule || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewClasslist(cls)}
                          className="h-9 w-9 inline-flex items-center justify-center text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Class List"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {cls.is_archived ? (
                          <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600" title="Archived by teacher">
                            Teacher Archived
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUnarchiveClass(cls)}
                            className="h-9 w-9 inline-flex items-center justify-center text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                            title="Restore to My Classes"
                          >
                            <ArchiveRestoreIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    {searchTerm || activeFilterCount > 0 ? (
                      <>
                        <p className="text-gray-500 font-medium">No matching archived classes found</p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setTeacherFilter('');
                            setSemesterFilter('');
                            setSchoolYearFilter('');
                            setYearLevelFilter('');
                            setPendingTeacherFilter('');
                            setPendingSemesterFilter('');
                            setPendingSchoolYearFilter('');
                            setPendingYearLevelFilter('');
                          }}
                          className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Clear Filters
                        </button>
                      </>
                    ) : (
                      <p className="text-gray-500 font-medium">No archived classes.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <p className="text-sm text-gray-600 mt-1">{viewingClasslist.semester} - {viewingClasslist.school_year}</p>
                <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                  Archived
                </span>
              </div>

              {/* Combined Class Info and Student List Table */}
              <div className="overflow-hidden">
                <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                  {/* Class Information Header */}
                  <thead>
                    <tr>
                      <th colSpan={5} className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50">
                        <div className="text-gray-900 font-semibold text-sm">Class Information</div>
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
                      <th colSpan={5} className="px-4 py-3 text-left border-y border-gray-200 bg-gray-50">
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
                      <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase" colSpan={4}>Name</th>
                    </tr>
                  </thead>

                  {/* Student Rows */}
                  <tbody className="bg-white text-xs">
                    {loadingClasslist && classlistStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
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
                          <td className="px-1 py-1.5 text-gray-900" colSpan={4}>
                            {student.last_name}, {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center">
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

export { ArchivedClasses };
export default ArchivedClasses;
