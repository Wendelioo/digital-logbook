import React from 'react';
import Modal from './Modal';
import ArchivedClasses from '../pages/student/StudentArchivedClasses';

interface StudentArchivedClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StudentArchivedClassesModal({ isOpen, onClose }: StudentArchivedClassesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archived Classes"
      size="2xl"
    >
      <ArchivedClasses hideHeader />
    </Modal>
  );
}

export default StudentArchivedClassesModal;
