import React, { useState } from 'react';
import { CheckCircle2, CornerUpLeft } from 'lucide-react';
import { useAppUi } from '../contexts/AppUiContext';

interface LogoutFeedbackModalProps {
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => void;
  mode?: 'logout' | 'manual';
}

interface FeedbackData {
  computer: { status: 'yes' | 'no' | null; issue: string };
  mouse: { status: 'yes' | 'no' | null; issue: string };
  keyboard: { status: 'yes' | 'no' | null; issue: string };
  monitor: { status: 'yes' | 'no' | null; issue: string };
  reportingContext: 'current_pc' | 'other_pc';
  targetPCNumber: string;
  additionalComments: string;
}

interface EquipmentItemProps {
  label: string;
  value: { status: 'yes' | 'no' | null; issue: string };
  onChange: (value: { status: 'yes' | 'no' | null; issue: string }) => void;
}

function EquipmentItem({ label, value, onChange }: EquipmentItemProps) {
  const isComplete = value.status !== null && (value.status === 'yes' || (value.status === 'no' && value.issue.trim()));

  return (
    <div className={`relative border rounded-xl p-4 transition-all duration-200 ${
      value.status === 'yes'
        ? 'border-green-200 bg-green-50/50'
        : value.status === 'no'
        ? 'border-red-200 bg-red-50/50'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* Status Indicator */}
      <div className="absolute top-4 right-4">
        {isComplete ? (
          <CheckCircle2 className={`h-5 w-5 ${
            value.status === 'yes' ? 'text-success-500' : 'text-danger-500'
          }`} />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        )}
      </div>

      {/* Equipment Header */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-900">{label}</h4>
      </div>

      {/* Status Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ status: 'yes', issue: '' })}
          className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            value.status === 'yes'
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-white border border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50'
          }`}
        >
          Working
        </button>
        <button
          type="button"
          onClick={() => onChange({ status: 'no', issue: value.issue })}
          className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            value.status === 'no'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white border border-gray-300 text-gray-700 hover:border-red-400 hover:bg-red-50'
          }`}
        >
          Issue
        </button>
      </div>

      {/* Issue Description */}
      {value.status === 'no' && (
        <div className="mt-3">
          <input
            type="text"
            value={value.issue}
            onChange={(e) => onChange({ status: 'no', issue: e.target.value })}
            placeholder="Describe the issue..."
          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-danger-500 focus:border-transparent text-sm"
            required
          />
        </div>
      )}
    </div>
  );
}

function LogoutFeedbackModal({ onClose, onSubmit, mode = 'logout' }: LogoutFeedbackModalProps) {
  const { toast } = useAppUi();
  const initialEquipmentStatus: 'yes' | null = mode === 'manual' ? 'yes' : null;
  const [feedback, setFeedback] = useState<FeedbackData>({
    computer: { status: initialEquipmentStatus, issue: '' },
    mouse: { status: initialEquipmentStatus, issue: '' },
    keyboard: { status: initialEquipmentStatus, issue: '' },
    monitor: { status: initialEquipmentStatus, issue: '' },
    reportingContext: 'current_pc',
    targetPCNumber: '',
    additionalComments: ''
  });

  const isOtherPC = feedback.reportingContext === 'other_pc';
  const equipmentItems = [
    { eq: feedback.computer, name: 'Computer' },
    { eq: feedback.mouse, name: 'Mouse' },
    { eq: feedback.keyboard, name: 'Keyboard' },
    { eq: feedback.monitor, name: 'Monitor' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'logout') {
      if (isOtherPC) {
        if (!feedback.targetPCNumber.trim()) {
          toast('Please enter the lab and PC number you are reporting for.', 'error');
          return;
        }
        for (const { eq, name } of equipmentItems) {
          if (eq.status === null) {
            toast(`Please indicate status for the ${name} (Working or Issue).`, 'error');
            return;
          }
          if (eq.status === 'no' && !eq.issue.trim()) {
            toast(`Please describe the issue with the ${name}.`, 'error');
            return;
          }
        }
      } else {
        if (!feedback.computer.status || !feedback.mouse.status ||
            !feedback.keyboard.status || !feedback.monitor.status) {
          toast('Please answer all equipment questions', 'error');
          return;
        }
        if (feedback.computer.status === 'no' && !feedback.computer.issue.trim()) {
          toast('Please describe the issue with the Computer', 'error');
          return;
        }
        if (feedback.mouse.status === 'no' && !feedback.mouse.issue.trim()) {
          toast('Please describe the issue with the Mouse', 'error');
          return;
        }
        if (feedback.keyboard.status === 'no' && !feedback.keyboard.issue.trim()) {
          toast('Please describe the issue with the Keyboard', 'error');
          return;
        }
        if (feedback.monitor.status === 'no' && !feedback.monitor.issue.trim()) {
          toast('Please describe the issue with the Monitor', 'error');
          return;
        }
      }
    }

    if (mode === 'manual') {
      if (!feedback.targetPCNumber.trim()) {
        toast('Please enter the computer lab and PC number.', 'error');
        return;
      }

      const hasIssue = equipmentItems.some(({ eq }) => eq.status === 'no');
      if (!hasIssue) {
        toast('Please mark at least one equipment item as Issue.', 'error');
        return;
      }

      const missingIssueDetail = equipmentItems.find(({ eq }) => eq.status === 'no' && !eq.issue.trim());
      if (missingIssueDetail) {
        toast(`Please describe the issue with the ${missingIssueDetail.name}.`, 'error');
        return;
      }
    }

    if (mode === 'logout' && feedback.reportingContext === 'other_pc' && !feedback.targetPCNumber.trim()) {
      toast('Please enter the lab and PC number you are reporting for.', 'error');
      return;
    }

    onSubmit(feedback);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const logoutCompletedItems = [
    feedback.computer.status !== null && (feedback.computer.status === 'yes' || feedback.computer.issue.trim()),
    feedback.mouse.status !== null && (feedback.mouse.status === 'yes' || feedback.mouse.issue.trim()),
    feedback.keyboard.status !== null && (feedback.keyboard.status === 'yes' || feedback.keyboard.issue.trim()),
    feedback.monitor.status !== null && (feedback.monitor.status === 'yes' || feedback.monitor.issue.trim())
  ].filter(Boolean).length;

  const progress = mode === 'logout' && !isOtherPC ? (logoutCompletedItems / 4) * 100 : 100;

  const otherPcAllComplete = [feedback.computer, feedback.mouse, feedback.keyboard, feedback.monitor]
    .every(eq => eq.status !== null && (eq.status === 'yes' || eq.issue.trim().length > 0));
  const otherPcCanSubmit =
    feedback.targetPCNumber.trim().length > 0 && otherPcAllComplete;

  const manualHasIssue = equipmentItems.some(({ eq }) => eq.status === 'no');
  const manualIssuesComplete = equipmentItems.every(({ eq }) => eq.status !== 'no' || eq.issue.trim().length > 0);
  const manualCanSubmit =
    manualHasIssue &&
    manualIssuesComplete &&
    feedback.targetPCNumber.trim().length > 0;

  const canSubmit = mode === 'logout'
    ? isOtherPC
      ? otherPcCanSubmit
      : progress === 100
    : manualCanSubmit;

  return (
    <div 
      className="modal-backdrop p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative modal-surface-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-primary-200/70 px-4 sm:px-8 py-4 sm:py-5 sticky top-0 bg-gradient-to-r from-primary-50/90 to-white z-10 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{mode === 'logout' ? 'Equipment Check' : 'Report Lab Issue'}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {mode === 'logout' ? 'Please verify all equipment status' : 'Report equipment issues immediately'}
              </p>
              
              {mode === 'logout' && !isOtherPC && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span className="font-medium">{logoutCompletedItems} of 4 completed</span>
                    <span className="text-gray-400">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="modal-back-icon-btn shrink-0"
              title="Back"
              aria-label="Back"
            >
              <CornerUpLeft className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-8" noValidate>
          {mode === 'manual' && (
            <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Report Details</h4>

              <div className="md:max-w-md">
                <label className="block text-xs font-medium text-gray-700 mb-2">Computer Lab &amp; PC Number *</label>
                <input
                  type="text"
                  value={feedback.targetPCNumber}
                  onChange={(e) => setFeedback({ ...feedback, targetPCNumber: e.target.value })}
                  placeholder="e.g. CL1-PC01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {mode === 'logout' ? (
            <>
              <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Reporting for</h4>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reportingContext"
                      checked={feedback.reportingContext === 'current_pc'}
                      onChange={() => setFeedback({
                        ...feedback,
                        reportingContext: 'current_pc',
                        targetPCNumber: '',
                        computer: { status: null, issue: '' },
                        mouse: { status: null, issue: '' },
                        keyboard: { status: null, issue: '' },
                        monitor: { status: null, issue: '' },
                      })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">This PC (the one I used)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reportingContext"
                      checked={feedback.reportingContext === 'other_pc'}
                      onChange={() => setFeedback({
                        ...feedback,
                        reportingContext: 'other_pc',
                        computer: { status: null, issue: '' },
                        mouse: { status: null, issue: '' },
                        keyboard: { status: null, issue: '' },
                        monitor: { status: null, issue: '' },
                      })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Another PC</span>
                  </label>
                </div>
                {isOtherPC && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Lab &amp; PC Number <span className="text-danger-500">*</span></label>
                    <input
                      type="text"
                      value={feedback.targetPCNumber}
                      onChange={(e) => setFeedback({ ...feedback, targetPCNumber: e.target.value })}
                      placeholder="e.g. CL1-PC01"
                  className="w-56 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              {isOtherPC ? (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-3">Select Working or Issue for each equipment on that PC (you can report no issues if everything is fine):</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EquipmentItem
                      label="Computer"
                      value={feedback.computer}
                      onChange={(value) => setFeedback({ ...feedback, computer: value })}
                    />
                    <EquipmentItem
                      label="Mouse"
                      value={feedback.mouse}
                      onChange={(value) => setFeedback({ ...feedback, mouse: value })}
                    />
                    <EquipmentItem
                      label="Keyboard"
                      value={feedback.keyboard}
                      onChange={(value) => setFeedback({ ...feedback, keyboard: value })}
                    />
                    <EquipmentItem
                      label="Monitor"
                      value={feedback.monitor}
                      onChange={(value) => setFeedback({ ...feedback, monitor: value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <EquipmentItem
                    label="Computer"
                    value={feedback.computer}
                    onChange={(value) => setFeedback({ ...feedback, computer: value })}
                  />
                  <EquipmentItem
                    label="Mouse"
                    value={feedback.mouse}
                    onChange={(value) => setFeedback({ ...feedback, mouse: value })}
                  />
                  <EquipmentItem
                    label="Keyboard"
                    value={feedback.keyboard}
                    onChange={(value) => setFeedback({ ...feedback, keyboard: value })}
                  />
                  <EquipmentItem
                    label="Monitor"
                    value={feedback.monitor}
                    onChange={(value) => setFeedback({ ...feedback, monitor: value })}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-white">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Equipment Status</h4>
              <p className="text-xs text-gray-500 mb-3">
                Mark only the affected equipment as Issue. If only one item has a problem, keep the rest as Working.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EquipmentItem
                  label="Computer"
                  value={feedback.computer}
                  onChange={(value) => setFeedback({ ...feedback, computer: value })}
                />
                <EquipmentItem
                  label="Mouse"
                  value={feedback.mouse}
                  onChange={(value) => setFeedback({ ...feedback, mouse: value })}
                />
                <EquipmentItem
                  label="Keyboard"
                  value={feedback.keyboard}
                  onChange={(value) => setFeedback({ ...feedback, keyboard: value })}
                />
                <EquipmentItem
                  label="Monitor"
                  value={feedback.monitor}
                  onChange={(value) => setFeedback({ ...feedback, monitor: value })}
                />
              </div>
            </div>
          )}

          {/* Additional Comments */}
          <div className="border-t border-gray-100 pt-6 mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Additional Comments <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={feedback.additionalComments}
              onChange={(e) => setFeedback({ ...feedback, additionalComments: e.target.value })}
              rows={3}
              placeholder="Any other observations or concerns..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canSubmit}
            >
              {mode === 'logout' ? 'Submit' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LogoutFeedbackModal;

