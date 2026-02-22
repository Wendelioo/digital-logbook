import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import {
  CreateClass,
  CreateSubject,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';

function CreateClasslist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    schoolYear: '',
    semester: '1st Semester',
    subjectCode: '',
    subjectName: '',
    descriptiveTitle: '',
    schedule: '',
    room: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validate required fields
      if (!formData.subjectCode) {
        setMessage('EDP Code is required.');
        setLoading(false);
        return;
      }

      if (!formData.subjectName) {
        setMessage('Subject Code is required.');
        setLoading(false);
        return;
      }

      if (!formData.descriptiveTitle) {
        setMessage('Descriptive Title is required.');
        setLoading(false);
        return;
      }

      if (!formData.schedule) {
        setMessage('Schedule is required.');
        setLoading(false);
        return;
      }

      if (!formData.schoolYear) {
        setMessage('School Year is required.');
        setLoading(false);
        return;
      }

      // Use the manually entered EDP code
      const subjectCode = formData.subjectCode.toUpperCase().trim();

      // Create the subject using the Subject Code and Descriptive Title
      await CreateSubject(
        formData.subjectName, // Subject Code goes to subject_code
        formData.descriptiveTitle, // Descriptive Title goes to description
        user?.id || 0,
        ''
      );

      // Create the class (teacher creates it for themselves)
      await CreateClass(
        formData.subjectName, // Subject Code for the class
        user?.id || 0,
        formData.subjectCode, // EDP Code
        formData.schedule,
        formData.room,
        '',
        formData.semester,
        formData.schoolYear,
        formData.descriptiveTitle, // Descriptive Title for the class
        user?.id || 0  // Teacher creates the class themselves
      );

      setNotification({ type: 'success', message: 'Class created successfully!' });
      setMessage('Class created successfully!');

      setTimeout(() => {
        navigate('/teacher/class-management');
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage(`Failed to create class: ${errorMessage}`);
      setNotification({ type: 'error', message: `Failed to create class: ${errorMessage}` });
      setTimeout(() => setNotification(null), 5000);
      console.error('Creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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

      <div
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate('/teacher/class-management');
          }
        }}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] flex flex-col">
          <button
            type="button"
            onClick={() => navigate('/teacher/class-management')}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
          >
            ×
          </button>

          <div className="p-3 pb-2 flex-shrink-0 border-b">
            <h2 className="text-lg font-bold text-gray-800">
              Class Information
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Basic Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="schoolYear" className="block text-sm font-medium text-gray-700 mb-1.5">
                          School Year <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="schoolYear"
                          value={formData.schoolYear}
                          onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Semester <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="semester"
                          value={formData.semester}
                          onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                          required
                        >
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject Information Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Subject Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                          EDP Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="subjectCode"
                          value={formData.subjectCode}
                          onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Subject Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="subjectName"
                          value={formData.subjectName}
                          onChange={(e) => setFormData({ ...formData, subjectName: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="descriptiveTitle" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Descriptive Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="descriptiveTitle"
                        value={formData.descriptiveTitle}
                        onChange={(e) => setFormData({ ...formData, descriptiveTitle: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule and Room Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Schedule and Venue</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Schedule <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="schedule"
                          value={formData.schedule}
                          onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                          placeholder="e.g., MWF 8:00 AM - 10:00 AM"
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">Use day + time format for accurate auto-attendance (e.g., TTH 1:00 PM - 2:30 PM).</p>
                      </div>

                      <div>
                        <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Room <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="room"
                          value={formData.room}
                          onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {message && (
                <div className={`mt-4 p-4 rounded-md ${message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                  {message}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex-shrink-0 border-t px-6 py-4 flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => navigate('/teacher/class-management')}
                variant="outline"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={loading}
                variant="primary"
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

export default CreateClasslist;
