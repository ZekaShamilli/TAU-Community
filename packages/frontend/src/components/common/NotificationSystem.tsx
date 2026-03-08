/**
 * Enhanced Notification System
 * Provides comprehensive user feedback through various notification types
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Slide,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Close,
} from '@mui/icons-material';
import { toast, ToastOptions, Id } from 'react-toastify';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  title?: string;
  message: string;
  type: NotificationType;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'warning' | 'error' | 'info';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface ProgressNotificationOptions {
  title: string;
  message?: string;
  progress: number;
  onCancel?: () => void;
}

// Context for notification system
interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirmation: (options: ConfirmationOptions) => void;
  showProgressNotification: (options: ProgressNotificationOptions) => void;
  hideProgressNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationOptions | null>(null);
  const [progressNotification, setProgressNotification] = useState<ProgressNotificationOptions | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const showNotification = useCallback((options: NotificationOptions) => {
    const toastOptions: ToastOptions = {
      autoClose: options.persistent ? false : (options.duration || 5000),
      closeOnClick: !options.persistent,
      pauseOnHover: true,
      draggable: true,
    };

    const content = (
      <Box>
        {options.title && (
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {options.title}
          </Typography>
        )}
        <Typography variant="body2">
          {options.message}
        </Typography>
        {options.action && (
          <Button
            size="small"
            color="inherit"
            onClick={options.action.onClick}
            sx={{ mt: 1 }}
          >
            {options.action.label}
          </Button>
        )}
      </Box>
    );

    switch (options.type) {
      case 'success':
        toast.success(content, toastOptions);
        break;
      case 'error':
        toast.error(content, toastOptions);
        break;
      case 'warning':
        toast.warning(content, toastOptions);
        break;
      case 'info':
        toast.info(content, toastOptions);
        break;
    }
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showNotification({ type: 'success', message, title });
  }, [showNotification]);

  const showError = useCallback((message: string, title?: string) => {
    showNotification({ type: 'error', message, title, persistent: true });
  }, [showNotification]);

  const showWarning = useCallback((message: string, title?: string) => {
    showNotification({ type: 'warning', message, title });
  }, [showNotification]);

  const showInfo = useCallback((message: string, title?: string) => {
    showNotification({ type: 'info', message, title });
  }, [showNotification]);

  const showConfirmation = useCallback((options: ConfirmationOptions) => {
    setConfirmationDialog(options);
  }, []);

  const showProgressNotification = useCallback((options: ProgressNotificationOptions) => {
    setProgressNotification(options);
  }, []);

  const hideProgressNotification = useCallback(() => {
    setProgressNotification(null);
  }, []);

  const handleConfirm = async () => {
    if (!confirmationDialog) return;

    setIsConfirming(true);
    try {
      await confirmationDialog.onConfirm();
      setConfirmationDialog(null);
    } catch (error) {
      console.error('Confirmation action failed:', error);
      showError('Action failed. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    if (confirmationDialog?.onCancel) {
      confirmationDialog.onCancel();
    }
    setConfirmationDialog(null);
  };

  const getConfirmationIcon = (type?: string) => {
    switch (type) {
      case 'warning':
        return <Warning color="warning" sx={{ fontSize: 48 }} />;
      case 'error':
        return <Error color="error" sx={{ fontSize: 48 }} />;
      default:
        return <Info color="info" sx={{ fontSize: 48 }} />;
    }
  };

  const contextValue: NotificationContextType = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
    showProgressNotification,
    hideProgressNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmationDialog}
        onClose={handleCancel}
        maxWidth="sm"
        fullWidth
      >
        {confirmationDialog && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={2}>
                {getConfirmationIcon(confirmationDialog.type)}
                <Typography variant="h6">
                  {confirmationDialog.title}
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Typography variant="body1">
                {confirmationDialog.message}
              </Typography>
            </DialogContent>
            
            <DialogActions>
              <Button
                onClick={handleCancel}
                disabled={isConfirming}
              >
                {confirmationDialog.cancelLabel || 'Cancel'}
              </Button>
              <Button
                onClick={handleConfirm}
                variant="contained"
                color={confirmationDialog.type === 'error' ? 'error' : 'primary'}
                disabled={isConfirming}
              >
                {isConfirming ? 'Processing...' : (confirmationDialog.confirmLabel || 'Confirm')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Progress Notification */}
      <Dialog
        open={!!progressNotification}
        onClose={progressNotification?.onCancel}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={!progressNotification?.onCancel}
      >
        {progressNotification && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">
                  {progressNotification.title}
                </Typography>
                {progressNotification.onCancel && (
                  <IconButton
                    onClick={progressNotification.onCancel}
                    size="small"
                  >
                    <Close />
                  </IconButton>
                )}
              </Box>
            </DialogTitle>
            
            <DialogContent>
              {progressNotification.message && (
                <Typography variant="body1" gutterBottom>
                  {progressNotification.message}
                </Typography>
              )}
              
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressNotification.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {Math.round(progressNotification.progress)}% complete
                </Typography>
              </Box>
            </DialogContent>
            
            {progressNotification.onCancel && (
              <DialogActions>
                <Button onClick={progressNotification.onCancel}>
                  Cancel
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>
    </NotificationContext.Provider>
  );
};

// Hook to use notification system
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Utility functions for common notification patterns
export const notificationUtils = {
  // Success patterns
  saved: (itemName: string = 'Item') => `${itemName} saved successfully!`,
  created: (itemName: string = 'Item') => `${itemName} created successfully!`,
  updated: (itemName: string = 'Item') => `${itemName} updated successfully!`,
  deleted: (itemName: string = 'Item') => `${itemName} deleted successfully!`,
  
  // Error patterns
  saveFailed: (itemName: string = 'Item') => `Failed to save ${itemName.toLowerCase()}. Please try again.`,
  loadFailed: (itemName: string = 'data') => `Failed to load ${itemName.toLowerCase()}. Please refresh the page.`,
  deleteFailed: (itemName: string = 'Item') => `Failed to delete ${itemName.toLowerCase()}. Please try again.`,
  networkError: () => 'Network error. Please check your connection and try again.',
  
  // Warning patterns
  unsavedChanges: () => 'You have unsaved changes. Are you sure you want to leave?',
  permanentAction: (action: string) => `This ${action} cannot be undone. Are you sure you want to continue?`,
  
  // Info patterns
  processing: (action: string) => `${action} in progress...`,
  noData: (itemName: string) => `No ${itemName.toLowerCase()} found.`,
};

// Higher-order component for automatic error handling
export function withNotificationHandling<P extends object>(
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: P) => {
    const notifications = useNotifications();

    // Add notification methods to props
    const enhancedProps = {
      ...props,
      notifications,
    } as P & { notifications: NotificationContextType };

    return <Component {...enhancedProps} />;
  };

  WrappedComponent.displayName = `withNotificationHandling(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}
