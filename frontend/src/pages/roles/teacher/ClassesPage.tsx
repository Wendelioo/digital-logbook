import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import TeacherStoredArchiveModal from '../../../components/TeacherStoredArchiveModal';
import LoadingDots from '../../../components/LoadingDots';
import { ArchiveIcon } from '../../../components/icons/ArchiveIcons';
import {
  Eye,
  Edit,
  Plus,
  X,
  CornerUpLeft,
  Filter,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  CloseClass,
  ReopenClass,
  ArchiveClass,
  DeleteClass,
  ExportClasslistCSV,
  ExportClasslistPDF,
  ExportClasslistDOCX,
} from '../../../../wailsjs/go/backend/App';
import { openExportSaveDialog, defaultClasslistFilename, type ExportFormat } from '../../../utils/exportSaveDialog';
import { getArchiveErrorMessage, getArchiveSuccessMessage } from '../../../utils/archiveNotifications';
import { formatBackendError } from '../../../utils/actionErrors';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';
import { Class } from './types';

function ClassManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast, confirm } = useAppUi();
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [pendingSemesterFilter, setPendingSemesterFilter] = useState<string>('all');
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>('all');
  const [pendingSchoolYearFilter, setPendingSchoolYearFilter] = useState<string>('all');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedClassForStatus, setSelectedClassForStatus] = useState<{ id: number; currentStatus: boolean; newStatus: boolean } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [openExportModal, setOpenExportModal] = useState<number | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const [filterPanelPlacement, setFilterPanelPlacement] = useState<'top' | 'bottom'>('bottom');

  const normalizeSemester = (value?: string | null): string => {
    if (!value) return '';
    const normalized = value.toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('1st') || normalized.includes('first') || normalized === '1') return '1';
    if (normalized.includes('2nd') || normalized.includes('second') || normalized === '2') return '2';
    return normalized;
  };

  useEffect(() => {
    const state = location.state as { openArchiveModal?: boolean; archiveTab?: 'attendance' | 'classes' } | null;
    if (state?.openArchiveModal && state.archiveTab === 'classes') {
      setShowArchiveModal(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const loadClasses = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await GetTeacherClassesByUserID(user.id);
      setClasses(data || []);
      setFilteredClasses(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load classes:', error);
      setError('Unable to load classes from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [user?.id]);

  useEffect(() => {
    let filtered = classes;

    if (searchTerm) {
      filtered = filtered.filter(cls =>
        cls.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.school_year && cls.school_year.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.edp_code && cls.edp_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cls.join_code && cls.join_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(cls => {
        if (statusFilter === 'active') return cls.is_active && !cls.is_archived;
        if (statusFilter === 'inactive') return !cls.is_active && !cls.is_archived;
        return true;
      });
    }

    if (semesterFilter !== 'all') {
      filtered = filtered.filter(cls => normalizeSemester(cls.semester) === semesterFilter);
    }

    if (schoolYearFilter !== 'all') {
      filtered = filtered.filter(cls => (cls.school_year || '') === schoolYearFilter);
    }

    setFilteredClasses(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, semesterFilter, schoolYearFilter, classes]);

  const handleViewClassList = (classId: number) => {
    navigate(`/teacher/class-management/${classId}?mode=view`);
  };

  // Get class status label and color
  const getClassStatusBadge = (cls: Class) => {
    if (cls.is_archived) {
      return { label: 'Archived', color: 'bg-orange-100 text-orange-800' };
    }
    if (!cls.is_active) {
      return { label: 'Closed', color: 'bg-red-100 text-red-800' };
    }
    return { label: 'Active', color: 'bg-green-100 text-green-800' };
  };

  const handleStatusChange = (classId: number, currentStatus: boolean, newStatus: boolean) => {
    if (currentStatus === newStatus) return;
    
    setSelectedClassForStatus({ id: classId, currentStatus, newStatus });
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedClassForStatus) return;

    setChangingStatus(true);
    try {
      if (selectedClassForStatus.newStatus) {
        // Changing to Active
        await ReopenClass(selectedClassForStatus.id);
      } else {
        // Changing to Inactive
        await CloseClass(selectedClassForStatus.id);
      }
      await loadClasses();
      setShowStatusModal(false);
      setSelectedClassForStatus(null);
    } catch (error) {
      console.error('Failed to change class status:', error);
      toast(`Could not update class status. ${formatBackendError(error)}`, 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleArchiveClass = async (classId: number) => {
    const targetClass = classes.find((cls) => cls.class_id === classId);
    const label = targetClass?.subject_code || 'this class';
    const titleLine = targetClass?.descriptive_title?.trim() || targetClass?.subject_name || '';
    const scheduleLine = targetClass?.schedule?.trim() || '';
    const detailLines = [
      `Subject code: ${label}`,
      titleLine ? `Title: ${titleLine}` : null,
      scheduleLine ? `Schedule: ${scheduleLine}` : null,
      `Class ID: ${classId}`,
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await confirm({
      title: 'Archive class',
      message:
        `You are about to archive this classlist (it will move to Stored archives and can be restored later).\n\n` +
        `${detailLines}\n\n` +
        `If you only need to fix a typo or wrong schedule, use Edit instead while the class is active.`,
      variant: 'default',
      confirmLabel: 'Archive',
    });
    if (!ok) return;

    try {
      await ArchiveClass(classId);
      await loadClasses();
      toast(getArchiveSuccessMessage('class', 'archive'), 'success');
    } catch (error) {
      console.error('Failed to archive class:', error);
      toast(getArchiveErrorMessage('class', 'archive', error), 'error');
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!user?.id) {
      toast('You must be signed in to delete a class.', 'error');
      return;
    }
    if (cls.is_archived) {
      toast('Archived classes cannot be deleted from this list. Restore from Stored archives first if needed.', 'error');
      return;
    }
    if (cls.is_active) {
      toast('Set the class to Inactive (closed) before deleting. Use Edit if you only need to correct class details.', 'error');
      return;
    }

    const code = cls.subject_code || '(no code)';
    const titleLine = cls.descriptive_title?.trim() || cls.subject_name || '';
    const scheduleLine = cls.schedule?.trim() || '';
    const detailLines = [
      `Subject code: ${code}`,
      titleLine ? `Title: ${titleLine}` : null,
      scheduleLine ? `Schedule: ${scheduleLine}` : null,
      `Class ID: ${cls.class_id}`,
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await confirm({
      title: 'Delete class permanently',
      message:
        `This cannot be undone. All attendance sessions and enrollments for this class will be removed from the database.\n\n` +
        `${detailLines}\n\n` +
        `Double-check that this is the correct row. If you entered the wrong subject or schedule, use Edit (when the class is active) or Archive instead.`,
      variant: 'danger',
      confirmLabel: 'Delete permanently',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setDeletingClassId(cls.class_id);
    try {
      await DeleteClass(cls.class_id, user.id);
      await loadClasses();
      toast('Class deleted permanently.', 'success');
    } catch (error) {
      console.error('Failed to delete class:', error);
      toast(`Could not delete class. ${formatBackendError(error)}`, 'error');
    } finally {
      setDeletingClassId(null);
    }
  };

  const showExportToast = (type: 'success' | 'error', message: string) => {
    setExportToast({ type, message });
    setTimeout(() => setExportToast(null), 5000);
  };

  const handleExportClasslist = async (classId: number, format: ExportFormat) => {
    setExportingId(classId);
    try {
      const savePath = await openExportSaveDialog('Save classlist', defaultClasslistFilename(format), format);
      if (!savePath) return;

      let filePath = '';
      if (format === 'csv') filePath = await ExportClasslistCSV(classId, savePath);
      else if (format === 'pdf') filePath = await ExportClasslistPDF(classId, savePath);
      else filePath = await ExportClasslistDOCX(classId, savePath);

      showExportToast('success', `Saved: ${filePath.split(/[\\/]/).pop()}`);
    } catch (err) {
      showExportToast('error', `Export failed. ${formatBackendError(err, 'Please try again.')}`);
    } finally {
      setExportingId(null);
    }
  };

  const updateFilterPanelPlacement = () => {
    const anchor = filterPopoverRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const estimatedPanelHeight = 320;
    const viewportMargin = 16;
    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
    const spaceAbove = rect.top - viewportMargin;

    if (spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow) {
      setFilterPanelPlacement('top');
      return;
    }

    setFilterPanelPlacement('bottom');
  };

  useEffect(() => {
    if (!showFilters) return;

    updateFilterPanelPlacement();
    window.addEventListener('resize', updateFilterPanelPlacement);
    window.addEventListener('scroll', updateFilterPanelPlacement, true);

    return () => {
      window.removeEventListener('resize', updateFilterPanelPlacement);
      window.removeEventListener('scroll', updateFilterPanelPlacement, true);
    };
  }, [showFilters]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
        </div>
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
  const schoolYearOptions = Array.from(
    new Set(classes.map((cls) => (cls.school_year || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (semesterFilter !== 'all' ? 1 : 0) +
    (schoolYearFilter !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-col min-w-0 min-h-0 overflow-x-hidden">
      {/* Export Toast */}
      {exportToast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          exportToast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="font-medium">{exportToast.message}</span>
        </div>
      )}
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Class Management</h2>
          <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="outline"
              size="sm"
              icon={<ArchiveIcon />}
            >
              Archive
            </Button>
            <Button
              onClick={() => navigate('/teacher/create-classlist')}
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              ADD CLASS
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Controls Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 max-w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search..."
            />
            {/* Filter toggle button */}
            <div ref={filterPopoverRef} className="relative">
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingStatusFilter(statusFilter);
                    setPendingSemesterFilter(semesterFilter);
                    setPendingSchoolYearFilter(schoolYearFilter);
                    updateFilterPanelPlacement();
                  }
                  setShowFilters(nextOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
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
                <div
                  className={`absolute right-0 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg ${
                    filterPanelPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">Filters</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select
                        value={pendingStatusFilter}
                        onChange={(e) => setPendingStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                      <select
                        value={pendingSemesterFilter}
                        onChange={(e) => setPendingSemesterFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">All</option>
                        <option value="1">1st Sem</option>
                        <option value="2">2nd Sem</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">School Year</label>
                      <select
                        value={pendingSchoolYearFilter}
                        onChange={(e) => setPendingSchoolYearFilter(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">All</option>
                        {schoolYearOptions.map((schoolYear) => (
                          <option key={schoolYear} value={schoolYear}>
                            {schoolYear}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Apply & Clear */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingStatusFilter('all');
                          setPendingSemesterFilter('all');
                          setPendingSchoolYearFilter('all');
                          setStatusFilter('all');
                          setSemesterFilter('all');
                          setSchoolYearFilter('all');
                          setShowFilters(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter(pendingStatusFilter);
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

      {/* Table Section */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="min-w-full w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%] sm:w-auto">
                  Subject Code
                </th>
                <th scope="col" className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[30%] sm:w-auto">
                  Descriptive Title
                </th>
                <th scope="col" className="hidden sm:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%] sm:w-auto">
                  Schedule
                </th>
                <th scope="col" className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[16%] sm:w-auto">
                  Status
                </th>
                <th scope="col" className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[24%] sm:w-auto">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentClasses.map((cls) => {
                const status = getClassStatusBadge(cls);
                return (
                  <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                      {cls.subject_code || '-'}
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                      {cls.descriptive_title || '-'}
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900 align-top">
                      {cls.schedule || '-'}
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-normal text-xs sm:text-sm align-top">
                      {cls.is_archived ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Archived
                        </span>
                      ) : (
                        <select
                          value={cls.is_active ? 'active' : 'inactive'}
                          onChange={(e) => handleStatusChange(cls.class_id, cls.is_active, e.target.value === 'active')}
                          className={`w-full min-w-[84px] px-2 py-1 border rounded-md text-xs font-medium focus:outline-none focus:ring-2 ${
                            cls.is_active 
                              ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500'
                              : 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500'
                          }`}
                          disabled={cls.is_archived}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      )}
                    </td>
                    <td className="px-2 sm:px-6 py-4 text-sm font-medium align-top">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Button
                          onClick={() => handleViewClassList(cls.class_id)}
                          variant="outline"
                          size="xs"
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                          icon={<Eye className="h-3 w-3" />}
                          title="Open read-only classlist"
                        />
                        {cls.is_active && !cls.is_archived && (
                          <Button
                            onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=edit`)}
                            variant="primary"
                            size="xs"
                            icon={<Edit className="h-3 w-3" />}
                            title="Edit class details, schedule, and students"
                          />
                        )}
                        {/* Archive - shown for non-archived classes; enabled only when INACTIVE */}
                        {!cls.is_archived && (
                          <Button
                            onClick={() => handleArchiveClass(cls.class_id)}
                            variant="outline"
                            size="xs"
                            className="text-orange-600 hover:bg-orange-50"
                            icon={<ArchiveIcon size="xs" />}
                            title="Archive class (hide from list; restore later from Stored archives)"
                            disabled={cls.is_active}
                          />
                        )}
                        {!cls.is_archived && (
                          <Button
                            onClick={() => handleDeleteClass(cls)}
                            variant="outline"
                            size="xs"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            icon={<Trash2 className="h-3 w-3" />}
                            title="Delete class forever (only when closed). Use Edit to fix mistakes while active."
                            disabled={cls.is_active || deletingClassId === cls.class_id}
                          />
                        )}
                        {/* Export dropdown */}
                        <Button
                          onClick={() => setOpenExportModal(cls.class_id)}
                          variant="outline"
                          size="xs"
                          className="text-gray-600 hover:bg-gray-100"
                          icon={<Printer className="h-3 w-3" />}
                          title="Download classlist (CSV, PDF, or DOCX)"
                          disabled={exportingId === cls.class_id}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination Section */}
      {filteredClasses.length > 0 && (
        <div className="flex-shrink-0 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs sm:text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredClasses.length} entries
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
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
            <>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't created any classes yet.
              </p>
            </>
          )}
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusModal && selectedClassForStatus && (
        <div className="modal-backdrop">
          <div className="modal-surface w-full max-w-md mx-2 sm:mx-4 p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Change Class Status
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedClassForStatus(null);
                }}
                className="modal-back-icon-btn"
                title="Back"
                aria-label="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">
              {selectedClassForStatus.newStatus ? (
                <>
                  <p className="text-sm text-gray-700 mb-3">
                    This class will be set to <span className="font-semibold text-green-700">active</span>.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                      <li>Students can enroll.</li>
                      <li>You can create and edit attendance.</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 mb-3">
                    This class will be set to <span className="font-semibold text-red-700">inactive</span>.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      <li>New student enrollment is disabled.</li>
                      <li>New attendance sheets cannot be created.</li>
                      <li>Existing records remain available for viewing.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedClassForStatus(null);
                }}
                variant="outline"
                disabled={changingStatus}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                variant={selectedClassForStatus.newStatus ? 'success' : 'danger'}
                disabled={changingStatus}
              >
                {changingStatus ? 'Changing...' : selectedClassForStatus.newStatus ? 'Activate Class' : 'Deactivate Class'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TeacherStoredArchiveModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          loadClasses();
        }}
        initialTab="classes"
        onClassUnarchived={loadClasses}
      />

      <Modal
        isOpen={openExportModal !== null}
        onClose={() => setOpenExportModal(null)}
        title="Export Classlist"
        size="sm"
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (openExportModal === null) return;
              const classID = openExportModal;
              setOpenExportModal(null);
              handleExportClasslist(classID, 'csv');
            }}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (openExportModal === null) return;
              const classID = openExportModal;
              setOpenExportModal(null);
              handleExportClasslist(classID, 'pdf');
            }}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              if (openExportModal === null) return;
              const classID = openExportModal;
              setOpenExportModal(null);
              handleExportClasslist(classID, 'docx');
            }}
          >
            DOCX
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default ClassManagement;
