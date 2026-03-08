/**
 * Common Components Export
 * Centralized exports for all common UI components
 */

// Error handling
export { default as ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export {
  ErrorRecovery,
  NetworkErrorRecovery,
  ServerErrorRecovery,
  PermissionErrorRecovery,
  useErrorRecovery,
} from './ErrorRecovery';

// Loading states
export {
  LoadingOverlay,
  LoadingSpinner,
  LoadingButton,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  PageLoading,
  DataLoading,
  EmptyState,
  useLoadingState,
} from './LoadingStates';

// Notifications
export {
  NotificationProvider,
  useNotifications,
  notificationUtils,
  withNotificationHandling,
} from './NotificationSystem';

// User feedback
export {
  ValidationErrors,
  SuccessFeedback,
  WarningFeedback,
  InfoFeedback,
  FieldFeedback,
  StatusIndicator,
  ProgressFeedback,
  FeedbackSummary,
  HelpTooltip,
} from './UserFeedback';

// Confirmation dialogs
export {
  default as ConfirmationDialog,
  DeleteConfirmationDialog,
  DestructiveActionDialog,
  SecurityActionDialog,
} from './ConfirmationDialog';

// Types
export type {
  NotificationType,
  NotificationOptions,
  ConfirmationOptions,
  ProgressNotificationOptions,
} from './NotificationSystem';

export type {
  ConfirmationDialogProps,
} from './ConfirmationDialog';

export type {
  ErrorType,
  RecoverableError,
} from './ErrorRecovery';