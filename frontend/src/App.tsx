import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import AppErrorBoundary from './components/AppErrorBoundary';
import LoginPage from './pages/LoginPage';
import Admin from './pages/admin';
import Teacher from './pages/teacher';
import Student from './pages/student';
import WorkingStudent from './pages/working-student';
import './style.css';

function AppRoutes() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['admin']}>
                  <Admin />
                </RoleRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/teacher/*" 
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['teacher']}>
                  <Teacher />
                </RoleRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/student/*" 
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['student']}>
                  <Student />
                </RoleRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/working-student/*" 
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={['working_student']}>
                  <WorkingStudent />
                </RoleRoute>
              </ProtectedRoute>
            } 
          />
          
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/dashboard" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
