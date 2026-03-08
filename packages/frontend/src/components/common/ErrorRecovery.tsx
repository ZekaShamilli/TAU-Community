/**
 * Error Recovery Components
 * Provides error recovery mechanisms and retry functionality
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  AlertTitle,
  Paper,
  Collapse,
  IconButton,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Refresh,
  ExpandMore,
  ExpandLess,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  WifiOff,
  CloudOff,
} from '@mui/icons-material';
import { useNotifications } from './NotificationSystem';

// Error types
export type ErrorType = 'network' | 'server' | 'validation' | 'permission' | 'timeout' | 'unknown';

export interface RecoverableError {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string;
  retryable?: boolean;
  timestamp?: Date;
}

// Error recovery props
interface ErrorRecoveryProps {
  error: RecoverableError;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  maxRetries?: number;
  retryDelay?: number;
  showDetails?: boolean;
  compact?: boolean;
}

export const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({
  error,
  onRetry,
  onDismiss,
  maxRetries = 3,
  retryDelay = 1000,
  showDetails = false,
  compact = false,
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(showDetails);
  const notifications = useNotifications();

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return <WifiOff color="error" />;
      case 'server':
        return <CloudOff color="error" />;
      case 'permission':
        return <ErrorIcon color="error" />;
      case 'timeout':
        return <Warning color="warning" />;
      default:
        return <ErrorIcon color="error" />;
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case 'timeout':
        return 'warning';
      case 'validation':
        return 'info';
      default:
        return 'error';
    }
  };

  const getSeverity = () => {
    switch (error.type) {
      case 'timeout':
        return 'warning';
      case 'validation':
        return 'info';
      default:
        return 'error';
    }
  };

  const handleRetry = useCallback(async () => {
    if (!onRetry || retryCount >= maxRetries || isRetrying) return;

    setIsRetrying(true);
    
    try {
      // Add delay before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      await onRetry();
      setRetryCount(0); // Reset on successful retry
      notifications.showSuccess('Operation completed successfully!');
    } catch (retryError) {
      setRetryCount(prev => prev + 1);
      console.error('Retry failed:', retryError);
      
      if (retryCount + 1 >= maxRetries) {
        notifications.showError('Maximum retry attempts reached. Please try again later.');
      } else {
        notifications.showWarning(`Retry failed. ${maxRetries - retryCount - 1} attempts remaining.`);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, retryCount, maxRetries, isRetrying, retryDelay, notifications]);

  const canRetry = error.retryable !== false && onRetry && retryCount < maxRetries;

  if (compact) {
    return (
      <Alert 
        severity={getSeverity()} 
        sx={{ mb: 1 }}
        action={
          <Box display="flex" gap={1}>
            {canRetry && (
              <Button
                size="small"
                onClick={handleRetry}
                disabled={isRetrying}
                startIcon={isRetrying ? undefined : <Refresh />}
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
            )}
            {onDismiss && (
              <Button size="small" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </Box>
        }
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
      <Box display="flex" alignItems="flex-start" gap={2}>
        {getErrorIcon()}
        
        <Box flex={1}>
          <Typography variant="h6" color={`${getErrorColor()}.main`} gutterBottom>
            {error.type === 'network' && 'Connection Error'}
            {error.type === 'server' && 'Server Error'}
            {error.type === 'validation' && 'Validation Error'}
            {error.type === 'permission' && 'Permission Error'}
            {error.type === 'timeout' && 'Request Timeout'}
            {error.type === 'unknown' && 'Unexpected Error'}
          </Typography>
          
          <Typography variant="body1" paragraph>
            {error.message}
          </Typography>

          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Chip
              label={error.type.toUpperCase()}
              color={getErrorColor() as any}
              size="small"
            />
            
            {error.code && (
              <Chip
                label={`Code: ${error.code}`}
                variant="outlined"
                size="small"
              />
            )}
            
            {retryCount > 0 && (
              <Chip
                label={`Retries: ${retryCount}/${maxRetries}`}
                color="warning"
                size="small"
              />
            )}
          </Box>

          {isRetrying && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Retrying operation...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          <Box display="flex" alignItems="center" gap={2} mb={error.details ? 1 : 0}>
            {canRetry && (
              <Button
                variant="contained"
                color={getErrorColor() as any}
                onClick={handleRetry}
                disabled={isRetrying}
                startIcon={isRetrying ? undefined : <Refresh />}
              >
                {isRetrying ? 'Retrying...' : `Retry (${maxRetries - retryCount} left)`}
              </Button>
            )}
            
            {onDismiss && (
              <Button variant="outlined" onClick={onDismiss}>
                Dismiss
              </Button>
            )}

            {error.details && (
              <IconButton
                size="small"
                onClick={() => setShowDetailsExpanded(!showDetailsExpanded)}
              >
                {showDetailsExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            )}
          </Box>

          {error.details && (
            <Collapse in={showDetailsExpanded}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Error Details</AlertTitle>
                <Typography variant="body2" component="pre" sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}>
                  {error.details}
                </Typography>
                {error.timestamp && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Occurred at: {error.timestamp.toLocaleString()}
                  </Typography>
                )}
              </Alert>
            </Collapse>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

// Network error recovery component
interface NetworkErrorRecoveryProps {
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
}

export const NetworkErrorRecovery: React.FC<NetworkErrorRecoveryProps> = ({
  onRetry,
  onDismiss,
}) => (
  <ErrorRecovery
    error={{
      type: 'network',
      message: 'Unable to connect to the server. Please check your internet connection.',
      details: 'This could be due to:\n• Poor internet connection\n• Server maintenance\n• Firewall restrictions',
      retryable: true,
      timestamp: new Date(),
    }}
    onRetry={onRetry}
    onDismiss={onDismiss}
    maxRetries={5}
    retryDelay={2000}
  />
);

// Server error recovery component
interface ServerErrorRecoveryProps {
  error?: Error;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
}

export const ServerErrorRecovery: React.FC<ServerErrorRecoveryProps> = ({
  error,
  onRetry,
  onDismiss,
}) => (
  <ErrorRecovery
    error={{
      type: 'server',
      message: 'The server encountered an error while processing your request.',
      details: error?.message || 'Internal server error occurred',
      retryable: true,
      timestamp: new Date(),
    }}
    onRetry={onRetry}
    onDismiss={onDismiss}
    maxRetries={3}
    retryDelay={3000}
  />
);

// Permission error recovery component
interface PermissionErrorRecoveryProps {
  requiredPermission?: string;
  onDismiss?: () => void;
}

export const PermissionErrorRecovery: React.FC<PermissionErrorRecoveryProps> = ({
  requiredPermission,
  onDismiss,
}) => (
  <ErrorRecovery
    error={{
      type: 'permission',
      message: 'You do not have permission to perform this action.',
      details: requiredPermission ? `Required permission: ${requiredPermission}` : undefined,
      retryable: false,
      timestamp: new Date(),
    }}
    onDismiss={onDismiss}
  />
);

// Hook for error recovery state management
export const useErrorRecovery = () => {
  const [errors, setErrors] = useState<Map<string, RecoverableError>>(new Map());

  const addError = useCallback((id: string, error: RecoverableError) => {
    setErrors(prev => new Map(prev).set(id, error));
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(id);
      return newErrors;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors(new Map());
  }, []);

  const hasErrors = errors.size > 0;
  const errorList = Array.from(errors.entries());

  return {
    errors: errorList,
    hasErrors,
    addError,
    removeError,
    clearErrors,
  };
};
