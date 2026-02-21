import React from 'react';
import Modal from './Modal';
import ArchivedStudentsManagement from '../pages/working-student/WorkingStudentArchiving';

interface WorkingStudentArchivedStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function WorkingStudentArchivedStudentsModal({ isOpen, onClose }: WorkingStudentArchivedStudentsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Archive Management"
      size="2xl"
    >
      <ArchivedStudentsManagement hideHeader />
    </Modal>
  );
}

export default WorkingStudentArchivedStudentsModal;
