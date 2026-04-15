import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerUpLeft } from 'lucide-react';
import Button from '../../../components/Button';
import {
  CreateClass,
  CreateSubject,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppUi } from '../../../contexts/AppUiContext';

function CreateClasslist() {
  const { user } = useAuth();
  const { toast } = useAppUi();
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



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validate required fields
      if (!formData.subjectCode) {
        const msg = 'EDP Code is required.';
        setMessage(msg);
        toast(msg, 'error');
        setLoading(false);
        return;
      }

      if (!formData.subjectName) {
        const msg = 'Subject Code is required.';
        setMessage(msg);
        toast(msg, 'error');
        setLoading(false);
        return;
      }

      if (!formData.descriptiveTitle) {
        const msg = 'Descriptive Title is required.';
        setMessage(msg);
        toast(msg, 'error');
        setLoading(false);
        return;
      }

      if (!formData.schedule) {
        const msg = 'Schedule is required.';
        setMessage(msg);
        toast(msg, 'error');
        setLoading(false);
        return;
      }

      if (!formData.schoolYear) {
        const msg = 'School Year is required.';
        setMessage(msg);
        toast(msg, 'error');
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

      const successMessage = 'Class created successfully!';

      setMessage(successMessage);
      toast(successMessage, 'success');
      navigate('/teacher/class-management');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessage(`Failed to create class: ${errorMessage}`);
      toast(`Failed to create class: ${errorMessage}`, 'error');
      console.error('Creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate('/teacher/class-management');
          }
        }}
      >
        <div className="modal-surface w-full max-w-3xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => navigate('/teacher/class-management')}
            className="absolute top-4 right-4 modal-back-icon-btn z-10"
            title="Back"
            aria-label="Back"
          >
            <CornerUpLeft className="h-5 w-5" />
          </button>

          <div className="p-3 pb-2 flex-shrink-0 border-b">
            <h2 className="text-lg font-bold text-gray-800">
              Class Information
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col" noValidate>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
            <div className="flex-shrink-0 border-t px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-3">
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
                CONFIRM
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default CreateClasslist;
