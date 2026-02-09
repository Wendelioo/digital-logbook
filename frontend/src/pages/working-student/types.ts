import { main } from '../../../wailsjs/go/models';

// Use generated types
export type ClassStudent = main.ClassStudent;
export type Department = main.Department;
export type User = main.User;
export type Feedback = main.Feedback;

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
}

export interface ViewStudentDetailsModalProps {
  student: ClassStudent | null;
  isOpen: boolean;
  onClose: () => void;
}
