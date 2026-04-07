import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import {
  Users,
  Edit,
  Trash2,
  Plus,
  X,
  Download,
  Eye,
} from 'lucide-react';
import {
  GetClassStudents,
  ExportClasslistCSV,
  UpdateClass,
  GetAllStudentsForEnrollment,
  EnrollMultipleStudents,
  UnenrollStudentFromClassByIDs,
  GetTeacherClassesByUserID,
  GetClassByID,
} from '../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultClasslistFilename } from '../../utils/exportSaveDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useAppUi } from '../../contexts/AppUiContext';
import { Class, ClasslistEntry, ClassStudent } from './types';

function ClassManagementDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast, confirm } = useAppUi();
  const isEditMode = searchParams.get('mode') === 'edit';
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<ClasslistEntry[]>([]);
  const [availableStudents, setAvailableStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [editFormData, setEditFormData] = useState({
    schedule: '',
    room: '',
    section: '',
    semester: '',
    schoolYear: ''
  });
  const [saving, setSaving] = useState(false);
  const [exportingClasslist, setExportingClasslist] = useState(false);

  const handleExportClasslist = async (classId: number) => {
    setExportingClasslist(true);
    try {
      const savePath = await openExportSaveDialog('Save classlist', defaultClasslistFilename('csv'), 'csv');
      if (!savePath) {
        setExportingClasslist(false);
        return;
      }
      const filePath = await ExportClasslistCSV(classId, savePath);
      toast(`Classlist exported successfully. File saved to: ${filePath}`, 'success');
    } catch (error) {
      console.error('Failed to export classlist:', error);
      toast('Failed to export classlist. Please try again.', 'error');
    } finally {
      setExportingClasslist(false);
    }
  };

  const loadClassDetails = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // Try to get class by ID (works for both active and archived classes)
      try {
        const classData = await GetClassByID(parseInt(id));
        if (classData) {
          setClassInfo(classData);
          setEditFormData({
            schedule: classData.schedule || '',
            room: classData.room || '',
            section: classData.section || '',
            semester: classData.semester || '',
            schoolYear: classData.school_year || ''
          });

          // Load students
          const studentsData = await GetClassStudents(parseInt(id));
          setStudents(studentsData || []);
          setError('');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log('Class not found by ID, trying active classes list');
      }

      // Fallback: search through active classes
      const classes = await GetTeacherClassesByUserID(user?.id || 0);
      const selectedClass = (classes || []).find((c: any) => c.class_id === parseInt(id));

      if (selectedClass) {
        setClassInfo(selectedClass);
        setEditFormData({
          schedule: selectedClass.schedule || '',
          room: selectedClass.room || '',
          section: selectedClass.section || '',
          semester: selectedClass.semester || '',
          schoolYear: selectedClass.school_year || ''
        });
      }

      const studentsData = await GetClassStudents(parseInt(id));
      setStudents(studentsData || []);

      setError('');
    } catch (error) {
      console.error('Failed to load class details:', error);
      setError('Unable to load class details from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassDetails();
  }, [id, user?.id]);

  const handleRemoveStudent = async (studentId: number, classId: number) => {
    const ok = await confirm({
      title: 'Remove student',
      message: 'Are you sure you want to remove this student from the class?',
      variant: 'danger',
      confirmLabel: 'Remove',
    });
    if (!ok) return;

    try {
      await UnenrollStudentFromClassByIDs(studentId, classId);
      await loadClassDetails();
      toast('Student removed successfully!', 'success');
    } catch (error) {
      console.error('Failed to remove student:', error);
      toast('Failed to remove student. Please try again.', 'error');
    }
  };

  const handleAddStudent = async () => {
    if (!id) return;

    try {
      const available = await GetAllStudentsForEnrollment(parseInt(id));
      setAvailableStudents(available || []);
      setShowAddModal(true);
      setSelectedStudents(new Set());
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to load available students:', error);
      toast('Failed to load students. Please try again.', 'error');
    }
  };

  const handleEnrollStudents = async () => {
    if (!id || selectedStudents.size === 0) return;

    setEnrolling(true);
    try {
      const studentIds = Array.from(selectedStudents);
      await EnrollMultipleStudents(studentIds, parseInt(id), user?.id || 0);

      setShowAddModal(false);
      await loadClassDetails();
      toast(`Successfully enrolled ${selectedStudents.size} student(s)!`, 'success');
    } catch (error) {
      console.error('Failed to enroll students:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to enroll some students. Please try again.';
      if (errorMessage.toLowerCase().includes('department')) {
        toast('Enrollment blocked: selected student department does not match this class department.', 'error');
      } else {
        toast(errorMessage, 'error');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleEditClass = () => {
    if (!classInfo) return;
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !classInfo) return;

    setSaving(true);
    try {
      await UpdateClass(
        parseInt(id),
        editFormData.schedule,
        editFormData.room,
        editFormData.section,
        editFormData.semester,
        editFormData.schoolYear,
        classInfo.is_active
      );
      setShowEditModal(false);
      await loadClassDetails();
      toast('Class updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update class:', error);
      toast('Failed to update class. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStudentSelection = (studentId: number) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const filteredAvailableStudents = availableStudents.filter(student =>
    !student.is_enrolled && (
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.middle_name && student.middle_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const filteredStudents = students.filter(student => {
    const searchLower = studentSearchTerm.toLowerCase();
    return (
      student.student_code.toLowerCase().includes(searchLower) ||
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      (student.middle_name && student.middle_name.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
        </div>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Class not found</p>
          <button
            onClick={() => navigate('/teacher/class-management')}
            className="mt-4 text-primary-600 hover:text-primary-900"
          >
            Back to Class Management
          </button>
        </div>
      </div>
    );
  }

  const archiveState = location.state as { fromArchiveModal?: boolean; returnToArchiveTab?: 'attendance' | 'classes' } | null;
  const isFromArchivedClasslistView = archiveState?.fromArchiveModal && archiveState.returnToArchiveTab === 'classes';

  return (
    <div className="modal-backdrop-dense">
      <div className="min-h-screen p-3 sm:p-4 md:p-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Single Class List Sheet - Bond Paper Style */}
        <div className="bg-white max-w-4xl mx-auto my-4 sm:my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
          {/* Close Button - Inside Sheet */}
          <button
            onClick={() => {
              if (isFromArchivedClasslistView) {
                navigate('/teacher/class-management', {
                  replace: true,
                  state: { openArchiveModal: true, archiveTab: 'classes' },
                });
                return;
              }

              navigate('/teacher/class-management');
            }}
            className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Sheet Title and Controls */}
          <div className="mb-6 pb-4 border-b border-gray-400">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 tracking-wide">CLASS LIST</h2>
              <p className="text-xs text-gray-600 mt-1">School Year {classInfo.school_year || 'N/A'} • {classInfo.semester || 'N/A'}</p>
            </div>
            <div className="flex justify-end items-center gap-2">
              <Button
                onClick={loadClassDetails}
                disabled={loading}
                variant="outline"
                size="sm"
                title="Refresh class list"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
              {classInfo.is_archived && !isFromArchivedClasslistView && (
                <Button
                  onClick={() => handleExportClasslist(classInfo.class_id)}
                  variant="outline"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  disabled={exportingClasslist}
                  title="Export to CSV"
                >
                  Export CSV
                </Button>
              )}
              {isEditMode && classInfo.is_active && !classInfo.is_archived && (
                <>
                  <Button
                    onClick={handleEditClass}
                    variant="outline"
                    size="sm"
                    icon={<Edit className="h-4 w-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={handleAddStudent}
                    variant="primary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add
                  </Button>
                </>
              )}
              {isEditMode && !classInfo.is_active && (
                <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded">
                  Class is {classInfo.is_archived ? 'archived' : 'closed'} — editing disabled
                </span>
              )}
            </div>
          </div>

          {/* Combined Class Info and Student List Table */}
          <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full" style={{ minWidth: '100%', tableLayout: 'auto' }}>
              {/* Class Information Header */}
              <thead>
                <tr>
                  <th colSpan={6} className="px-4 py-2 text-left border-b-2 border-gray-900">
                    <div className="text-gray-900 font-bold text-sm tracking-wide">CLASS INFORMATION</div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white text-sm">
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>Subject Code:</td>
                  <td className="px-4 py-2 text-gray-900">{classInfo.subject_code || 'N/A'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap" style={{ width: '100px' }}>Schedule:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={3}>{classInfo.schedule || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Subject Name:</td>
                  <td className="px-4 py-2 text-gray-900">{classInfo.subject_name || 'N/A'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Room:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={3}>{classInfo.room || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Semester:</td>
                  <td className="px-4 py-2 text-gray-900">{classInfo.semester || 'N/A'}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">School Year:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={3}>{classInfo.school_year || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">Instructor:</td>
                  <td className="px-4 py-2 text-gray-900" colSpan={5}>{classInfo.teacher_name || 'N/A'}</td>
                </tr>
              </tbody>

              {/* Student List Header */}
              <thead>
                <tr>
                  <th colSpan={6} className="px-4 py-3 text-left border-b-2 border-gray-900">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 font-bold text-sm tracking-wide">STUDENTS LIST</span>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>Total: {filteredStudents.length}</span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '50px' }}>No.</th>
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Student ID</th>
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '180px' }}>Name</th>
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '200px' }}>Email</th>
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>Contact</th>
                  {isEditMode && (
                    <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Actions</th>
                  )}
                </tr>
              </thead>

              {/* Student Rows */}
              <tbody className="bg-white text-xs">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student, index) => (
                    <tr key={student.student_user_id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-2 py-1.5 text-center font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-gray-900 text-xs whitespace-nowrap">
                        {student.student_code}
                      </td>
                      <td className="px-2 py-1.5 text-gray-900 whitespace-nowrap">
                        {student.last_name}, {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''}
                      </td>
                      <td className="px-2 py-1.5 text-gray-700" style={{ wordBreak: 'break-word' }}>
                        {student.email || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                        {student.contact_number || '—'}
                      </td>
                      {isEditMode && classInfo.is_active && !classInfo.is_archived && (
                        <td className="px-2 py-1.5 text-center">
                          <Button
                            onClick={() => handleRemoveStudent(student.student_user_id, student.class_id)}
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="h-3 w-3" />}
                            className="text-gray-500 hover:text-gray-700 h-9 w-9 px-0 py-0"
                            title="Remove student"
                          />
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <Users className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">No students enrolled</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-3xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="text-center p-4 sm:p-8 pb-3 sm:pb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-blue-600 mb-2">Add</h2>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Select students to enroll in {classInfo?.subject_code}</p>
            </div>

            <div className="px-4 sm:px-8 pb-4 sm:pb-8 flex-1 overflow-hidden flex flex-col">
              <div className="mb-4 flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder=""
                  />
                </div>
              </div>

              <div className="mb-2 text-sm text-gray-600 flex-shrink-0">
                {selectedStudents.size > 0 ? (
                  <span className="font-semibold text-blue-600">
                    {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                  </span>
                ) : (
                  <span>Select students to enroll</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {filteredAvailableStudents.length > 0 ? (
                  <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '50px' }}>
                          <input
                            type="checkbox"
                            checked={filteredAvailableStudents.length > 0 && filteredAvailableStudents.every(s => selectedStudents.has(s.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents(new Set(filteredAvailableStudents.map(s => s.id)));
                              } else {
                                setSelectedStudents(new Set());
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                          Student ID
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                          Name
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAvailableStudents.map((student) => (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedStudents.has(student.id) ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.student_id}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                            {student.last_name}, {student.first_name} {student.middle_name || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No students available</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm ? 'No students match your search criteria.' : 'All students are already enrolled or there are no students in the system.'}
                    </p>
                  </div>
                )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 flex-shrink-0">
                <Button
                  type="button"
                    onClick={() => setShowAddModal(false)}
                    variant="outline"
                    size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleEnrollStudents}
                  disabled={selectedStudents.size === 0 || enrolling}
                  variant="primary"
                    loading={enrolling}
                    size="sm"
                  >
                    Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-2xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="text-center p-4 sm:p-8 pb-3 sm:pb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-blue-600 mb-2">Edit Class</h2>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
            </div>

            <div className="px-4 sm:px-8 pb-4 sm:pb-8 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
                  <input
                    type="text"
                    value={editFormData.schoolYear}
                    onChange={(e) => setEditFormData({ ...editFormData, schoolYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={editFormData.semester}
                    onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Semester</option>
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <input
                    type="text"
                    value={editFormData.schedule}
                    onChange={(e) => setEditFormData({ ...editFormData, schedule: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={editFormData.room}
                    onChange={(e) => setEditFormData({ ...editFormData, room: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Section removed as requested */}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  variant="primary"
                  loading={saving}
                  size="sm"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default ClassManagementDetail;
