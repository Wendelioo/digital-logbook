import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Eye, EyeOff, UserPlus, Settings, KeyRound, Check, X, CornerUpLeft } from 'lucide-react';
import { CreateUser, GetDepartments } from '../../wailsjs/go/backend/App';
import { backend } from '../../wailsjs/go/models';
import Button from '../components/Button';
import LoadingDots from '../components/LoadingDots';
import { InputField } from '../components/Form';
import backgroundImage from '../assets/background/background.jpg';
import RegistrationModal from './RegistrationPage';

type Department = backend.Department;

const roleRoutes: { [key: string]: string } = {
  student: '/student',
  working_student: '/student-staff',
  teacher: '/teacher',
  admin: '/admin'
};

const getErrorText = (err: unknown): string => {
  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }

    const maybeError = (err as { error?: unknown }).error;
    if (typeof maybeError === 'string') {
      return maybeError;
    }

    try {
      return JSON.stringify(err);
    } catch {
      return '';
    }
  }

  return '';
};

const mapLoginErrorMessage = (err: unknown): string => {
  const rawMessage = getErrorText(err);
  const message = rawMessage.toLowerCase();

  if (
    message.includes('invalid credentials') ||
    message.includes('invalid username or password') ||
    message.includes('user not found') ||
    message.includes('password is incorrect')
  ) {
    return 'Incorrect ID or password. Please check your details and try again.';
  }

  if (message.includes('pending approval') || message.includes('account pending')) {
    return 'Your account is pending approval. Please wait for verification.';
  }

  if (message.includes('registration was rejected') || message.includes('account rejected')) {
    return 'Your registration was rejected. Please contact your administrator.';
  }

  if (message.includes('archived')) {
    return 'Your account is archived. Please contact your administrator.';
  }

  if (message.includes('deactivated')) {
    return 'Your account is deactivated. Please contact your administrator.';
  }

  if (message.includes('deleted')) {
    return 'Your account was deleted. Please contact your administrator.';
  }

  if (message.includes('inactive')) {
    return 'Your account is inactive. Please contact your administrator.';
  }

  if (message.includes('expired after 4 years') || message.includes('account has expired')) {
    return 'Your student account has expired after 4 years. Please register a new account.';
  }

  if (
    message.includes('username is required') ||
    message.includes('password is required') ||
    message.includes('must be at least')
  ) {
    return rawMessage;
  }

  if (message.includes('runtime not initialized') || message.includes('run the app via wails')) {
    return 'Application runtime is not ready. Please restart the app.';
  }

  if (message.includes('database') || message.includes('connection') || message.includes('connect')) {
    return 'Unable to connect to the server right now. Please try again in a moment.';
  }

  if (rawMessage.trim().length > 0) {
    return rawMessage;
  }

  return 'Login failed. Please try again.';
};

const mapRegistrationErrorMessage = (err: unknown): string => {
  const rawMessage = getErrorText(err);
  const message = rawMessage.toLowerCase();

  if (message.includes('pending registration')) {
    return 'Your registration is already pending approval. Please wait for verification.';
  }

  if (message.includes('already active') || message.includes('already registered to an active account')) {
    return 'This account is already active. Please sign in instead.';
  }

  if (
    message.includes('student id already registered') ||
    message.includes('student id is already') ||
    ((message.includes('unique') || message.includes('duplicate')) &&
      (message.includes('student') || message.includes('username') || message.includes('users')))
  ) {
    return 'This Student ID is already registered. Please use a different Student ID.';
  }

  if (
    message.includes('email already') ||
    message.includes('email is already registered') ||
    ((message.includes('unique') || message.includes('duplicate')) &&
      (message.includes('email') || message.includes('students')))
  ) {
    return 'This email is already in use. Please use another email address.';
  }

  if (message.includes('department') && (message.includes('inactive') || message.includes('invalid') || message.includes('required'))) {
    return 'Please select a valid active department.';
  }

  if (message.includes('database') || message.includes('connection') || message.includes('transaction failed')) {
    return 'Unable to process registration right now. Please try again in a moment.';
  }

  if (rawMessage.trim().length > 0) {
    return rawMessage;
  }

  return 'Registration failed. Please try again.';
};

function LoginPage() {
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true');
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
  type ForgotStep = 'form' | 'completed';
  const [forgotStep, setForgotStep] = useState<ForgotStep>('form');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotIdentityVerified, setForgotIdentityVerified] = useState(false);
  const [forgotCodeVerified, setForgotCodeVerified] = useState(false);
  const [forgotRecoveryCode, setForgotRecoveryCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowNew, setForgotShowNew] = useState(false);
  const [forgotShowConfirm, setForgotShowConfirm] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [showLockSettingsModal, setShowLockSettingsModal] = useState(false);
  const [lockExpression, setLockExpression] = useState('lockmode: false');
  const [lockComputerLab, setLockComputerLab] = useState('');
  const [lockPCNumber, setLockPCNumber] = useState('');
  const [lockStationLabel, setLockStationLabel] = useState('Unconfigured PC');
  const [lockStatusMessage, setLockStatusMessage] = useState('');
  const [lockErrorMessage, setLockErrorMessage] = useState('');
  const [lockSaving, setLockSaving] = useState(false);
  const [lockModeEnabled, setLockModeEnabled] = useState(false);
  const [showLockTrigger, setShowLockTrigger] = useState(false);
  const [dbHost, setDbHost] = useState('');
  const [dbPort, setDbPort] = useState('3306');
  const [dbName, setDbName] = useState('');
  const [dbUsername, setDbUsername] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbConfigPath, setDbConfigPath] = useState('');
  const [dbMode, setDbMode] = useState('production');
  const [dbConfigured, setDbConfigured] = useState(false);
  const [dbStatusMessage, setDbStatusMessage] = useState('');
  const [dbErrorMessage, setDbErrorMessage] = useState('');
  const [showDbPassword, setShowDbPassword] = useState(false);

  type LockSettings = {
    lock_mode: boolean;
    computer_lab: string;
    pc_number: string;
    station_label: string;
  };

  type DatabaseSetupSettings = {
    host: string;
    port: string;
    dbname: string;
    username: string;
    password: string;
    mode: string;
    source_path: string;
    write_path: string;
    is_configured: boolean;
  };

  const verifyPasswordResetIdentifierBridge = async (
    identifier: string
  ): Promise<void> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.VerifyPasswordResetIdentifier !== 'function') {
      throw new Error('This app build does not support ID-first recovery verification yet. Please restart after updating.');
    }

    await appBridge.VerifyPasswordResetIdentifier(identifier);
  };

  const verifyRecoveryCodeForIdentifierBridge = async (
    identifier: string,
    recoveryCode: string
  ): Promise<void> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.VerifyRecoveryCodeForIdentifier !== 'function') {
      throw new Error('This app build does not support account-bound recovery-code verification yet. Please restart after updating.');
    }

    await appBridge.VerifyRecoveryCodeForIdentifier(identifier, recoveryCode);
  };

  const resetPasswordWithIdentifierRecoveryCodeBridge = async (
    identifier: string,
    recoveryCode: string,
    newPasswordValue: string
  ): Promise<void> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.ResetPasswordWithIdentifierRecoveryCode !== 'function') {
      throw new Error('This app build does not support ID-first recovery reset yet. Please restart after updating.');
    }

    await appBridge.ResetPasswordWithIdentifierRecoveryCode(identifier, recoveryCode, newPasswordValue);
  };

  const loadLockSettingsBridge = async (): Promise<LockSettings> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.GetLockSettings !== 'function') {
      throw new Error('This app build does not support lock mode settings yet. Please restart after updating.');
    }

    return appBridge.GetLockSettings();
  };

  const setLockSettingsFromInputBridge = async (
    input: string,
    computerLab: string,
    pcNumber: string
  ): Promise<LockSettings> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.SetLockSettingsFromInput !== 'function') {
      throw new Error('This app build does not support lock mode updates yet. Please restart after updating.');
    }

    return appBridge.SetLockSettingsFromInput(input, computerLab, pcNumber);
  };

  const loadDatabaseSetupBridge = async (): Promise<DatabaseSetupSettings> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.GetDatabaseSetupSettings !== 'function') {
      throw new Error('This app build does not support database configuration yet. Please restart after updating.');
    }

    return appBridge.GetDatabaseSetupSettings();
  };

  const saveDatabaseSetupBridge = async (
    host: string,
    port: string,
    dbname: string,
    username: string,
    passwordValue: string
  ): Promise<DatabaseSetupSettings> => {
    const appBridge = (window as any)?.go?.backend?.App;
    if (!appBridge || typeof appBridge.SaveDatabaseSetupSettings !== 'function') {
      throw new Error('This app build does not support database configuration updates yet. Please restart after updating.');
    }

    return appBridge.SaveDatabaseSetupSettings(host, port, dbname, username, passwordValue);
  };

  const handleForgotVerifyIdentity = async () => {
    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your account ID first.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      await verifyPasswordResetIdentifierBridge(forgotIdentifier.trim());
      setForgotIdentityVerified(true);
      setForgotCodeVerified(false);
      setForgotError('');
    } catch (error) {
      setForgotIdentityVerified(false);
      setForgotCodeVerified(false);
      const message = getThrowableMessage(error, '');
      const normalized = message.toLowerCase();
      if (
        normalized.includes('does not support') ||
        normalized.includes('restart after updating') ||
        normalized.includes('runtime')
      ) {
        setForgotError(message || 'Unable to process account ID right now.');
      } else {
        setForgotError('Invalid or unregistered account ID.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const pwRules = {
    length: forgotNewPassword.length >= 8,
    upper: /[A-Z]/.test(forgotNewPassword),
    lower: /[a-z]/.test(forgotNewPassword),
    number: /[0-9]/.test(forgotNewPassword),
    special: /[^A-Za-z0-9]/.test(forgotNewPassword),
  };
  const pwValid = Object.values(pwRules).every(Boolean);
  const pwMatch = forgotNewPassword === forgotConfirmPassword && forgotConfirmPassword.length > 0;

  const getThrowableMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }
    if (typeof err === 'string' && err.trim()) {
      return err;
    }
    if (err && typeof err === 'object') {
      const maybeMessage = (err as { message?: unknown; error?: unknown }).message
        ?? (err as { message?: unknown; error?: unknown }).error;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
    }
    return fallback;
  };

  const handleForgotVerifyRecoveryCode = async () => {
    if (!forgotIdentityVerified) {
      setForgotError('Please enter your account ID first.');
      return;
    }
    if (!forgotRecoveryCode.trim()) {
      setForgotError('Please enter your recovery code.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      await verifyRecoveryCodeForIdentifierBridge(forgotIdentifier.trim(), forgotRecoveryCode.trim());
      setForgotCodeVerified(true);
      setForgotError('');
    } catch (error) {
      setForgotCodeVerified(false);
      setForgotError(getThrowableMessage(error, 'Unable to verify recovery code.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentityVerified) {
      setForgotError('Please enter your account ID first.');
      return;
    }
    if (!forgotCodeVerified) {
      setForgotError('Please verify your recovery code first.');
      return;
    }
    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your account ID first.');
      return;
    }
    if (!forgotRecoveryCode.trim()) {
      setForgotError('Please enter your recovery code.');
      return;
    }
    if (!pwValid || !pwMatch) {
      setForgotError('Please meet all password requirements and ensure passwords match.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      await resetPasswordWithIdentifierRecoveryCodeBridge(
        forgotIdentifier.trim(),
        forgotRecoveryCode.trim(),
        forgotNewPassword
      );
      setForgotStep('completed');
    } catch (err) {
      setForgotError(getThrowableMessage(err, 'Failed to reset password.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('form');
    setForgotIdentifier('');
    setForgotIdentityVerified(false);
    setForgotCodeVerified(false);
    setForgotRecoveryCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotShowNew(false);
    setForgotShowConfirm(false);
  };

  const forgotStage: 'identifier' | 'code' | 'password' = !forgotIdentityVerified
    ? 'identifier'
    : !forgotCodeVerified
      ? 'code'
      : 'password';

  const openLockSettingsModal = async () => {
    setShowLockSettingsModal(true);
    setLockErrorMessage('');
    setLockStatusMessage('');
    setDbErrorMessage('');
    setDbStatusMessage('');

    try {
      const settings = await loadLockSettingsBridge();
      setLockModeEnabled(Boolean(settings.lock_mode));
      setLockExpression(`lockmode: ${settings.lock_mode ? 'true' : 'false'}`);
      setLockComputerLab(settings.computer_lab ?? '');
      setLockPCNumber(settings.pc_number ?? '');
      setLockStationLabel(settings.station_label ?? 'Unconfigured PC');
    } catch (err) {
      setLockErrorMessage(getThrowableMessage(err, 'Unable to load lock mode status.'));
    }

    try {
      const dbSettings = await loadDatabaseSetupBridge();
      setDbHost(dbSettings.host ?? '');
      setDbPort(dbSettings.port ?? '3306');
      setDbName(dbSettings.dbname ?? '');
      setDbUsername(dbSettings.username ?? '');
      setDbPassword(dbSettings.password ?? '');
      setDbMode((dbSettings.mode ?? 'production').toLowerCase());
      setDbConfigured(Boolean(dbSettings.is_configured));
      setDbConfigPath(dbSettings.source_path || dbSettings.write_path || '');
    } catch (err) {
      setDbErrorMessage(getThrowableMessage(err, 'Unable to load database configuration.'));
    }
  };

  const closeLockSettingsModal = () => {
    setShowLockSettingsModal(false);
    setLockErrorMessage('');
    setLockStatusMessage('');
    setDbErrorMessage('');
    setDbStatusMessage('');
    setShowLockTrigger(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        if (showLockTrigger || showLockSettingsModal) {
          closeLockSettingsModal();
        } else {
          setShowLockTrigger(true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showLockTrigger, showLockSettingsModal]);

  const applyLockSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lockExpression.trim()) {
      setLockErrorMessage('Please enter a value, for example: lockmode: true');
      return;
    }

    setLockSaving(true);
    setLockErrorMessage('');
    setLockStatusMessage('');
    setDbErrorMessage('');
    setDbStatusMessage('');

    let lockUpdated = false;
    try {
      const updatedSettings = await setLockSettingsFromInputBridge(
        lockExpression.trim(),
        lockComputerLab.trim(),
        lockPCNumber.trim()
      );
      const updatedMode = Boolean(updatedSettings.lock_mode);
      setLockModeEnabled(updatedMode);
      setLockExpression(`lockmode: ${updatedMode ? 'true' : 'false'}`);
      setLockComputerLab(updatedSettings.computer_lab ?? '');
      setLockPCNumber(updatedSettings.pc_number ?? '');
      setLockStationLabel(updatedSettings.station_label ?? 'Unconfigured PC');
      setLockStatusMessage(`Lock mode is now ${updatedMode ? 'enabled' : 'disabled'}.`);
      lockUpdated = true;
    } catch (err) {
      setLockErrorMessage(getThrowableMessage(err, 'Unable to update lock mode.'));
    }

    try {
      const updated = await saveDatabaseSetupBridge(
        dbHost.trim(),
        dbPort.trim(),
        dbName.trim(),
        dbUsername.trim(),
        dbPassword
      );

      setDbHost(updated.host ?? '');
      setDbPort(updated.port ?? '3306');
      setDbName(updated.dbname ?? '');
      setDbUsername(updated.username ?? '');
      setDbPassword(updated.password ?? '');
      setDbMode((updated.mode ?? 'production').toLowerCase());
      setDbConfigured(Boolean(updated.is_configured));
      const resolvedPath = updated.source_path || updated.write_path || '';
      setDbConfigPath(resolvedPath);
      setDbStatusMessage(
        resolvedPath
          ? `Database settings saved to ${resolvedPath}.`
          : 'Database settings saved successfully.'
      );

      if (lockUpdated) {
        setLockStatusMessage('Settings applied successfully.');
      }
    } catch (err) {
      setDbErrorMessage(getThrowableMessage(err, 'Unable to save database configuration.'));
    } finally {
      setLockSaving(false);
    }
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
      const userData = await login(username, password, rememberMe);
      
      if (userData) {
        navigate(roleRoutes[userData.role]);
      } else {
        setError('Incorrect ID or password. Please check your details and try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = mapLoginErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
      const errorMessage = mapRegistrationErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row relative overflow-y-auto">
      {/* Left Section - Background Image with Title and Text */}
      <div className="w-full md:w-1/2 relative flex flex-col justify-center items-start p-6 sm:p-10 lg:p-16 overflow-hidden min-h-[240px] sm:min-h-[300px] md:min-h-screen">
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
        
        {/* Content Container */}
        <div className="relative z-10 max-w-2xl">
          {/* Text Content */}
          <div className="space-y-6">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-[-0.04em] text-white drop-shadow-2xl">
              <span className="block">Easily Track</span>
              <span className="block text-teal-300">Your Lab Entries.</span>
            </h1>
            
            <p className="text-sm md:text-base lg:text-lg text-white/90 leading-relaxed font-normal max-w-lg drop-shadow-lg">
              Sign in to use the PC and manage your attendance in laboratory classes.
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - White Background with Login Form */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              Sign In
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
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" noValidate autoComplete="off">
            {/* Username/ID Field */}
            <div>
              <label htmlFor="username" className="sr-only">
                ID
              </label>
              <div className="relative rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-24 sm:w-32 border-r border-gray-300 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 pointer-events-none bg-gray-50">
                  <span>ID</span>
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="username"
                  name="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-28 sm:pl-36 pr-4 py-3 border-0 rounded-lg focus:outline-none focus:ring-0"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-24 sm:w-32 border-r border-gray-300 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 pointer-events-none bg-gray-50">
                  <span>Password</span>
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-password-input w-full pl-28 sm:pl-36 pr-11 py-3 border-0 rounded-lg focus:outline-none focus:ring-0"
                  autoComplete="new-password"
                  required
                />
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
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
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
                  <LoadingDots className="mr-3" dotClassName="h-2.5 w-2.5 bg-white" />
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

      {showLockTrigger && (
        <button
          type="button"
          onClick={openLockSettingsModal}
          className="absolute bottom-4 left-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-md ring-1 ring-gray-200 hover:bg-white"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}

      {/* Config Settings Modal */}
      {showLockSettingsModal && (
        <div className="modal-backdrop p-4 z-40">
          <div className="modal-surface-2xl w-full max-w-md max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-primary-200/80 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Config Settings</h3>
              </div>
              <button
                type="button"
                onClick={closeLockSettingsModal}
                className="modal-back-icon-btn"
                title="Back"
                aria-label="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={applyLockSettings} className="px-6 py-5 space-y-4" noValidate>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Current status: <span className={`font-semibold ${lockModeEnabled ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {lockModeEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Station label: <span className="font-semibold text-slate-700">{lockStationLabel}</span>
              </div>

              <div>
                <label htmlFor="lock-expression" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Lock Mode Setting
                </label>
                <input
                  id="lock-expression"
                  type="text"
                  value={lockExpression}
                  onChange={(e) => setLockExpression(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="lock-computer-lab" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Computer Lab
                </label>
                <input
                  id="lock-computer-lab"
                  type="text"
                  value={lockComputerLab}
                  onChange={(e) => setLockComputerLab(e.target.value)}
                  placeholder="Example: Lab A"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="lock-pc-number" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  PC Number
                </label>
                <input
                  id="lock-pc-number"
                  type="text"
                  value={lockPCNumber}
                  onChange={(e) => setLockPCNumber(e.target.value)}
                  placeholder="Example: 12"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoComplete="off"
                />
              </div>

              <div className="pt-2 border-t border-gray-200 space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Database config status:{' '}
                  <span className={`font-semibold ${dbConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {dbConfigured ? 'Configured' : 'Not configured'}
                  </span>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  Mode: <span className="font-semibold text-slate-700 capitalize">{dbMode || 'production'}</span>
                  <br />
                  Config file: <span className="font-semibold break-all text-slate-700">{dbConfigPath || 'Not created yet'}</span>
                </div>

                <div>
                  <label htmlFor="db-host" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Database Host
                  </label>
                  <input
                    id="db-host"
                    type="text"
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="Example: 127.0.0.1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="db-port" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Database Port
                  </label>
                  <input
                    id="db-port"
                    type="text"
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    placeholder="Example: 3306"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="db-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Database Name
                  </label>
                  <input
                    id="db-name"
                    type="text"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="Example: logbookdb"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="db-username" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Database Username
                  </label>
                  <input
                    id="db-username"
                    type="text"
                    value={dbUsername}
                    onChange={(e) => setDbUsername(e.target.value)}
                    placeholder="Example: root"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="db-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Database Password
                  </label>
                  <div className="relative">
                    <input
                      id="db-password"
                      type={showDbPassword ? 'text' : 'password'}
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      placeholder="Database password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                      aria-label={showDbPassword ? 'Hide database password' : 'Show database password'}
                    >
                      {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {dbErrorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {dbErrorMessage}
                  </div>
                )}

                {dbStatusMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                    {dbStatusMessage}
                  </div>
                )}
              </div>

              {lockErrorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {lockErrorMessage}
                </div>
              )}

              {lockStatusMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                  {lockStatusMessage}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeLockSettingsModal}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={lockSaving}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {lockSaving ? (
                    <>
                      <LoadingDots dotClassName="h-2.5 w-2.5 bg-white" />
                      Saving...
                    </>
                  ) : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-backdrop p-4">
          <div className="modal-surface-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-primary-200/80 bg-gradient-to-r from-primary-50/95 to-gray-50/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              </div>
              <button
                onClick={closeForgotModal}
                className="modal-back-icon-btn"
                title="Back"
                aria-label="Back"
              >
                <CornerUpLeft className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {forgotStep === 'completed' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Password Updated</h4>
                  <p className="text-sm text-gray-600">
                    Your password was reset successfully. You can now sign in with your new password.
                  </p>
                  <button
                    onClick={closeForgotModal}
                    className="mt-6 w-full bg-teal-600 text-white py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
                  >
                    Back To Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotResetPassword} className="space-y-4" noValidate>
                  {forgotError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {forgotError}
                    </div>
                  )}

                  {forgotStage === 'identifier' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Account ID</label>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => {
                          setForgotIdentifier(e.target.value);
                          setForgotIdentityVerified(false);
                          setForgotCodeVerified(false);
                          setForgotRecoveryCode('');
                          setForgotNewPassword('');
                          setForgotConfirmPassword('');
                        }}
                        placeholder="Enter your ID"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  )}

                  {forgotStage === 'code' && (
                    <>
                      <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                        ID accepted. Enter your recovery code.
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recovery Code</label>
                        <input
                          type="text"
                          value={forgotRecoveryCode}
                          onChange={(e) => {
                            setForgotRecoveryCode(e.target.value.toUpperCase());
                            setForgotCodeVerified(false);
                          }}
                          placeholder="Example: ABCDE-FGHJK"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          required
                        />
                      </div>
                    </>
                  )}

                  {forgotStage === 'password' && (
                    <>
                      <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                        Recovery code verified. Enter your new password.
                      </div>
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
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setForgotShowNew(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600"
                          >
                            {forgotShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {forgotNewPassword.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {[
                              { ok: pwRules.length, label: 'At least 8 characters' },
                              { ok: pwRules.upper, label: 'Uppercase letter (A-Z)' },
                              { ok: pwRules.lower, label: 'Lowercase letter (a-z)' },
                              { ok: pwRules.number, label: 'Number (0-9)' },
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
                          <button
                            type="button"
                            tabIndex={-1}
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
                    {forgotStage === 'identifier' && (
                      <button
                        type="button"
                        onClick={handleForgotVerifyIdentity}
                        disabled={forgotLoading || !forgotIdentifier.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {forgotLoading ? (
                          <>
                            <LoadingDots dotClassName="h-2.5 w-2.5 bg-white" />
                            Processing...
                          </>
                        ) : 'Next'}
                      </button>
                    )}
                    {forgotStage === 'code' && (
                      <button
                        type="button"
                        onClick={handleForgotVerifyRecoveryCode}
                        disabled={forgotLoading || !forgotRecoveryCode.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {forgotLoading ? (
                          <>
                            <LoadingDots dotClassName="h-2.5 w-2.5 bg-white" />
                            Processing...
                          </>
                        ) : 'Next'}
                      </button>
                    )}
                    {forgotStage === 'password' && (
                      <button
                        type="submit"
                        disabled={forgotLoading || !forgotIdentityVerified || !forgotCodeVerified || !forgotIdentifier.trim() || !forgotRecoveryCode.trim() || !pwValid || !pwMatch}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {forgotLoading ? (
                          <>
                            <LoadingDots dotClassName="h-2.5 w-2.5 bg-white" />
                            Resetting...
                          </>
                        ) : 'Reset Password'}
                      </button>
                    )}
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
