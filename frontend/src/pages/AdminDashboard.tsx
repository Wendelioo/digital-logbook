import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  UserPlus,
  Edit,
  Trash2,
  Download,
  Search,
  Filter,
  SlidersHorizontal,
  X,
  Eye,
  EyeOff,
  Building2,
  Plus,
  Calendar,
  Upload,
  FolderOpen,
  GraduationCap,
  BarChart3,
  AlertCircle,
  Archive,
  RotateCcw,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  GetAdminDashboard,
  GetUsers,
  GetUsersByType,
  SearchUsers,
  CreateUser,
  UpdateUser,
  DeleteUser,
  GetAllLogs,
  GetFeedback,
  GetDepartments,
  CreateDepartment,
  UpdateDepartment,
  DeleteDepartment,
  GetLogDates,
  GetFeedbackDates,
  ArchiveLogsByDate,
  ArchiveFeedbackByDate,
  GetArchivedLogSheets,
  GetArchivedFeedbackSheets,
  GetArchivedLogsByDate,
  GetArchivedFeedbackByDate,
  UnarchiveLogSheet,
  UnarchiveFeedbackSheet,
  ExportArchivedLogSheetCSV,
  ExportArchivedLogSheetPDF,
  ExportArchivedFeedbackSheetCSV,
  ExportArchivedFeedbackSheetPDF
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  total_students: number;
  total_teachers: number;
  working_students: number;
  recent_logins: number;
}

interface User {
  id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  role: string;
  employee_id?: string;
  student_id?: string;
  year?: string;
  section?: string;
  photo_url?: string;
  email?: string;
  contact_number?: string;
  department_code?: string;
  created: string;
}

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_id_number: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

// Use the generated Feedback model from main
type Feedback = main.Feedback;

// Archive sheet types
interface ArchivedLogSheet {
  date: string;
  total_logins: number;
  student_count: number;
  teacher_count: number;
  admin_count: number;
  working_student_count: number;
  unique_pcs: number;
}

interface ArchivedFeedbackSheet {
  date: string;
  total_reports: number;
  good_count: number;
  issue_count: number;
  unique_pcs: number;
  unique_students: number;
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    total_teachers: 0,
    working_students: 0,
    recent_logins: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetAdminDashboard();
        setStats(data);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.total_students,
      color: 'bg-blue-500',
      icon: <Users className="h-8 w-8" />
    },
    {
      title: 'Teachers',
      value: stats.total_teachers,
      color: 'bg-green-500',
      icon: <Users className="h-8 w-8" />
    },
    {
      title: 'Working Students',
      value: stats.working_students,
      color: 'bg-purple-500',
      icon: <Users className="h-8 w-8" />
    },
    {
      title: 'Recent Logins',
      value: stats.recent_logins,
      color: 'bg-orange-500',
      icon: <ClipboardList className="h-8 w-8" />
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${card.color} rounded-md p-3 text-white`}>
                    {card.icon}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {card.title}
                    </dt>
                    <dd className="text-3xl font-bold text-gray-900">
                      {card.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="users"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <UserPlus className="h-6 w-6 text-primary-600 mr-3" />
            <span className="text-gray-900">Manage Users</span>
          </Link>
          <Link
            to="logs"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ClipboardList className="h-6 w-6 text-primary-600 mr-3" />
            <span className="text-gray-900">View Logs</span>
          </Link>
          <Link
            to="reports"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-6 w-6 text-primary-600 mr-3" />
            <span className="text-gray-900">Export Reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
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
    year: '',
    section: '',
    email: '',
    contactNumber: '',
    departmentCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Excel-like table state: sorting, filtering, selection, pagination
  type SortKey = 'name' | 'role' | 'year' | 'created';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<SortKey, string>>({
    name: '',
    role: '',
    year: '',
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
    setFilters({ name: '', role: '', year: '', created: '' });
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

  const copySelected = async (rows: User[]) => {
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
        // Search with user type filter
        data = await SearchUsers(searchTerm, userTypeFilter);
      } else if (searchTerm) {
        // Search all users
        data = await SearchUsers(searchTerm, '');
      } else if (userTypeFilter) {
        // Filter by user type only
        data = await GetUsersByType(userTypeFilter);
      } else {
        // Get all users
        data = await GetUsers();
      }

      // Ensure data is always an array, even if API returns null/undefined
      setUsers(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Unable to load users from server.');
      // Set empty array on error to prevent blank screen
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields based on role
      if (!formData.firstName || !formData.lastName) {
        showNotification('error', 'First Name and Last Name are required');
        return;
      }

      if (formData.role === 'working_student' || formData.role === 'student') {
        if (!formData.studentId) {
          showNotification('error', `Student ID is required for ${formData.role === 'student' ? 'Students' : 'Working Students'}`);
          return;
        }
      } else if (formData.role === 'teacher') {
        if (!formData.employeeId) {
          showNotification('error', 'Employee ID is required for Teachers');
          return;
        }
      }

      // Build name from lastName, firstName, middleName
      const fullName = `${formData.lastName}, ${formData.firstName}${formData.middleName ? ' ' + formData.middleName : ''}`;

      // For new users, password is required
      // For editing, if password is empty, we keep the old password (backend handles this)
      let password_to_pass = formData.password;

      // If creating a new user and no password provided, show error
      if (!editingUser && !password_to_pass) {
        showNotification('error', 'Password is required for new users');
        return;
      }

      // Validate password confirmation for new users
      if (!editingUser && formData.password !== formData.confirmPassword) {
        showNotification('error', 'Passwords do not match');
        return;
      }

      console.log('Submitting user with data:', {
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        employeeId: formData.employeeId,
        studentId: formData.studentId,
        year: formData.year,
        section: formData.section
      });

      const departmentCode = formData.role === 'teacher' ? formData.departmentCode : '';

      if (editingUser) {
        await UpdateUser(editingUser.id, fullName, formData.firstName, formData.middleName, formData.lastName, '', formData.role, formData.employeeId, formData.studentId, '', '', formData.email, formData.contactNumber, departmentCode);
        showNotification('success', 'User updated successfully!');
      } else {
        await CreateUser(password_to_pass, fullName, formData.firstName, formData.middleName, formData.lastName, '', formData.role, formData.employeeId, formData.studentId, '', '', formData.email, formData.contactNumber, departmentCode);

        // Show specific notification based on user role
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
      setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', year: '', section: '', email: '', contactNumber: '', departmentCode: '' });
      setAvatarFile(null);
      setAvatarPreview(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save user. Please try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleEdit = (user: User) => {
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
      year: user.year || '',
      section: user.section || '',
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
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await DeleteUser(id);
        showNotification('success', 'User deleted successfully!');
        loadUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete user. Please try again.';
        showNotification('error', errorMessage);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Derived table data (filters, sort, pagination)
  // Note: userTypeFilter and searchTerm are now handled server-side
  // Only column-specific filters are applied here
  const filteredUsers = users.filter((u) => {
    // Column-specific filters
    const inName = u.name.toLowerCase().includes(filters.name.toLowerCase());
    const inRole = u.role.toLowerCase().includes(filters.role.toLowerCase());
    const inYear = (u.year || '').toLowerCase().includes(filters.year.toLowerCase());
    const inCreated = (u.created || '').toLowerCase().includes(filters.created.toLowerCase());
    return inName && inRole && inYear && inCreated;
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
      case 'year':
        va = (a.year || '').toLowerCase();
        vb = (b.year || '').toLowerCase();
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
        <Button
          onClick={() => setShowForm(true)}
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
        >
          ADD NEW
        </Button>
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
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingUser(null);
              setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', year: '', section: '', email: '', contactNumber: '', departmentCode: '' });
              setAvatarFile(null);
              setAvatarPreview(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingUser(null);
                setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', year: '', section: '', email: '', contactNumber: '', departmentCode: '' });
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            {/* Header */}
            <div className="p-4 pb-3 flex-shrink-0 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {editingUser ? `Edit ${formData.role === 'teacher' ? 'Teacher' : formData.role === 'student' ? 'Student' : 'Working Student'}` : `Add ${formData.role === 'teacher' ? 'Teacher' : formData.role === 'student' ? 'Student' : 'Working Student'}`}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-4">
                {/* Role Selection - Hidden if editing */}
                {!editingUser && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setFormData({
                          ...formData,
                          role: newRole
                        });
                      }}
                      className="w-full max-w-xs px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="teacher">Teacher</option>
                      <option value="student">Student</option>
                      <option value="working_student">Working Student</option>
                    </select>
                  </div>
                )}

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - Personal Information */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Personal Information</h4>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={formData.middleName}
                        onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contact</label>
                      <input
                        type="tel"
                        value={formData.contactNumber}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="09789436123"
                      />
                    </div>
                  </div>

                  {/* Right Column - Account Information and Avatar */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Account Information</h4>

                    {formData.role === 'teacher' ? (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                        <select
                          value={formData.departmentCode}
                          onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Please Select Here</option>
                          {departments.filter(dept => dept.is_active).map((dept) => (
                            <option key={dept.department_code} value={dept.department_code}>
                              {dept.department_code} - {dept.department_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
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
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        placeholder={formData.role === 'teacher' ? 'Teacher ID' : 'Student ID'}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-2.5 py-1.5 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={!editingUser}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full px-2.5 py-1.5 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={!editingUser}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* User Avatar */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">User Avatar</label>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id="avatar-upload"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                          <label
                            htmlFor="avatar-upload"
                            className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
                          >
                            Choose File
                          </label>
                          <span className="text-xs text-gray-500">
                            {avatarFile ? avatarFile.name : 'No file chosen'}
                          </span>
                        </div>
                        <div className="w-full h-32 bg-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-gray-400 text-xs">No image selected</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                    setFormData({ password: '', confirmPassword: '', name: '', firstName: '', middleName: '', lastName: '', role: 'teacher', employeeId: '', studentId: '', year: '', section: '', email: '', contactNumber: '', departmentCode: '' });
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  variant="secondary"
                  size="sm"
                >
                  CANCEL
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  SAVE
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Show <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1 mx-1"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select> entries
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
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            {currentUsers.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      User ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Full Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      User Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.map((user, index) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.employee_id || user.student_id || user.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.first_name && user.last_name
                          ? `${user.last_name}, ${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''}`
                          : user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.role.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setViewingUser(user)}
                            variant="outline"
                            size="sm"
                            icon={<Eye className="h-3 w-3" />}
                            title="View"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          />
                          <Button
                            onClick={() => handleEdit(user)}
                            variant="primary"
                            size="sm"
                            icon={<Edit className="h-3 w-3" />}
                            title="Edit"
                          />
                          <Button
                            onClick={() => handleDelete(user.id)}
                            variant="danger"
                            size="sm"
                            icon={<Trash2 className="h-3 w-3" />}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500">No data available.</p>
              </div>
            )}
          </div>
        </div>
        {currentUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
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
      </div>
    </div>
  );
}

interface ViewUserDetailsModalProps {
  user: User | null;
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
    if (user.role === 'student' || user.role === 'working_student') {
      return user.year && user.section ? `${user.year} - ${user.section}` : user.year || user.section || 'N/A';
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
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  {user.role === 'teacher' ? 'Department:' : 'Year & Section:'}
                </span>
                <span className="text-sm text-gray-900 ml-2">{getDepartment()}</span>
              </div>
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

function ViewLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Available dates for archiving
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [archiving, setArchiving] = useState(false);

  // General search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Date filter only
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadLogs();
    loadAvailableDates();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await GetAllLogs();
      if (data && Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
      setError('');
    } catch (error) {
      console.error('Failed to load logs:', error);
      setError('Failed to load logs. Please check your database connection.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDates = async () => {
    try {
      const dates = await GetLogDates();
      setAvailableDates(dates || []);
    } catch (error) {
      console.error('Failed to load log dates:', error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
  };

  // Archive by date handler
  const handleArchiveByDate = async (date: string) => {
    if (!confirm(`Are you sure you want to archive all logs for ${date}? Archived logs can be exported from the Archive section.`)) {
      return;
    }

    setArchiving(true);
    try {
      const count = await ArchiveLogsByDate(date, user?.id || 0);
      alert(`Successfully archived ${count} log(s) for ${date}`);
      loadLogs();
      loadAvailableDates();
    } catch (error) {
      console.error('Failed to archive logs:', error);
      alert('Failed to archive logs');
    } finally {
      setArchiving(false);
    }
  };

  // Group logs by date for display
  const groupedLogs = logs.reduce((groups, log) => {
    const date = log.login_time ? new Date(log.login_time).toISOString().split('T')[0] : 'unknown';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, LoginLog[]>);

  // Apply filters to logs
  const filteredLogs = logs.filter((log) => {
    // General search - searches across all fields
    const searchLower = searchQuery.toLowerCase();
    const logDate = log.login_time ? new Date(log.login_time).toISOString().split('T')[0] : '';
    const timeIn = log.login_time ? new Date(log.login_time).toLocaleTimeString() : '';
    const timeOut = log.logout_time ? new Date(log.logout_time).toLocaleTimeString() : '';

    const matchesSearch = searchQuery === '' ||
      log.user_name.toLowerCase().includes(searchLower) ||
      (log.user_id_number || '').toLowerCase().includes(searchLower) ||
      log.user_type.toLowerCase().includes(searchLower) ||
      (log.pc_number || '').toLowerCase().includes(searchLower) ||
      logDate.includes(searchLower) ||
      timeIn.toLowerCase().includes(searchLower) ||
      timeOut.toLowerCase().includes(searchLower);

    // Date filter
    const matchesDate = dateFilter === '' || logDate === dateFilter;

    return matchesSearch && matchesDate;
  });

  // Check if showing filtered view by date - show archive button
  const showArchiveButton = dateFilter && availableDates.includes(dateFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Log Entries</h2>
            <p className="text-sm text-gray-500 mt-1">Filter by date and archive entire days</p>
          </div>
          <div className="flex gap-2">
            {showArchiveButton && (
              <Button
                onClick={() => handleArchiveByDate(dateFilter)}
                disabled={archiving}
                variant="primary"
                icon={<Archive className="h-4 w-4" />}
              >
                {archiving ? 'Archiving...' : `Archive ${dateFilter}`}
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar and Filter Button */}
        <div className="flex gap-3">
          <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${showFilters
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              {dateFilter && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  1
                </span>
              )}
            </button>

            {/* Dropdown Filters Panel */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>
          {(searchQuery || dateFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time-In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time-Out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user_id_number || log.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {log.user_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {log.pc_number || <span className="text-gray-400">N/A</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {log.login_time ? new Date(log.login_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {log.logout_time ? (
                          new Date(log.logout_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {log.login_time ? new Date(log.login_time).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <p className="text-gray-500 font-medium">No logs found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{filteredLogs.length}</span> of <span className="font-medium">{logs.length}</span> logs
          </div>
          {(searchQuery || dateFilter) && (
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Search className="h-4 w-4" />
              <span>Search/Filters active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Available dates for archiving
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [archiving, setArchiving] = useState(false);

  // General search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Date filter only
  const [dateFilter, setDateFilter] = useState('');

  // Modal state
  const [selectedReport, setSelectedReport] = useState<Feedback | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    loadReports();
    loadAvailableDates();
  }, []);

  const loadReports = async () => {
    try {
      const data = await GetFeedback();
      if (data && Array.isArray(data)) {
        setReports(data);
      } else {
        setReports([]);
      }
      setError('');
    } catch (error) {
      console.error('Failed to load reports:', error);
      setError('Failed to load reports. Please check your database connection.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDates = async () => {
    try {
      const dates = await GetFeedbackDates();
      setAvailableDates(dates || []);
    } catch (error) {
      console.error('Failed to load feedback dates:', error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
  };

  // Archive by date handler
  const handleArchiveByDate = async (date: string) => {
    if (!confirm(`Are you sure you want to archive all reports for ${date}? Archived reports can be exported from the Archive section.`)) {
      return;
    }

    setArchiving(true);
    try {
      const count = await ArchiveFeedbackByDate(date, user?.id || 0);
      alert(`Successfully archived ${count} report(s) for ${date}`);
      loadReports();
      loadAvailableDates();
    } catch (error) {
      console.error('Failed to archive reports:', error);
      alert('Failed to archive reports');
    } finally {
      setArchiving(false);
    }
  };

  // Apply filters to reports
  const filteredReports = reports.filter((report) => {
    // General search - searches across all fields
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      report.student_name.toLowerCase().includes(searchLower) ||
      report.student_id_str.toLowerCase().includes(searchLower) ||
      report.pc_number.toLowerCase().includes(searchLower) ||
      report.equipment_condition.toLowerCase().includes(searchLower) ||
      report.monitor_condition.toLowerCase().includes(searchLower) ||
      report.keyboard_condition.toLowerCase().includes(searchLower) ||
      report.mouse_condition.toLowerCase().includes(searchLower) ||
      (report.comments && report.comments.toLowerCase().includes(searchLower)) ||
      (report.date_submitted && report.date_submitted.toLowerCase().includes(searchLower));

    // Date filter
    const matchesDate = dateFilter === '' || (report.date_submitted && report.date_submitted.startsWith(dateFilter));

    return matchesSearch && matchesDate;
  });

  // Check if showing filtered view by date - show archive button
  const showArchiveButton = dateFilter && availableDates.includes(dateFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
            <p className="text-sm text-gray-500 mt-1">Filter by date and archive entire days</p>
          </div>
          <div className="flex gap-3">
            {showArchiveButton && (
              <Button
                onClick={() => handleArchiveByDate(dateFilter)}
                disabled={archiving}
                variant="primary"
                icon={<Archive className="h-4 w-4" />}
              >
                {archiving ? 'Archiving...' : `Archive ${dateFilter}`}
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar and Filter Button */}
        <div className="flex gap-3">
          <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${showFilters
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              {dateFilter && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  1
                </span>
              )}
            </button>

            {/* Dropdown Filters Panel */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>
          {(searchQuery || dateFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Forwarded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {report.student_id_str}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {report.student_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {report.pc_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{report.forwarded_by_name || 'Unknown'}</span>
                        {report.forwarded_at && (
                          <span className="text-xs text-gray-500">
                            {new Date(report.forwarded_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowReportModal(true);
                        }}
                        variant="primary"
                        icon={<Eye className="h-4 w-4" />}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-gray-500 font-medium">No reports available</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredReports.length}</span> of <span className="font-semibold text-gray-900">{reports.length}</span> report{reports.length !== 1 ? 's' : ''}
          </div>
          {(searchQuery || dateFilter) && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filters active</span>
            </div>
          )}
        </div>
      </div>

      {/* Report Details Modal */}
      {showReportModal && selectedReport && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReportModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Equipment Report Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Full report submitted by student</p>
                </div>
              </div>

              {/* Report Information */}
              <div className="space-y-6">
                {/* Student Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{selectedReport.student_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Student ID:</span>
                      <p className="font-medium text-gray-900">{selectedReport.student_id_str}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PC Number:</span>
                      <p className="font-medium text-gray-900">{selectedReport.pc_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Date Submitted:</span>
                      <p className="font-medium text-gray-900">
                        {selectedReport.date_submitted ? new Date(selectedReport.date_submitted).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Equipment Conditions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Equipment Conditions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Equipment</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.equipment_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.equipment_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.equipment_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Monitor</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.monitor_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.monitor_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.monitor_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Keyboard</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.keyboard_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.keyboard_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.keyboard_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Mouse</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.mouse_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.mouse_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.mouse_condition}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Student Comments */}
                {selectedReport.comments && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Comments</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReport.comments}</p>
                  </div>
                )}

                {/* Working Student Notes */}
                {selectedReport.working_student_notes && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Working Student Notes</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap italic">{selectedReport.working_student_notes}</p>
                  </div>
                )}

                {/* Forwarding Information */}
                {selectedReport.forwarded_by_name && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Forwarding Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Forwarded By:</span>
                        <p className="font-medium text-gray-900">{selectedReport.forwarded_by_name}</p>
                      </div>
                      {selectedReport.forwarded_at && (
                        <div>
                          <span className="text-gray-600">Forwarded At:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(selectedReport.forwarded_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Department {
  department_code: string;
  department_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [formData, setFormData] = useState({
    departmentCode: '',
    departmentName: ''
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
        await UpdateDepartment(editingDepartment.department_code, formData.departmentCode, formData.departmentName, '', true);
        showNotification('success', 'Department updated successfully!');
      } else {
        await CreateDepartment(formData.departmentCode, formData.departmentName, '');
        showNotification('success', 'Department added successfully!');
      }

      setShowForm(false);
      setEditingDepartment(null);
      setFormData({ departmentCode: '', departmentName: '' });
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
      departmentName: department.department_name
    });
    setShowForm(true);
  };

  const handleDelete = async (departmentCode: string) => {
    if (confirm('Are you sure you want to delete this department?')) {
      try {
        await DeleteDepartment(departmentCode);
        showNotification('success', 'Department deleted successfully!');
        loadDepartments();
      } catch (error) {
        console.error('Failed to delete department:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete department. Please try again.';
        showNotification('error', errorMessage);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const filteredDepartments = departments.filter((dept) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      dept.department_code.toLowerCase().includes(searchLower) ||
      dept.department_name.toLowerCase().includes(searchLower) ||
      (dept.description && dept.description.toLowerCase().includes(searchLower))
    );

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && dept.is_active) ||
      (statusFilter === 'inactive' && !dept.is_active);

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const total = filteredDepartments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pagedDepartments = filteredDepartments.slice(startIndex, endIndex);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department Management</h2>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          variant="primary"
          icon={<Plus className="w-5 h-5" />}
        >
          Add Department
        </Button>
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
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingDepartment(null);
              setFormData({ departmentCode: '', departmentName: '' });
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingDepartment(null);
                setFormData({ departmentCode: '', departmentName: '' });
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            {/* Header */}
            <div className="text-center p-8 pb-4 flex-shrink-0">
              <h3 className="text-2xl font-bold text-blue-600 mb-2">
                {editingDepartment ? 'Edit Department' : 'Add Department'}
              </h3>
              <div className="w-24 h-0.5 bg-blue-600 mx-auto"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto px-8 pb-8 flex-1">
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
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${dept.is_active
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
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
                        onClick={() => handleDelete(dept.department_code)}
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="h-3 w-3" />}
                        title="Delete"
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
    </div>
  );
}

// Archive Management Component (Document-based)
function ArchiveManagement() {
  const [activeTab, setActiveTab] = useState<'logs' | 'reports'>('logs');
  const [logSheets, setLogSheets] = useState<ArchivedLogSheet[]>([]);
  const [feedbackSheets, setFeedbackSheets] = useState<ArchivedFeedbackSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  // View modal state
  const [viewingSheet, setViewingSheet] = useState<{ type: 'logs' | 'reports'; date: string } | null>(null);
  const [viewData, setViewData] = useState<LoginLog[] | Feedback[]>([]);
  const [loadingView, setLoadingView] = useState(false);

  useEffect(() => {
    loadArchivedSheets();
  }, []);

  const loadArchivedSheets = async () => {
    setLoading(true);
    try {
      const [logs, reports] = await Promise.all([
        GetArchivedLogSheets(),
        GetArchivedFeedbackSheets()
      ]);
      setLogSheets(logs || []);
      setFeedbackSheets(reports || []);
      setError('');
    } catch (err) {
      console.error('Failed to load archived sheets:', err);
      setError('Failed to load archived data');
    } finally {
      setLoading(false);
    }
  };

  // View sheet details
  const handleViewSheet = async (type: 'logs' | 'reports', date: string) => {
    setViewingSheet({ type, date });
    setLoadingView(true);
    try {
      if (type === 'logs') {
        const data = await GetArchivedLogsByDate(date);
        setViewData(data || []);
      } else {
        const data = await GetArchivedFeedbackByDate(date);
        setViewData(data || []);
      }
    } catch (err) {
      console.error('Failed to load sheet details:', err);
      alert('Failed to load sheet details');
    } finally {
      setLoadingView(false);
    }
  };

  // Unarchive sheet
  const handleUnarchiveSheet = async (type: 'logs' | 'reports', date: string) => {
    if (!confirm(`Are you sure you want to unarchive all ${type === 'logs' ? 'logs' : 'reports'} for ${date}?`)) {
      return;
    }

    setProcessing(true);
    try {
      if (type === 'logs') {
        await UnarchiveLogSheet(date);
      } else {
        await UnarchiveFeedbackSheet(date);
      }
      alert(`Successfully unarchived ${type} for ${date}`);
      loadArchivedSheets();
    } catch (err) {
      console.error('Failed to unarchive sheet:', err);
      alert('Failed to unarchive sheet');
    } finally {
      setProcessing(false);
    }
  };

  // Export handlers
  const handleExportCSV = async (type: 'logs' | 'reports', date: string) => {
    try {
      let filename: string;
      if (type === 'logs') {
        filename = await ExportArchivedLogSheetCSV(date);
      } else {
        filename = await ExportArchivedFeedbackSheetCSV(date);
      }
      alert(`Exported to ${filename}`);
    } catch (err: any) {
      alert(err.message || 'Failed to export');
    }
  };

  const handleExportPDF = async (type: 'logs' | 'reports', date: string) => {
    try {
      let filename: string;
      if (type === 'logs') {
        filename = await ExportArchivedLogSheetPDF(date);
      } else {
        filename = await ExportArchivedFeedbackSheetPDF(date);
      }
      alert(`Exported to ${filename}`);
    } catch (err: any) {
      alert(err.message || 'Failed to export');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Archive</h2>
            <p className="text-sm text-gray-500 mt-1">View, export, and manage archived login logs and equipment reports by date</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Login Logs ({logSheets.length} sheets)
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Equipment Reports ({feedbackSheets.length} sheets)
            </button>
          </nav>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Log Sheets */}
      {activeTab === 'logs' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logSheets.length > 0 ? (
                  logSheets.map((sheet) => (
                    <tr key={sheet.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm text-gray-900">{sheet.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-primary-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">Login Logs - {formatDate(sheet.date)}</div>
                            <div className="text-xs text-gray-500">{sheet.total_logins} records</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleViewSheet('logs', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 inline mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => handleExportCSV('logs', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                            title="Export as CSV"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => handleExportPDF('logs', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                            title="Export as PDF"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleUnarchiveSheet('logs', sheet.date)}
                            disabled={processing}
                            className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50"
                            title="Restore to active logs"
                          >
                            <RotateCcw className="h-4 w-4 inline mr-1" />
                            Unarchive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No archived log sheets</p>
                      <p className="text-gray-400 text-sm mt-1">Archive logs by date from the View Logs page</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedback Sheets */}
      {activeTab === 'reports' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feedbackSheets.length > 0 ? (
                  feedbackSheets.map((sheet) => (
                    <tr key={sheet.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm text-gray-900">{sheet.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-primary-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">Equipment Reports - {formatDate(sheet.date)}</div>
                            <div className="text-xs text-gray-500">{sheet.total_reports} records</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleViewSheet('reports', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 inline mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => handleExportCSV('reports', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                            title="Export as CSV"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => handleExportPDF('reports', sheet.date)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                            title="Export as PDF"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleUnarchiveSheet('reports', sheet.date)}
                            disabled={processing}
                            className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50"
                            title="Restore to active reports"
                          >
                            <RotateCcw className="h-4 w-4 inline mr-1" />
                            Unarchive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No archived report sheets</p>
                      <p className="text-gray-400 text-sm mt-1">Archive reports by date from the Reports page</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Sheet Modal */}
      {viewingSheet && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={() => setViewingSheet(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {viewingSheet.type === 'logs' ? 'Login Logs' : 'Equipment Reports'} - {formatDate(viewingSheet.date)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{viewingSheet.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExportCSV(viewingSheet.type, viewingSheet.date)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleExportPDF(viewingSheet.type, viewingSheet.date)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => setViewingSheet(null)}
                  className="text-gray-400 hover:text-gray-500 p-2"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loadingView ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : viewingSheet.type === 'logs' ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PC Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time-In</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time-Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(viewData as LoginLog[]).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{log.user_id_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{log.user_name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs font-medium">
                            {log.user_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{log.pc_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {log.login_time ? new Date(log.login_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {log.logout_time ? new Date(log.logout_time).toLocaleTimeString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PC</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monitor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keyboard</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mouse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(viewData as Feedback[]).map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{report.student_name}</div>
                          <div className="text-xs text-gray-500">{report.student_id_str}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{report.pc_number}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.equipment_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>{report.equipment_condition}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.monitor_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>{report.monitor_condition}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.keyboard_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>{report.keyboard_condition}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.mouse_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>{report.mouse_condition}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/admin' },
    { name: 'Manage Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/admin/users' },
    { name: 'Departments', href: '/admin/departments', icon: <GraduationCap className="h-5 w-5" />, current: location.pathname === '/admin/departments' },
    { name: 'Log Entries', href: '/admin/logs', icon: <FolderOpen className="h-5 w-5" />, current: location.pathname === '/admin/logs' },
    { name: 'Reports', href: '/admin/reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/admin/reports' },
    { name: 'Archive', href: '/admin/archive', icon: <Archive className="h-5 w-5" />, current: location.pathname === '/admin/archive' },
  ];

  return (
    <Layout navigationItems={navigationItems} title="Admin Dashboard">
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="departments" element={<DepartmentManagement />} />
        <Route path="logs" element={<ViewLogs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="archive" element={<ArchiveManagement />} />
      </Routes>
    </Layout>
  );
}

export default AdminDashboard;

