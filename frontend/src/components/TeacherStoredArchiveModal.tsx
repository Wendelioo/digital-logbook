import Modal from './Modal';
import TeacherAttendanceArchive, { AttendanceArchiveTab } from '../pages/teacher/TeacherAttendanceArchive';

interface TeacherStoredArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: AttendanceArchiveTab;
  onClassUnarchived?: () => void;
}

function TeacherStoredArchiveModal({ isOpen, onClose, initialTab, onClassUnarchived }: TeacherStoredArchiveModalProps) {
  const title = initialTab === 'classes' ? 'Archived Classlist' : 'Archived Attendance';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="2xl"
    >
      <TeacherAttendanceArchive initialTab={initialTab} hideHeader onClassUnarchived={onClassUnarchived} />
    </Modal>
  );
}

export default TeacherStoredArchiveModal;
