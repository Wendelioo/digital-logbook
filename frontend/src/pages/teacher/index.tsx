import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import {
  LayoutDashboard,
  Clock,
  Library,
  CalendarPlus,
  ClipboardList,
  Archive,
} from 'lucide-react';
import LoginHistory from '../../components/LoginHistory';
import DashboardOverview from './TeacherDashboard';
import ClassManagement from './TeacherClassManagement';
import CreateClasslist from './TeacherCreateClasslist';
import ClassManagementDetail from './TeacherClassDetail';
import AttendanceClassSelection from './TeacherAttendanceSelection';
import StoredAttendance from './TeacherStoredAttendance';
import AttendanceManagementDetail from './TeacherAttendanceDetail';

function TeacherDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/teacher' },
    { name: 'Class Management', href: '/teacher/class-management', icon: <Library className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/class-management') },
    { name: 'Attendance', href: '/teacher/attendance', icon: <CalendarPlus className="h-5 w-5" />, current: location.pathname.startsWith('/teacher/attendance') && !location.pathname.includes('/stored') },
    { name: 'Login History', href: '/teacher/login-history', icon: <Clock className="h-5 w-5" />, current: location.pathname === '/teacher/login-history' },
    { 
      name: 'Archive', 
      href: '/teacher/stored-attendance', 
      icon: <Archive className="h-5 w-5" />, 
      current: location.pathname === '/teacher/stored-attendance',
      children: [
        { 
          name: 'Classlist', 
          href: '/teacher/stored-attendance?tab=classes', 
          icon: <ClipboardList className="h-4 w-4" />, 
          current: location.pathname === '/teacher/stored-attendance' && (new URLSearchParams(location.search).get('tab') === 'classes')
        },
        { 
          name: 'Attendance', 
          href: '/teacher/stored-attendance?tab=attendance', 
          icon: <CalendarPlus className="h-4 w-4" />, 
          current: location.pathname === '/teacher/stored-attendance' && (!new URLSearchParams(location.search).get('tab') || new URLSearchParams(location.search).get('tab') === 'attendance')
        },
      ]
    },
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
        <Route path="login-history" element={<LoginHistory showStatus={false} />} />
        <Route path="stored-attendance" element={<StoredAttendance />} />
      </Routes>
    </Layout>
  );
}

export default TeacherDashboard;
