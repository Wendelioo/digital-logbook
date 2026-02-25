import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FolderOpen,
  BarChart3
} from 'lucide-react';
import DashboardOverview from './AdminDashboard';
import UserManagement from './AdminUserManagement';
import DepartmentManagement from './AdminDepartments';
import ViewLogs from './AdminLogs';
import Reports from './AdminReports';

function AdminDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/admin' },
    { name: 'Manage Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/admin/users' },
    { name: 'Departments', href: '/admin/departments', icon: <GraduationCap className="h-5 w-5" />, current: location.pathname === '/admin/departments' },
    { name: 'Log Entries', href: '/admin/logs', icon: <FolderOpen className="h-5 w-5" />, current: location.pathname === '/admin/logs' },
    { name: 'Reports', href: '/admin/reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/admin/reports' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="departments" element={<DepartmentManagement />} />
        <Route path="logs" element={<ViewLogs />} />
        <Route path="reports" element={<Reports />} />
      </Routes>
    </Layout>
  );
}

export default AdminDashboard;
