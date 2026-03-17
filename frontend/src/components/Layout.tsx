import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { UpdateUserPhoto, ChangePassword, SaveEquipmentFeedback, UpdateUser, GetPendingFeedback, GetPendingRegistrations } from '../../wailsjs/go/backend/App';
import { compressImage, isImageFile, isValidFileSize } from '../utils/imageUtils';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Lock,
  UserCircle,
  Menu,
  X as XIcon,
  Eye,
  EyeOff,
  Bell,
} from 'lucide-react';
import LogoutFeedbackModal from './LogoutFeedbackModal';

interface LayoutProps {
  children: React.ReactNode;
  navigationItems: NavigationItem[];
  title?: string;
  subtitle?: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  children?: NavigationItem[];
  isDivider?: boolean;
  label?: string;
}

function getNotifRelativeTime(dateStr: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Layout({ children, navigationItems, title, subtitle }: LayoutProps) {
  const { user, logout, updateUser } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'logout' | 'manual'>('logout');
  const [showPendingTasksModal, setShowPendingTasksModal] = useState(false);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(user?.photo_url || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    firstName: user?.first_name || '',
    middleName: user?.middle_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    contactNumber: user?.contact_number || ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const canEditProfile = user?.role === 'student' || user?.role === 'working_student';

  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    if (user?.role === 'student') {
      // Show feedback modal ONLY for regular students
      setShowLogoutConfirmModal(true);
    } else if (user?.role === 'working_student') {
      // Block logout if there are pending tasks to review
      try {
        const [pendingFeedback, pendingRegs] = await Promise.all([
          GetPendingFeedback().catch(() => []),
          GetPendingRegistrations().catch(() => []),
        ]);
        const feedbackCount = pendingFeedback?.length ?? 0;
        const regsCount = pendingRegs?.length ?? 0;
        if (feedbackCount > 0 || regsCount > 0) {
          setPendingFeedbackCount(feedbackCount);
          setPendingRegistrationsCount(regsCount);
          setShowPendingTasksModal(true);
          return;
        }
      } catch (error) {
        console.error('Failed to check pending tasks:', error);
      }
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        navigate('/login');
      }
    } else {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        navigate('/login');
      }
    }
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirmModal(false);
    setFeedbackMode('logout');
    setShowFeedbackModal(true);
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirmModal(false);
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    try {
      if (!user) return;

      const reportContextDetails = feedbackMode === 'manual'
        ? [
            `Report Context: ${feedbackData.reportingContext === 'other_pc' ? 'Another PC' : 'Current PC'}`,
            `Reported By: ${feedbackData.reportedBy === 'classmate' ? 'Classmate' : 'Self'}`,
            `Target PC Number: ${feedbackData.targetPCNumber || 'N/A'}`,
            `Urgency: ${feedbackData.severity || 'normal'}`,
            `Affected Student ID: ${feedbackData.affectedStudentID || 'N/A'}`,
            `Issue Category: ${feedbackData.issueCategory || 'computer'}`,
          ]
        : [];

      const additionalComments = [
        ...reportContextDetails,
        feedbackData.additionalComments ? `Additional: ${feedbackData.additionalComments}` : ''
      ].filter(Boolean).join('\n');

      let computerStatus = feedbackData.computer?.status || 'yes';
      let computerIssue = feedbackData.computer?.issue || '';
      let mouseStatus = feedbackData.mouse?.status || 'yes';
      let mouseIssue = feedbackData.mouse?.issue || '';
      let keyboardStatus = feedbackData.keyboard?.status || 'yes';
      let keyboardIssue = feedbackData.keyboard?.issue || '';
      let monitorStatus = feedbackData.monitor?.status || 'yes';
      let monitorIssue = feedbackData.monitor?.issue || '';

      if (feedbackMode === 'manual') {
        const issueDescription = feedbackData.issueDescription || '';

        computerStatus = 'yes';
        computerIssue = '';
        mouseStatus = 'yes';
        mouseIssue = '';
        keyboardStatus = 'yes';
        keyboardIssue = '';
        monitorStatus = 'yes';
        monitorIssue = '';

        switch (feedbackData.issueCategory) {
          case 'mouse':
            mouseStatus = 'no';
            mouseIssue = issueDescription;
            break;
          case 'keyboard':
            keyboardStatus = 'no';
            keyboardIssue = issueDescription;
            break;
          case 'monitor':
            monitorStatus = 'no';
            monitorIssue = issueDescription;
            break;
          case 'other':
            computerStatus = 'no';
            computerIssue = `General issue: ${issueDescription}`;
            break;
          case 'computer':
          default:
            computerStatus = 'no';
            computerIssue = issueDescription;
            break;
        }
      }

      // When reporting for another PC, pass its number; otherwise backend uses current machine hostname
      const optionalPCNumber =
        feedbackData.reportingContext === 'other_pc' && feedbackData.targetPCNumber?.trim()
          ? feedbackData.targetPCNumber.trim()
          : '';

      await SaveEquipmentFeedback(
        user.id,
        user.name,
        computerStatus,
        computerIssue,
        mouseStatus,
        mouseIssue,
        keyboardStatus,
        keyboardIssue,
        monitorStatus,
        monitorIssue,
        additionalComments,
        optionalPCNumber
      );

      if (feedbackMode === 'manual') {
        setShowFeedbackModal(false);
        alert('Issue report submitted successfully. The working student will review it first.');
        return;
      }
    } catch (error) {
      console.error('Failed to save feedback:', error);
      if (feedbackMode === 'manual') {
        alert('Failed to submit issue report. Please try again.');
        return;
      }

      alert('Failed to save feedback. You will still be logged out.');
    }

    setShowFeedbackModal(false);
    await logout();
    navigate('/login');
  };

  const handleFeedbackCancel = () => {
    setShowFeedbackModal(false);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      alert('Please select an image file.');
      return;
    }

    if (!isValidFileSize(file, 5)) {
      alert('Image size must be less than 5MB.');
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setPhotoFile(file);
      setPhotoPreview(compressedDataUrl);
    } catch (error) {
      console.error('Failed to process image:', error);
      alert('Failed to process the image file. Please try again.');
    }
  };

  const handlePhotoSave = async () => {
    if (!photoFile || !user || !photoPreview) {
      alert('Please select an image first.');
      return;
    }

    try {
      await UpdateUserPhoto(user.id, user.role, photoPreview);

      const updatedUser = {
        ...user,
        photo_url: photoPreview
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      if (updateUser) {
        updateUser(updatedUser);
      }

      setPhotoFile(null);

      alert('Profile photo updated successfully!');
    } catch (error: any) {
      console.error('Failed to update profile photo:', error);

      // Clear the preview since save failed - photo is NOT actually saved
      setPhotoPreview(user?.photo_url || '');
      setPhotoFile(null);

      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      if (errorMessage.toLowerCase().includes('database not connected')) {
        alert('Database connection is not available. Your session was restored from a previous login, but the database is currently unreachable. Please restart the application.');
      } else {
        alert(`Failed to update profile photo: ${errorMessage}`);
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('New password must include at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('New password must include at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('New password must include at least one number');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordError('New password must include at least one special character');
      return;
    }

    if (!user) return;

    try {
      await ChangePassword(user.name, oldPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setShowAccountModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      console.error('Failed to change password:', error);
      setPasswordError('Failed to change password. Please check your old password.');
    }
  };

  useEffect(() => {
    if (user) {
      setProfileFormData({
        firstName: user.first_name || '',
        middleName: user.middle_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        contactNumber: user.contact_number || ''
      });
      setPhotoPreview(user.photo_url || '');
    }
  }, [user]);

  const handleEditProfile = () => {
    setEditingProfile(true);
    setProfileError('');
    setProfileSuccess('');
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    setProfileError('');
    setProfileSuccess('');
    if (user) {
      setProfileFormData({
        firstName: user.first_name || '',
        middleName: user.middle_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        contactNumber: user.contact_number || ''
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);

    if (!user) {
      setSavingProfile(false);
      return;
    }

    try {
      // Parameters: id, name, firstName, middleName, lastName, role, employeeID, studentID, email, contactNumber, departmentCode
      await UpdateUser(
        user.id,
        user.name || '',
        profileFormData.firstName,
        profileFormData.middleName,
        profileFormData.lastName,
        user.role,
        user.employee_id || '',
        user.student_id || '',
        profileFormData.email,
        profileFormData.contactNumber,
        '' // departmentCode - not available in User type
      );

      const updatedUser = {
        ...user,
        first_name: profileFormData.firstName,
        middle_name: profileFormData.middleName,
        last_name: profileFormData.lastName,
        email: profileFormData.email,
        contact_number: profileFormData.contactNumber
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));

      if (updateUser) {
        updateUser(updatedUser);
      }

      setProfileSuccess('Profile updated successfully!');
      setEditingProfile(false);

      setTimeout(() => {
        setProfileSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileError('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCloseAccountModal = () => {
    setShowAccountModal(false);
    setActiveTab('profile');
    setPasswordError('');
    setPasswordSuccess('');
    setProfileError('');
    setProfileSuccess('');
    setEditingProfile(false);
    setPhotoFile(null);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (user) {
      setProfileFormData({
        firstName: user.first_name || '',
        middleName: user.middle_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        contactNumber: user.contact_number || ''
      });
    }
  };

  const handleModalBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseAccountModal();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        const isProfileIcon = target.closest('[data-profile-icon]');
        if (!isProfileIcon) {
          setProfileDropdownOpen(false);
        }
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [profileDropdownOpen]);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };

    if (notifDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [notifDropdownOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
        if (showAccountModal) {
          handleCloseAccountModal();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAccountModal]);

  // Safety mechanism: Force close modal on component unmount
  useEffect(() => {
    return () => {
      setShowAccountModal(false);
      setProfileDropdownOpen(false);
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-30 transition-opacity duration-300"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 bg-white/95 backdrop-blur-sm border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out z-40 w-[240px] shadow-xl ${
          sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex items-center h-14 flex-shrink-0 px-4">
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Close sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin pb-4 px-3">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              if (item.isDivider) {
                return (
                  <li key={item.name} className="py-3">
                    <div className={sidebarCollapsed ? 'mx-3' : 'mx-3'}>
                      <div className="border-t border-gray-200"></div>
                    </div>
                    {!sidebarCollapsed && item.label && (
                      <div className="px-4 pt-3">
                        <span className="text-xs font-medium text-gray-500">
                          {item.label}
                        </span>
                      </div>
                    )}
                  </li>
                );
              }

              const isOpen = openDropdowns.includes(item.name);
              const hasChildren = item.children && item.children.length > 0;
              const isChildActive = hasChildren && item.children?.some(child => child.current);

              return (
                <li key={item.name}>
                  {hasChildren ? (
                    <div>
                      <button
                        onClick={() => {
                          if (isOpen) {
                            setOpenDropdowns(openDropdowns.filter(name => name !== item.name));
                          } else {
                            setOpenDropdowns([...openDropdowns, item.name]);
                          }
                        }}
                            className={`group w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                          isChildActive
                              ? 'bg-primary-50 text-primary-700 font-semibold border border-primary-100'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title={item.name}
                      >
                        <div className="flex items-center">
                            <div className={`flex-shrink-0 ${
                            isChildActive ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-700'
                          } [&>svg]:w-5 [&>svg]:h-5`}>
                            {item.icon}
                          </div>

                            <span className="ml-6 whitespace-nowrap">
                              {item.name}
                            </span>
                        </div>

                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`} />
                      </button>

                      {isOpen && item.children && (
                        <ul className="mt-0.5">
                          {item.children.map((child) => (
                            <li key={child.name}>
                              <Link
                                to={child.href}
                                className={`flex items-center px-3 py-2 rounded-xl text-sm transition-colors ${
                                  child.current
                                    ? 'bg-primary-50 text-primary-700 font-semibold border border-primary-100'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                title={child.name}
                              >
                                <div className={`flex-shrink-0 ml-2 ${
                                  child.current ? 'text-gray-900' : 'text-gray-500'
                                } [&>svg]:w-5 [&>svg]:h-5`}>
                                  {child.icon}
                                </div>
                                <span className="ml-6 whitespace-nowrap">
                                  {child.name}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.href}
                      className={`flex items-center px-3 py-2 rounded-xl text-sm transition-colors ${
                        item.current
                          ? 'bg-primary-50 text-primary-700 font-semibold border border-primary-100'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      title={item.name}
                    >
                      <div className={`flex-shrink-0 ${
                        item.current ? 'text-gray-900' : 'text-gray-600'
                      } [&>svg]:w-5 [&>svg]:h-5`}>
                        {item.icon}
                      </div>
                      <span className="ml-6 whitespace-nowrap">
                        {item.name}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-2">
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              data-profile-icon
              className="w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <div className="relative flex-shrink-0">
                {user?.photo_url || photoPreview ? (
                  <img
                    src={photoPreview || user?.photo_url}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 rounded-full border-2 border-white" />
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name && user?.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user?.first_name || user?.name || 'User'
                  }
                </div>
                <div className="text-xs text-gray-500 capitalize truncate">
                  {user?.role?.replace('_', ' ') || 'Role'}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                profileDropdownOpen ? 'rotate-180' : ''
              }`} />
            </button>

            {profileDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
              >
                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowAccountModal(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Account Settings</span>
                  </button>

                  <div className="border-t border-gray-200 my-1" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-4 px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen">
        <header className="flex-shrink-0 h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 shadow-sm relative z-20">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            {title && (
              <div className="section-highlight py-2 bg-gradient-to-r from-primary-50 to-white border-primary-100">
                <h1 className="section-highlight-title">{title}</h1>
                {subtitle && (
                  <p className="section-highlight-subtitle">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              onClick={() => setNotifDropdownOpen(prev => !prev)}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifDropdownOpen && (
              <div className="absolute right-0 top-12 w-80 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden animate-slideIn">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-72">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Bell className="w-8 h-8 mb-2" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.is_read) markRead(n.id); }}
                        className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                          !n.is_read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] text-gray-400">
                              {getNotifRelativeTime(n.created_at)}
                            </span>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {showAccountModal && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
          onClick={handleModalBackdropClick}
        >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Account Settings</h2>
              </div>
              <button
                onClick={handleCloseAccountModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-200 bg-white px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  <span>Profile</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'password'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Security</span>
                </div>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'profile' ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Profile"
                            className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center ring-4 ring-white shadow-md">
                            <User className="w-10 h-10 text-blue-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Profile Photo</h4>
                        <div className="flex items-center gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                            onClick={(e) => {
                              (e.target as HTMLInputElement).value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                          >
                            Choose Photo
                          </button>
                          {photoFile && (
                          <button
                            type="button"
                            onClick={handlePhotoSave}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                          >
                              Save Photo
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Max file size: 5MB. Recommended: 400x400px</p>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={canEditProfile ? handleSaveProfile : (e) => e.preventDefault()}
                    className="space-y-5"
                    noValidate
                  >
                    {canEditProfile && profileError && (
                      <div className="bg-danger-50 border-l-4 border-danger-500 p-4 rounded-lg">
                        <p className="text-sm text-danger-700">{profileError}</p>
                      </div>
                    )}

                    {canEditProfile && profileSuccess && (
                      <div className="bg-success-50 border-l-4 border-success-500 p-4 rounded-lg">
                        <p className="text-sm text-success-700">{profileSuccess}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          First Name <span className="text-danger-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileFormData.firstName}
                          onChange={(e) => setProfileFormData({ ...profileFormData, firstName: e.target.value })}
                          disabled={!editingProfile || !canEditProfile}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Middle Name
                        </label>
                        <input
                          type="text"
                          value={profileFormData.middleName}
                          onChange={(e) => setProfileFormData({ ...profileFormData, middleName: e.target.value })}
                          disabled={!editingProfile || !canEditProfile}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Last Name <span className="text-danger-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileFormData.lastName}
                          onChange={(e) => setProfileFormData({ ...profileFormData, lastName: e.target.value })}
                          disabled={!editingProfile || !canEditProfile}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileFormData.email}
                          onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                          disabled={!editingProfile || !canEditProfile}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          value={profileFormData.contactNumber}
                          onChange={(e) => setProfileFormData({ ...profileFormData, contactNumber: e.target.value })}
                          disabled={!editingProfile || !canEditProfile}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Designated Role
                        </label>
                        <input
                          type="text"
                          value={user?.role ? user.role.replace('_', ' ') : ''}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Account Information</h5>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Created</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {user?.created
                              ? (() => {
                                  const d = new Date(user.created.replace(' ', 'T'));
                                  return Number.isNaN(d.getTime())
                                    ? user.created
                                    : d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                })()
                              : 'Not available'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Validity</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {user?.created
                              ? (() => {
                                  const d = new Date(user.created.replace(' ', 'T'));
                                  if (Number.isNaN(d.getTime())) return 'Not available';
                                  const expiry = new Date(d);
                                  expiry.setFullYear(expiry.getFullYear() + 4);
                                  const isExpired = expiry.getTime() < Date.now();
                                  return (
                                    <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                      {expiry.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                      {isExpired && ' (Expired)'}
                                    </span>
                                  );
                                })()
                              : 'Not available'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4">
                      <p className="text-xs text-gray-500">
                        Some fields are managed by your organization. Please contact an administrator to update your primary profile information.
                      </p>
                      <div className="flex justify-end gap-3">
                        {canEditProfile && (
                          !editingProfile ? (
                            <button
                              type="button"
                              onClick={handleEditProfile}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                            >
                              Edit Profile
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleCancelEditProfile}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={savingProfile}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingProfile ? 'Saving...' : 'Save Changes'}
                              </button>
                            </>
                          )
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-6" noValidate>
                  {passwordError && (
                    <div className="bg-danger-50 border-l-4 border-danger-500 p-4 rounded-lg">
                      <p className="text-sm text-danger-700">{passwordError}</p>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-success-50 border-l-4 border-success-500 p-4 rounded-lg">
                      <p className="text-sm text-success-700">{passwordSuccess}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>At least 8 characters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>Contains a number</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>Contains a special character</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>Case sensitive</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Re-type new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                    <button
                      type="button"
                      onClick={handleCloseAccountModal}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Change Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showPendingTasksModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10001]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Tasks</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You still have pending tasks that need to be resolved before logging out:
            </p>
            <ul className="text-sm text-gray-700 mb-6 space-y-2">
              {pendingFeedbackCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
                  <span><span className="font-semibold text-warning-700">{pendingFeedbackCount}</span> equipment report{pendingFeedbackCount !== 1 ? 's' : ''} awaiting review</span>
                </li>
              )}
              {pendingRegistrationsCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
                  <span><span className="font-semibold text-warning-700">{pendingRegistrationsCount}</span> registration{pendingRegistrationsCount !== 1 ? 's' : ''} awaiting approval</span>
                </li>
              )}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setShowPendingTasksModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                OK, I'll Review Them
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10001]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to log out? You'll be asked to provide equipment feedback.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleLogoutCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-danger-600 rounded-lg hover:bg-danger-700 transition-colors shadow-sm"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <LogoutFeedbackModal
          onSubmit={handleFeedbackSubmit}
          onClose={handleFeedbackCancel}
          mode={feedbackMode}
        />
      )}
    </div>
  );
}

export default Layout;
