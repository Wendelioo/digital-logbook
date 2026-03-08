import { backend } from '../../../wailsjs/go/models';

// Use generated types
export type ClassStudent = backend.ClassStudent;
export type Department = backend.Department;
export type User = backend.User;
export type Feedback = backend.Feedback;

// ArchivedStudent represents a graduated student scheduled for deletion
export interface ArchivedStudent {
  user_id: number;
  student_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  contact_number?: string;
  archived_at: string;
  deletion_scheduled_at: string;
  days_until_deletion: number;
}

export interface DashboardStats {
  students_registered: number;
  pending_feedback: number;
  today_registrations: number;
  active_students_now: number;
  pending_registrations: number;
}

export interface ViewStudentDetailsModalProps {
  student: ClassStudent | null;
  isOpen: boolean;
  onClose: () => void;
}
