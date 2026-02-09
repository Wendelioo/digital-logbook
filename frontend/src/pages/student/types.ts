import { main } from '../../../wailsjs/go/models';

// Use the generated models from the backend
export type Attendance = main.Attendance;
export type StudentDashboardData = main.StudentDashboard;
export type Feedback = main.Feedback;
export type CourseClass = main.CourseClass;
export type ClasslistEntry = main.ClasslistEntry;

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
