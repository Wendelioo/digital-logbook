import React, { useState } from 'react';
import { X, Monitor, Mouse, Keyboard, Computer, CheckCircle2, AlertCircle } from 'lucide-react';

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
  issueCategory: 'computer' | 'mouse' | 'keyboard' | 'monitor' | 'other';
  issueDescription: string;
  reportingContext: 'current_pc' | 'other_pc';
  reportedBy: 'self' | 'classmate';
  targetPCNumber: string;
  affectedStudentID: string;
  severity: 'normal' | 'high' | 'critical';
  additionalComments: string;
}

interface EquipmentItemProps {
  label: string;
  icon: React.ReactNode;
  value: { status: 'yes' | 'no' | null; issue: string };
  onChange: (value: { status: 'yes' | 'no' | null; issue: string }) => void;
}

function EquipmentItem({ label, icon, value, onChange }: EquipmentItemProps) {
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
            value.status === 'yes' ? 'text-green-500' : 'text-red-500'
          }`} />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        )}
      </div>

      {/* Equipment Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-lg ${
          value.status === 'yes' 
            ? 'bg-green-100' 
            : value.status === 'no' 
            ? 'bg-red-100' 
            : 'bg-gray-50'
        }`}>
          <div className={`h-5 w-5 ${
            value.status === 'yes' 
              ? 'text-green-600' 
              : value.status === 'no' 
              ? 'text-red-600' 
              : 'text-gray-500'
          }`}>
            {icon}
          </div>
        </div>
        <h4 className="font-medium text-gray-900">{label}</h4>
      </div>

      {/* Status Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ status: 'yes', issue: '' })}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
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
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            required
          />
        </div>
      )}
    </div>
  );
}

function LogoutFeedbackModal({ onClose, onSubmit, mode = 'logout' }: LogoutFeedbackModalProps) {
  const [feedback, setFeedback] = useState<FeedbackData>({
    computer: { status: null, issue: '' },
    mouse: { status: null, issue: '' },
    keyboard: { status: null, issue: '' },
    monitor: { status: null, issue: '' },
    issueCategory: 'computer',
    issueDescription: '',
    reportingContext: 'current_pc',
    reportedBy: 'self',
    targetPCNumber: '',
    affectedStudentID: '',
    severity: 'normal',
    additionalComments: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'logout') {
      // Validate that all equipment status are selected
      if (!feedback.computer.status || !feedback.mouse.status ||
          !feedback.keyboard.status || !feedback.monitor.status) {
        alert('Please answer all equipment questions');
        return;
      }

      // Validate that if "No" is selected, an issue description is provided
      if (feedback.computer.status === 'no' && !feedback.computer.issue.trim()) {
        alert('Please describe the issue with the Computer');
        return;
      }
      if (feedback.mouse.status === 'no' && !feedback.mouse.issue.trim()) {
        alert('Please describe the issue with the Mouse');
        return;
      }
      if (feedback.keyboard.status === 'no' && !feedback.keyboard.issue.trim()) {
        alert('Please describe the issue with the Keyboard');
        return;
      }
      if (feedback.monitor.status === 'no' && !feedback.monitor.issue.trim()) {
        alert('Please describe the issue with the Monitor');
        return;
      }
    }

    if (mode === 'manual' && !feedback.issueDescription.trim()) {
      alert('Please describe the issue you are reporting.');
      return;
    }

    if (feedback.reportingContext === 'other_pc' && !feedback.targetPCNumber.trim()) {
      alert('Please enter the PC number you are reporting for.');
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

  const progress = mode === 'logout' ? (logoutCompletedItems / 4) * 100 : 100;
  const canSubmit = mode === 'logout'
    ? progress === 100
    : feedback.issueDescription.trim().length > 0 &&
      (feedback.reportingContext === 'current_pc' || feedback.targetPCNumber.trim().length > 0);

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-100 px-8 py-5 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{mode === 'logout' ? 'Equipment Check' : 'Report Lab Issue'}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {mode === 'logout' ? 'Please verify all equipment status' : 'Report equipment issues immediately'}
              </p>
              
              {mode === 'logout' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span className="font-medium">{logoutCompletedItems} of 4 completed</span>
                    <span className="text-gray-400">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {mode === 'manual' && (
            <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Reporting Context</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">You are reporting for</label>
                  <select
                    value={feedback.reportingContext}
                    onChange={(e) => setFeedback({
                      ...feedback,
                      reportingContext: e.target.value as 'current_pc' | 'other_pc'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="current_pc">Current PC</option>
                    <option value="other_pc">Another PC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Reported by</label>
                  <select
                    value={feedback.reportedBy}
                    onChange={(e) => setFeedback({
                      ...feedback,
                      reportedBy: e.target.value as 'self' | 'classmate'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="self">Self</option>
                    <option value="classmate">Classmate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Target PC Number {feedback.reportingContext === 'other_pc' ? '*' : '(Optional)'}</label>
                  <input
                    type="text"
                    value={feedback.targetPCNumber}
                    onChange={(e) => setFeedback({ ...feedback, targetPCNumber: e.target.value })}
                    placeholder="e.g. PC-12"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Urgency</label>
                  <select
                    value={feedback.severity}
                    onChange={(e) => setFeedback({
                      ...feedback,
                      severity: e.target.value as 'normal' | 'high' | 'critical'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Affected Student ID (Optional)</label>
                <input
                  type="text"
                  value={feedback.affectedStudentID}
                  onChange={(e) => setFeedback({ ...feedback, affectedStudentID: e.target.value })}
                  placeholder="If reporting for classmate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {mode === 'logout' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <EquipmentItem
                label="Computer"
                icon={<Computer />}
                value={feedback.computer}
                onChange={(value) => setFeedback({ ...feedback, computer: value })}
              />

              <EquipmentItem
                label="Mouse"
                icon={<Mouse />}
                value={feedback.mouse}
                onChange={(value) => setFeedback({ ...feedback, mouse: value })}
              />

              <EquipmentItem
                label="Keyboard"
                icon={<Keyboard />}
                value={feedback.keyboard}
                onChange={(value) => setFeedback({ ...feedback, keyboard: value })}
              />

              <EquipmentItem
                label="Monitor"
                icon={<Monitor />}
                value={feedback.monitor}
                onChange={(value) => setFeedback({ ...feedback, monitor: value })}
              />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-white">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Issue Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Issue Category</label>
                  <select
                    value={feedback.issueCategory}
                    onChange={(e) => setFeedback({
                      ...feedback,
                      issueCategory: e.target.value as 'computer' | 'mouse' | 'keyboard' | 'monitor' | 'other'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="computer">Computer</option>
                    <option value="monitor">Monitor</option>
                    <option value="keyboard">Keyboard</option>
                    <option value="mouse">Mouse</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Issue Description *</label>
                <textarea
                  value={feedback.issueDescription}
                  onChange={(e) => setFeedback({ ...feedback, issueDescription: e.target.value })}
                  rows={4}
                  placeholder="Describe what is not working..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
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

