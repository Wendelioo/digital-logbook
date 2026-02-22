import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { Archive } from 'lucide-react';

interface ArchiveConfirmationModalProps {
  isOpen: boolean;
  logCount?: number;
  itemType?: string;
  itemDescription?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  loading?: boolean;
}

const ArchiveConfirmationModal: React.FC<ArchiveConfirmationModalProps> = ({
  isOpen,
  logCount,
  itemType,
  itemDescription,
  onConfirm,
  onCancel,
  onClose,
  loading = false,
}) => {
  if (!isOpen) return null;

  const handleClose = onClose || onCancel || (() => {});
  const count = logCount || 1;
  const type = itemType || 'log entry';
  const itemLabel = logCount !== undefined ? `${count} ${type}${count === 1 ? '' : 's'}` : type;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="p-8">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">Archive {itemLabel}?</h3>
          <p className="text-gray-600 mt-1">
            {itemDescription ? `${itemDescription}` : `This ${type} will be moved to Archive.`}
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <p className="text-sm text-gray-700">You can restore archived records later from the Archive section.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={onConfirm}
            icon={<Archive className="h-4 w-4" />}
            disabled={loading}
          >
            {loading ? 'Archiving...' : 'Archive'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ArchiveConfirmationModal;
