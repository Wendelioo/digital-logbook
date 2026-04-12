import Modal, { MODAL_BODY_MIN_HEIGHT_CLASS } from './Modal';
import TeacherAttendanceArchive, { AttendanceArchiveTab } from '../pages/teacher/TeacherAttendanceArchive';

interface TeacherStoredArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: AttendanceArchiveTab;
  onClassUnarchived?: () => void;
  onAttendanceUnarchived?: () => void;
}

function TeacherStoredArchiveModal({ isOpen, onClose, initialTab, onClassUnarchived, onAttendanceUnarchived }: TeacherStoredArchiveModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archive"
      size="2xl"
      contentMinHeightClassName={MODAL_BODY_MIN_HEIGHT_CLASS}
    >
      <TeacherAttendanceArchive initialTab={initialTab} hideHeader onClassUnarchived={onClassUnarchived} onAttendanceUnarchived={onAttendanceUnarchived} />
    </Modal>
  );
}

export default TeacherStoredArchiveModal;
