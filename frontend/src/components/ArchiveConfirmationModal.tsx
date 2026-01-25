import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertCircle, CheckCircle, Archive } from 'lucide-react';

interface ArchiveConfirmationModalProps {
  isOpen: boolean;
  logCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const ArchiveConfirmationModal: React.FC<ArchiveConfirmationModalProps> = ({
  isOpen,
  logCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-yellow-100 rounded-full">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Archive {logCount} Log {logCount === 1 ? 'Entry' : 'Entries'}?
            </h3>
            <p className="text-gray-600 mt-1">
              These entries will be moved to the Archive section
            </p>
          </div>
        </div>

        {/* Information Box */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>Logs will be grouped by archive date for easy organization</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>You can restore them anytime from the Archive section</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>Original login dates and times will be preserved</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={onConfirm}
            icon={<Archive className="h-4 w-4" />}
          >
            Archive {logCount} {logCount === 1 ? 'Entry' : 'Entries'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ArchiveConfirmationModal;
