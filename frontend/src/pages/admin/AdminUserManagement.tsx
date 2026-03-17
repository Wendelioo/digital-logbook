import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import { StatusBadge } from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingDots from '../../components/LoadingDots';
import {
  UserPlus,
  Edit,
  Trash2,
  Search,
  X,
  Eye,
  EyeOff,
  Plus,
  Upload,
  User,
  Users,
  Settings,
  Archive,
  ArchiveRestore,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import {
  GetUsers,
  GetUsersByType,
  SearchUsers,
  CreateUser,
  UpdateUser,
  DeleteUser,
  GetDepartments,
  ArchiveUser,
  GetArchivedUsers,
  UnarchiveUser,
  ResetPasswordByRole,
  DeactivateTeacher,
  DeleteExpiredDeactivatedUsers,
  GetUsersByActivityStatus,
  ReactivateUser,
} from '../../../wailsjs/go/backend/App';
import { User as UserType, Department } from './types';
import { useAuth } from '../../contexts/AuthContext';

// ── Frontend time-ago helper ─────────────────────────────────────────────────
function timeAgoFE(isoDateStr: string): string {
  const past = new Date(isoDateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 60) return seconds <= 1 ? 'just now' : `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

interface ViewUserDetailsModalProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  departmentName?: string;
}

function ViewUserDetailsModal({ user, isOpen, onClose, departmentName }: ViewUserDetailsModalProps) {
  if (!isOpen || !user) return null;

  const getFullName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''} ${user.last_name}`;
    }
    return user.name;
  };

  const getTitle = () => {
    const role = user.role.replace('_', ' ');
    return role.charAt(0).toUpperCase() + role.slice(1) + ' Details';
  };

  const getUsername = () => {
    return user.employee_id || user.student_id || user.name;
  };

  const getDepartment = () => {
    if (user.role === 'teacher' && departmentName) {
      return departmentName;
    }
    return 'N/A';
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
          <h3 className="text-lg font-semibold text-gray-900">{getTitle()}</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Left Section - Profile Picture */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-black rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {user.photo_url ? (
                  <img
                    src={user.photo_url}
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
                <span className="text-sm text-gray-900 ml-2">{user.contact_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Email:</span>
                <span className="text-sm text-gray-900 ml-2">{user.email || ''}</span>
              </div>
              {user.role === 'teacher' && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">Department:</span>
                  <span className="text-sm text-gray-900 ml-2">{getDepartment()}</span>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-gray-700">Username:</span>
                <span className="text-sm text-gray-900 ml-2">{getUsername()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Close Button */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button
            onClick={onClose}
            variant="secondary"
            icon={<X className="h-4 w-4" />}
          >
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [viewingUser, setViewingUser] = useState<UserType | null>(null);
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    name: '',
    firstName: '',
    middleName: '',
    lastName: '',
    role: 'teacher',
    employeeId: '',
    studentId: '',
    email: '',
    contactNumber: '',
    departmentCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState<UserType[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [deleteExpiredLoading, setDeleteExpiredLoading] = useState(false);

  // Activity-status tabs (Active / Archived / Deactivated / Deleted)
  type ActivityTab = 'active' | 'archived' | 'deactivated' | 'deleted';
  const [activityTab, setActivityTab] = useState<ActivityTab>('active');
  const [activityUsers, setActivityUsers] = useState<UserType[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Excel-like table state: sorting, filtering, selection, pagination
  type SortKey = 'name' | 'role' | 'created';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<SortKey, string>>({
    name: '',
    role: '',
    created: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Pagination state
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const toggleSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDir('asc');
      return key;
    });
  };

  const onFilterChange = (key: SortKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ name: '', role: '', created: '' });
    setCurrentPage(1);
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000); // Hide notification after 5 seconds
  };

  const copySelected = async (rows: UserType[]) => {
    try {
      const header = ['User ID', 'Full Name', 'User Type'];
      const lines = rows.map((u) => {
        const fullName = u.first_name && u.last_name
          ? `${u.last_name}, ${u.first_name}${u.middle_name ? ' ' + u.middle_name : ''}`
          : u.name;
        const loginId = u.employee_id || u.student_id || u.name || '-';
        return [loginId, fullName, u.role.replace('_', ' ')].join('\t');
      });
      const text = [header.join('\t'), ...lines].join('\n');
      await navigator.clipboard.writeText(text);
      alert(`Copied ${rows.length} row(s) to clipboard`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Copy to clipboard failed.');
    }
  };

  const deleteSelected = async (ids: number[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => DeleteUser(id)));
      setSelectedIds(new Set());
      showNotification('success', `${ids.length} user(s) deleted successfully!`);
      loadUsers();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete users. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, [userTypeFilter, searchTerm]); // Reload when filters change

  // Reload activity tab users whenever the selected tab changes
  useEffect(() => {
    loadActivityUsers(activityTab);
  }, [activityTab]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [userTypeFilter, searchTerm, entriesPerPage]);

  const loadDepartments = async () => {
    try {
      const data = await GetDepartments();
      setDepartments(data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const loadUsers = async () => {
    try {
      let data;

      // Use server-side filtering for better performance
      if (searchTerm && userTypeFilter) {
        data = await SearchUsers(searchTerm, userTypeFilter);
      } else if (searchTerm) {
        data = await SearchUsers(searchTerm, '');
      } else if (userTypeFilter) {
        data = await GetUsersByType(userTypeFilter);
      } else {
        data = await GetUsers();
      }

      setUsers(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Unable to load users from server.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedUsers = async () => {
    setArchivedLoading(true);
    try {
      const data = await GetArchivedUsers();
      setArchivedUsers(data || []);
    } catch (error) {
      console.error('Failed to load archived users:', error);
      setArchivedUsers([]);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load archived accounts.';
      showNotification('error', errorMessage);
    } finally {
      setArchivedLoading(false);
    }
  };

  const loadActivityUsers = async (tab: 'active' | 'archived' | 'deactivated' | 'deleted') => {
    setActivityLoading(true);
    try {
      const data = await GetUsersByActivityStatus(tab);
      setActivityUsers(data || []);
    } catch (error) {
      console.error('Failed to load activity users:', error);
      setActivityUsers([]);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load accounts.';
      showNotification('error', errorMessage);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleReactivate = async (user: UserType) => {
    const name = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name;
    if (!confirm(`Reactivate ${name}? Their account will be restored to active status.`)) return;
    try {
      await ReactivateUser(user.id);
      showNotification('success', `${name} has been reactivated.`);
      loadActivityUsers(activityTab);
      loadUsers();
    } catch (error) {
      console.error('Failed to reactivate user:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to reactivate account.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.firstName || !formData.lastName) {
        showNotification('error', 'First Name and Last Name are required');
        return;
      }

      const ID_REGEX = /^\d{7}$/;

      if (formData.role === 'working_student' || formData.role === 'student') {
        if (!formData.studentId) {
          showNotification('error', `Student ID is required for ${formData.role === 'student' ? 'Students' : 'Working Students'}`);
          return;
        }
        if (!ID_REGEX.test(formData.studentId.trim())) {
          showNotification('error', 'Invalid student ID — must be exactly 7 digits (e.g. 2211172)');
          return;
        }
      } else if (formData.role === 'teacher' || formData.role === 'admin') {
        if (!formData.employeeId) {
          showNotification('error', `Employee ID is required for ${formData.role === 'admin' ? 'Admins' : 'Teachers'}`);
          return;
        }
        if (!ID_REGEX.test(formData.employeeId.trim())) {
          showNotification('error', 'Invalid employee ID — must be exactly 7 digits (e.g. 2211172)');
          return;
        }
      }

      const fullName = `${formData.lastName}, ${formData.firstName}${formData.middleName ? ' ' + formData.middleName : ''}`;

      // For new users, password is required
      // For editing, if password is empty, we keep the old password (backend handles this)
      let password_to_pass = formData.password;

      if (!editingUser && !password_to_pass) {
        showNotification('error', 'Password is required for new users');
        return;
      }

      if (!editingUser && formData.password !== formData.confirmPassword) {
        showNotification('error', 'Passwords do not match');
        return;
      }

      const departmentCode = formData.role === 'teacher' ? formData.departmentCode : '';

      if (editingUser) {
        await UpdateUser(editingUser.id, fullName, formData.firstName, formData.middleName, formData.lastName, formData.role, formData.employeeId, formData.studentId, formData.email, formData.contactNumber, departmentCode);
        showNotification('success', 'User updated successfully!');
      } else {
        await CreateUser(password_to_pass, fullName, formData.firstName, formData.middleName, formData.lastName, formData.role, formData.employeeId, formData.studentId, formData.email, formData.contactNumber, departmentCode);

        const roleMessages = {
          'student': 'Student added successfully!',
          'working_student': 'Working student added successfully!',
          'teacher': 'Teacher added successfully!',
          'admin': 'Admin added successfully!'
        };
        const message = roleMessages[formData.role as keyof typeof roleMessages] || 'User added successfully!';
        showNotification('success', message);
      }

      setShowForm(false);
      setEditingUser(null);
      setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', email: '', contactNumber: '', departmentCode: '' });
      setAvatarFile(null);
      setAvatarPreview(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save user. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleEdit = (user: UserType) => {
    setEditingUser(user);
    setFormData({
      password: '',
      confirmPassword: '',
      name: user.name,
      firstName: user.first_name || '',
      middleName: user.middle_name || '',
      lastName: user.last_name || '',
      role: user.role,
      employeeId: user.employee_id || '',
      studentId: user.student_id || '',
      email: user.email || '',
      contactNumber: user.contact_number || '',
      departmentCode: user.department_code || ''
    });
    setAvatarFile(null);
    setAvatarPreview(null);
    setShowForm(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user permanently? This cannot be undone.')) {
      return;
    }
    try {
      await DeleteUser(id);
      showNotification('success', 'User deleted successfully!');
      loadUsers();
      loadActivityUsers(activityTab);
      if (showArchivedModal) {
        loadArchivedUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleArchive = async (user: UserType) => {
    if (user.role === 'teacher') {
      showNotification('error', 'Teacher accounts cannot be archived. Please delete the account instead.');
      return;
    }

    try {
      await ArchiveUser(user.id);
      showNotification('success', 'User archived successfully!');
      loadUsers();
      if (showArchivedModal) {
        loadArchivedUsers();
      }
    } catch (error) {
      console.error('Failed to archive user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive user. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleRestoreArchived = async (id: number) => {
    try {
      await UnarchiveUser(id);
      showNotification('success', 'Archived account restored successfully!');
      loadArchivedUsers();
      loadUsers();
      loadActivityUsers(activityTab);
    } catch (error) {
      console.error('Failed to restore archived user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore account. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleDeleteArchivedUser = async (user: UserType) => {
    const name = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.name;
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    try {
      await DeleteUser(user.id);
      showNotification('success', 'Account deleted permanently.');
      loadArchivedUsers();
      loadUsers();
      loadActivityUsers(activityTab);
    } catch (error) {
      console.error('Failed to delete archived user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleDeleteExpiredDeactivated = async (days: number) => {
    if (!confirm(`Permanently delete all accounts that have been deactivated for more than ${days} days? This cannot be undone.`)) return;
    setDeleteExpiredLoading(true);
    try {
      const count = await DeleteExpiredDeactivatedUsers(days);
      showNotification('success', `${count} expired deactivated account(s) deleted permanently.`);
      loadArchivedUsers();
      loadUsers();
      loadActivityUsers(activityTab);
    } catch (error) {
      console.error('Failed to delete expired deactivated users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete expired accounts. Please try again.';
      showNotification('error', errorMessage);
    } finally {
      setDeleteExpiredLoading(false);
    }
  };

  const handleResetPassword = async (targetUser: UserType) => {
    if (!currentUser) {
      showNotification('error', 'Current session not found. Please login again.');
      return;
    }

    const newPassword = window.prompt(`Set new password for ${targetUser.first_name || targetUser.name}:`);
    if (newPassword === null) return;

    const trimmedPassword = newPassword.trim();
    if (!trimmedPassword) {
      showNotification('error', 'New password is required.');
      return;
    }

    const confirmPassword = window.prompt('Confirm new password:');
    if (confirmPassword === null) return;

    if (trimmedPassword !== confirmPassword.trim()) {
      showNotification('error', 'Passwords do not match.');
      return;
    }

    try {
      await ResetPasswordByRole(currentUser.id, targetUser.id, trimmedPassword);
      showNotification('success', 'Password reset successful.');
    } catch (error) {
      console.error('Failed to reset password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password.';
      showNotification('error', errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  // Derived table data (filters, sort, pagination)
  // Note: userTypeFilter and searchTerm are now handled server-side
  // Build a lookup map from activityUsers (which contains last-login data) keyed by user ID
  const activityByID = new Map(activityUsers.map((u) => [u.id, u]));

  // Only column-specific filters are applied here
  const filteredUsers = users.filter((u) => {
    const inName = u.name.toLowerCase().includes(filters.name.toLowerCase());
    const inRole = u.role.toLowerCase().includes(filters.role.toLowerCase());
    const inCreated = (u.created || '').toLowerCase().includes(filters.created.toLowerCase());
    return inName && inRole && inCreated;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let va: string;
    let vb: string;
    switch (sortKey) {
      case 'name':
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        break;
      case 'role':
        va = a.role.toLowerCase();
        vb = b.role.toLowerCase();
        break;
      case 'created':
        va = a.created.toLowerCase();
        vb = b.created.toLowerCase();
        break;
      default:
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        break;
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Recalculate pagination with simplified approach
  const totalPages = Math.ceil(sortedUsers.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentUsers = sortedUsers.slice(startIndex, endIndex);
  const startEntry = sortedUsers.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, sortedUsers.length);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowForm(true)}
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            ADD NEW
          </Button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className={`bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out animate-slideIn ${
            notification.type === 'success' ? 'border-l-4 border-success-500' : 'border-l-4 border-danger-500'
          }`}>
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <svg className="h-6 w-6 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-success-800' : 'text-danger-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={() => setNotification(null)}
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingUser(null);
          setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', email: '', contactNumber: '', departmentCode: '' });
          setAvatarFile(null);
          setAvatarPreview(null);
        }}
        title={editingUser ? `Edit ${formData.role === 'teacher' ? 'Teacher' : formData.role === 'student' ? 'Student' : 'Working Student'}` : `Add New ${formData.role === 'teacher' ? 'Teacher' : formData.role === 'student' ? 'Student' : 'Working Student'}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Role Selection - Only shown when adding new user */}
          {!editingUser && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">User Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'teacher', label: 'Teacher' },
                  { value: 'working_student', label: 'Working Student' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: option.value })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.role === option.value
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-gray-300 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${
                      formData.role === option.value ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Personal Information</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account Information</label>
            <div className="grid grid-cols-2 gap-3">
              {formData.role === 'teacher' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    value={formData.departmentCode}
                    onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Department</option>
                    {departments.filter(dept => dept.is_active).map(dept => (
                      <option key={dept.department_code} value={dept.department_code}>
                        {dept.department_code} - {dept.department_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username {formData.role === 'teacher' ? '(Employee ID)' : '(Student ID)'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role === 'teacher' ? formData.employeeId : formData.studentId}
                  onChange={(e) => {
                    if (formData.role === 'teacher') {
                      setFormData({ ...formData, employeeId: e.target.value, password: e.target.value });
                    } else {
                      setFormData({ ...formData, studentId: e.target.value, password: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 text-sm pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Photo Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profile Photo</label>
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-lg bg-gray-100 border-2 border-gray-300 border-dashed flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-16 w-16 text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Photo
                </label>
                <p className="mt-2 text-sm text-gray-500">
                  {avatarFile ? avatarFile.name : 'No file selected'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingUser(null);
                setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', email: '', contactNumber: '', departmentCode: '' });
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
              className="px-5 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
            >
              {editingUser ? (
                <>
                  <Edit className="h-4 w-4" />
                  <span>Update User</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* View User Details Modal */}
      <ViewUserDetailsModal
        user={viewingUser}
        isOpen={!!viewingUser}
        onClose={() => setViewingUser(null)}
        departmentName={undefined}
      />

      <Modal
        isOpen={showArchivedModal}
        onClose={() => setShowArchivedModal(false)}
        title="Archive"
        size="2xl"
      >
        {archivedLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
          </div>
        ) : archivedUsers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No archived accounts found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>Permanently delete accounts deactivated for:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteExpiredDeactivated(30)}
                disabled={deleteExpiredLoading}
              >
                {deleteExpiredLoading ? '…' : '30+ days'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteExpiredDeactivated(365)}
                disabled={deleteExpiredLoading}
              >
                365+ days
              </Button>
            </div>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '220px' }}>Full Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '130px' }}>Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '150px' }}>Archived Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.employee_id || user.student_id || user.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900" style={{ wordBreak: 'break-word' }}>
                      {user.first_name && user.last_name
                        ? `${user.last_name}, ${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''}`
                        : user.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{user.role.replace('_', ' ')}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{user.created || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => handleRestoreArchived(user.id)}
                          variant="success"
                          size="sm"
                          className="h-9 w-9 px-0 py-0"
                          icon={<ArchiveRestore className="h-4 w-4" />}
                          title="Restore"
                        />
                        <Button
                          onClick={() => handleDeleteArchivedUser(user)}
                          variant="danger"
                          size="sm"
                          className="h-9 w-9 px-0 py-0"
                          icon={<Trash2 className="h-4 w-4" />}
                          title="Delete permanently"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </div>
        )}
      </Modal>

      {/* ── Activity Status Tabs ─────────────────────────────────────────────── */}
      <div className="mt-6 mb-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-1" aria-label="Account status tabs">
            {(
              [
                { key: 'active',      label: 'Active',      icon: <UserCheck className="h-4 w-4" />,  color: 'text-green-600',  border: 'border-green-500'  },
                { key: 'archived',    label: 'Archived',    icon: <Archive className="h-4 w-4" />,    color: 'text-yellow-600', border: 'border-yellow-500' },
                { key: 'deactivated', label: 'Deactivated', icon: <UserX className="h-4 w-4" />,      color: 'text-orange-600', border: 'border-orange-500' },
                { key: 'deleted',     label: 'Pending Deletion', icon: <Trash2 className="h-4 w-4" />, color: 'text-red-600',  border: 'border-red-500'    },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivityTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
                  ${activityTab === tab.key
                    ? `${tab.border} ${tab.color} bg-white`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab description */}
        <div className="mt-2 mb-4 text-xs text-gray-500">
          {activityTab === 'active' && (
            <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-green-500" /> Currently active accounts — last login within the past 6 months.</span>
          )}
          {activityTab === 'archived' && (
            <span className="flex items-center gap-1"><Archive className="h-3.5 w-3.5 text-yellow-500" /> Manually archived accounts. Restore to allow login again.</span>
          )}
          {activityTab === 'deactivated' && (
            <span className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-orange-500" /> Auto-deactivated after 6+ months of inactivity — only admin can reactivate. Accounts deactivated for 4+ years are flagged for deletion.</span>
          )}
          {activityTab === 'deleted' && (
            <span className="flex items-center gap-1"><Trash2 className="h-3.5 w-3.5 text-red-500" /> Accounts inactive for 4+ years — pending permanent deletion. Admin can still restore them or remove them now.</span>
          )}
        </div>

        {/* Activity users table — only shown for non-active tabs */}
        {activityTab !== 'active' && (activityLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
          </div>
        ) : activityUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow border border-gray-100 py-10 text-center text-gray-500">
            <p className="text-sm font-medium">
              No {activityTab} accounts found.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              When accounts become {activityTab === 'deactivated' ? 'inactive' : activityTab === 'deleted' ? 'eligible for deletion' : activityTab},
              they will appear in this list.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last Login</span>
                    </th>
                    {activityTab === 'deactivated' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deactivated</th>
                    )}
                    {activityTab === 'deleted' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flagged For Deletion</th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activityUsers.map((user) => {
                    const displayId = user.employee_id || user.student_id || user.name || '-';
                    const fullName = user.first_name && user.last_name
                      ? `${user.last_name}, ${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''}`
                      : user.name;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{displayId}</td>
                        <td className="px-4 py-3 text-gray-800">{fullName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                            ${user.role === 'teacher' ? 'bg-blue-100 text-blue-700'
                              : user.role === 'admin' ? 'bg-purple-100 text-purple-700'
                              : user.role === 'working_student' ? 'bg-teal-100 text-teal-700'
                              : 'bg-green-100 text-green-700'}`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${
                            !user.last_login_ago || user.last_login_ago === 'Never logged in'
                              ? 'text-gray-400 italic'
                              : 'text-gray-700'
                          }`}>
                            {user.last_login_ago || 'Never logged in'}
                          </span>
                          {user.last_login_at && (
                            <div className="text-xs text-gray-400 mt-0.5">{user.last_login_at}</div>
                          )}
                        </td>
                        {activityTab === 'deactivated' && (
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                            {user.deactivated_at
                              ? <><div className="font-medium text-orange-600">{timeAgoFE(user.deactivated_at)}</div><div className="text-gray-400">{user.deactivated_at}</div></>
                              : '-'}
                          </td>
                        )}
                        {activityTab === 'deleted' && (
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                            {user.deleted_at
                              ? <><div className="font-medium text-red-600">{timeAgoFE(user.deleted_at)}</div><div className="text-gray-400">{user.deleted_at}</div></>
                              : '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Archived tab actions */}
                            {activityTab === 'archived' && (
                              <>
                                <Button onClick={() => handleRestoreArchived(user.id)} variant="success" size="sm" icon={<ArchiveRestore className="h-3 w-3" />} title="Restore" />
                                <Button onClick={() => handleDeleteArchivedUser(user)} variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} title="Delete permanently" />
                              </>
                            )}
                            {/* Deactivated tab actions */}
                            {activityTab === 'deactivated' && (
                              <>
                                <Button onClick={() => handleReactivate(user)} variant="success" size="sm" icon={<UserCheck className="h-3 w-3" />} title="Reactivate account" >
                                  Reactivate
                                </Button>
                                <Button onClick={() => handleDelete(user.id)} variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} title="Permanently delete" />
                              </>
                            )}
                            {/* Deleted (pending deletion) tab actions */}
                            {activityTab === 'deleted' && (
                              <>
                                <Button onClick={() => handleReactivate(user)} variant="success" size="sm" icon={<UserCheck className="h-3 w-3" />} title="Restore account" >
                                  Restore
                                </Button>
                                <Button
                                  onClick={async () => {
                                    const name = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name;
                                    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
                                    try { await DeleteUser(user.id); showNotification('success', 'Account permanently deleted.'); loadActivityUsers(activityTab); }
                                    catch (error) { showNotification('error', error instanceof Error ? error.message : 'Failed to delete.'); }
                                  }}
                                  variant="danger" size="sm" icon={<Trash2 className="h-3 w-3" />} title="Delete permanently"
                                >
                                  Delete Now
                                </Button>
                              </>
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
        ))}
      </div>

      {/* ── Active Users Table (full table with search/filter/pagination) ─── */}
      {activityTab === 'active' && (
        <>
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Show <select
                  value={entriesPerPage}
                  onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-300 rounded px-2 py-1 mx-1"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select> entries
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Users</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="working_student">Working Student</option>
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table
                columns={[
                  {
                    key: 'user_id',
                    label: 'User ID',
                    render: (user: UserType) => user.employee_id || user.student_id || user.name || '-'
                  },
                  {
                    key: 'name',
                    label: 'Full Name',
                    sortable: true,
                    render: (user: UserType) => user.first_name && user.last_name
                      ? `${user.last_name}, ${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''}`
                      : user.name
                  },
                  {
                    key: 'role',
                    label: 'User Type',
                    sortable: true,
                    render: (user: UserType) => (
                      <StatusBadge
                        status={user.role === 'teacher' ? 'success' : user.role === 'student' ? 'active' : 'pending'}
                        label={user.role.replace('_', ' ')}
                      />
                    )
                  },
                  {
                    key: 'last_login',
                    label: 'Last Login',
                    render: (user: UserType) => {
                      const info = activityByID.get(user.id);
                      const ago = info?.last_login_ago;
                      const at = info?.last_login_at;
                      if (!ago || ago === 'Never logged in') {
                        return <span className="text-gray-400 italic text-xs">Never logged in</span>;
                      }
                      return (
                        <span>
                          <span className="font-medium text-gray-700 text-sm">{ago}</span>
                          {at && <div className="text-xs text-gray-400 mt-0.5">{at}</div>}
                        </span>
                      );
                    }
                  },
                  {
                    key: 'action',
                    label: 'Action',
                    render: (user: UserType) => (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setViewingUser(user)}
                          variant="outline"
                          size="sm"
                          icon={<Eye className="h-3 w-3" />}
                          title="View"
                        />
                        <Button
                          onClick={() => handleEdit(user)}
                          variant="primary"
                          size="sm"
                          icon={<Edit className="h-3 w-3" />}
                          title="Edit"
                        />
                        {user.role !== 'admin' && (
                          <Button
                            onClick={() => handleResetPassword(user)}
                            variant="outline"
                            size="sm"
                            icon={<Settings className="h-3 w-3" />}
                            title="Reset Password"
                          />
                        )}
                        {user.role === 'teacher' ? (
                          <Button
                            onClick={async () => {
                              if (!confirm('Deactivate this teacher account? It will become inactive but remain for records and can be restored within 30 days.')) {
                                return;
                              }
                              try {
                                await DeactivateTeacher(user.id);
                                showNotification('success', 'Teacher account deactivated.');
                                loadUsers();
                              } catch (error) {
                                console.error('Failed to deactivate teacher:', error);
                                const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate teacher account. Please try again.';
                                showNotification('error', errorMessage);
                              }
                            }}
                            variant="outline"
                            size="sm"
                            icon={<Archive className="h-3 w-3" />}
                            title="Deactivate"
                          />
                        ) : user.role !== 'admin' ? (
                          <Button
                            onClick={() => handleArchive(user)}
                            variant="outline"
                            size="sm"
                            icon={<Archive className="h-3 w-3" />}
                            title="Archive"
                          />
                        ) : null}
                      </div>
                    )
                  }
                ]}
                data={currentUsers}
                loading={loading}
                emptyMessage="No users found"
              />
            </div>
            {currentUsers.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="text-sm text-gray-600">
                  Showing {startEntry} to {endEntry} of {sortedUsers.length} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      variant={currentPage === pageNum ? "primary" : "outline"}
                      size="sm"
                    >
                      {pageNum}
                    </Button>
                  ))}
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
          </div>
        </>
      )}
    </div>
  );
}

export default UserManagement;

