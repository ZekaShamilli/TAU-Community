import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  requireAuth?: boolean;
  clubId?: string; // For club-specific access control
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredRoles,
  requireAuth = true,
  clubId,
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, hasRole, hasAnyRole, canAccessClub } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="50vh"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      </Box>
    );
  }

  // Check if authentication is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check specific role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check multiple roles requirement
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check club-specific access
  if (clubId && !canAccessClub(clubId)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

// Convenience components for specific roles
export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRole={UserRole.SUPER_ADMIN}>
    {children}
  </ProtectedRoute>
);

export const ClubPresidentRoute: React.FC<{ children: React.ReactNode; clubId?: string }> = ({ 
  children, 
  clubId 
}) => (
  <ProtectedRoute requiredRole={UserRole.CLUB_PRESIDENT} clubId={clubId}>
    {children}
  </ProtectedRoute>
);

export const AdminRoute: React.FC<{ children: React.ReactNode; clubId?: string }> = ({ 
  children, 
  clubId 
}) => (
  <ProtectedRoute 
    requiredRoles={[UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT]} 
    clubId={clubId}
  >
    {children}
  </ProtectedRoute>
);

export const AuthenticatedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireAuth={true}>
    {children}
  </ProtectedRoute>
);
