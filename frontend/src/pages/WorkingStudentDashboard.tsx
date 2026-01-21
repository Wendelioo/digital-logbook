import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Save,
  Plus,
  UserCheck,
  ArrowLeft,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  MapPin,
  AlertCircle,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  X,
  BarChart3,
  Upload,
  Download
} from 'lucide-react';
import { 
  GetWorkingStudentDashboard,
  CreateUser,
  GetAllRegisteredStudents,
  GetPendingFeedback,
  ForwardFeedbackToAdmin,
  ForwardMultipleFeedbackToAdmin,
  GetDepartments,
  CreateUsersBulk,
  CreateUsersBulkFromFile
} from '../../wailsjs/go/main/App';
import { useAuth } from '../contexts/AuthContext';
import { main } from '../../wailsjs/go/models';

// Use generated types
type ClassStudent = main.ClassStudent;
type Department = main.Department;
type User = main.User;
type Feedback = main.Feedback;

// Department type is now imported from main models above

interface DashboardStats {
  students_registered: number;
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    students_registered: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await GetWorkingStudentDashboard();
        setStats(data);
      } catch (error) {
        console.error('Failed to load working student dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Auto-refresh every 30 seconds to keep stats up-to-date
    const refreshInterval = setInterval(() => {
      loadStats();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

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
        <h2 className="text-2xl font-bold text-gray-900">Working Student Dashboard</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Students Registered
                  </dt>
                  <dd className="text-3xl font-bold text-gray-900">
                    {stats.students_registered}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="manage-users"
          className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Student Management</h3>
          </div>
        </Link>
      </div>
    </div>
  );
}

interface RegisterStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterStudentModal({ onClose, onSuccess }: RegisterStudentModalProps) {
  const [formData, setFormData] = useState({
    studentCode: '',
    firstName: '',
    middleName: '',
    lastName: '',
    contactNumber: '',
    department: ''
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const data = await GetDepartments();
        // Filter only active departments
        const activeDepartments = (data || []).filter((dept: Department) => dept.is_active);
        setDepartments(activeDepartments);
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    };
    loadDepartments();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const fullName = `${formData.lastName}, ${formData.firstName}${formData.middleName ? ' ' + formData.middleName : ''}`;
      
      // Use student code as password (default password)
      await CreateUser(
        formData.studentCode, 
        fullName, 
        formData.firstName, 
        formData.middleName, 
        formData.lastName, 
        '',
        'student', 
        '',
        formData.studentCode,
        '', // year level - not in simplified form
        '', // section - not in simplified form
        '', // email - not in simplified form
        formData.contactNumber,
        '' // departmentCode - not applicable for students
      );
      setNotification({ type: 'success', message: 'Student added successfully! ' });
      setMessage('Student added successfully! Default password is their Student Code.');
      
      // Wait a bit to show the success message, then call onSuccess
      setTimeout(() => {
        setNotification(null);
        onSuccess();
      }, 2000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to add student. Please try again.' });
      setMessage('Failed to add student. Please try again.');
      console.error('Registration error:', error);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
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
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotification(null)}
                  className="bg-white text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div 
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative max-h-[90vh] flex flex-col">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </Button>
          
          <div className="p-4 pb-3 flex-shrink-0 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Student
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
            <div className="p-4">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Student Code</label>
                    <input
                      type="text"
                      value={formData.studentCode}
                      onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

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

                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="tel"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="09987564123"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Please Select Here</option>
                      {departments.map((dept) => (
                        <option key={dept.department_code} value={dept.department_code}>
                          {dept.department_code}-{dept.department_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={loading}
              >
                SAVE
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

interface BulkRegisterStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function BulkRegisterStudentModal({ onClose, onSuccess }: BulkRegisterStudentModalProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string, details?: any} | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);

  const processFile = (file: File) => {
    // Accept PDF, DOCX, CSV, TXT files
    const validExtensions = ['.pdf', '.docx', '.doc', '.csv', '.txt'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExt)) {
      setNotification({ 
        type: 'error', 
        message: 'Please upload a PDF, DOCX, CSV, or TXT file' 
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }
    
    setUploadedFile(file);
    
    // Read file as base64 for backend processing
    const reader = new FileReader();
    
    if (fileExt === '.pdf' || fileExt === '.docx' || fileExt === '.doc') {
      // Read binary files as ArrayBuffer, then convert to base64
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        setFileBase64(base64);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Read text files and convert to base64
      reader.onload = (event) => {
        const text = event.target?.result as string;
        // Convert text to base64
        const base64 = btoa(unescape(encodeURIComponent(text)));
        setFileBase64(base64);
        
        // Show preview for text-based files
        const lines = text.split('\n').filter(line => line.trim());
        const preview = lines.slice(0, 6).map(line => {
          // Simple CSV parsing (handles quoted fields)
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        });
        setPreviewData(preview);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !fileBase64) {
      setNotification({ type: 'error', message: 'Please upload a file' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setLoading(true);
    setNotification(null);

    try {
      const result = await CreateUsersBulkFromFile(fileBase64, uploadedFile.name);
      
      const successCount = result.success_count as number || 0;
      const errorCount = result.error_count as number || 0;
      const errors = result.errors as string[] || [];

      if (successCount > 0) {
        setNotification({
          type: 'success',
          message: `Successfully registered ${successCount} student(s)!${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
          details: errorCount > 0 ? errors : undefined
        });
        
        setTimeout(() => {
          setNotification(null);
          onSuccess();
        }, 3000);
      } else {
        setNotification({
          type: 'error',
          message: `Failed to register students. ${errorCount} error(s) occurred.`,
          details: errors
        });
        setTimeout(() => setNotification(null), 10000);
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to register students. Please check your file format and ensure it contains student codes and names.',
      });
      setTimeout(() => setNotification(null), 10000);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Student Code,First Name,Last Name,Middle Name,Contact Number
2024-001,John,Doe,Smith,09123456789
2024-002,Jane,Smith,,09123456790
2024-003,Mike,Johnson,David,`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_bulk_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-lg w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
                {notification.details && notification.details.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                      {notification.details.slice(0, 5).map((error: string, idx: number) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {notification.details.length > 5 && (
                        <li className="text-gray-600">... and {notification.details.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotification(null)}
                  className="bg-white text-gray-400 hover:text-gray-500"
                  icon={<X className="h-5 w-5" />}
                >
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div 
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] flex flex-col">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </Button>
          
          <div className="p-4 pb-3 flex-shrink-0 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Register Students
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload a file (PDF, DOCX, CSV, or TXT) with student information. Students can complete their profiles later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
            <div className="p-4 space-y-4">
              {/* File Format Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900 mb-1">Supported File Formats</h3>
                    <p className="text-xs text-blue-700 mb-2">
                      <strong>PDF, DOCX, CSV, TXT</strong> files are supported
                    </p>
                    <p className="text-xs text-blue-700 mb-2">
                      Required information: <strong>Student Code, First Name, Last Name</strong>
                    </p>
                    <p className="text-xs text-blue-700">
                      Optional: <strong>Middle Name, Gender, Contact Number</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    icon={<Download className="h-3 w-3" />}
                    className="ml-4 text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    CSV Template
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File
                </label>
                <label 
                  htmlFor="file-upload" 
                  className="mt-1 flex flex-col justify-center items-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors cursor-pointer"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      processFile(file);
                    }
                  }}
                >
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center items-center">
                      <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span>
                      <span className="pl-1">or drag and drop</span>
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOCX, CSV, or TXT files</p>
                    {uploadedFile && (
                      <p className="text-sm text-gray-700 mt-2">
                        Selected: <span className="font-medium">{uploadedFile.name}</span>
                      </p>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    accept=".pdf,.docx,.doc,.csv,.txt"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview (first {previewData.length} rows)
                  </label>
                  <div className="border border-gray-300 rounded-md overflow-hidden">
                    <div className="overflow-x-auto max-h-48">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Student Code</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">First Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Last Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Middle Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Gender</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.map((row, idx) => (
                            <tr key={idx} className={idx === 0 ? 'bg-yellow-50' : ''}>
                              {[0, 1, 2, 3, 4, 5].map((colIdx) => (
                                <td key={colIdx} className="px-3 py-2 text-gray-900">
                                  {row[colIdx] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {previewData.length > 0 && (
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t border-gray-200">
                        {previewData[0].some(cell => cell.toLowerCase().includes('student') || cell.toLowerCase().includes('code')) 
                          ? '⚠️ First row appears to be a header and will be skipped' 
                          : 'First row will be processed'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={loading}
                disabled={!uploadedFile}
              >
                UPLOAD & REGISTER
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

interface StudentRow {
  id: string;
  ctrlNo: number;
  studentId: string;
  fullName: string;
  yearLevel: string;
}

function ManageUsers() {
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<ClassStudent | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadStudents = async () => {
    try {
      const data = await GetAllRegisteredStudents('All', 'All');
      setStudents(data || []);
      setFilteredStudents(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load students:', error);
      setError('Unable to load students from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.middle_name && student.middle_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredStudents(filtered);
    }
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, students]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);
  const startEntry = filteredStudents.length > 0 ? startIndex + 1 : 0;
  const endEntry = Math.min(endIndex, filteredStudents.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
        <div className="flex gap-2">
          <Button
            variant="success"
            onClick={() => setShowBulkModal(true)}
            icon={<Upload className="h-4 w-4" />}
          >
            BULK ADD
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            ADD NEW
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          <p>{error}</p>
        </div>
      )}

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
        <div className="overflow-x-auto">
          {currentStudents.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Student ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Full Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Contact Number
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.student_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.last_name}, {student.first_name} {student.middle_name || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(student as any).email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(student as any).contact_number || 'N/A'}
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
        {currentStudents.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {startEntry} to {endEntry} of {filteredStudents.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
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
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <RegisterStudentModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadStudents();
          }}
        />
      )}

      {/* Bulk Register Students Modal */}
      {showBulkModal && (
        <BulkRegisterStudentModal 
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            loadStudents();
          }}
        />
      )}

      {/* View Student Details Modal */}
      <ViewStudentDetailsModal
        student={viewingStudent}
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
      />
    </div>
  );
}

interface ViewStudentDetailsModalProps {
  student: ClassStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

function ViewStudentDetailsModal({ student, isOpen, onClose }: ViewStudentDetailsModalProps) {
  if (!isOpen || !student) return null;

  const getFullName = () => {
    return `${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''} ${student.last_name}`;
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
          <h3 className="text-lg font-semibold text-gray-900">Student Details</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Left Section - Profile Picture */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-black rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {(student as any).profile_photo || (student as any).profilePhoto ? (
                  <img 
                    src={(student as any).profile_photo || (student as any).profilePhoto} 
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
                <span className="text-sm text-gray-900 ml-2">{(student as any).contact_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Email:</span>
                <span className="text-sm text-gray-900 ml-2">{(student as any).email || ''}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Username:</span>
                <span className="text-sm text-gray-900 ml-2">{student.student_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Close Button */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            icon={<X className="h-4 w-4" />}
          >
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}

function EquipmentReports() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Set<number>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showBatchForwardModal, setShowBatchForwardModal] = useState(false);
  const [forwardNotes, setForwardNotes] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<Feedback | null>(null);

  useEffect(() => {
    loadPendingFeedback();

    // Auto-refresh every 30 seconds to show new feedback submissions
    const refreshInterval = setInterval(() => {
      loadPendingFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadPendingFeedback = async () => {
    try {
      const data = await GetPendingFeedback();
      setFeedbackList(data || []);
      setError('');
    } catch (error) {
      console.error('Failed to load pending feedback:', error);
      setError('Unable to load pending feedback. Make sure you are connected to the database.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleForwardClick = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setForwardNotes('');
    setShowForwardModal(true);
  };

  const handleForwardSubmit = async () => {
    if (!selectedFeedback || !user) return;

    setForwarding(true);
    try {
      await ForwardFeedbackToAdmin(selectedFeedback.id, user.id, forwardNotes);
      showNotification('success', 'Feedback forwarded to admin successfully!');
      setShowForwardModal(false);
      setSelectedFeedback(null);
      setForwardNotes('');
      await loadPendingFeedback(); // Refresh the list
    } catch (error) {
      console.error('Failed to forward feedback:', error);
      showNotification('error', 'Failed to forward feedback. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleBatchForwardClick = () => {
    if (selectedFeedbackIds.size === 0) {
      showNotification('error', 'Please select at least one report to forward.');
      return;
    }
    setForwardNotes('');
    setShowBatchForwardModal(true);
  };

  const handleBatchForwardSubmit = async () => {
    if (selectedFeedbackIds.size === 0 || !user) return;

    setForwarding(true);
    try {
      const feedbackIdsArray = Array.from(selectedFeedbackIds);
      const count = await ForwardMultipleFeedbackToAdmin(feedbackIdsArray, user.id, forwardNotes);
      showNotification('success', `Successfully forwarded ${count} report${count !== 1 ? 's' : ''} to admin!`);
      setShowBatchForwardModal(false);
      setSelectedFeedbackIds(new Set());
      setForwardNotes('');
      await loadPendingFeedback(); // Refresh the list
    } catch (error) {
      console.error('Failed to forward feedback:', error);
      showNotification('error', 'Failed to forward feedback. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFeedbackIds(new Set(feedbackList.map(f => f.id)));
    } else {
      setSelectedFeedbackIds(new Set());
    }
  };

  const handleSelectFeedback = (feedbackId: number, checked: boolean) => {
    const newSelected = new Set(selectedFeedbackIds);
    if (checked) {
      newSelected.add(feedbackId);
    } else {
      newSelected.delete(feedbackId);
    }
    setSelectedFeedbackIds(newSelected);
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
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${
          notification.type === 'success' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'
        }`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotification(null)}
                  className="bg-white text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {feedbackList.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 font-medium">No reports available</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Batch Actions Bar */}
          {selectedFeedbackIds.size > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-blue-900">{selectedFeedbackIds.size}</span> report{selectedFeedbackIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFeedbackIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBatchForwardClick}
                  icon={<Send className="h-4 w-4" />}
                >
                  Forward ({selectedFeedbackIds.size})
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedFeedbackIds.size === feedbackList.length && feedbackList.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
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
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedbackList.map((feedback) => (
                    <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFeedbackIds.has(feedback.id)}
                          onChange={(e) => handleSelectFeedback(feedback.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.student_id_str}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {feedback.student_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {feedback.pc_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.date_submitted ? new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReportForDetails(feedback);
                              setShowDetailsModal(true);
                            }}
                            icon={<Eye className="h-4 w-4" />}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleForwardClick(feedback)}
                            icon={<Send className="h-4 w-4" />}
                          >
                            Forward
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{feedbackList.length}</span> pending report{feedbackList.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && selectedFeedback && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForwardModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-8 pb-4">
              <Send className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Forward to Admin
              </h3>
              <p className="text-gray-600">
                Review the equipment report and add notes before forwarding to admin
              </p>
            </div>

            <div className="px-8 pb-8">
              {/* Feedback Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Report Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Student:</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.student_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">PC Number:</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.pc_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedFeedback.date_submitted).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedFeedback.date_submitted).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs text-gray-600">Equipment</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.equipment_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.equipment_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.equipment_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Monitor</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.monitor_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.monitor_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.monitor_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Keyboard</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.keyboard_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.keyboard_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.keyboard_condition}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Mouse</span>
                    <p className={`text-xs font-semibold mt-1 ${
                      selectedFeedback.mouse_condition === 'Good' ? 'text-green-700' :
                      selectedFeedback.mouse_condition === 'Minor Issue' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {selectedFeedback.mouse_condition}
                    </p>
                  </div>
                </div>
                {selectedFeedback.comments && (
                  <div className="mt-4">
                    <span className="text-xs text-gray-600">Student Comments:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedFeedback.comments}</p>
                  </div>
                )}
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any observations or recommendations for the admin..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowForwardModal(false)}
                  disabled={forwarding}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleForwardSubmit}
                  loading={forwarding}
                >
                  Forward to Admin
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Forward Modal */}
      {showBatchForwardModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBatchForwardModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-8 pb-4">
              <Send className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Forward Multiple Reports to Admin
              </h3>
              <p className="text-gray-600">
                You are about to forward <span className="font-semibold text-blue-600">{selectedFeedbackIds.size}</span> report{selectedFeedbackIds.size !== 1 ? 's' : ''} to admin
              </p>
            </div>

            <div className="px-8 pb-8">
              {/* Selected Reports Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Selected Reports</h4>
                <div className="space-y-2">
                  {feedbackList
                    .filter(f => selectedFeedbackIds.has(f.id))
                    .map((feedback) => (
                      <div key={feedback.id} className="text-sm text-gray-700 flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                        <span className="font-medium">{feedback.student_name}</span>
                        <span className="text-gray-500">PC {feedback.pc_number}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label htmlFor="batch-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  id="batch-notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any observations or recommendations for the admin (applies to all selected reports)..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowBatchForwardModal(false)}
                  disabled={forwarding}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBatchForwardSubmit}
                  loading={forwarding}
                >
                  Forward {selectedFeedbackIds.size} Report{selectedFeedbackIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {showDetailsModal && selectedReportForDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10"
            >
              ×
            </Button>
            
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
                      <p className="font-medium text-gray-900">{selectedReportForDetails.student_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Student ID:</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.student_id_str}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PC Number:</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.pc_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Date Submitted:</span>
                      <p className="font-medium text-gray-900">
                        {selectedReportForDetails.date_submitted ? new Date(selectedReportForDetails.date_submitted).toLocaleString('en-US', {
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
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.equipment_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.equipment_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.equipment_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Monitor</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.monitor_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.monitor_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.monitor_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Keyboard</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.keyboard_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.keyboard_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.keyboard_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Mouse</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${
                        selectedReportForDetails.mouse_condition === 'Good' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedReportForDetails.mouse_condition === 'Minor Issue' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedReportForDetails.mouse_condition}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Student Comments */}
                {selectedReportForDetails.comments && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Comments</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReportForDetails.comments}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
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

function WorkingStudentDashboard() {
  const location = useLocation();
  
  const navigationItems = [
    { name: 'Dashboard', href: '/working-student', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/working-student' },
    { name: 'Student Management', href: '/working-student/manage-users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/working-student/manage-users' },
    { name: 'Equipment Reports', href: '/working-student/equipment-reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/working-student/equipment-reports' },
  ];

  return (
    <Layout navigationItems={navigationItems} title="Working Student Dashboard">
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="manage-users" element={<ManageUsers />} />
        <Route path="equipment-reports" element={<EquipmentReports />} />
      </Routes>
    </Layout>
  );
}

export default WorkingStudentDashboard;
