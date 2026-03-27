import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import { StatusBadge } from '../../components/Badge';
import Modal, { MODAL_BODY_MIN_HEIGHT_CLASS } from '../../components/Modal';
import { ArchiveIcon, ArchiveRestoreIcon } from '../../components/icons/ArchiveIcons';
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
  UserCheck,
  UserX,
  Clock,
  GraduationCap,
  Wrench,
} from 'lucide-react';
import {
  GetUsers,
  GetUsersByType,
  CreateUser,
  UpdateUser,
  GetDepartments,
  ArchiveUser,
  GetArchivedUsers,
  UnarchiveUser,
  ResetPasswordByRole,
  DeactivateTeacher,
  GetUsersByActivityStatus,
  ReactivateUser,
} from '../../../wailsjs/go/backend/App';
import { User as UserType, Department } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useAppUi } from '../../contexts/AppUiContext';

const INITIAL_USER_FORM = {
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
  departmentCode: '',
};

function validateStrongPasswordClient(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Include at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Include at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Include at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Include at least one special character.';
  return null;
}

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
    if ((user.role === 'teacher' || user.role === 'student' || user.role === 'working_student') && departmentName) {
      return departmentName;
    }
    return 'N/A';
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-surface w-full max-w-2xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-primary-200/80 flex items-center gap-2 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
          <Eye className="h-5 w-5 text-primary-600" strokeWidth={1.75} />
          <h3 className="text-lg font-semibold text-gray-900">{getTitle()}</h3>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex justify-end">
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
  const { confirm } = useAppUi();
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
  const [formData, setFormData] = useState(() => ({ ...INITIAL_USER_FORM }));
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState<UserType[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

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
  // Pagination state
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserType | null>(null);
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminResetPasswordConfirm, setAdminResetPasswordConfirm] = useState('');
  const [showAdminResetPassword, setShowAdminResetPassword] = useState(false);
  const [showAdminResetPasswordConfirm, setShowAdminResetPasswordConfirm] = useState(false);
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

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

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000); // Hide notification after 5 seconds
  };

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, [userTypeFilter]); // Reload when user type changes

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

      // Keep user-type filtering server-side; search is handled client-side.
      if (userTypeFilter) {
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

  const loadArchivedUsers = async (opts?: { silent?: boolean }) => {
    setArchivedLoading(true);
    try {
      const data = await GetArchivedUsers();
      setArchivedUsers(data || []);
    } catch (error) {
      console.error('Failed to load archived users:', error);
      setArchivedUsers([]);
      if (!opts?.silent) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load archived accounts.';
        showNotification('error', errorMessage);
      }
    } finally {
      setArchivedLoading(false);
    }
  };

  const loadActivityUsers = async (
    tab: 'active' | 'archived' | 'deactivated' | 'deleted',
    opts?: { silent?: boolean }
  ) => {
    setActivityLoading(true);
    try {
      const data = await GetUsersByActivityStatus(tab);
      setActivityUsers(data || []);
    } catch (error) {
      console.error('Failed to load activity users:', error);
      setActivityUsers([]);
      if (!opts?.silent) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load accounts.';
        showNotification('error', errorMessage);
      }
    } finally {
      setActivityLoading(false);
    }
  };

  const handleReactivate = async (user: UserType) => {
    const name = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name;
    const ok = await confirm({
      title: 'Reactivate account',
      message: `Reactivate ${name}? Their account will be restored to active status.`,
      variant: 'default',
      confirmLabel: 'Reactivate',
    });
    if (!ok) return;
    try {
      await ReactivateUser(user.id);
      showNotification('success', `${name} has been reactivated.`);
      loadActivityUsers(activityTab, { silent: true });
      loadUsers();
    } catch (error) {
      console.error('Failed to reactivate user:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to reactivate account.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
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

      if ((formData.role === 'student' || formData.role === 'working_student') && !formData.departmentCode) {
        showNotification('error', 'Department is required for students and working students');
        return;
      }

      // Password is only collected in the add-user flow; use Change password in the row actions to reset.
      let password_to_pass = formData.password;

      if (!editingUser && !password_to_pass) {
        showNotification('error', 'Password is required for new users');
        return;
      }

      if (!editingUser && formData.password !== formData.confirmPassword) {
        showNotification('error', 'Passwords do not match');
        return;
      }

      if (!editingUser && password_to_pass) {
        const pwErr = validateStrongPasswordClient(password_to_pass);
        if (pwErr) {
          showNotification('error', pwErr);
          return;
        }
      }

      const departmentCode = (formData.role === 'teacher' || formData.role === 'student' || formData.role === 'working_student')
        ? formData.departmentCode
        : '';

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
      setFormData({ ...INITIAL_USER_FORM });
      setAvatarFile(null);
      setAvatarPreview(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save user. Please try again.';
      showNotification('error', errorMessage);
    } finally {
      setFormSubmitting(false);
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
        loadArchivedUsers({ silent: true });
      }
    } catch (error) {
      console.error('Failed to archive user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive user. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleUnarchiveUser = async (id: number) => {
    try {
      await UnarchiveUser(id);
      showNotification('success', 'Account unarchived successfully!');
      loadArchivedUsers({ silent: true });
      loadUsers();
      loadActivityUsers(activityTab, { silent: true });
    } catch (error) {
      console.error('Failed to unarchive user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to unarchive account. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const openResetPasswordModal = (targetUser: UserType) => {
    if (!currentUser) {
      showNotification('error', 'Current session not found. Please login again.');
      return;
    }
    setResetPasswordUser(targetUser);
    setAdminResetPassword('');
    setAdminResetPasswordConfirm('');
    setShowAdminResetPassword(false);
    setShowAdminResetPasswordConfirm(false);
  };

  const closeResetPasswordModal = () => {
    setResetPasswordUser(null);
    setAdminResetPassword('');
    setAdminResetPasswordConfirm('');
    setResetPasswordSubmitting(false);
  };

  const submitAdminResetPassword = async () => {
    if (!currentUser || !resetPasswordUser) return;

    const trimmedPassword = adminResetPassword.trim();
    if (!trimmedPassword) {
      showNotification('error', 'New password is required.');
      return;
    }

    const policyError = validateStrongPasswordClient(trimmedPassword);
    if (policyError) {
      showNotification('error', policyError);
      return;
    }

    if (trimmedPassword !== adminResetPasswordConfirm.trim()) {
      showNotification('error', 'Passwords do not match.');
      return;
    }

    setResetPasswordSubmitting(true);
    try {
      await ResetPasswordByRole(currentUser.id, resetPasswordUser.id, trimmedPassword);
      showNotification('success', 'Password reset successful.');
      closeResetPasswordModal();
    } catch (error) {
      console.error('Failed to reset password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password.';
      showNotification('error', errorMessage);
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  // Derived table data (search, column filters, sort, pagination)
  // Build a lookup map from activityUsers (which contains last-login data) keyed by user ID
  const activityByID = new Map(activityUsers.map((u) => [u.id, u]));

  // Global search + column-specific filters are applied client-side.
  const filteredUsers = users.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    const searchable = [
      u.name,
      u.first_name,
      u.middle_name,
      u.last_name,
      u.employee_id,
      u.student_id,
      u.email,
      u.contact_number,
      u.role,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const inSearch = !q || searchable.includes(q);
    const inName = u.name.toLowerCase().includes(filters.name.toLowerCase());
    const inRole = u.role.toLowerCase().includes(filters.role.toLowerCase());
    const inCreated = (u.created || '').toLowerCase().includes(filters.created.toLowerCase());
    return inSearch && inName && inRole && inCreated;
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
        <div className="fixed top-4 right-4 z-50 w-[min(100vw-2rem,22rem)] sm:w-[min(100vw-2rem,26rem)] max-w-md">
          <div
            className={`relative bg-white shadow-lg rounded-xl pointer-events-auto ring-1 ring-primary-900/8 transform transition-all duration-300 ease-in-out animate-slideIn ${
              notification.type === 'success' ? 'border-l-4 border-success-500' : 'border-l-4 border-danger-500'
            }`}
          >
            <button
              type="button"
              className="absolute top-3 right-3 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0"
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <div className="p-4 pr-11">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
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
                <p
                  className={`text-sm font-medium leading-snug break-words min-w-0 flex-1 ${
                    notification.type === 'success' ? 'text-success-800' : 'text-danger-800'
                  }`}
                >
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          if (formSubmitting) return;
          setShowForm(false);
          setEditingUser(null);
          setFormData({ ...INITIAL_USER_FORM });
          setAvatarFile(null);
          setAvatarPreview(null);
          setShowPassword(false);
          setShowConfirmPassword(false);
        }}
        title={editingUser ? 'Edit user' : 'Add user'}
        size="xl"
        showVariantIcon={false}
        contentMinHeightClassName="min-h-[min(380px,65vh)]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={formSubmitting}
              onClick={() => {
                setShowForm(false);
                setEditingUser(null);
                setFormData({ ...INITIAL_USER_FORM });
                setAvatarFile(null);
                setAvatarPreview(null);
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="admin-user-form"
              variant="primary"
              size="md"
              loading={formSubmitting}
              icon={editingUser ? <Edit className="h-4 w-4" strokeWidth={1.75} /> : <UserPlus className="h-4 w-4" strokeWidth={1.75} />}
            >
              {editingUser ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      >
        <form id="admin-user-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          {!editingUser && (
            <p className="text-sm text-gray-600 -mt-1">
              New account type:{' '}
              <span className="font-semibold text-gray-900">
                {formData.role === 'teacher' ? 'Teacher' : formData.role === 'student' ? 'Student' : 'Working student'}
              </span>
            </p>
          )}

          {!editingUser && (
            <div className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 sm:p-5">
              <p className="label mb-3">Account type</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    { value: 'teacher', label: 'Teacher', hint: 'Faculty', Icon: Users },
                    { value: 'student', label: 'Student', hint: 'Learner', Icon: GraduationCap },
                    { value: 'working_student', label: 'Working student', hint: 'Lab assistant', Icon: Wrench },
                  ] as const
                ).map(({ value, label, hint, Icon }) => {
                  const selected = formData.role === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: value })}
                      className={`flex flex-col items-start gap-1 rounded-xl border-2 px-3.5 py-3 text-left transition-all ${
                        selected
                          ? 'border-primary-500 bg-primary-50/80 shadow-sm ring-1 ring-primary-200'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${selected ? 'text-primary-600' : 'text-gray-400'}`}
                        strokeWidth={1.75}
                      />
                      <span className={`text-sm font-semibold ${selected ? 'text-primary-900' : 'text-gray-800'}`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-500 leading-tight">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-soft space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Personal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="user-first-name">
                  First name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="user-first-name"
                  type="text"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="user-middle-name">
                  Middle name
                </label>
                <input
                  id="user-middle-name"
                  type="text"
                  autoComplete="additional-name"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-last-name">
                  Last name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="user-last-name"
                  type="text"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="user-contact">
                  Contact number
                </label>
                <input
                  id="user-contact"
                  type="tel"
                  autoComplete="tel"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-soft space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account & sign-in</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(formData.role === 'teacher' || formData.role === 'student' || formData.role === 'working_student') && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="user-department">
                    Department{' '}
                    {(formData.role === 'student' || formData.role === 'working_student') && (
                      <span className="text-danger-500">*</span>
                    )}
                  </label>
                  <select
                    id="user-department"
                    value={formData.departmentCode}
                    onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value })}
                    className="select"
                    required={formData.role === 'student' || formData.role === 'working_student'}
                  >
                    <option value="">Select department</option>
                    {departments.filter((dept) => dept.is_active).map((dept) => (
                      <option key={dept.department_code} value={dept.department_code}>
                        {dept.department_code} — {dept.department_name}
                      </option>
                    ))}
                  </select>
                  {formData.role === 'teacher' && (
                    <p className="mt-1.5 text-xs text-gray-500">Optional for teachers; required for students and working students.</p>
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label" htmlFor="user-email">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="user-email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2 sm:max-w-md">
                <label className="label" htmlFor="user-login-id">
                  {formData.role === 'teacher' ? 'Employee ID' : 'Student ID'}{' '}
                  <span className="text-danger-500">*</span>
                </label>
                <input
                  id="user-login-id"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={7}
                  placeholder="7 digits"
                  value={formData.role === 'teacher' ? formData.employeeId : formData.studentId}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 7);
                    if (formData.role === 'teacher') {
                      setFormData((prev) =>
                        editingUser
                          ? { ...prev, employeeId: v }
                          : { ...prev, employeeId: v, password: v }
                      );
                    } else {
                      setFormData((prev) =>
                        editingUser
                          ? { ...prev, studentId: v }
                          : { ...prev, studentId: v, password: v }
                      );
                    }
                  }}
                  className="input font-mono tabular-nums"
                  required
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Exactly 7 digits.
                  {!editingUser && (
                    <> For new users, the initial password is set to this value until you enter a different password below.</>
                  )}
                </p>
              </div>

              {!editingUser && (
                <>
                  <div className="sm:col-span-2 rounded-lg border border-primary-100 bg-primary-50/50 px-3 py-2.5">
                    <p className="text-xs font-medium text-gray-800">Password requirements</p>
                    <ul className="mt-1.5 text-xs text-gray-600 list-disc list-inside space-y-0.5">
                      <li>At least 8 characters</li>
                      <li>Uppercase, lowercase, number, and special character</li>
                    </ul>
                  </div>

                  <div>
                    <label className="label" htmlFor="user-password">
                      Password <span className="text-danger-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="user-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="input pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="user-password-confirm">
                      Confirm password <span className="text-danger-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="user-password-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="input pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-soft">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Profile photo</h3>
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden ring-1 ring-gray-100">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-14 w-14 text-gray-300" strokeWidth={1.25} />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <label htmlFor="avatar-upload">
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
                    <Upload className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
                    Choose image
                  </span>
                </label>
                <p className="mt-2 text-xs text-gray-500 truncate">
                  {avatarFile ? avatarFile.name : 'PNG or JPG recommended.'}
                </p>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!resetPasswordUser}
        onClose={closeResetPasswordModal}
        title={
          resetPasswordUser
            ? `Reset password — ${resetPasswordUser.first_name || resetPasswordUser.name}`
            : 'Reset password'
        }
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeResetPasswordModal} disabled={resetPasswordSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitAdminResetPassword} disabled={resetPasswordSubmitting}>
              {resetPasswordSubmitting ? 'Saving…' : 'Save password'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose a strong password. It must be at least 8 characters and include uppercase, lowercase, a number, and a
            special character.
          </p>
          <div>
            <label className="label" htmlFor="admin-reset-password">
              New password
            </label>
            <div className="relative">
              <input
                id="admin-reset-password"
                type={showAdminResetPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={adminResetPassword}
                onChange={(e) => setAdminResetPassword(e.target.value)}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAdminResetPassword(!showAdminResetPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label={showAdminResetPassword ? 'Hide password' : 'Show password'}
              >
                {showAdminResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="admin-reset-password-confirm">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="admin-reset-password-confirm"
                type={showAdminResetPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={adminResetPasswordConfirm}
                onChange={(e) => setAdminResetPasswordConfirm(e.target.value)}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAdminResetPasswordConfirm(!showAdminResetPasswordConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label={showAdminResetPasswordConfirm ? 'Hide password' : 'Show password'}
              >
                {showAdminResetPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
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
        contentMinHeightClassName={MODAL_BODY_MIN_HEIGHT_CLASS}
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
                      <div className="table-action-group">
                        <Button
                          onClick={() => handleUnarchiveUser(user.id)}
                          variant="success"
                          size="sm"
                          className="h-9 w-9 px-0 py-0 min-w-[2.25rem]"
                          icon={<ArchiveRestoreIcon />}
                          title="Unarchive"
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
                { key: 'archived',    label: 'Archived',    icon: <ArchiveIcon />,    color: 'text-warning-700', border: 'border-warning-500' },
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
            <span className="flex items-center gap-1.5"><ArchiveIcon size="xs" className="text-warning-600" /> Manually archived accounts. Unarchive to allow login again.</span>
          )}
          {activityTab === 'deactivated' && (
            <span className="flex items-center gap-1"><UserX className="h-3.5 w-3.5 text-orange-500" /> Auto-deactivated after 6+ months of inactivity — only admin can reactivate. Accounts deactivated for 4+ years are flagged for deletion.</span>
          )}
          {activityTab === 'deleted' && (
            <span className="flex items-center gap-1"><Trash2 className="h-3.5 w-3.5 text-red-500" /> Accounts inactive for 4+ years — flagged for removal by system policy. Admins can restore accounts from this list; permanent deletion is not done from the app.</span>
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
                              <Button onClick={() => handleUnarchiveUser(user.id)} variant="success" size="sm" icon={<ArchiveRestoreIcon size="xs" />} title="Unarchive" />
                            )}
                            {/* Deactivated tab actions */}
                            {activityTab === 'deactivated' && (
                              <Button onClick={() => handleReactivate(user)} variant="success" size="sm" icon={<UserCheck className="h-3 w-3" />} title="Reactivate account" >
                                Reactivate
                              </Button>
                            )}
                            {/* Deleted (pending deletion) tab actions */}
                            {activityTab === 'deleted' && (
                              <Button onClick={() => handleReactivate(user)} variant="success" size="sm" icon={<UserCheck className="h-3 w-3" />} title="Restore account" >
                                Restore
                              </Button>
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
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            onClick={() => openResetPasswordModal(user)}
                            variant="outline"
                            size="sm"
                            icon={<Settings className="h-3 w-3" />}
                            title="Reset Password"
                          />
                        )}
                        {user.role === 'teacher' ? (
                          <Button
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Deactivate teacher',
                                message:
                                  'Deactivate this teacher account? It will become inactive but remain for records and can be restored within 30 days.',
                                variant: 'danger',
                                confirmLabel: 'Deactivate',
                              });
                              if (!ok) return;
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
                            icon={<ArchiveIcon size="xs" />}
                            title="Deactivate"
                          />
                        ) : user.role !== 'admin' ? (
                          <Button
                            onClick={() => handleArchive(user)}
                            variant="outline"
                            size="sm"
                            icon={<ArchiveIcon size="xs" />}
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
                hideEmptyIcon
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

