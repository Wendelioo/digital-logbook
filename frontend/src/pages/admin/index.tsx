import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FolderOpen,
  BarChart3,
  Archive
} from 'lucide-react';
import DashboardOverview from './AdminDashboard';
import UserManagement from './AdminUserManagement';
import DepartmentManagement from './AdminDepartments';
import ViewLogs from './AdminLogs';
import Reports from './AdminReports';
import ArchiveManagement from './AdminArchive';

function AdminDashboard() {
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" />, current: location.pathname === '/admin' },
    { name: 'Manage Users', href: '/admin/users', icon: <Users className="h-5 w-5" />, current: location.pathname === '/admin/users' },
    { name: 'Departments', href: '/admin/departments', icon: <GraduationCap className="h-5 w-5" />, current: location.pathname === '/admin/departments' },
    { name: 'Log Entries', href: '/admin/logs', icon: <FolderOpen className="h-5 w-5" />, current: location.pathname === '/admin/logs' },
    { name: 'Reports', href: '/admin/reports', icon: <BarChart3 className="h-5 w-5" />, current: location.pathname === '/admin/reports' },
    {
      name: 'Archive',
      href: '/admin/archive',
      icon: <Archive className="h-5 w-5" />,
      current: location.pathname === '/admin/archive',
      children: [
        {
          name: 'Log Entries',
          href: '/admin/archive?tab=logs',
          icon: <FolderOpen className="h-4 w-4" />,
          current: location.pathname === '/admin/archive' && (!new URLSearchParams(location.search).get('tab') || new URLSearchParams(location.search).get('tab') === 'logs')
        },
        {
          name: 'Feedback Reports',
          href: '/admin/archive?tab=reports',
          icon: <BarChart3 className="h-4 w-4" />,
          current: location.pathname === '/admin/archive' && new URLSearchParams(location.search).get('tab') === 'reports'
        },
      ]
    },
  ];

  return (
    <Layout navigationItems={navigationItems}>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="departments" element={<DepartmentManagement />} />
        <Route path="logs" element={<ViewLogs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="archive" element={<ArchiveManagement />} />
      </Routes>
    </Layout>
  );
}

export default AdminDashboard;
