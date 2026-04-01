import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import './i18n/config'; // Initialize i18n

// Import components
import ProtectedRoute, { SuperAdminRoute, ClubPresidentRoute } from './components/ProtectedRoute';
import SessionManager from './components/auth/SessionManager';
import LoginForm from './components/auth/LoginForm';
import SignUpForm from './components/auth/SignUpForm';
import EmailVerification from './components/auth/EmailVerification';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import UnauthorizedPage from './components/auth/UnauthorizedPage';
import TwoFactorSetup from './components/auth/TwoFactorSetup';
import ErrorBoundary from './components/common/ErrorBoundary';
import { NotificationProvider } from './components/common/NotificationSystem';

// Public components
import HomePage from './components/public/HomePage';
import ClubPage from './components/public/ClubPage';
import ClubsPage from './components/public/ClubsPage';
import NotFoundPage from './components/public/NotFoundPage';

// Student components
import GPACalculator from './components/student/GPACalculator';

// Admin components
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';

// Club components
import ClubPresidentDashboard from './components/club/ClubPresidentDashboard';

function App() {
  return (
    <div className="min-h-screen animated-gradient-bg">
      <ErrorBoundary>
        <NotificationProvider>
          <SessionManager>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/kulup/:clubSlug" element={<ClubPage />} />
            
            {/* Student Routes */}
            <Route 
              path="/gpa-calculator" 
              element={
                <ProtectedRoute>
                  <GPACalculator />
                </ProtectedRoute>
              } 
            />
            
            {/* Authentication Routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignUpForm />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route 
              path="/setup-2fa" 
              element={
                <ProtectedRoute requiredRole={UserRole.SUPER_ADMIN}>
                  <TwoFactorSetup />
                </ProtectedRoute>
              } 
            />

            {/* Super Admin Routes */}
            <Route 
              path="/admin/*" 
              element={
                <SuperAdminRoute>
                  <SuperAdminDashboard />
                </SuperAdminRoute>
              } 
            />

            {/* Club President Routes */}
            <Route 
              path="/club-dashboard/*" 
              element={
                <ClubPresidentRoute>
                  <ClubPresidentDashboard />
                </ClubPresidentRoute>
              } 
            />

            {/* Redirect authenticated users to appropriate dashboard */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardRedirect />
                </ProtectedRoute>
              } 
            />

            {/* 404 Page */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </SessionManager>
      </NotificationProvider>
    </ErrorBoundary>
    </div>
  );
}

// Component to redirect users to appropriate dashboard based on role
const DashboardRedirect: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      console.log('DashboardRedirect - User role:', user.role);
      switch (user.role) {
        case UserRole.SUPER_ADMIN:
          console.log('Redirecting to /admin');
          navigate('/admin', { replace: true });
          break;
        case UserRole.CLUB_PRESIDENT:
          console.log('Redirecting to /club-dashboard');
          navigate('/club-dashboard', { replace: true });
          break;
        default:
          console.log('Redirecting to / (home)');
          navigate('/', { replace: true });
          break;
      }
    }
  }, [user, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
      <p className="text-sm text-text-tertiary font-medium">{t('common.loading')}</p>
    </div>
  );
};

export default App;
