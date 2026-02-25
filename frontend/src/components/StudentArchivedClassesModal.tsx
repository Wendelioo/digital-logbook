import Modal from './Modal';
import ArchivedClasses from '../pages/student/StudentArchivedClasses';

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
    >
      <ArchivedClasses hideHeader onClassRestored={onClassRestored} />
    </Modal>
  );
}

export default StudentArchivedClassesModal;
