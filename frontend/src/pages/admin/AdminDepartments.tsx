import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import { ArchiveIcon, ArchiveRestoreIcon } from '../../components/icons/ArchiveIcons';
import {
  Plus,
  Edit,
  Search,
  X,
  AlertCircle
} from 'lucide-react';
import {
  GetDepartments,
  CreateDepartment,
  UpdateDepartment
} from '../../../wailsjs/go/backend/App';
import { Department } from './types';

function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [archivedSearchTerm, setArchivedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDeptForStatus, setSelectedDeptForStatus] = useState<{ code: string; name: string; currentStatus: boolean; newStatus: boolean; actionContext?: 'status' | 'unarchive' } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [formData, setFormData] = useState({
    departmentCode: '',
    departmentName: '',
    isActive: true
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await GetDepartments();
      setDepartments(data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.departmentCode || !formData.departmentName) {
        showNotification('error', 'Department Code and Name are required');
        return;
      }

      if (editingDepartment) {
        await UpdateDepartment(editingDepartment.department_code, formData.departmentCode, formData.departmentName, '', formData.isActive);
        showNotification('success', 'Department updated successfully!');
      } else {
        await CreateDepartment(formData.departmentCode, formData.departmentName, '');
        showNotification('success', 'Department added successfully!');
      }

      setShowForm(false);
      setEditingDepartment(null);
      setFormData({ departmentCode: '', departmentName: '', isActive: true });
      loadDepartments();
    } catch (error) {
      console.error('Failed to save department:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save department. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      departmentCode: department.department_code,
      departmentName: department.department_name,
      isActive: department.is_active
    });
    setShowForm(true);
  };

  const handleStatusChange = (
    deptCode: string,
    deptName: string,
    currentStatus: boolean,
    newStatus: boolean,
    actionContext: 'status' | 'unarchive' = 'status'
  ) => {
    if (currentStatus === newStatus) return;
    
    setSelectedDeptForStatus({ code: deptCode, name: deptName, currentStatus, newStatus, actionContext });
    setShowStatusModal(true);
  };

  const handleArchiveDepartment = (dept: Department) => {
    if (dept.is_active) {
      showNotification('error', 'Only inactive departments can be archived. Set the status to inactive first.');
      return;
    }

    showNotification('success', 'Department archived successfully.');
  };

  const confirmStatusChange = async () => {
    if (!selectedDeptForStatus) return;

    setChangingStatus(true);
    try {
      // Update department with new status (keeping the same code, name, and description)
      const dept = departments.find(d => d.department_code === selectedDeptForStatus.code);
      if (!dept) {
        throw new Error('Department not found');
      }
      
      await UpdateDepartment(
        dept.department_code,
        dept.department_code,
        dept.department_name,
        dept.description || '',
        selectedDeptForStatus.newStatus
      );
      
      const isUnarchiveAction = selectedDeptForStatus.actionContext === 'unarchive' && selectedDeptForStatus.newStatus;
      showNotification('success', `Department ${isUnarchiveAction ? 'unarchived' : selectedDeptForStatus.newStatus ? 'activated' : 'deactivated'} successfully!`);
      await loadDepartments();
      setShowStatusModal(false);
      setSelectedDeptForStatus(null);
    } catch (error) {
      console.error('Failed to change department status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to change department status. Please try again.';
      showNotification('error', errorMessage);
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  const searchedDepartments = departments.filter((dept) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      dept.department_code.toLowerCase().includes(searchLower) ||
      dept.department_name.toLowerCase().includes(searchLower) ||
      (dept.description && dept.description.toLowerCase().includes(searchLower))
    );
  });

  const archivedDepartments = departments.filter((dept) => !dept.is_active);
  const filteredArchivedDepartments = archivedDepartments.filter((dept) => {
    const q = archivedSearchTerm.toLowerCase();
    return (
      dept.department_code.toLowerCase().includes(q) ||
      dept.department_name.toLowerCase().includes(q) ||
      (dept.description && dept.description.toLowerCase().includes(q))
    );
  });

  // Pagination
  const total = searchedDepartments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pagedDepartments = searchedDepartments.slice(startIndex, endIndex);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowArchivedModal(true)}
            variant="outline"
            icon={<ArchiveIcon size="md" />}
          >
            Archived
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            variant="primary"
            icon={<Plus className="w-5 h-5" />}
          >
            Add Department
          </Button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
          }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setNotification(null)}
                >
                  <span className="sr-only">Close</span>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Controls */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Show</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <label className="text-sm text-gray-700">entries</label>
          </div>
          <div className="flex-1 max-w-xs relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Department Form Modal */}
      {showForm && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingDepartment(null);
              setFormData({ departmentCode: '', departmentName: '', isActive: true });
            }
          }}
        >
          <div className="modal-surface w-full max-w-2xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingDepartment(null);
                setFormData({ departmentCode: '', departmentName: '', isActive: true });
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            {/* Header */}
            <div className="text-center p-4 sm:p-8 pb-3 sm:pb-4 flex-shrink-0">
              <h3 className="text-2xl font-bold text-blue-600 mb-2">
                {editingDepartment ? 'Edit Department' : 'Add Department'}
              </h3>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto px-4 sm:px-8 pb-4 sm:pb-8 flex-1" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department Code *</label>
                  <input
                    type="text"
                    value={formData.departmentCode}
                    onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!!editingDepartment}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department Name *</label>
                  <input
                    type="text"
                    value={formData.departmentName}
                    onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              {/* Status Toggle - Only show when editing */}
              {editingDepartment && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      formData.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium ${formData.isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <div className="text-center">
                <Button
                  type="submit"
                  variant="danger"
                  className="w-full max-w-xs"
                >
                  {editingDepartment ? 'UPDATE' : 'SUBMIT'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departments Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedDepartments.map((dept, index) => (
                <tr key={dept.department_code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dept.department_code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {dept.description || dept.department_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={dept.is_active ? 'active' : 'inactive'}
                      onChange={(e) => handleStatusChange(dept.department_code, dept.department_name, dept.is_active, e.target.value === 'active')}
                      className={`px-3 py-1 border rounded-md text-xs font-medium focus:outline-none focus:ring-2 ${
                        dept.is_active 
                          ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500'
                          : 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500'
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleEdit(dept)}
                        variant="primary"
                        size="sm"
                        icon={<Edit className="h-3 w-3" />}
                        title="Edit"
                      />
                      <Button
                        onClick={() => handleArchiveDepartment(dept)}
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 px-0 py-0"
                        disabled={dept.is_active}
                        icon={<ArchiveIcon size="xs" />}
                        title="Archive"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {pagedDepartments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500 font-medium">No departments found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium">{total === 0 ? 0 : startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{total}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <Button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                variant={currentPage === pageNum ? 'primary' : 'outline'}
                size="sm"
              >
                {pageNum}
              </Button>
            ))}
            <Button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Archived Departments Modal */}
      {showArchivedModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowArchivedModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-5xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArchiveIcon size="md" className="text-gray-700" />
                <h3 className="text-base font-semibold text-gray-900 tracking-tight">Archived Departments</h3>
                <span className="text-sm text-gray-500">({archivedDepartments.length})</span>
              </div>
              <button
                onClick={() => setShowArchivedModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
                type="button"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={archivedSearchTerm}
                  onChange={(e) => setArchivedSearchTerm(e.target.value)}
                  placeholder="Search archived departments"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {archivedSearchTerm && (
                  <button
                    onClick={() => setArchivedSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-h-[min(480px,72vh)] min-w-0">
              <div className="h-full min-h-[inherit] overflow-x-auto overflow-y-auto">
                <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                  <thead className="bg-gradient-to-r from-gray-50 via-primary-50/30 to-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '220px' }}>
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '300px' }}>
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredArchivedDepartments.map((dept, idx) => (
                      <tr
                        key={dept.department_code}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-primary-50/40 transition-colors`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                          <div className="font-medium text-gray-900">{dept.department_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{dept.department_code}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                          {dept.description || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button
                            onClick={() => handleStatusChange(dept.department_code, dept.department_name, dept.is_active, true, 'unarchive')}
                            variant="success"
                            size="sm"
                            className="h-9 w-9 px-0 py-0"
                            icon={<ArchiveRestoreIcon size="xs" />}
                            title="Unarchive"
                          />
                        </td>
                      </tr>
                    ))}
                    {filteredArchivedDepartments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <p className="text-gray-500 font-medium">No archived departments found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusModal && selectedDeptForStatus && (
        <div className="modal-backdrop">
          <div className="modal-surface w-full max-w-md mx-2 sm:mx-4 p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedDeptForStatus.newStatus ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <AlertCircle className={`h-6 w-6 ${
                    selectedDeptForStatus.newStatus ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Change Department Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedDeptForStatus(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Department: <strong>{selectedDeptForStatus.name}</strong>
              </p>
              {selectedDeptForStatus.newStatus ? (
                <>
                  <p className="text-gray-700 mb-3">
                    You are about to <strong className="text-green-600">{selectedDeptForStatus.actionContext === 'unarchive' ? 'unarchive' : 'activate'}</strong> this department.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <h4 className="font-semibold text-green-800 mb-2">{selectedDeptForStatus.actionContext === 'unarchive' ? 'Changes when unarchived:' : 'Changes when activated:'}</h4>
                    <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                      <li>Department will be available for new user assignments</li>
                      <li>Classes can be created under this department</li>
                      <li>Department will appear in all active listings</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-700 mb-3">
                    You are about to <strong className="text-red-600">deactivate</strong> this department.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <h4 className="font-semibold text-red-800 mb-2">Restrictions when inactive:</h4>
                    <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                      <li>New users <strong>cannot be assigned</strong> to this department</li>
                      <li>New classes <strong>cannot be created</strong> under this department</li>
                      <li>Existing data remains viewable</li>
                      <li>Department will be hidden from active selections</li>
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
                  setSelectedDeptForStatus(null);
                }}
                variant="outline"
                disabled={changingStatus}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                variant={selectedDeptForStatus.newStatus ? 'success' : 'danger'}
                disabled={changingStatus}
              >
                {changingStatus ? 'Changing...' : selectedDeptForStatus.newStatus ? (selectedDeptForStatus.actionContext === 'unarchive' ? 'Unarchive Department' : 'Activate Department') : 'Deactivate Department'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentManagement;
