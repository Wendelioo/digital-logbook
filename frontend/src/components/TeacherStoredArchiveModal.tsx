import React from 'react';
import Modal from './Modal';
import StoredAttendance, { StoredAttendanceTab } from '../pages/teacher/TeacherStoredAttendance';

interface TeacherStoredArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: StoredAttendanceTab;
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
      <StoredAttendance initialTab={initialTab} hideHeader />
    </Modal>
  );
}

export default TeacherStoredArchiveModal;
