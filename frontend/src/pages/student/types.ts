import { backend } from '../../../wailsjs/go/models';

// Use the generated models from the backend
export type Attendance = backend.Attendance;
export type StudentDashboardData = backend.StudentDashboard;
export type Feedback = backend.Feedback;
export type CourseClass = backend.CourseClass;
export type ClasslistEntry = backend.ClasslistEntry;

// LoginLog interface matching the JSON structure from backend
export interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

// Interface for semester grouping
export interface SemesterGroup {
  semester: string;
  schoolYear: string;
  classes: CourseClass[];
}
