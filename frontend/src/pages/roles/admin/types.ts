import { backend } from '../../../../wailsjs/go/models';

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
  today_teacher_logins: number;
  today_admin_logins: number;
  last_teacher_login_at?: string;
  last_teacher_pc_number?: string;
  last_admin_login_at?: string;
  last_admin_pc_number?: string;
  today_new_users: number;
  issue_reports_today: number;
  no_issue_reports_today: number;
  pending_feedback: number;
  resolved_reports_today: number;
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
  // Activity tracking fields (populated by GetUsersByActivityStatus)
  last_login_at?: string;
  last_login_ago?: string;
  currently_logged_in?: boolean;
  deactivated_at?: string;
  deleted_at?: string;
  activity_status?: string; // "active" | "archived" | "deactivated" | "deleted"
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
export type Feedback = backend.Feedback;

export interface Department {
  department_code: string;
  department_name: string;
  description?: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
