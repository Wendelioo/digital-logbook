import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects routes requiring authentication
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
}

interface RoleRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

/**
 * Protects routes requiring specific user roles
 */
export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
}
