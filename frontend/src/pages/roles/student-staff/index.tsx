import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../../../components/Layout';
import PendingRegistrations from '../../../components/PendingRegistrations';
import LoginHistory from '../../../components/LoginHistory';
import { MyClasses, ArchivedClasses, StudentAttendance } from '../student';
import {
  LayoutDashboard,
  History,
  BarChart3,
  ClipboardList,
  Library,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import DashboardOverview from './DashboardPage';
import EquipmentReports from './EquipmentReportsPage';
import ArchivedStudentsManagement from './ArchivedStudentsPage';

function WorkingStudentDashboard() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Navigation items organized into sections:
  // 1. Working Student duties (lab management)
  // 2. Student features (classes, personal records) - since working students are also students
  // Note: Working students don't submit feedback - they FORWARD student feedback to admin
  const navigationItems = [
    // Working Student Section
    { name: 'Dashboard', href: '/student-staff', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/student-staff' },
    { name: 'Registration Requests', href: '/student-staff/pending-registrations', icon: <ClipboardList className="h-5 w-5" />, current: location.pathname === '/student-staff/pending-registrations' },
    { name: 'Feedback', href: '/student-staff/equipment-reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/student-staff/equipment-reports' },
    
    // Divider label for student features
    { name: 'divider', href: '', icon: null, current: false, isDivider: true, label: 'My Student Records' },
    
    // Student Features Section - for when working students need to access their own student features
    // Note: No "My Feedback History" because working students forward feedback, they don't submit it
    { name: 'Attendance', href: '/student-staff/attendance', icon: <ClipboardCheck className="h-5 w-5" />, current: location.pathname === '/student-staff/attendance' },
    { name: 'My Classes', href: '/student-staff/my-classes', icon: <Library className="h-5 w-5" />, current: location.pathname === '/student-staff/my-classes' },
    { name: 'Login History', href: '/student-staff/login-history', icon: <History className="h-5 w-5" />, current: location.pathname === '/student-staff/login-history' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        {/* Working Student Routes */}
        <Route index element={<DashboardOverview />} />
        <Route path="pending-registrations" element={<PendingRegistrations workingStudentUserId={user?.id || 0} />} />
        <Route path="archived-students" element={<ArchivedStudentsManagement />} />
        <Route path="equipment-reports" element={<EquipmentReports />} />
        
        {/* Student Feature Routes - for working students to access their own student features */}
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="my-classes" element={<MyClasses />} />
        <Route path="my-archived-classes" element={<ArchivedClasses />} />
        <Route path="login-history" element={<LoginHistory />} />
      </Routes>
    </Layout>
  );
}

export default WorkingStudentDashboard;
