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
  UserCircle
} from 'lucide-react';
import LogoutFeedbackModal from './LogoutFeedbackModal';

interface LayoutProps {
  children: React.ReactNode;
  navigationItems: NavigationItem[];
  title: string;
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
      {/* Static sidebar - always visible - Icon-only design */}
      <div className="fixed left-0 top-0 bottom-0 flex flex-col w-16 bg-gray-200 shadow-lg border-r border-gray-300 z-10">
        {/* Navigation Section - Icon only */}
        <div className="flex-1 pt-2 pb-4 overflow-y-auto overflow-x-hidden">
              <nav className="flex flex-col items-center space-y-3 px-2">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={item.name}
                    className={`${
                      item.current
                        ? 'bg-purple-100 rounded-lg'
                        : 'hover:bg-gray-300 rounded-lg'
                    } group flex items-center justify-center w-12 h-12 transition-all duration-200 ease-in-out`}
                  >
                    <div className={`${item.current ? 'text-purple-700' : 'text-gray-600 group-hover:text-gray-800'} transition-colors duration-200 [&>svg]:w-6 [&>svg]:h-6`}>
                      {item.icon}
                    </div>
                  </Link>
                ))}
              </nav>
        </div>
        
        {/* Footer Section - User Profile */}
        <div className="flex-shrink-0 pb-4 flex items-center justify-center">
          {user?.photo_url || photoPreview ? (
            <img 
              src={photoPreview || user?.photo_url} 
              alt="Profile" 
              className="h-10 w-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-gray-400 transition-all"
              data-profile-icon
              onClick={(e) => {
                e.stopPropagation();
                setProfileDropdownOpen(!profileDropdownOpen);
              }}
            />
          ) : (
            <div 
              className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-gray-400 transition-all"
              data-profile-icon
              onClick={(e) => {
                e.stopPropagation();
                setProfileDropdownOpen(!profileDropdownOpen);
              }}
            >
              <User className="h-6 w-6 text-gray-600" />
            </div>
          )}
        </div>
      </div>
      
      {/* Profile dropdown - positioned outside sidebar to avoid clipping */}
      {profileDropdownOpen && (
        <div 
          className="fixed left-16 bottom-4 w-48 rounded-md shadow-xl py-1 bg-white ring-1 ring-black ring-opacity-5 z-[9999]"
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-900">{user?.first_name || user?.name || 'User'}</div>
              <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ') || 'Role'}</div>
            </div>
            <button
              type="button"
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
              onClick={(e) => {
                e.stopPropagation();
                setShowAccountModal(true);
                setProfileDropdownOpen(false);
              }}
            >
              <Settings className="h-4 w-4 mr-3" />
              Account
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign out
            </button>
          </div>
        )}

      {/* Main content */}
      <div className="flex flex-col h-screen bg-gray-50 ml-16 overflow-hidden">
        {/* Top navigation */}
        <div className="flex-shrink-0 flex h-16 bg-white shadow-md border-b border-gray-300 z-10">
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <span className="text-xl lg:text-2xl font-semibold text-gray-900">{title}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 bg-gray-50 overflow-y-auto overflow-x-hidden">
          <div className="py-6">
            <div className="max-w-full mx-auto px-4 sm:px-6 md:px-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[10000] flex items-center justify-center p-4"
          onClick={handleModalBackdropClick}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="relative bg-white rounded-lg shadow-xl w-auto max-w-lg max-h-[90vh] flex flex-col z-[10001]">
            {/* Modal Header - Fixed */}
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">Account Settings</h3>
              <button
                type="button"
                onClick={handleCloseAccountModal}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs - Fixed */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <div className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'profile'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <UserCircle className="h-5 w-5" />
                    <span>Profile</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'password'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Change Password</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Tab Content - Scrollable */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Student/Working Student specific layout */}
                  {(user?.role === 'student' || user?.role === 'working_student') ? (
                    <form onSubmit={handleSaveProfile} className="space-y-6">
                      {profileError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                          {profileError}
                        </div>
                      )}
                      
                      {profileSuccess && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                          {profileSuccess}
                        </div>
                      )}

                      {/* Basic Information Section */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h4>
                        
                        {/* Profile Photo and Fields Layout */}
                        <div className="flex gap-6 items-start mb-4">
                          {/* Profile Photo - Left Side */}
                          <div className="flex flex-col items-start flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                            {photoPreview ? (
                              <img 
                                src={photoPreview} 
                                alt="Profile" 
                                className="h-20 w-20 rounded-full object-cover border-2 border-gray-300"
                              />
                            ) : (
                              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                                <User className="h-10 w-10 text-gray-400" />
                              </div>
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                              onClick={(e) => {
                                // Reset input value to allow selecting the same file again
                                (e.target as HTMLInputElement).value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                            >
                              Change Photo
                            </button>
                            {photoFile && (
                              <>
                                <button
                                  type="button"
                                  onClick={handlePhotoSave}
                                  className="mt-1 text-xs text-green-600 hover:text-green-800 underline font-medium"
                                >
                                  Save Photo
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelPhotoChange}
                                  className="mt-1 text-xs text-gray-600 hover:text-gray-800 underline font-medium"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>

                          {/* Form Fields - Right Side */}
                          <div className="space-y-3">
                          {/* Student ID */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Student ID</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="text"
                                  value={user?.student_id || user?.name || ''}
                                  className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 w-56"
                                  disabled
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.student_id || user?.name || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Last Name */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Last Name</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="text"
                                  value={profileFormData.lastName}
                                  onChange={(e) => setProfileFormData({ ...profileFormData, lastName: e.target.value })}
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                                  required
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.last_name || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* First Name */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">First Name</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="text"
                                  value={profileFormData.firstName}
                                  onChange={(e) => setProfileFormData({ ...profileFormData, firstName: e.target.value })}
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                                  required
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.first_name || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Middle Name */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Middle Name</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="text"
                                  value={profileFormData.middleName}
                                  onChange={(e) => setProfileFormData({ ...profileFormData, middleName: e.target.value })}
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.middle_name || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Details Section */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">Contact Details</h4>
                        
                        <div className="space-y-3">
                          {/* Contact Number */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Contact No.</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="text"
                                  value={profileFormData.contactNumber}
                                  onChange={(e) => setProfileFormData({ ...profileFormData, contactNumber: e.target.value })}
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.contact_number || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Email */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Email</label>
                            <div className="ml-3">
                              {editingProfile ? (
                                <input
                                  type="email"
                                  value={profileFormData.email}
                                  onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                  <span className="text-gray-900">{user?.email || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Account Created */}
                          <div className="flex items-center">
                            <label className="block text-sm font-medium text-gray-700 w-28 text-left">Account Created</label>
                            <div className="ml-3">
                              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 w-64">
                                <span className="text-gray-900">
                                  {user?.created ? new Date(user.created).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mt-4">
                        <button
                          type="button"
                          onClick={editingProfile ? handleCancelEditProfile : handleEditProfile}
                          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="submit"
                          disabled={!editingProfile || savingProfile}
                          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingProfile ? 'Updating...' : 'Update'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* For admins and teachers - keep existing layout */}
                      <div className="space-y-6">
                        {/* Basic Information Section */}
                        <div className="mb-8">
                          <h4 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h4>
                          
                          {/* Profile Picture and ID Row */}
                          <div className="flex items-center gap-8 mb-6">
                            {/* Profile Picture */}
                            <div className="flex flex-col items-center">
                              {photoPreview ? (
                                <img 
                                  src={photoPreview} 
                                  alt="Profile" 
                                  className="h-24 w-24 rounded-full object-cover border-2 border-gray-300"
                                />
                              ) : (
                                <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300">
                                  <User className="h-14 w-14 text-gray-600" />
                                </div>
                              )}
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                                onClick={(e) => {
                                  // Reset input value to allow selecting the same file again
                                  (e.target as HTMLInputElement).value = '';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                              >
                                Change Photo
                              </button>
                              {photoFile && (
                                <>
                                  <button
                                    type="button"
                                    onClick={handlePhotoSave}
                                    className="mt-1 text-sm text-green-600 hover:text-green-800 underline font-medium"
                                  >
                                    Save Photo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelPhotoChange}
                                    className="mt-1 text-sm text-gray-600 hover:text-gray-800 underline font-medium"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                            
                            {/* ID - positioned next to profile picture */}
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {user?.role === 'admin' ? 'Admin ID' : 
                                 user?.role === 'teacher' ? 'Teacher ID' : 'Student ID'}
                              </label>
                              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                <span className="text-gray-900">
                                  {user?.role === 'admin' ? (user?.employee_id || user?.name || 'N/A') :
                                   user?.role === 'teacher' ? (user?.employee_id || user?.name || 'N/A') :
                                   user?.student_id || user?.name || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* For admins */}
                          {user?.role === 'admin' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Last Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.last_name || 'N/A'}</span>
                                </div>
                              </div>

                              {/* First Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.first_name || 'N/A'}</span>
                                </div>
                              </div>

                              {/* Middle Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.middle_name || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* For teachers */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Last Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.last_name || 'N/A'}</span>
                                </div>
                              </div>

                              {/* First Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.first_name || 'N/A'}</span>
                                </div>
                              </div>

                              {/* Middle Name */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.middle_name || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Contact Details Section */}
                        <div className="mb-8">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Contact Number - only show for teachers */}
                            {user?.role === 'teacher' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contact No.</label>
                                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                  <span className="text-gray-900">{user?.contact_number || 'N/A'}</span>
                                </div>
                              </div>
                            )}

                            {/* Email */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                <span className="text-gray-900">{user?.email || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Account Created Section */}
                        <div className="mb-8">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Created</h4>
                          <div>
                            <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                              <span className="text-gray-900">
                                {user?.created ? new Date(user.created).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'password' && (
                <div className="space-y-4">
                  {/* Title */}
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">Change Password</h4>
                  
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passwordError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        {passwordError}
                      </div>
                    )}
                    
                    {passwordSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                        {passwordSuccess}
                      </div>
                    )}

                    {/* Current Password */}
                    <div>
                      <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="oldPassword"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    {/* New Password */}
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
                      >
                        Change Password
                      </button>
                    </div>
                  </form>
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
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-md"
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