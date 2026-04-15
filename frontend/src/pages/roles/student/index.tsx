import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../../../components/Layout';
import {
  LayoutDashboard,
  Clock,
  MessageSquare,
  Library,
  ClipboardCheck,
} from 'lucide-react';
import LoginHistory from '../../../components/LoginHistory';
import DashboardOverview from './DashboardPage';
import MyClasses from './ClassesPage';
import ArchivedClasses from './ArchivedClassesPage';
import FeedbackHistory from './FeedbackHistoryPage';
import StudentAttendance from './AttendancePage';

function StudentDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/student', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/student' },
    { name: 'My Classes', href: '/student/classes', icon: <Library className="h-5 w-5" />, current: location.pathname === '/student/classes' },
    { name: 'Attendance', href: '/student/attendance', icon: <ClipboardCheck className="h-5 w-5" />, current: location.pathname === '/student/attendance' },
    { name: 'Login History', href: '/student/login-history', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/student/login-history' },
    { name: 'Feedback History', href: '/student/feedback', icon: <MessageSquare className="h-5 w-5" />, current: location.pathname === '/student/feedback' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="classes" element={<MyClasses />} />
        <Route path="archived-classes" element={<ArchivedClasses />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="login-history" element={<LoginHistory />} />
        <Route path="feedback" element={<FeedbackHistory />} />
      </Routes>
    </Layout>
  );
}

export default StudentDashboard;

// Re-export student-specific components for use in WorkingStudent dashboard
export { MyClasses } from './ClassesPage';
export { ArchivedClasses } from './ArchivedClassesPage';
export { FeedbackHistory } from './FeedbackHistoryPage';
export { default as StudentAttendance } from './AttendancePage';
