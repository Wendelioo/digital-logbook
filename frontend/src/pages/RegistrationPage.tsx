import React, { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  AlertCircle,
  UserCircle,
  Phone,
  Mail,
  Lock,
} from 'lucide-react';
import { SubmitRegistration } from '../../wailsjs/go/backend/App';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    student_id: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    contact_number: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedFormData = {
      ...formData,
      [name]: value,
    };
    setFormData(updatedFormData);
    setFieldErrors((prev) => ({
      ...prev,
      ...validateAllFields(updatedFormData, name as keyof typeof formData),
    }));
    setError('');
  };

  // Valid format: exactly 7 digits (e.g. 2211172)
  const STUDENT_ID_REGEX = /^\d{7}$/;

  const validateAllFields = (
    values: typeof formData,
    touchedField?: keyof typeof formData
  ): Partial<Record<keyof typeof formData, string>> => {
    const errors: Partial<Record<keyof typeof formData, string>> = { ...(touchedField ? fieldErrors : {}) };

    const fieldsToValidate: (keyof typeof formData)[] = touchedField
      ? [touchedField]
      : ['student_id', 'first_name', 'last_name', 'middle_name', 'contact_number', 'email', 'password', 'confirm_password'];

    fieldsToValidate.forEach((field) => {
      const value = values[field]?.trim?.() ?? values[field];
      let message = '';

      switch (field) {
        case 'student_id':
          if (!value) {
            message = 'Student ID is required.';
          } else if (!STUDENT_ID_REGEX.test(value)) {
            message = 'Student ID must be exactly 7 digits.';
          }
          break;
        case 'first_name':
          if (!value) {
            message = 'First name is required.';
          }
          break;
        case 'last_name':
          if (!value) {
            message = 'Last name is required.';
          }
          break;
        case 'contact_number':
          if (!value) {
            message = 'Contact number is required.';
          } else if (!/^\d{10,}$/.test(value)) {
            message = 'Contact number must have at least 10 digits.';
          }
          break;
        case 'email':
          if (!value) {
            message = 'Email address is required.';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            message = 'Please enter a valid email address.';
          }
          break;
        case 'password':
          if (!value) {
            message = 'Password is required.';
          } else if (String(value).length < 8) {
            message = 'Password must be at least 8 characters.';
          }
          break;
        case 'confirm_password':
          if (!value) {
            message = 'Please confirm your password.';
          } else if (value !== values.password) {
            message = 'Passwords do not match.';
          }
          break;
        case 'middle_name':
          // Optional field – no validation for now
          message = '';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const errors = validateAllFields(formData);
    setFieldErrors(errors);

    if (Object.values(errors).some(Boolean)) {
      setError('Please correct the errors in the form.');
      setLoading(false);
      return;
    }

    try {
      await SubmitRegistration(formData);
      setSuccess(true);
      setFormData({
        student_id: '',
        last_name: '',
        first_name: '',
        middle_name: '',
        contact_number: '',
        email: '',
        password: '',
        confirm_password: '',
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center relative">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-8 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Please fill in the details below to register as a student.
          </p>
        </div>

        <div className="px-8 py-4 space-y-6 overflow-y-auto">
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
                    required
                    placeholder="Enter your student ID"
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
                    required
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
                    required
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
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
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
                      required
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
                      required
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
                      required
                      minLength={8}
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
                      required
                      minLength={8}
                      className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg focus:ring-2 ${
                        fieldErrors.confirm_password
                          ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                      }`}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
