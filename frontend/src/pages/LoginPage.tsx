import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Eye, EyeOff, UserPlus, Settings, KeyRound, Check, X } from 'lucide-react';
import { CreateUser, GetDepartments, GetStudentTeachers, RequestPasswordReset } from '../../wailsjs/go/backend/App';
import { backend } from '../../wailsjs/go/models';
import Button from '../components/Button';
import { InputField } from '../components/Form';
import backgroundImage from '../assets/background/background.jpg';
import RegistrationModal from './RegistrationPage';

type Department = backend.Department;
type TeacherOption = backend.TeacherOption;

const roleRoutes: { [key: string]: string } = {
  student: '/student',
  working_student: '/working-student',
  teacher: '/teacher',
  admin: '/admin'
};

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  type ForgotStep = 'form' | 'submitted';
  const [forgotStep, setForgotStep] = useState<ForgotStep>('form');
  const [forgotStudentCode, setForgotStudentCode] = useState('');
  const [forgotTeachers, setForgotTeachers] = useState<TeacherOption[]>([]);
  const [forgotTeacherID, setForgotTeacherID] = useState<number | ''>('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowNew, setForgotShowNew] = useState(false);
  const [forgotShowConfirm, setForgotShowConfirm] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotTeacherName, setForgotTeacherName] = useState('');

  const pwRules = {
    length: forgotNewPassword.length >= 8,
    upper: /[A-Z]/.test(forgotNewPassword),
    number: /[0-9]/.test(forgotNewPassword),
    special: /[^A-Za-z0-9]/.test(forgotNewPassword),
  };
  const pwValid = Object.values(pwRules).every(Boolean);
  const pwMatch = forgotNewPassword === forgotConfirmPassword && forgotConfirmPassword.length > 0;

  const handleForgotStudentBlur = async () => {
    const code = forgotStudentCode.trim();
    if (!code) return;
    setForgotError('');
    setForgotTeachers([]);
    setForgotTeacherID('');
    try {
      const teachers = await GetStudentTeachers(code);
      if (!teachers || teachers.length === 0) {
        setForgotError('No active classes found for this Student ID.');
      } else {
        setForgotTeachers(teachers);
      }
    } catch (err) {
      setForgotError('Student ID not found.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) { setForgotError('Password does not meet requirements.'); return; }
    if (!pwMatch) { setForgotError('Passwords do not match.'); return; }
    if (!forgotTeacherID) { setForgotError('Please select a teacher.'); return; }
    setForgotLoading(true);
    setForgotError('');
    try {
      await RequestPasswordReset(forgotStudentCode.trim(), Number(forgotTeacherID), forgotNewPassword);
      const selected = forgotTeachers.find(t => t.teacher_user_id === Number(forgotTeacherID));
      setForgotTeacherName(selected?.full_name ?? 'your teacher');
      setForgotStep('submitted');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to submit request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('form');
    setForgotStudentCode('');
    setForgotTeachers([]);
    setForgotTeacherID('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotTeacherName('');
  };

  const [registrationData, setRegistrationData] = useState({
    studentCode: '',
    firstName: '',
    middleName: '',
    lastName: ''
  });
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Load departments when registration mode is activated
  useEffect(() => {
    if (isRegistering) {
      const loadDepartments = async () => {
        try {
          const data = await GetDepartments();
          const activeDepartments = (data || []).filter((dept: Department) => dept.is_active);
          setDepartments(activeDepartments);
        } catch (error) {
          console.error('Failed to load departments:', error);
        }
      };
      loadDepartments();
    }
  }, [isRegistering]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const userData = await login(username, password);
      
      if (userData) {
        navigate(roleRoutes[userData.role]);
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isDatabaseError = (errorMsg: string) => {
    return errorMsg.toLowerCase().includes('database') || 
           errorMsg.toLowerCase().includes('connection') ||
           errorMsg.toLowerCase().includes('connect');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationData.studentCode || !registrationData.firstName || !registrationData.lastName) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const fullName = `${registrationData.lastName}, ${registrationData.firstName}${registrationData.middleName ? ' ' + registrationData.middleName : ''}`;

      const result = await CreateUser(
        registrationData.studentCode,
        fullName,
        registrationData.firstName,
        registrationData.middleName,
        registrationData.lastName,
        'student',
        '',
        registrationData.studentCode, // student_id
        '', // email - can be updated in profile settings
        '', // contact number - can be updated in profile settings
        '' // departmentCode
      );

      
      
      // Reset registration form
      setRegistrationData({
        studentCode: '',
        firstName: '',
        middleName: '',
        lastName: ''
      });
      
      // Switch back to login mode after 3 seconds
      setTimeout(() => {
        setIsRegistering(false);
        setSuccessMessage('');
        setUsername(registrationData.studentCode); // Pre-fill username with student code
      }, 3000);
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex">
      {/* Left Section - Background Image with Title and Text */}
      <div className="w-1/2 relative flex flex-col justify-center items-start p-16 overflow-hidden">
        {/* Blurred Background Image */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(4px)',
            transform: 'scale(1.1)'
          }}
        ></div>
        {/* Gradient Overlay for better contrast and visual appeal */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/50 to-teal-900/40"></div>
        
        {/* Decorative Accent Line */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 via-teal-500 to-teal-600"></div>
        
        {/* Content Container */}
        <div className="relative z-10 max-w-2xl">
          {/* Text Content */}
          <div className="space-y-8">
            {/* Decorative element before heading */}
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-1 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full"></div>
              <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
            </div>
            
            <h2 className="text-5xl font-extrabold text-white leading-[1.1] tracking-[-0.02em] drop-shadow-2xl mb-4">
              Track Your Lab Attendance
            </h2>
            
            <p className="text-white/95 text-xl leading-[1.7] font-normal max-w-xl drop-shadow-lg pl-1">
              Log in with your account to view your records and monitor your computer lab history.
            </p>
            
            {/* Decorative dots */}
            <div className="flex items-center gap-2 pt-2">
              <div className="w-2 h-2 bg-teal-400/80 rounded-full"></div>
              <div className="w-2 h-2 bg-teal-400/60 rounded-full"></div>
              <div className="w-2 h-2 bg-teal-400/40 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - White Background with Login Form */}
      <div className="w-1/2 bg-white flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isRegistering ? 'Register an account to get started.' : 'Sign in to continue and access your account.'}
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-5 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-r-lg text-sm font-medium">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
              <p className="text-sm font-medium">{error}</p>
              {isDatabaseError(error) && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="text-xs mb-2">Can't connect to the database? You may need to configure the database settings.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/database-setup')}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-red-800 hover:text-red-900 underline"
                  >
                    <Settings className="w-4 h-4" />
                    Configure Database Connection
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Username/ID Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-800 mb-2.5">
                ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-password-input w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password Info */}
            <div className="pt-1 flex items-center justify-between">
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer" 
                />
                <span className="ml-2.5 text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                className="text-xs font-medium text-teal-600 hover:text-teal-700 underline decoration-dotted decoration-1"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white py-3.5 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-base shadow-md hover:shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>

            {/* Register Link */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setShowRegistrationModal(true)}
                  className="text-teal-600 hover:text-teal-700 font-semibold transition-colors"
                >
                  Register here
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
      
      {/* Registration Modal */}
      <RegistrationModal 
        isOpen={showRegistrationModal} 
        onClose={() => setShowRegistrationModal(false)} 
      />

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              </div>
              <button onClick={closeForgotModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {forgotStep === 'submitted' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-teal-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted</h4>
                  <p className="text-sm text-gray-600 mb-1">
                    Please wait for <strong>{forgotTeacherName}</strong> to approve your password reset request.
                  </p>
                  <p className="text-sm text-gray-500">Approach your teacher during your lab session.</p>
                  <button
                    onClick={closeForgotModal}
                    className="mt-6 w-full bg-teal-600 text-white py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                  {forgotError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {forgotError}
                    </div>
                  )}

                  {/* Student ID */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Student ID</label>
                    <input
                      type="text"
                      value={forgotStudentCode}
                      onChange={e => { setForgotStudentCode(e.target.value); setForgotTeachers([]); setForgotTeacherID(''); }}
                      onBlur={handleForgotStudentBlur}
                      placeholder="Enter your Student ID"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  {/* Teacher dropdown — shown after valid student ID */}
                  {forgotTeachers.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Teacher</label>
                      <select
                        value={forgotTeacherID}
                        onChange={e => setForgotTeacherID(Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        required
                      >
                        <option value="">— Select a teacher —</option>
                        {forgotTeachers.map(t => (
                          <option key={t.teacher_user_id} value={t.teacher_user_id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* New Password */}
                  {forgotTeachers.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                        <div className="relative">
                          <input
                            type={forgotShowNew ? 'text' : 'password'}
                            value={forgotNewPassword}
                            onChange={e => setForgotNewPassword(e.target.value)}
                            placeholder="New password"
                            className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                          <button type="button" tabIndex={-1}
                            onClick={() => setForgotShowNew(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600"
                          >
                            {forgotShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {/* Live checklist */}
                        {forgotNewPassword.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {[
                              { ok: pwRules.length,  label: 'At least 8 characters' },
                              { ok: pwRules.upper,   label: 'Uppercase letter (A-Z)' },
                              { ok: pwRules.number,  label: 'Number (0-9)' },
                              { ok: pwRules.special, label: 'Special character (!@#$%...)' },
                            ].map(r => (
                              <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
                                <Check className={`h-3 w-3 ${r.ok ? 'text-green-500' : 'text-gray-300'}`} />
                                {r.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={forgotShowConfirm ? 'text' : 'password'}
                            value={forgotConfirmPassword}
                            onChange={e => setForgotConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                              forgotConfirmPassword.length > 0
                                ? pwMatch ? 'border-green-400' : 'border-red-400'
                                : 'border-gray-300'
                            }`}
                            required
                          />
                          <button type="button" tabIndex={-1}
                            onClick={() => setForgotShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600"
                          >
                            {forgotShowConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {forgotConfirmPassword.length > 0 && !pwMatch && (
                          <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeForgotModal}
                      className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || !pwValid || !pwMatch || !forgotTeacherID}
                      className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {forgotLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
