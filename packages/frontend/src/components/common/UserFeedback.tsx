/**
 * User Feedback Components
 * Provides comprehensive user feedback for forms, validation, and user interactions
 */

import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper,
  Collapse,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  ExpandLess,
  Close,
  HelpOutline,
} from '@mui/icons-material';

// Validation error display
interface ValidationErrorsProps {
  errors: Record<string, string | string[]>;
  title?: string;
  showTitle?: boolean;
}

export const ValidationErrors: React.FC<ValidationErrorsProps> = ({
  errors,
  title = 'Please fix the following errors:',
  showTitle = true,
}) => {
  const errorEntries = Object.entries(errors).filter(([_, value]) => value);
  
  if (errorEntries.length === 0) return null;

  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {showTitle && <AlertTitle>{title}</AlertTitle>}
      <List dense>
        {errorEntries.map(([field, messages]) => {
          const messageArray = Array.isArray(messages) ? messages : [messages];
          return messageArray.map((message, index) => (
            <ListItem key={`${field}-${index}`} sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 20 }}>
                <Error color="error" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={message}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ));
        })}
      </List>
    </Alert>
  );
};

// Success feedback
interface SuccessFeedbackProps {
  message: string;
  title?: string;
  actions?: React.ReactNode;
  onClose?: () => void;
}

export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({
  message,
  title,
  actions,
  onClose,
}) => (
  <Alert 
    severity="success" 
    sx={{ mb: 2 }}
    action={onClose && (
      <IconButton size="small" onClick={onClose}>
        <Close fontSize="small" />
      </IconButton>
    )}
  >
    {title && <AlertTitle>{title}</AlertTitle>}
    <Typography variant="body2">{message}</Typography>
    {actions && (
      <Box sx={{ mt: 1 }}>
        {actions}
      </Box>
    )}
  </Alert>
);

// Warning feedback
interface WarningFeedbackProps {
  message: string;
  title?: string;
  details?: string[];
  onClose?: () => void;
}

export const WarningFeedback: React.FC<WarningFeedbackProps> = ({
  message,
  title,
  details,
  onClose,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Alert 
      severity="warning" 
      sx={{ mb: 2 }}
      action={onClose && (
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      )}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      <Typography variant="body2">{message}</Typography>
      
      {details && details.length > 0 && (
        <>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ mt: 1 }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              {expanded ? 'Hide' : 'Show'} details
            </Typography>
          </IconButton>
          
          <Collapse in={expanded}>
            <List dense>
              {details.map((detail, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>
                    <Warning color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={detail}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </>
      )}
    </Alert>
  );
};

// Info feedback
interface InfoFeedbackProps {
  message: string;
  title?: string;
  persistent?: boolean;
  onClose?: () => void;
}

export const InfoFeedback: React.FC<InfoFeedbackProps> = ({
  message,
  title,
  persistent = false,
  onClose,
}) => (
  <Alert 
    severity="info" 
    sx={{ mb: 2 }}
    action={!persistent && onClose && (
      <IconButton size="small" onClick={onClose}>
        <Close fontSize="small" />
      </IconButton>
    )}
  >
    {title && <AlertTitle>{title}</AlertTitle>}
    <Typography variant="body2">{message}</Typography>
  </Alert>
);

// Form field feedback
interface FieldFeedbackProps {
  error?: string;
  warning?: string;
  info?: string;
  success?: string;
  helperText?: string;
}

export const FieldFeedback: React.FC<FieldFeedbackProps> = ({
  error,
  warning,
  info,
  success,
  helperText,
}) => {
  if (error) {
    return (
      <Typography variant="caption" color="error" display="flex" alignItems="center" sx={{ mt: 0.5 }}>
        <Error fontSize="small" sx={{ mr: 0.5 }} />
        {error}
      </Typography>
    );
  }

  if (warning) {
    return (
      <Typography variant="caption" color="warning.main" display="flex" alignItems="center" sx={{ mt: 0.5 }}>
        <Warning fontSize="small" sx={{ mr: 0.5 }} />
        {warning}
      </Typography>
    );
  }

  if (success) {
    return (
      <Typography variant="caption" color="success.main" display="flex" alignItems="center" sx={{ mt: 0.5 }}>
        <CheckCircle fontSize="small" sx={{ mr: 0.5 }} />
        {success}
      </Typography>
    );
  }

  if (info) {
    return (
      <Typography variant="caption" color="info.main" display="flex" alignItems="center" sx={{ mt: 0.5 }}>
        <Info fontSize="small" sx={{ mr: 0.5 }} />
        {info}
      </Typography>
    );
  }

  if (helperText) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        {helperText}
      </Typography>
    );
  }

  return null;
};

// Status indicator
interface StatusIndicatorProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'pending';
  label: string;
  size?: 'small' | 'medium';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'small',
}) => {
  const getColor = () => {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle fontSize="small" />;
      case 'error': return <Error fontSize="small" />;
      case 'warning': return <Warning fontSize="small" />;
      case 'info': return <Info fontSize="small" />;
      case 'pending': return <HelpOutline fontSize="small" />;
      default: return undefined;
    }
  };

  const iconElement = getIcon();

  return (
    <Chip
      icon={iconElement}
      label={label}
      color={getColor() as any}
      size={size}
      variant={status === 'pending' ? 'outlined' : 'filled'}
    />
  );
};

// Progress feedback
interface ProgressFeedbackProps {
  title: string;
  progress: number;
  message?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

export const ProgressFeedback: React.FC<ProgressFeedbackProps> = ({
  title,
  progress,
  message,
  showPercentage = true,
  color = 'primary',
}) => (
  <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {showPercentage && (
        <Typography variant="body2" color="text.secondary">
          {Math.round(progress)}%
        </Typography>
      )}
    </Box>
    
    <LinearProgress
      variant="determinate"
      value={progress}
      color={color}
      sx={{ height: 8, borderRadius: 4, mb: message ? 1 : 0 }}
    />
    
    {message && (
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    )}
  </Paper>
);

// Feedback summary
interface FeedbackSummaryProps {
  title: string;
  items: Array<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    count?: number;
  }>;
  onClose?: () => void;
}

export const FeedbackSummary: React.FC<FeedbackSummaryProps> = ({
  title,
  items,
  onClose,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  
  const errorCount = items.filter(item => item.type === 'error').length;
  const warningCount = items.filter(item => item.type === 'warning').length;
  const successCount = items.filter(item => item.type === 'success').length;
  
  const primarySeverity = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success';

  return (
    <Alert 
      severity={primarySeverity}
      sx={{ mb: 2 }}
      action={onClose && (
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      )}
    >
      <AlertTitle>{title}</AlertTitle>
      
      <Box display="flex" gap={1} mb={1}>
        {successCount > 0 && (
          <Chip
            icon={<CheckCircle fontSize="small" />}
            label={`${successCount} successful`}
            color="success"
            size="small"
          />
        )}
        {warningCount > 0 && (
          <Chip
            icon={<Warning fontSize="small" />}
            label={`${warningCount} warnings`}
            color="warning"
            size="small"
          />
        )}
        {errorCount > 0 && (
          <Chip
            icon={<Error fontSize="small" />}
            label={`${errorCount} errors`}
            color="error"
            size="small"
          />
        )}
      </Box>

      <IconButton
        size="small"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ExpandLess /> : <ExpandMore />}
        <Typography variant="caption" sx={{ ml: 0.5 }}>
          {expanded ? 'Hide' : 'Show'} details
        </Typography>
      </IconButton>

      <Collapse in={expanded}>
        <List dense>
          {items.map((item, index) => (
            <ListItem key={index} sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 20 }}>
                {item.type === 'success' && <CheckCircle color="success" fontSize="small" />}
                {item.type === 'error' && <Error color="error" fontSize="small" />}
                {item.type === 'warning' && <Warning color="warning" fontSize="small" />}
                {item.type === 'info' && <Info color="info" fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={item.message}
                primaryTypographyProps={{ variant: 'body2' }}
              />
              {item.count && (
                <Chip label={item.count} size="small" variant="outlined" />
              )}
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Alert>
  );
};

// Help tooltip
interface HelpTooltipProps {
  title: string;
  children: React.ReactElement;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, children }) => (
  <Tooltip title={title} arrow placement="top">
    {children}
  </Tooltip>
);
