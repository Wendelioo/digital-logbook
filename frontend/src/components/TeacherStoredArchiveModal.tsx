import React from 'react';
import Modal from './Modal';
import TeacherAttendanceArchive, { AttendanceArchiveTab } from '../pages/teacher/TeacherAttendanceArchive';

interface TeacherStoredArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: AttendanceArchiveTab;
}

function TeacherStoredArchiveModal({ isOpen, onClose, initialTab }: TeacherStoredArchiveModalProps) {
  const title = initialTab === 'classes' ? 'Archived Classlist' : 'Archived Attendance';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="2xl"
    >
      <TeacherAttendanceArchive initialTab={initialTab} hideHeader />
    </Modal>
  );
}

export default TeacherStoredArchiveModal;
