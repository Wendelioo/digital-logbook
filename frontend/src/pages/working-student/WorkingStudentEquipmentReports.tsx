import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import LoadingDots from '../../components/LoadingDots';
import {
  Eye,
  AlertCircle,
  Send,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  GetPendingFeedback,
  GetConfirmedFeedback,
  GetRejectedFeedback,
  ConfirmFeedback,
  ForwardFeedbackToAdmin,
  ForwardMultipleFeedbackToAdmin,
} from '../../../wailsjs/go/backend/App';
import { useAuth } from '../../contexts/AuthContext';
import { parseReportContext } from '../../utils/feedbackComments';
import { Feedback } from './types';

type SectionTab = 'issues' | 'ready_to_forward' | 'rejected';

function EquipmentReports() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [confirmedList, setConfirmedList] = useState<Feedback[]>([]);
  const [rejectedList, setRejectedList] = useState<Feedback[]>([]);
  const [sectionTab, setSectionTab] = useState<SectionTab>('issues');
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmFeedback, setConfirmFeedback] = useState<Feedback | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<'confirm' | 'reject' | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadAllFeedback();

    const refreshInterval = setInterval(() => {
      loadAllFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadAllFeedback = async () => {
    try {
      const [pending, confirmed, rejected] = await Promise.all([
        GetPendingFeedback(),
        GetConfirmedFeedback(),
        GetRejectedFeedback(),
      ]);
      setFeedbackList(pending || []);
      setConfirmedList(confirmed || []);
      setRejectedList(rejected || []);
      setError('');
    } catch (error) {
      console.error('Failed to load feedback:', error);
      setError('Unable to load feedback. Make sure you are connected to the database.');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const isNoIssueReport = (report: Feedback) => {
    const allGood =
      (report.equipment_condition || '').toLowerCase() === 'good' &&
      (report.monitor_condition || '').toLowerCase() === 'good' &&
      (report.keyboard_condition || '').toLowerCase() === 'good' &&
      (report.mouse_condition || '').toLowerCase() === 'good';
    const hasComment = !!(report.comments && report.comments.trim());
    return allGood && !hasComment;
  };

  const countIssues = (report: Feedback): number =>
    [
      report.equipment_condition,
      report.monitor_condition,
      report.keyboard_condition,
      report.mouse_condition,
    ].filter(c => c && c.toLowerCase() !== 'good').length;

  const issueFeedbackList = feedbackList.filter((report) => !isNoIssueReport(report));
  const visibleFeedbackList = sectionTab === 'issues'
    ? issueFeedbackList
    : sectionTab === 'ready_to_forward'
      ? confirmedList
      : rejectedList;
  const isRejectedTab = sectionTab === 'rejected';

  const handleConfirmClick = (feedback: Feedback, decision: 'confirm' | 'reject') => {
    setConfirmFeedback(feedback);
    setConfirmDecision(decision);
    setConfirmNotes('');
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmFeedback || !user || !confirmDecision) return;
    setConfirming(true);
    try {
      await ConfirmFeedback(confirmFeedback.id, user.id, confirmDecision === 'confirm', confirmNotes.trim());
      showNotification(
        'success',
        confirmDecision === 'confirm'
          ? 'Report confirmed. It can now be forwarded to admin.'
          : 'Report marked as not confirmed.'
      );
      setShowConfirmModal(false);
      setConfirmFeedback(null);
      setConfirmDecision(null);
      setConfirmNotes('');
      await loadAllFeedback();
    } catch (error) {
      console.error('Failed to confirm/reject feedback:', error);
      showNotification('error', 'Failed to save. Please try again.');
    } finally {
      setConfirming(false);
    }
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
      await ForwardFeedbackToAdmin(selectedFeedback.id, user.id, forwardNotes.trim());
      showNotification('success', 'Feedback forwarded to admin successfully!');
      setShowForwardModal(false);
      setSelectedFeedback(null);
      setForwardNotes('');
      await loadAllFeedback();
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
      const count = await ForwardMultipleFeedbackToAdmin(feedbackIdsArray, user.id, forwardNotes.trim());
      showNotification('success', `Successfully forwarded ${count} report${count !== 1 ? 's' : ''} to admin!`);
      setShowBatchForwardModal(false);
      setSelectedFeedbackIds(new Set());
      setForwardNotes('');
      await loadAllFeedback();
    } catch (error) {
      console.error('Failed to batch forward:', error);
      showNotification('error', 'Failed to forward feedback. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectedIds = new Set(selectedFeedbackIds);
      visibleFeedbackList.forEach((feedback) => selectedIds.add(feedback.id));
      setSelectedFeedbackIds(selectedIds);
    } else {
      const selectedIds = new Set(selectedFeedbackIds);
      visibleFeedbackList.forEach((feedback) => selectedIds.delete(feedback.id));
      setSelectedFeedbackIds(selectedIds);
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
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
      </div>

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

      <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between border-b border-gray-100">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
            <button
              type="button"
              onClick={() => { setSectionTab('issues'); setSelectedFeedbackIds(new Set()); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                sectionTab === 'issues'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Issue Reports
              <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold ${
                sectionTab === 'issues' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
              }`}>{issueFeedbackList.length}</span>
            </button>
            <button
              type="button"
              onClick={() => { setSectionTab('ready_to_forward'); setSelectedFeedbackIds(new Set()); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                sectionTab === 'ready_to_forward'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Verified – Ready to Forward
              <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold ${
                sectionTab === 'ready_to_forward' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
              }`}>{confirmedList.length}</span>
            </button>
            <button
              type="button"
              onClick={() => { setSectionTab('rejected'); setSelectedFeedbackIds(new Set()); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                sectionTab === 'rejected'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rejected
              <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold ${
                sectionTab === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
              }`}>{rejectedList.length}</span>
            </button>
          </div>

        </div>

        <div className="px-4 py-2 bg-gray-50 flex items-center gap-4 text-sm text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{visibleFeedbackList.length}</span>
            {' '}report{visibleFeedbackList.length !== 1 ? 's' : ''} shown
          </span>
          {!isRejectedTab && selectedFeedbackIds.size > 0 && (
            <span className="text-blue-600 font-medium">
              · {selectedFeedbackIds.size} selected
            </span>
          )}
        </div>
      </div>

      {visibleFeedbackList.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 font-medium">No reports available for this section</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {!isRejectedTab && selectedFeedbackIds.size > 0 && (
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
                {sectionTab === 'ready_to_forward' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleBatchForwardClick}
                    icon={<Send className="h-4 w-4" />}
                  >
                    Forward ({selectedFeedbackIds.size})
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full divide-y divide-gray-200 table-fixed">
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      {!isRejectedTab && (
                        <input
                          type="checkbox"
                          checked={visibleFeedbackList.length > 0 && visibleFeedbackList.every((feedback) => selectedFeedbackIds.has(feedback.id))}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      )}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      PC / Origin
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleFeedbackList.map((feedback) => (
                    <tr key={feedback.id} className={`transition-colors ${
                      isNoIssueReport(feedback)
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-red-50 hover:bg-red-100'
                    }`}>
                      <td className="px-3 py-3">
                        {!isRejectedTab && (
                          <input
                            type="checkbox"
                            checked={selectedFeedbackIds.has(feedback.id)}
                            onChange={(e) => handleSelectFeedback(feedback.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate">{feedback.student_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{feedback.student_id_str}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold w-fit truncate max-w-full">
                            {feedback.pc_number}
                          </span>
                          {(() => {
                            const { reportedForAnotherPC, submittedFrom } = parseReportContext(feedback.comments);
                            if (!reportedForAnotherPC && !submittedFrom) return null;
                            return (
                              <span className="text-xs text-gray-500 truncate">
                                {submittedFrom ? `from ${submittedFrom}` : 'Other PC'}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-gray-700">
                          {feedback.date_submitted ? new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric'
                          }) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          if (isRejectedTab) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-red-100 text-red-800">
                                  Rejected
                                </span>
                                {feedback.verified_at && (
                                  <span className="text-[11px] text-red-700 whitespace-nowrap">
                                    {new Date(feedback.verified_at).toLocaleString('en-US', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          const n = countIssues(feedback);
                          const hasIssues = n > 0;
                          const baseLabel = hasIssues ? `${n} ${n === 1 ? 'Issue' : 'Issues'}` : 'No Issues';

                          return (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                hasIssues
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {baseLabel}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            title="View Details"
                            onClick={() => {
                              setSelectedReportForDetails(feedback);
                              setShowDetailsModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors w-full justify-center"
                          >
                            <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Details</span>
                          </button>
                          {sectionTab === 'issues' ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Confirm issue"
                                onClick={() => handleConfirmClick(feedback, 'confirm')}
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex-1 justify-center"
                              >
                                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>Confirm</span>
                              </button>
                              <button
                                type="button"
                                title="Reject report"
                                onClick={() => handleConfirmClick(feedback, 'reject')}
                                className="inline-flex items-center justify-center p-1.5 text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : sectionTab === 'ready_to_forward' ? (
                            <button
                              type="button"
                              title="Forward to admin"
                              onClick={() => handleForwardClick(feedback)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors w-full justify-center"
                            >
                              <Send className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Forward</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {visibleFeedbackList.length} report{visibleFeedbackList.length !== 1 ? 's' : ''} shown
              {!isRejectedTab && selectedFeedbackIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-medium">· {selectedFeedbackIds.size} selected</span>
              )}
            </div>
          </div>
        </div>
      )}

      {showForwardModal && selectedFeedback && (
        <div 
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForwardModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-4 sm:p-6 pb-3 sm:pb-4">
              <Send className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Forward to Admin
              </h3>
              <p className="text-gray-600">
                Review the equipment report and add notes before forwarding to admin
              </p>
            </div>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Report Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Student:</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.student_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Reported for (PC):</span>
                    <p className="font-medium text-gray-900">{selectedFeedback.pc_number}</p>
                    {(() => {
                      const { reportedForAnotherPC, submittedFrom } = parseReportContext(selectedFeedback.comments);
                      if (!reportedForAnotherPC && !submittedFrom) return null;
                      return (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {reportedForAnotherPC && 'Reported for another PC'}
                          {reportedForAnotherPC && submittedFrom && ' · '}
                          {submittedFrom && `Submitted from: ${submittedFrom}`}
                        </p>
                      );
                    })()}
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
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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

              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes for the admin..."
                />
              </div>

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

      {showConfirmModal && confirmFeedback && confirmDecision && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowConfirmModal(false);
              setConfirmFeedback(null);
              setConfirmDecision(null);
              setConfirmNotes('');
            }
          }}
        >
          <div className="modal-surface w-full max-w-lg mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowConfirmModal(false);
                setConfirmFeedback(null);
                setConfirmDecision(null);
                setConfirmNotes('');
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            <div className="p-4 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${confirmDecision === 'confirm' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {confirmDecision === 'confirm' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {confirmDecision === 'confirm' ? 'Confirm issue' : 'Reject report'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {confirmFeedback.student_name} · Reported for: PC {confirmFeedback.pc_number}
                    {(() => {
                      const { submittedFrom } = parseReportContext(confirmFeedback.comments);
                      return submittedFrom ? ` · Submitted from: ${submittedFrom}` : '';
                    })()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                {confirmDecision === 'confirm'
                  ? 'Confirm that the reported equipment issue is true. Once confirmed, this report can be forwarded to admin.'
                  : 'Mark this report as not confirmed (issue not verified). It will not be forwarded to admin.'}
              </p>
              <label htmlFor="confirm-notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                id="confirm-notes"
                rows={3}
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
                placeholder="Add verification notes..."
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmFeedback(null);
                    setConfirmDecision(null);
                    setConfirmNotes('');
                  }}
                  disabled={confirming}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSubmit}
                  loading={confirming}
                  className={confirmDecision === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {confirmDecision === 'confirm' ? 'Confirm issue' : 'Reject report'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBatchForwardModal && (
        <div 
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBatchForwardModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-2xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchForwardModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </Button>
            
            <div className="text-center p-4 sm:p-8 pb-3 sm:pb-4">
              <Send className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Forward Multiple Reports to Admin
              </h3>
              <p className="text-gray-600">
                You are about to forward <span className="font-semibold text-blue-600">{selectedFeedbackIds.size}</span> report{selectedFeedbackIds.size !== 1 ? 's' : ''} to admin
              </p>
            </div>

            <div className="px-4 sm:px-8 pb-4 sm:pb-8">
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Selected Reports</h4>
                <div className="space-y-2">
                  {confirmedList
                    .filter(f => selectedFeedbackIds.has(f.id))
                    .map((feedback) => (
                      <div key={feedback.id} className="text-sm text-gray-700 flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                        <span className="font-medium">{feedback.student_name}</span>
                        <span className="text-gray-500">
                          Reported for: PC {feedback.pc_number}
                          {(() => {
                            const { submittedFrom } = parseReportContext(feedback.comments);
                            return submittedFrom ? ` · from ${submittedFrom}` : '';
                          })()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="batch-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="batch-notes"
                  rows={4}
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes for the admin (applies to all selected reports)..."
                />
              </div>

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

      {showDetailsModal && selectedReportForDetails && (
        <div 
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
            }
          }}
        >
          <div className="modal-surface w-full max-w-3xl mx-2 sm:mx-4 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10"
            >
              ×
            </Button>
            
            <div className="p-4 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Equipment Report Details</h3>
                  <p className="text-sm text-gray-600 mt-1">Equipment feedback submitted by student</p>
                </div>
              </div>

              <div className="space-y-6">
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
                      <span className="text-gray-600">Reported for (PC):</span>
                      <p className="font-medium text-gray-900">{selectedReportForDetails.pc_number}</p>
                      {(() => {
                        const { reportedForAnotherPC, submittedFrom } = parseReportContext(selectedReportForDetails.comments);
                        if (!reportedForAnotherPC && !submittedFrom) return null;
                        return (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {reportedForAnotherPC && 'Reported for another PC'}
                            {reportedForAnotherPC && submittedFrom && ' · '}
                            {submittedFrom && `Submitted from: ${submittedFrom}`}
                          </p>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-gray-600">Date Submitted:</span>
                      <p className="font-medium text-gray-900">
                        {selectedReportForDetails.date_submitted ? new Date(selectedReportForDetails.date_submitted).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

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

                {selectedReportForDetails.comments && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Comments</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReportForDetails.comments}</p>
                  </div>
                )}
              </div>

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
