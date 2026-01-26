import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UpdateUserPhoto, ChangePassword, SaveEquipmentFeedback, UpdateUser } from '../../wailsjs/go/main/App';
import { 
  LayoutDashboard, 
  User,
  Settings,
  LogOut,
  ChevronDown,
  Lock,
  UserCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import LogoutFeedbackModal from './LogoutFeedbackModal';

interface LayoutProps {
  children: React.ReactNode;
  navigationItems: NavigationItem[];
  title?: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
}

function Layout({ children, navigationItems, title }: LayoutProps) {
  const { user, logout, updateUser } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(user?.photo_url || '');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  
  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Profile edit states (for students and working students)
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
  
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Utility function to compress and resize image
  const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 with compression
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogout = async () => {
    // Show confirmation modal for students
    if (user?.role === 'student') {
      setShowLogoutConfirmModal(true);
    } else {
      // For non-students, logout directly
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        // Even if logout fails, navigate to login
        navigate('/login');
      }
    }
  };

  const handleLogoutConfirm = () => {
    // User confirmed logout, now show feedback modal
    setShowLogoutConfirmModal(false);
    setShowFeedbackModal(true);
  };

  const handleLogoutCancel = () => {
    // User cancelled logout
    setShowLogoutConfirmModal(false);
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    try {
      if (!user) return;
      
      // Call the backend function to save feedback
      // Parameters: userID, userName, computerStatus, computerIssue, mouseStatus, mouseIssue, 
      //             keyboardStatus, keyboardIssue, monitorStatus, monitorIssue, additionalComments
      await SaveEquipmentFeedback(
        user.id,
        user.name,
        feedbackData.computer.status,
        feedbackData.computer.issue || '',
        feedbackData.mouse.status,
        feedbackData.mouse.issue || '',
        feedbackData.keyboard.status,
        feedbackData.keyboard.issue || '',
        feedbackData.monitor.status,
        feedbackData.monitor.issue || '',
        feedbackData.additionalComments || ''
      );
      
      console.log('✓ Feedback saved successfully');
    } catch (error) {
      console.error('Failed to save feedback:', error);
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
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
      }
      
      try {
        // Compress and resize the image before saving
        const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
        setPhotoFile(file);
        setPhotoPreview(compressedDataUrl);
      } catch (error) {
        console.error('Failed to process image:', error);
        alert('Failed to process the image file. Please try again.');
      }
    }
  };

  const handlePhotoSave = async () => {
    if (!photoFile || !user || !photoPreview) {
      alert('Please select an image first.');
      return;
    }
    
    try {
      // Save the data URL to the database
      await UpdateUserPhoto(user.id, user.role, photoPreview);
      
      // Update user object in localStorage and context
      const updatedUser = {
        ...user,
        photo_url: photoPreview
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update the context with the new photo
      if (updateUser) {
        updateUser(updatedUser);
      }
      
      // Clear the photo file state
      setPhotoFile(null);
      
      // Close the modal
      setShowAccountModal(false);
      
      alert('Photo updated successfully!');
    } catch (error) {
      console.error('Failed to update photo:', error);
      alert('Failed to update photo. Make sure you are connected to the database.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validate inputs
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (!user) return;

    try {
      await ChangePassword(user.name, oldPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowAccountModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      console.error('Failed to change password:', error);
      setPasswordError('Failed to change password. Please check your old password.');
    }
  };

  // Initialize profile form data when user changes
  useEffect(() => {
    if (user) {
      setProfileFormData({
        firstName: user.first_name || '',
        middleName: user.middle_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        contactNumber: user.contact_number || ''
      });
      // Sync photo preview with user photo
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
    setProfileFormData({
      firstName: user?.first_name || '',
      middleName: user?.middle_name || '',
      lastName: user?.last_name || '',
      email: user?.email || '',
      contactNumber: user?.contact_number || ''
    });
    setProfileError('');
    setProfileSuccess('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);

    try {
      const fullName = `${profileFormData.lastName}, ${profileFormData.firstName}${profileFormData.middleName ? ' ' + profileFormData.middleName : ''}`;
      
      await UpdateUser(
        user.id,
        fullName,
        profileFormData.firstName,
        profileFormData.middleName,
        profileFormData.lastName,
        '', // gender
        user.role || '',
        '', // employeeID
        user.student_id || user.name || '', // studentID
        '', // year - not editable
        '', // section - not editable
        profileFormData.email,
        profileFormData.contactNumber,
        '' // departmentCode
      );

      // Update user in context and localStorage
      const updatedUserData = {
        first_name: profileFormData.firstName,
        middle_name: profileFormData.middleName,
        last_name: profileFormData.lastName,
        email: profileFormData.email,
        contact_number: profileFormData.contactNumber,
        name: fullName
      };
      updateUser(updatedUserData);

      setProfileSuccess('Profile updated successfully!');
      setEditingProfile(false);
      
      // Close modal after showing success message
      setTimeout(() => {
        handleCloseAccountModal();
      }, 1500);
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
    setPhotoFile(null);
    setPhotoPreview(user?.photo_url || '');
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setEditingProfile(false);
    setProfileFormData({
      firstName: user?.first_name || '',
      middleName: user?.middle_name || '',
      lastName: user?.last_name || '',
      email: user?.email || '',
      contactNumber: user?.contact_number || ''
    });
    setProfileError('');
    setProfileSuccess('');
  };

  const handleCancelPhotoChange = () => {
    setPhotoFile(null);
    setPhotoPreview(user?.photo_url || '');
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModalBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseAccountModal();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Also check if click is on profile icon
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

  // Close dropdown and modal on escape key
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
    <div className="h-screen overflow-hidden bg-gray-50">
      {/* Modern Expandable Sidebar */}
      <div 
        ref={sidebarRef}
        className={`fixed left-0 top-0 bottom-0 flex flex-col bg-white shadow-xl border-r border-gray-200 z-10 transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-64' : 'w-20'
        }`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Navigation Section */}
        <div className="flex-1 pt-20 pb-6 overflow-y-auto overflow-x-hidden sidebar-scroll">
          <nav className="px-3 space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`relative flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                  item.current
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {/* Active indicator bar */}
                {item.current && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                )}
                
                <div className={`flex-shrink-0 transition-colors duration-200 ${
                  item.current ? 'text-white' : 'text-gray-500 group-hover:text-primary-600'
                } [&>svg]:w-6 [&>svg]:h-6`}>
                  {item.icon}
                </div>
                
                <span className={`ml-4 font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                  sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                }`}>
                  {item.name}
                </span>
                
                {/* Tooltip for collapsed state */}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.name}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
                  </div>
                )}
              </Link>
            ))}
          </nav>
        </div>
        
        {/* Divider */}
        <div className="border-t border-gray-200 mx-3" />
        
        {/* Profile Section */}
        <div className="flex-shrink-0 p-4">
          <div 
            className={`flex items-center space-x-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setProfileDropdownOpen(!profileDropdownOpen);
            }}
          >
            <div className="flex-shrink-0 relative">
              {user?.photo_url || photoPreview ? (
                <img 
                  src={photoPreview || user?.photo_url} 
                  alt="Profile" 
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-primary-200 shadow-sm"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-2 ring-primary-200 shadow-sm">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            
            <div className={`flex-1 min-w-0 transition-all duration-300 ${
              sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
            }`}>
              <div className="text-sm font-semibold text-gray-900 truncate">
                {user?.first_name || user?.name || 'User'}
              </div>
              <div className="text-xs text-gray-500 capitalize truncate">
                {user?.role?.replace('_', ' ') || 'Role'}
              </div>
            </div>
            
            <ChevronDown className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-all duration-300 ${
              sidebarExpanded ? 'opacity-100 w-4' : 'opacity-0 w-0'
            }`} />
          </div>
        </div>
        
        {/* Expand/Collapse Toggle */}
        <div className="absolute -right-3 top-1/2 -translate-y-1/2">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-6 h-6 bg-white hover:bg-gray-50 text-gray-600 hover:text-primary-600 rounded-full shadow-lg border border-gray-300 flex items-center justify-center transition-all duration-200"
          >
            {sidebarExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Profile dropdown - positioned outside sidebar */}
      {profileDropdownOpen && (
        <div 
          className={`fixed bottom-6 w-64 rounded-xl shadow-2xl bg-white ring-1 ring-gray-200 z-[9999] overflow-hidden transition-all duration-300 ${
            sidebarExpanded ? 'left-72' : 'left-24'
          }`}
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
        >
          {/* User Info Header */}
          <div className="px-4 py-4 bg-gradient-to-r from-primary-500 to-primary-600">
            <div className="flex items-center space-x-3">
              {user?.photo_url || photoPreview ? (
                <img 
                  src={photoPreview || user?.photo_url} 
                  alt="Profile" 
                  className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white shadow-md">
                  <User className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user?.first_name || user?.name || 'User'}</div>
                <div className="text-xs text-primary-100 capitalize truncate">{user?.role?.replace('_', ' ') || 'Role'}</div>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-2">
            <button
              type="button"
              className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-left transition-all group"
              onClick={(e) => {
                e.stopPropagation();
                setShowAccountModal(true);
                setProfileDropdownOpen(false);
              }}
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors mr-3">
                <Settings className="h-4 w-4 text-gray-600 group-hover:text-primary-600 transition-colors" />
              </div>
              <span className="font-medium">Account Settings</span>
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 text-left transition-all group"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors mr-3">
                <LogOut className="h-4 w-4 text-red-600" />
              </div>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex flex-col h-screen bg-gray-50 transition-all duration-300 overflow-hidden ${
        sidebarExpanded ? 'ml-64' : 'ml-20'
      }`}>
        {/* Top navigation */}
        <div className="flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200 z-10">
          <div className="flex-1 px-6 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Additional header items can go here */}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 bg-gray-50 overflow-y-auto overflow-x-hidden">
          <div className="py-6">
            <div className="max-w-full mx-auto px-4 sm:px-6 md:px-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-[10000] flex items-start justify-center p-4"
          onClick={handleModalBackdropClick}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col z-[10001] my-4">
            {/* Modal Header - Fixed */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-8 py-5 flex justify-between items-center flex-shrink-0 rounded-t-xl">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Account Settings</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAccountModal}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 focus:outline-none transition-all"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs - Fixed */}
            <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex px-8">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-6 border-b-3 font-semibold text-sm transition-all ${
                    activeTab === 'profile'
                      ? 'border-gray-700 text-gray-900 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <UserCircle className="h-5 w-5" />
                    <span>Profile Information</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`py-4 px-6 border-b-3 font-semibold text-sm transition-all ${
                    activeTab === 'password'
                      ? 'border-gray-700 text-gray-900 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Security</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="px-8 py-6 bg-gray-50 overflow-y-auto flex-1">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Student/Working Student specific layout */}
                  {(user?.role === 'student' || user?.role === 'working_student') ? (
                    <form onSubmit={handleSaveProfile} className="space-y-6">
                      {profileError && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md shadow-sm">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {profileError}
                          </div>
                        </div>
                      )}
                      
                      {profileSuccess && (
                        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-md shadow-sm">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {profileSuccess}
                          </div>
                        </div>
                      )}

                      {/* Profile Photo Section */}
                      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                        <div className="flex items-center space-x-6">
                          <div className="relative">
                            {photoPreview ? (
                              <img 
                                src={photoPreview} 
                                alt="Profile" 
                                className="h-20 w-20 rounded-full object-cover border-4 border-gray-200 shadow-md"
                              />
                            ) : (
                              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-4 border-gray-200 shadow-md">
                                <User className="h-10 w-10 text-gray-600" />
                              </div>
                            )}
                            <div className="absolute bottom-0 right-0 bg-gray-700 rounded-full p-1.5 shadow-lg">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">Profile Photo</h4>
                            <div className="flex items-center space-x-3">
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
                                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium shadow-sm"
                              >
                                Choose Photo
                              </button>
                              {photoFile && (
                                <>
                                  <button
                                    type="button"
                                    onClick={handlePhotoSave}
                                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                                  >
                                    Save Photo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelPhotoChange}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors font-medium"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Personal Information Section */}
                      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-gray-900">Personal Information</h4>
                          <button
                            type="button"
                            onClick={editingProfile ? handleCancelEditProfile : handleEditProfile}
                            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>{editingProfile ? 'Cancel' : 'Edit'}</span>
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Student ID */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                            <input
                              type="text"
                              value={user?.student_id || user?.name || ''}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-medium"
                              disabled
                            />
                          </div>

                          {/* Last Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                            <input
                              type="text"
                              value={editingProfile ? profileFormData.lastName : (user?.last_name || '')}
                              onChange={(e) => editingProfile && setProfileFormData({ ...profileFormData, lastName: e.target.value })}
                              className={`w-full px-4 py-2.5 border rounded-lg ${
                                editingProfile 
                                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-gray-500 focus:border-transparent' 
                                  : 'border-gray-300 bg-gray-50 text-gray-600'
                              }`}
                              disabled={!editingProfile}
                              required
                            />
                          </div>

                          {/* First Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                            <input
                              type="text"
                              value={editingProfile ? profileFormData.firstName : (user?.first_name || '')}
                              onChange={(e) => editingProfile && setProfileFormData({ ...profileFormData, firstName: e.target.value })}
                              className={`w-full px-4 py-2.5 border rounded-lg ${
                                editingProfile 
                                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-gray-500 focus:border-transparent' 
                                  : 'border-gray-300 bg-gray-50 text-gray-600'
                              }`}
                              disabled={!editingProfile}
                              required
                            />
                          </div>

                          {/* Middle Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                            <input
                              type="text"
                              value={editingProfile ? profileFormData.middleName : (user?.middle_name || '')}
                              onChange={(e) => editingProfile && setProfileFormData({ ...profileFormData, middleName: e.target.value })}
                              className={`w-full px-4 py-2.5 border rounded-lg ${
                                editingProfile 
                                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-gray-500 focus:border-transparent' 
                                  : 'border-gray-300 bg-gray-50 text-gray-600'
                              }`}
                              disabled={!editingProfile}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contact Information Section */}
                      <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Contact Number */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                            <input
                              type="text"
                              value={editingProfile ? profileFormData.contactNumber : (user?.contact_number || '')}
                              onChange={(e) => editingProfile && setProfileFormData({ ...profileFormData, contactNumber: e.target.value })}
                              className={`w-full px-4 py-2.5 border rounded-lg ${
                                editingProfile 
                                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-gray-500 focus:border-transparent' 
                                  : 'border-gray-300 bg-gray-50 text-gray-600'
                              }`}
                              disabled={!editingProfile}
                            />
                          </div>

                          {/* Email */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input
                              type="email"
                              value={editingProfile ? profileFormData.email : (user?.email || '')}
                              onChange={(e) => editingProfile && setProfileFormData({ ...profileFormData, email: e.target.value })}
                              className={`w-full px-4 py-2.5 border rounded-lg ${
                                editingProfile 
                                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-gray-500 focus:border-transparent' 
                                  : 'border-gray-300 bg-gray-50 text-gray-600'
                              }`}
                              disabled={!editingProfile}
                            />
                          </div>

                          {/* Account Created */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
                            <input
                              type="text"
                              value={user?.created ? new Date(user.created).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'N/A'}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                              disabled
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {editingProfile && (
                        <div className="flex justify-end gap-3 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                          <button
                            type="button"
                            onClick={handleCancelEditProfile}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center space-x-2"
                          >
                            {savingProfile ? (
                              <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Save Changes</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </form>
                  ) : (
                    <>
                      {/* For admins and teachers - improved layout */}
                      <div className="space-y-6">
                        {/* Profile Photo Section */}
                        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">Profile Photo</h4>
                          <div className="flex items-center space-x-6">
                            <div className="relative">
                              {photoPreview ? (
                                <img 
                                  src={photoPreview} 
                                  alt="Profile" 
                                  className="h-20 w-20 rounded-full object-cover border-4 border-blue-100 shadow-md"
                                />
                              ) : (
                                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-4 border-gray-200 shadow-md">
                                  <User className="h-10 w-10 text-gray-600" />
                                </div>
                              )}
                              <div className="absolute bottom-0 right-0 bg-gray-700 rounded-full p-1.5 shadow-lg">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
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
                                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium shadow-sm"
                                >
                                  Choose Photo
                                </button>
                                {photoFile && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handlePhotoSave}
                                      className="px-4 py-2 bg-success-600 text-white border border-success-600 text-sm rounded-lg hover:bg-success-700 hover:border-success-700 transition-colors font-medium shadow-sm"
                                    >
                                      Save Photo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelPhotoChange}
                                      className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition-colors font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Personal Information Section */}
                        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">Personal Information</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* ID Field */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {user?.role === 'admin' ? 'Admin ID' : 'Teacher ID'}
                              </label>
                              <input
                                type="text"
                                value={user?.employee_id || user?.name || 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-medium"
                                disabled
                              />
                            </div>

                            {/* Last Name */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                              <input
                                type="text"
                                value={user?.last_name || 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                disabled
                              />
                            </div>

                            {/* First Name */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                              <input
                                type="text"
                                value={user?.first_name || 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                disabled
                              />
                            </div>

                            {/* Middle Name */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                              <input
                                type="text"
                                value={user?.middle_name || 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        {/* Contact Information Section */}
                        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Contact Number - only for teachers */}
                            {user?.role === 'teacher' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                                <input
                                  type="text"
                                  value={user?.contact_number || 'N/A'}
                                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                  disabled
                                />
                              </div>
                            )}

                            {/* Email */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                              <input
                                type="email"
                                value={user?.email || 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                disabled
                              />
                            </div>

                            {/* Account Created */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
                              <input
                                type="text"
                                value={user?.created ? new Date(user.created).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'N/A'}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                                disabled
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'password' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    {/* Title */}
                    <div className="flex items-center space-x-3 mb-5">
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <Lock className="h-6 w-6 text-blue-600" />
                      </div>
                      <h4 className="text-xl font-bold text-gray-900">Change Password</h4>
                    </div>
                  
                    <form onSubmit={handlePasswordChange} className="space-y-5">
                      {passwordError && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md shadow-sm">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {passwordError}
                          </div>
                        </div>
                      )}
                      
                      {passwordSuccess && (
                        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-md shadow-sm">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {passwordSuccess}
                          </div>
                        </div>
                      )}

                      {/* Current Password */}
                      <div>
                        <label htmlFor="oldPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                          Current Password
                        </label>
                        <input
                          type="password"
                          id="oldPassword"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white text-gray-900"
                          required
                        />
                      </div>

                      {/* New Password */}
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          id="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white text-gray-900"
                          required
                        />
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          id="confirmPassword"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white text-gray-900"
                          required
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                        >
                          <Lock className="h-5 w-5" />
                          <span>Update Password</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Logout Confirmation Modal (for students only) */}
      {showLogoutConfirmModal && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleLogoutCancel();
            }
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Modal Content */}
            <div className="p-6">
              {/* Icon */}
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 text-center mb-6">
                Are you sure you want to logout?
              </h3>
              
              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleLogoutCancel}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium text-sm shadow-sm"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Feedback Modal (for students only) */}
      {showFeedbackModal && (
        <LogoutFeedbackModal
          onClose={handleFeedbackCancel}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  );
}

export default Layout;
