import Modal from './Modal';
import ArchiveManagement, { ArchiveTab } from '../pages/admin/AdminArchive';

interface AdminArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: ArchiveTab;
}

function AdminArchiveModal({ isOpen, onClose, initialTab }: AdminArchiveModalProps) {
  const title = initialTab === 'reports' ? 'Archived Feedback Reports' : 'Archived Log Entries';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="2xl"
    >
      <ArchiveManagement initialTab={initialTab} hideHeader />
    </Modal>
  );
}

export default AdminArchiveModal;
