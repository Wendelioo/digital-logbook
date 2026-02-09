import { main } from '../../../wailsjs/go/models';

export interface DashboardStats {
  total_students: number;
  total_teachers: number;
  working_students: number;
  recent_logins: number;
  active_users_now: number;
  students_logged_in: number;
  teachers_logged_in: number;
  working_students_logged_in: number;
  today_logins: number;
  today_new_users: number;
  locked_accounts: number;
  pending_feedback: number;
}

export interface User {
  id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  role: string;
  employee_id?: string;
  student_id?: string;
  photo_url?: string;
  email?: string;
  contact_number?: string;
  department_code?: string;
  created: string;
}

export interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_id_number: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

// Use the generated Feedback model from main
export type Feedback = main.Feedback;

// Archive sheet types
export interface ArchivedLogSheet {
  date: string;
  total_logins: number;
  student_count: number;
  teacher_count: number;
  admin_count: number;
  working_student_count: number;
  unique_pcs: number;
}

export interface ArchivedFeedbackSheet {
  date: string;
  total_reports: number;
  good_count: number;
  issue_count: number;
  unique_pcs: number;
  unique_students: number;
}

export interface Department {
  department_code: string;
  department_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
