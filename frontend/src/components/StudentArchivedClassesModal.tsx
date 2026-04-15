import Modal, { MODAL_BODY_MIN_HEIGHT_CLASS } from './Modal';
import ArchivedClasses from '../pages/roles/student/ArchivedClassesPage';

interface StudentArchivedClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassRestored?: () => void;
}

function StudentArchivedClassesModal({ isOpen, onClose, onClassRestored }: StudentArchivedClassesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archive"
      size="2xl"
      contentMinHeightClassName={MODAL_BODY_MIN_HEIGHT_CLASS}
    >
      <ArchivedClasses hideHeader onClassRestored={onClassRestored} />
    </Modal>
  );
}

export default StudentArchivedClassesModal;
