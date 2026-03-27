// Shared type definitions for the application

export interface User {
  id: number;
  name: string;
  role: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  employee_id?: string;
  student_id?: string;
  email?: string;
  contact_number?: string;
  photo_url?: string;
  photo_path?: string;
  department_code?: string;
  created?: string;
  login_log_id?: number;
}
