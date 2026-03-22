import React, { useEffect, useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  AlertCircle,
  UserCircle,
  Phone,
  Mail,
  Lock,
  Check,
} from 'lucide-react';
import { GetDepartments, SubmitRegistration } from '../../wailsjs/go/backend/App';
import { backend } from '../../wailsjs/go/models';
import LoadingDots from '../components/LoadingDots';

type Department = backend.Department;

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const mapRegistrationErrorMessage = (err: unknown): string => {
  const rawMessage = err instanceof Error ? err.message : '';
  const message = rawMessage.toLowerCase();

  if (message.includes('pending registration')) {
    return 'Your registration is already pending approval. Please wait for verification.';
  }

  if (message.includes('already active') || message.includes('already registered to an active account')) {
    return 'This account is already active. Please sign in instead.';
  }

  if (message.includes('student id already registered') || message.includes('student id is already')) {
    return 'This Student ID is already registered. Please use a different Student ID or contact support.';
  }

  if (message.includes('email already') || message.includes('email is already registered')) {
    return 'This email is already in use. Please use another email address.';
  }

  if (message.includes('rejected') && message.includes('student id')) {
    return 'This Student ID was previously rejected. Re-register using the same Student ID details.';
  }

  if (message.includes('department') && (message.includes('inactive') || message.includes('invalid') || message.includes('required'))) {
    return 'Please select a valid active department.';
  }

  if (
    message.includes('required') ||
    message.includes('invalid') ||
    message.includes('must be') ||
    message.includes('contains invalid characters')
  ) {
    return rawMessage;
  }

  if (message.includes('database') || message.includes('connection') || message.includes('transaction failed')) {
    return 'Unable to process registration right now. Please try again in a moment.';
  }

  if (rawMessage.trim().length > 0) {
    return rawMessage;
  }

  return 'Registration failed. Please try again.';
};

const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState({
    student_id: '',
    department_code: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    contact_number: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});

  useEffect(() => {
    if (!isOpen) return;

    const loadDepartments = async () => {
      try {
        const data = await GetDepartments();
        setDepartments((data || []).filter((dept: Department) => dept.is_active));
      } catch (err) {
        console.error('Failed to load departments:', err);
        setDepartments([]);
      }
    };

    loadDepartments();
  }, [isOpen]);

  const capitalizeFirstLetter = (input: string): string => {
    const firstNonSpaceIndex = input.search(/\S/);
    if (firstNonSpaceIndex === -1) return input;

    const ch = input[firstNonSpaceIndex];
    if (!/[a-z]/.test(ch)) return input;

    return (
      input.slice(0, firstNonSpaceIndex) +
      ch.toUpperCase() +
      input.slice(firstNonSpaceIndex + 1)
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === 'first_name' || name === 'last_name' || name === 'middle_name') {
      value = capitalizeFirstLetter(value);
    }

    const updatedFormData = {
      ...formData,
      [name]: value,
    };
    setFormData(updatedFormData);
    setFieldErrors((prev) =>
      validateAllFields(updatedFormData, name as keyof typeof formData, prev)
    );
    setError('');
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as keyof typeof formData;
    setFieldErrors((prev) => validateAllFields(formData, name, prev));
  };

  // Validation constants (aligned with backend)
  const MAX_LEN_NAME = 100;
  const MAX_LEN_EMAIL = 254;
  const MAX_LEN_CONTACT = 30;
  const MAX_LEN_PASSWORD = 256;
  const MAX_LEN_STUDENT_ID = 50;
  const STUDENT_ID_REGEX = /^\d{7}$/;
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  // Philippine mobile 09 + 9 digits, or 7–15 digits for landline (backend: cleaned of spaces/dashes)
  const PHONE_REGEX = /^(09\d{9}|\d{7,15})$/;

  const hasControlOrNull = (s: string) => /[\x00-\x1F\x7F]/.test(s);

  const validateAllFields = (
    values: typeof formData,
    touchedField?: keyof typeof formData,
    currentErrors: Partial<Record<keyof typeof formData, string>> = {}
  ): Partial<Record<keyof typeof formData, string>> => {
    const errors: Partial<Record<keyof typeof formData, string>> = touchedField ? { ...currentErrors } : {};

    const fieldsToValidate: (keyof typeof formData)[] = touchedField
      ? [touchedField]
      : ['student_id', 'department_code', 'first_name', 'last_name', 'middle_name', 'contact_number', 'email', 'password', 'confirm_password'];

    fieldsToValidate.forEach((field) => {
      const raw = values[field];
      const value = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
      let message = '';

      switch (field) {
        case 'student_id':
          if (!value) {
            message = 'Student ID is required.';
          } else if (value.length > MAX_LEN_STUDENT_ID) {
            message = `Student ID must be at most ${MAX_LEN_STUDENT_ID} characters.`;
          } else if (hasControlOrNull(value)) {
            message = 'Student ID contains invalid characters.';
          } else if (!STUDENT_ID_REGEX.test(value)) {
            message = 'Student ID must be exactly 7 digits (e.g. 2211172).';
          }
          break;
        case 'department_code':
          if (!value) {
            message = 'Department is required.';
          }
          break;
        case 'first_name':
          if (!value) {
            message = 'First name is required.';
          } else if (value.length > MAX_LEN_NAME) {
            message = `First name must be at most ${MAX_LEN_NAME} characters.`;
          } else if (hasControlOrNull(value)) {
            message = 'First name contains invalid characters.';
          }
          break;
        case 'last_name':
          if (!value) {
            message = 'Last name is required.';
          } else if (value.length > MAX_LEN_NAME) {
            message = `Last name must be at most ${MAX_LEN_NAME} characters.`;
          } else if (hasControlOrNull(value)) {
            message = 'Last name contains invalid characters.';
          }
          break;
        case 'middle_name':
          if (value.length > MAX_LEN_NAME) {
            message = `Middle name must be at most ${MAX_LEN_NAME} characters.`;
          } else if (value && hasControlOrNull(value)) {
            message = 'Middle name contains invalid characters.';
          }
          break;
        case 'contact_number':
          if (!value) {
            message = 'Contact number is required.';
          } else {
            const cleaned = value.replace(/[\s\-]/g, '');
            if (cleaned.length > MAX_LEN_CONTACT) {
              message = `Contact number must be at most ${MAX_LEN_CONTACT} characters.`;
            } else if (hasControlOrNull(value)) {
              message = 'Contact number contains invalid characters.';
            } else if (!PHONE_REGEX.test(cleaned)) {
              message = 'Use a valid mobile (e.g. 09XXXXXXXXX) or landline (7–15 digits).';
            }
          }
          break;
        case 'email':
          if (!value) {
            message = 'Email address is required.';
          } else if (value.length > MAX_LEN_EMAIL) {
            message = `Email must be at most ${MAX_LEN_EMAIL} characters.`;
          } else if (hasControlOrNull(value)) {
            message = 'Email contains invalid characters.';
          } else if (!EMAIL_REGEX.test(value)) {
            message = 'Please enter a valid email address.';
          }
          break;
        case 'password':
          if (!value) {
            message = 'Password is required.';
          } else if (value.length > MAX_LEN_PASSWORD) {
            message = `Password must be at most ${MAX_LEN_PASSWORD} characters.`;
          } else if (value.length < 8) {
            message = 'Password must be at least 8 characters.';
          } else if (!/[A-Z]/.test(value)) {
            message = 'Password must include at least one uppercase letter.';
          } else if (!/[a-z]/.test(value)) {
            message = 'Password must include at least one lowercase letter.';
          } else if (!/[0-9]/.test(value)) {
            message = 'Password must include at least one number.';
          } else if (!/[^A-Za-z0-9]/.test(value)) {
            message = 'Password must include at least one special character (!@#$%...).';
          }
          break;
        case 'confirm_password':
          if (!value) {
            message = 'Please confirm your password.';
          } else if (value !== values.password) {
            message = 'Passwords do not match.';
          }
          break;
        default:
          break;
      }

      if (message) {
        errors[field] = message;
      } else {
        delete errors[field];
      }
    });

    return errors;
  };

  // For password checklist UI (same rules as backend)
  // Backend treats "special" as punctuation or symbol characters (unicode.IsPunct / unicode.IsSymbol),
  // so we approximate that here using an ASCII punctuation/symbol character class.
  const pwRules = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    lower: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[!-/:-@[-`{-~]/.test(formData.password),
  };
  const pwValid = Object.values(pwRules).every(Boolean);
  const pwMatch = formData.password === formData.confirm_password && formData.confirm_password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const errors = validateAllFields(formData);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('Please correct the errors in the form.');
      setLoading(false);
      return;
    }
    if (!pwValid || !pwMatch) {
      setError('Please meet all password requirements and ensure passwords match.');
      setLoading(false);
      return;
    }

    try {
      await SubmitRegistration(formData);
      setSuccess(true);
      setFormData({
        student_id: '',
        department_code: '',
        last_name: '',
        first_name: '',
        middle_name: '',
        contact_number: '',
        email: '',
        password: '',
        confirm_password: '',
      });
    } catch (err) {
      setError(mapRegistrationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 sm:p-8 text-center relative max-h-[calc(100vh-2rem)] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Registration Submitted!
          </h2>
          <p className="text-gray-600 mb-8 text-sm">
            Your registration has been submitted successfully. Please wait for working student approval. 
            You will be able to login once your account is approved.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 transition-all font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Please fill in the details below to register as a student.
          </p>
        </div>

        <div className="px-4 sm:px-8 py-4 sm:py-5 space-y-6 overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Student ID */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 tracking-wide uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <UserCircle className="w-3.5 h-3.5" />
                  </span>
                  <span>Student Identification</span>
                </div>
              </div>
              <div>
                <label htmlFor="student_id" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="student_id"
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    maxLength={MAX_LEN_STUDENT_ID}
                    autoComplete="off"
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                      fieldErrors.student_id
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                    }`}
                  />
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {fieldErrors.student_id && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.student_id}</p>
                )}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Department */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 tracking-wide uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <UserCircle className="w-3.5 h-3.5" />
                  </span>
                  <span>Department</span>
                </div>
              </div>
              <div>
                <label htmlFor="department_code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="department_code"
                  name="department_code"
                  value={formData.department_code}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                    fieldErrors.department_code
                      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                  }`}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.department_code} value={dept.department_code}>
                      {dept.department_code} - {dept.department_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.department_code && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.department_code}</p>
                )}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Personal Information */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 tracking-wide uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <UserCircle className="w-3.5 h-3.5" />
                  </span>
                  <span>Personal Information</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    maxLength={MAX_LEN_NAME}
                    className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                      fieldErrors.first_name
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                    }`}
                  />
                  {fieldErrors.first_name && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.first_name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    maxLength={MAX_LEN_NAME}
                    className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                      fieldErrors.last_name
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                    }`}
                  />
                  {fieldErrors.last_name && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.last_name}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middle_name"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={MAX_LEN_NAME}
                    className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 focus:border-primary-500 ${
                      fieldErrors.middle_name
                        ? 'border-red-400 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-primary-500'
                    }`}
                  />
                  {fieldErrors.middle_name && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.middle_name}</p>
                  )}
                </div>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Contact Information */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 tracking-wide uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <span>Contact Information</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact_number" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="contact_number"
                      name="contact_number"
                      value={formData.contact_number}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      maxLength={MAX_LEN_CONTACT}
                      className={`w-full pl-10 pr-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                        fieldErrors.contact_number
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {fieldErrors.contact_number && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_number}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      maxLength={MAX_LEN_EMAIL}
                      className={`w-full pl-10 pr-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                        fieldErrors.email
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Account Security */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 tracking-wide uppercase">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <span>Account Security</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      minLength={8}
                      maxLength={MAX_LEN_PASSWORD}
                      autoComplete="new-password"
                      className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                        fieldErrors.password
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.password.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {[
                        { ok: pwRules.length, label: 'At least 8 characters' },
                        { ok: pwRules.upper, label: 'Uppercase letter (A–Z)' },
                        { ok: pwRules.lower, label: 'Lowercase letter (a–z)' },
                        { ok: pwRules.number, label: 'Number (0–9)' },
                        { ok: pwRules.special, label: 'Special character (!@#$%...)' },
                      ].map((r) => (
                        <li
                          key={r.label}
                          className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-green-600' : 'text-gray-400'}`}
                        >
                          <Check className={`h-3 w-3 flex-shrink-0 ${r.ok ? 'text-green-500' : 'text-gray-300'}`} />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirm_password"
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      minLength={8}
                      maxLength={MAX_LEN_PASSWORD}
                      autoComplete="new-password"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                        fieldErrors.confirm_password
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {fieldErrors.confirm_password && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.confirm_password}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Submit Button */}
            <hr className="border-gray-100" />
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !pwValid || !pwMatch}
                className="inline-flex items-center justify-center px-6 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingDots dotClassName="h-2.5 w-2.5 bg-white" />
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
