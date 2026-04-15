import Modal, { MODAL_BODY_MIN_HEIGHT_CLASS } from './Modal';
import ArchivedStudentsManagement from '../pages/roles/student-staff/ArchivedStudentsPage';

interface WorkingStudentArchivedStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function WorkingStudentArchivedStudentsModal({ isOpen, onClose }: WorkingStudentArchivedStudentsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archive"
      size="2xl"
      contentMinHeightClassName={MODAL_BODY_MIN_HEIGHT_CLASS}
    >
      <ArchivedStudentsManagement hideHeader archivedOnly />
    </Modal>
  );
}

export default WorkingStudentArchivedStudentsModal;
