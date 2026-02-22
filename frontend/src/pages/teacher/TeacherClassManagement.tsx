import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Button';
import TeacherStoredArchiveModal from '../../components/TeacherStoredArchiveModal';
import {
  Eye,
  Edit,
  Plus,
  Archive,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  GetTeacherClassesByUserID,
  CloseClass,
  ReopenClass,
  ArchiveClass,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Class } from './types';

function ClassManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedClassForStatus, setSelectedClassForStatus] = useState<{ id: number; currentStatus: boolean; newStatus: boolean } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

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
        (cls.edp_code && cls.edp_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredClasses(filtered);
    setCurrentPage(1);
  }, [searchTerm, classes]);

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
      alert('Failed to change class status. ' + (error instanceof Error ? error.message : 'Please try again.'));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleArchiveClass = async (classId: number) => {
    if (!window.confirm('Are you sure you want to archive this class? It will be moved to the Archive section along with all its attendance records.')) {
      return;
    }
    try {
      await ArchiveClass(classId);
      await loadClasses();
      alert('Class archived successfully!');
    } catch (error) {
      console.error('Failed to archive class:', error);
      alert('Failed to archive class. ' + (error instanceof Error ? error.message : 'Please try again.'));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
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

  return (
    <div className="flex flex-col min-w-0">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Class Management</h2>
          <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="outline"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
            >
              Archive
            </Button>
            <Button
              onClick={() => navigate('/teacher/create-classlist')}
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              ADD NEW
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-700">Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-auto px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder=""
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '84px' }}>
                  EDP Code
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '96px' }}>
                  Subject Code
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px' }}>
                  Descriptive Title
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>
                  Schedule
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '96px' }}>
                  Status
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '104px' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentClasses.map((cls) => {
                const status = getClassStatusBadge(cls);
                return (
                  <tr key={cls.class_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {cls.edp_code || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {cls.subject_code || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900">
                      {cls.descriptive_title || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-normal break-words text-xs sm:text-sm text-gray-900">
                      {cls.schedule || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm">
                      {cls.is_archived ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Archived
                        </span>
                      ) : (
                        <select
                          value={cls.is_active ? 'active' : 'inactive'}
                          onChange={(e) => handleStatusChange(cls.class_id, cls.is_active, e.target.value === 'active')}
                          className={`px-2 py-1 border rounded-md text-xs font-medium focus:outline-none focus:ring-2 ${
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
                    <td className="px-3 sm:px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Button
                          onClick={() => handleViewClassList(cls.class_id)}
                          variant="outline"
                          size="xs"
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100"
                          icon={<Eye className="h-3 w-3" />}
                          title="View"
                        />
                        {cls.is_active && !cls.is_archived && (
                          <Button
                            onClick={() => navigate(`/teacher/class-management/${cls.class_id}?mode=edit`)}
                            variant="primary"
                            size="xs"
                            icon={<Edit className="h-3 w-3" />}
                            title="Edit"
                          />
                        )}
                        {/* Archive - only for INACTIVE classes */}
                        {!cls.is_active && !cls.is_archived && (
                          <Button
                            onClick={() => handleArchiveClass(cls.class_id)}
                            variant="outline"
                            size="xs"
                            className="text-orange-600 hover:bg-orange-50"
                            icon={<Archive className="h-3 w-3" />}
                            title="Archive Class"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              <div className="mt-6">
                <Button
                  onClick={() => navigate('/teacher/create-classlist')}
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add New Class
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusModal && selectedClassForStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedClassForStatus.newStatus ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <AlertCircle className={`h-6 w-6 ${
                    selectedClassForStatus.newStatus ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Change Class Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedClassForStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">
              {selectedClassForStatus.newStatus ? (
                <>
                  <p className="text-gray-700 mb-3">
                    You are about to <strong className="text-green-600">activate</strong> this class.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <h4 className="font-semibold text-green-800 mb-2">Changes when activated:</h4>
                    <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                      <li>Students can enroll in this class</li>
                      <li>You can create and edit attendance</li>
                      <li>Class will accept new activities</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-700 mb-3">
                    You are about to <strong className="text-red-600">deactivate</strong> this class.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <h4 className="font-semibold text-red-800 mb-2">Restrictions when inactive:</h4>
                    <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                      <li>Students <strong>cannot enroll</strong> in this class</li>
                      <li>New attendance sheets <strong>cannot be created</strong></li>
                      <li>Existing data remains viewable but not editable</li>
                      <li>You can <strong>archive</strong> this class when inactive</li>
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
        onClose={() => setShowArchiveModal(false)}
        initialTab="classes"
      />
    </div>
  );
}

export default ClassManagement;
