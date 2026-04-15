import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Layout from '../../../components/Layout';
import {
  LayoutDashboard,
  Users,
  Building2,
  History,
  BarChart3,
} from 'lucide-react';
import DashboardOverview from './DashboardPage';
import UserManagement from './UsersPage';
import DepartmentManagement from './DepartmentsPage';
import ViewLogs from './LogsPage';
import Reports from './ReportsPage';

function AdminDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/admin' },
    { name: 'Manage Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/admin/users' },
    { name: 'Departments', href: '/admin/departments', icon: <Building2 className="h-5 w-5" />, current: location.pathname === '/admin/departments' },
    { name: 'Log Entries', href: '/admin/logs', icon: <History className="h-5 w-5" />, current: location.pathname === '/admin/logs' },
    { name: 'Feedback', href: '/admin/reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/admin/reports' },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="password-resets" element={<Navigate to="/admin" replace />} />
        <Route path="departments" element={<DepartmentManagement />} />
        <Route path="logs" element={<ViewLogs />} />
        <Route path="reports" element={<Reports />} />
      </Routes>
    </Layout>
  );
}

export default AdminDashboard;
