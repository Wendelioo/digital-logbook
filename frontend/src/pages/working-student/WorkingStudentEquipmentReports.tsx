import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import {
  Eye,
  AlertCircle,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';
import {
  GetPendingFeedback,
  ForwardFeedbackToAdmin,
  ForwardMultipleFeedbackToAdmin,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Feedback } from './types';

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
          <div className="overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full divide-y divide-gray-200" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" style={{ minWidth: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedFeedbackIds.size === feedbackList.length && feedbackList.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '180px' }}>
                      Full Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '100px' }}>
                      PC Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '120px' }}>
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '200px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedbackList.map((feedback) => (
                    <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFeedbackIds.has(feedback.id)}
                          onChange={(e) => handleSelectFeedback(feedback.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.student_id_str}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900" style={{ wordBreak: 'break-word' }}>
                        {feedback.student_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {feedback.pc_number}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {feedback.date_submitted ? new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
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

export default EquipmentReports;
