import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import {
  X,
  Search,
  Loader2,
  Users,
  Eye,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  GetStudentArchivedClasses,
  GetClassStudents,
  UnarchiveStudentEnrollment,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { CourseClass, ClasslistEntry, SemesterGroup } from './types';

interface ArchivedClassesProps {
  hideHeader?: boolean;
}

function ArchivedClasses({ hideHeader = false }: ArchivedClassesProps) {
  const { user } = useAuth();
  const [archivedClasses, setArchivedClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expandedSemesters, setExpandedSemesters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [viewingClasslist, setViewingClasslist] = useState<CourseClass | null>(null);
  const [classlistStudents, setClasslistStudents] = useState<ClasslistEntry[]>([]);
  const [loadingClasslist, setLoadingClasslist] = useState(false);

  useEffect(() => {
    loadArchivedClasses();
  }, [user]);

  const loadArchivedClasses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await GetStudentArchivedClasses(user.id);
      setArchivedClasses(data || []);
      
      // Auto-expand the first semester group
      if (data && data.length > 0) {
        const firstClass = data[0];
        const key = `${firstClass.semester || 'Unknown'}-${firstClass.school_year || 'Unknown'}`;
        setExpandedSemesters(new Set([key]));
      }
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

  const handleUnarchiveClass = async (classInfo: CourseClass) => {
    if (!user) return;
    
    const confirmUnarchive = window.confirm(
      `Are you sure you want to restore "${classInfo.subject_code}" to My Classes?`
    );
    
    if (!confirmUnarchive) return;
    
    try {
      await UnarchiveStudentEnrollment(user.id, classInfo.class_id);
      await loadArchivedClasses(); // Refresh the list
    } catch (error) {
      console.error('Failed to unarchive class:', error);
      alert('Failed to restore class. Please try again.');
    }
  };

  // Group classes by semester and school year
  const groupedClasses = React.useMemo(() => {
    const groups: SemesterGroup[] = [];
    const groupMap = new Map<string, SemesterGroup>();

    // Filter classes based on search term and semester filter
    let filteredClasses = archivedClasses;
    
    // Apply semester filter
    if (semesterFilter !== 'all') {
      filteredClasses = filteredClasses.filter(cls => 
        cls.semester?.toLowerCase() === semesterFilter.toLowerCase()
      );
    }
    
    // Apply search term
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filteredClasses = filteredClasses.filter(cls =>
        cls.subject_code.toLowerCase().includes(query) ||
        (cls.subject_name && cls.subject_name.toLowerCase().includes(query)) ||
        (cls.descriptive_title && cls.descriptive_title.toLowerCase().includes(query)) ||
        (cls.edp_code && cls.edp_code.toLowerCase().includes(query)) ||
        (cls.teacher_name && cls.teacher_name.toLowerCase().includes(query))
      );
    }

    filteredClasses.forEach(cls => {
      const semester = cls.semester || 'Unknown Semester';
      const schoolYear = cls.school_year || 'Unknown Year';
      const key = `${semester}-${schoolYear}`;

      if (!groupMap.has(key)) {
        const group: SemesterGroup = {
          semester,
          schoolYear,
          classes: []
        };
        groupMap.set(key, group);
        groups.push(group);
      }
      groupMap.get(key)!.classes.push(cls);
    });

    return groups;
  }, [archivedClasses, searchTerm, semesterFilter]);

  const toggleSemester = (key: string) => {
    const newExpanded = new Set(expandedSemesters);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSemesters(newExpanded);
  };

  const formatSemesterLabel = (semester: string, schoolYear: string) => {
    return `${semester} - ${schoolYear}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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
              <Archive className="h-6 w-6 text-gray-600" />
              <h2 className="text-2xl font-bold text-gray-900">Archived Classes</h2>
            </div>
            <div className="text-sm text-gray-500">
              {archivedClasses.length} archived {archivedClasses.length === 1 ? 'class' : 'classes'}
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            View your previously enrolled classes organized by semester.
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Semester</span>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Search</span>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search classes..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Archived Classes by Semester */}
      {groupedClasses.length > 0 ? (
        <div className="space-y-4">
          {groupedClasses.map((group) => {
            const key = `${group.semester}-${group.schoolYear}`;
            const isExpanded = expandedSemesters.has(key);

            return (
              <div key={key} className="bg-white shadow rounded-lg overflow-hidden">
                {/* Semester Header */}
                <button
                  onClick={() => toggleSemester(key)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {formatSemesterLabel(group.semester, group.schoolYear)}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {group.classes.length} {group.classes.length === 1 ? 'class' : 'classes'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                    Archived
                  </span>
                </button>

                {/* Classes Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            EDP Code
                          </th>
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
                            Room
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.classes.map((cls) => (
                          <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {cls.edp_code || '-'}
                            </td>
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {cls.room || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewClasslist(cls)}
                                  className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                  title="View Class List"
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleUnarchiveClass(cls)}
                                  className="text-green-600 hover:text-green-800 transition-colors p-1"
                                  title="Restore to My Classes"
                                >
                                  <ArchiveRestore className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <Archive className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {searchTerm ? (
            <>
              <p className="text-gray-500 font-medium">No matching archived classes found</p>
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Clear Search
              </button>
            </>
          ) : (
            <p className="text-gray-500 font-medium">No archived classes</p>
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

export { ArchivedClasses };
export default ArchivedClasses;
