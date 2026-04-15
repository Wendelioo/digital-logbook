import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import {
  LayoutDashboard,
  Clock,
  Library,
  CalendarPlus,
  ClipboardList,
} from 'lucide-react';
import LoginHistory from '../../../components/LoginHistory';
import DashboardOverview from './DashboardPage';
import ClassManagement from './ClassesPage';
import CreateClasslist from './CreateClassPage';
import ClassManagementDetail from './ClassDetailsPage';
import AttendanceClassSelection from './AttendancePage';
import AttendanceManagementDetail from './AttendanceDetailsPage';

function TeacherDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/teacher' },
    { name: 'Class Management', href: '/teacher/class-management', icon: <Library className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/class-management') },
    { name: 'Attendance', href: '/teacher/attendance', icon: <CalendarPlus className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/attendance') && !location.pathname.includes('/stored') },
    { name: 'Login History', href: '/teacher/login-history', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/teacher/login-history' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="class-management" element={<ClassManagement />} />
        <Route path="create-classlist" element={<CreateClasslist />} />
        <Route path="class-management/:id" element={<ClassManagementDetail />} />
        <Route path="attendance/:id" element={<AttendanceManagementDetail />} />
        <Route path="attendance" element={<AttendanceClassSelection />} />
        <Route path="password-resets" element={<Navigate to="/teacher" replace />} />
        <Route path="login-history" element={<LoginHistory showStatus={false} />} />
        <Route path="stored-attendance" element={<Navigate to="/teacher/attendance" replace />} />
      </Routes>
    </Layout>
  );
}

export default TeacherDashboard;
