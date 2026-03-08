/**
 * Loading State Components
 * Provides consistent loading indicators and states across the application
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Typography,
  Paper,
  Card,
  CardContent,
  Backdrop,
  Fade,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

// Loading overlay for full-screen operations
interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  progress?: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message = 'Loading...',
  progress,
}) => (
  <Backdrop
    sx={{
      color: '#fff',
      zIndex: (theme) => theme.zIndex.drawer + 1,
      flexDirection: 'column',
    }}
    open={open}
  >
    <Fade in={open}>
      <Box textAlign="center">
        {progress !== undefined ? (
          <Box sx={{ width: 200, mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
        ) : (
          <CircularProgress size={60} thickness={4} sx={{ mb: 2 }} />
        )}
        <Typography variant="h6">{message}</Typography>
      </Box>
    </Fade>
  </Backdrop>
);

// Inline loading spinner
interface LoadingSpinnerProps {
  size?: number;
  message?: string;
  sx?: SxProps<Theme>;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  message,
  sx,
}) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    p={3}
    sx={sx}
  >
    <CircularProgress size={size} />
    {message && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {message}
      </Typography>
    )}
  </Box>
);

// Loading button state
interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  children,
  size = 'small',
}) => (
  <Box display="flex" alignItems="center" gap={1}>
    {loading && <CircularProgress size={size === 'small' ? 16 : size === 'medium' ? 20 : 24} />}
    {children}
  </Box>
);

// Skeleton loaders for different content types
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <Box>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={rowIndex} display="flex" gap={2} mb={1}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            variant="text"
            width={`${100 / columns}%`}
            height={40}
          />
        ))}
      </Box>
    ))}
  </Box>
);

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <Card key={index} sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="100%" height={20} />
          <Skeleton variant="text" width="80%" height={20} />
          <Box display="flex" gap={1} mt={2}>
            <Skeleton variant="rectangular" width={80} height={32} />
            <Skeleton variant="rectangular" width={80} height={32} />
          </Box>
        </CardContent>
      </Card>
    ))}
  </Box>
);

export const FormSkeleton: React.FC = () => (
  <Box>
    <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1 }} />
    <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 3 }} />
    
    <Skeleton variant="text" width="40%" height={24} sx={{ mb: 1 }} />
    <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 3 }} />
    
    <Skeleton variant="text" width="35%" height={24} sx={{ mb: 1 }} />
    <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 3 }} />
    
    <Box display="flex" gap={2}>
      <Skeleton variant="rectangular" width={100} height={40} />
      <Skeleton variant="rectangular" width={80} height={40} />
    </Box>
  </Box>
);

// Page loading state
interface PageLoadingProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading page...',
  showProgress = false,
  progress,
}) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    minHeight="60vh"
    p={3}
  >
    <Paper
      elevation={1}
      sx={{
        p: 4,
        textAlign: 'center',
        minWidth: 300,
      }}
    >
      {showProgress && progress !== undefined ? (
        <Box sx={{ width: '100%', mb: 3 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {Math.round(progress)}%
          </Typography>
        </Box>
      ) : (
        <CircularProgress size={48} sx={{ mb: 3 }} />
      )}
      
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
    </Paper>
  </Box>
);

// Data loading state with retry
interface DataLoadingProps {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const DataLoading: React.FC<DataLoadingProps> = ({
  message = 'Loading data...',
  onRetry,
  retryLabel = 'Retry',
}) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    p={4}
  >
    <CircularProgress sx={{ mb: 2 }} />
    <Typography variant="body1" color="text.secondary" gutterBottom>
      {message}
    </Typography>
    {onRetry && (
      <Typography
        variant="body2"
        color="primary"
        sx={{ cursor: 'pointer', textDecoration: 'underline' }}
        onClick={onRetry}
      >
        {retryLabel}
      </Typography>
    )}
  </Box>
);

// Empty state component
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    p={4}
    textAlign="center"
  >
    {icon && (
      <Box sx={{ mb: 2, opacity: 0.5 }}>
        {icon}
      </Box>
    )}
    
    <Typography variant="h6" color="text.secondary" gutterBottom>
      {title}
    </Typography>
    
    {description && (
      <Typography variant="body2" color="text.secondary" paragraph>
        {description}
      </Typography>
    )}
    
    {action && (
      <Box sx={{ mt: 2 }}>
        {action}
      </Box>
    )}
  </Box>
);

// Hook for managing loading states
export const useLoadingState = (initialStates: Record<string, boolean> = {}) => {
  const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>(initialStates);

  const setLoading = React.useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  }, []);

  const isLoading = React.useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = React.useCallback(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  return {
    loadingStates,
    setLoading,
    isLoading,
    isAnyLoading,
  };
};
