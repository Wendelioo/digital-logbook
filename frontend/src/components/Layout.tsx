import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UpdateUserPhoto, ChangePassword, SaveEquipmentFeedback, UpdateUser } from '../../wailsjs/go/main/App';
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

function Layout({ children, navigationItems, title, subtitle }: LayoutProps) {
  const { user, logout, updateUser } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(user?.photo_url || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);
  
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

  const handleLogout = async () => {
    // Show feedback modal ONLY for regular students
    if (user?.role === 'student') {
      setShowLogoutConfirmModal(true);
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
    if (!file) return;

    // Validate file type and size
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
      
      alert('Profile photo updated successfully!');
    } catch (error: any) {
      console.error('Failed to update profile photo:', error);
      
      // Clear the preview since save failed - photo is NOT actually saved
      setPhotoPreview(user?.photo_url || '');
      setPhotoFile(null);
      
      // Show the actual error message from the backend
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
    setProfileError('');
    setProfileSuccess('');
    // Reset form data
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
      // Call the backend function to update user
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

      // Update user in context and localStorage
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

      // Auto-hide success message after 3 seconds
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
    // Reset password fields
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    // Reset profile form
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

  // Close dropdown when clicking outside
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* LEFT SIDEBAR - No Logo/Title */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-30 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Toggle Button */}
        <div className="absolute -right-3 top-6 z-40">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-primary-600 hover:border-primary-300 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <Menu className="w-3.5 h-3.5" />
            ) : (
              <XIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto pt-6 pb-4 px-3">
          <ul className="space-y-1.5">
            {navigationItems.map((item) => {
              // Handle divider items
              if (item.isDivider) {
                return (
                  <li key={item.name} className="pt-4 pb-2">
                    {!sidebarCollapsed && (
                      <div className="px-3">
                        <div className="border-t border-gray-200 mb-2"></div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {item.label || item.name}
                        </span>
                      </div>
                    )}
                    {sidebarCollapsed && (
                      <div className="border-t border-gray-200 mx-3"></div>
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
                    // Dropdown item
                    <div>
                      <button
                        onClick={() => {
                          if (isOpen) {
                            setOpenDropdowns(openDropdowns.filter(name => name !== item.name));
                          } else {
                            setOpenDropdowns([...openDropdowns, item.name]);
                          }
                        }}
                        className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isChildActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title={item.name}
                      >
                        <div className="flex items-center">
                          {/* Active Indicator */}
                          {isChildActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
                          )}
                          
                          {/* Icon */}
                          <div className={`flex-shrink-0 ${
                            isChildActive ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'
                          } [&>svg]:w-5 [&>svg]:h-5`}>
                            {item.icon}
                          </div>
                          
                          {/* Label */}
                          {!sidebarCollapsed && (
                            <span className="ml-3 whitespace-nowrap">
                              {item.name}
                            </span>
                          )}
                        </div>
                        
                        {/* Dropdown Arrow */}
                        {!sidebarCollapsed && (
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`} />
                        )}
                        
                        {/* Tooltip for collapsed state */}
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                            {item.name}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                          </div>
                        )}
                      </button>
                      
                      {/* Dropdown Menu */}
                      {isOpen && !sidebarCollapsed && item.children && (
                        <ul className="mt-1 ml-4 space-y-1">
                          {item.children.map((child) => (
                            <li key={child.name}>
                              <Link
                                to={child.href}
                                className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  child.current
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                title={child.name}
                              >
                                {/* Active Indicator */}
                                {child.current && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary-600 rounded-r-full" />
                                )}
                                
                                {/* Icon */}
                                <div className={`flex-shrink-0 ${
                                  child.current ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'
                                } [&>svg]:w-4 [&>svg]:h-4`}>
                                  {child.icon}
                                </div>
                                
                                {/* Label */}
                                <span className="ml-3 whitespace-nowrap text-xs">
                                  {child.name}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    // Regular item
                    <Link
                      to={item.href}
                      className={`group relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        item.current
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      title={item.name}
                    >
                      {/* Active Indicator */}
                      {item.current && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
                      )}
                      
                      {/* Icon */}
                      <div className={`flex-shrink-0 ${
                        item.current ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'
                      } [&>svg]:w-5 [&>svg]:h-5`}>
                        {item.icon}
                      </div>
                      
                      {/* Label */}
                      {!sidebarCollapsed && (
                        <span className="ml-3 whitespace-nowrap">
                          {item.name}
                        </span>
                      )}
                      
                      {/* Tooltip for collapsed state */}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-6 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                          {item.name}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                        </div>
                      )}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Section - User Profile */}
        <div className="border-t border-gray-200 p-3">
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              data-profile-icon
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {user?.photo_url || photoPreview ? (
                  <img 
                    src={photoPreview || user?.photo_url} 
                    alt="Profile" 
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center ring-2 ring-gray-200">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 rounded-full border-2 border-white" />
              </div>
              
              {/* User Info */}
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {user?.first_name && user?.last_name 
                      ? `${user.first_name} ${user.last_name}`
                      : user?.first_name || user?.name || 'User'
                    }
                  </div>
                  <div className="text-xs text-gray-500 capitalize truncate">
                    {user?.role?.replace('_', ' ') || 'Role'}
                  </div>
                </div>
              )}
              
              {!sidebarCollapsed && (
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                  profileDropdownOpen ? 'rotate-180' : ''
                }`} />
              )}
            </button>

            {/* Profile Dropdown */}
            {profileDropdownOpen && (
              <div 
                ref={dropdownRef}
                className={`absolute bottom-full mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 ${
                  sidebarCollapsed ? 'left-full ml-2 w-56' : 'left-0 right-0'
                }`}
              >
                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowAccountModal(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Account Settings</span>
                  </button>
                  
                  <div className="border-t border-gray-100 my-1.5" />
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
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

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        {/* TOP HEADER */}
        <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <div className="flex-1">
            {title && (
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Additional header actions can go here */}
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* MODALS */}
      
      {/* Account Settings Modal */}
      {showAccountModal && (
        <div 
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
          onClick={handleModalBackdropClick}
        >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary-600" />
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

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-primary-600 text-primary-600'
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
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Security</span>
                </div>
              </button>
            </div>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'profile' ? (
                <div className="space-y-6">
                  {/* Profile content will go here - keeping existing logic */}
                  {/* Profile Photo Section */}
                  <div className="bg-beige-50 rounded-lg p-5 border border-beige-200">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {photoPreview ? (
                          <img 
                            src={photoPreview} 
                            alt="Profile" 
                            className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center ring-4 ring-white shadow-md">
                            <User className="w-10 h-10 text-primary-600" />
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
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                            >
                              Save Photo
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Max file size: 5MB. Recommended: 400x400px</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Information - Role Specific */}
                  {(user?.role === 'student' || user?.role === 'working_student') && (
                    <form onSubmit={handleSaveProfile} className="space-y-5">
                      {profileError && (
                        <div className="bg-danger-50 border-l-4 border-danger-500 p-4 rounded-lg">
                          <p className="text-sm text-danger-700">{profileError}</p>
                        </div>
                      )}
                      
                      {profileSuccess && (
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
                            disabled={!editingProfile}
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
                            disabled={!editingProfile}
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
                            disabled={!editingProfile}
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
                            disabled={!editingProfile}
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
                            disabled={!editingProfile}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        {!editingProfile ? (
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
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingProfile ? 'Saving...' : 'Save Changes'}
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                  )}

                  {/* For non-student roles - display only */}
                  {user?.role !== 'student' && user?.role !== 'working_student' && (
                    <div className="space-y-4">
                      <div className="bg-beige-50 rounded-lg p-5 border border-beige-200">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {user?.first_name} {user?.middle_name} {user?.last_name}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</dt>
                            <dd className="mt-1 text-sm text-gray-900">{user?.email || 'Not set'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</dt>
                            <dd className="mt-1 text-sm text-gray-900">{user?.contact_number || 'Not set'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</dt>
                            <dd className="mt-1 text-sm text-gray-900 capitalize">{user?.role?.replace('_', ' ')}</dd>
                          </div>
                        </dl>
                      </div>
                      <p className="text-sm text-gray-500">
                        Contact an administrator to update your profile information.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-5">
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseAccountModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
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

      {/* Logout Confirmation Modal (for students) */}
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

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <LogoutFeedbackModal
          onSubmit={handleFeedbackSubmit}
          onClose={handleFeedbackCancel}
        />
      )}
    </div>
  );
}

export default Layout;
