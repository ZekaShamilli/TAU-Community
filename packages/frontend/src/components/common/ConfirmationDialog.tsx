/**
 * Confirmation Dialog Component
 * Provides user confirmation for destructive or important actions
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Warning,
  Error,
  Info,
  DeleteForever,
  Security,
} from '@mui/icons-material';

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'warning' | 'error' | 'info' | 'destructive';
  loading?: boolean;
  
  // Additional confirmation requirements
  requireTextConfirmation?: {
    expectedText: string;
    placeholder?: string;
    helperText?: string;
  };
  requireCheckboxConfirmation?: {
    label: string;
    helperText?: string;
  };
  
  // Additional content
  details?: string[];
  warningMessage?: string;
  
  // Styling
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning',
  loading = false,
  requireTextConfirmation,
  requireCheckboxConfirmation,
  details,
  warningMessage,
  maxWidth = 'sm',
}) => {
  const [textConfirmation, setTextConfirmation] = React.useState('');
  const [checkboxConfirmation, setCheckboxConfirmation] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setTextConfirmation('');
      setCheckboxConfirmation(false);
      setIsConfirming(false);
    }
  }, [open]);

  const getIcon = () => {
    switch (type) {
      case 'error':
      case 'destructive':
        return <Error color="error" sx={{ fontSize: 48 }} />;
      case 'warning':
        return <Warning color="warning" sx={{ fontSize: 48 }} />;
      case 'info':
        return <Info color="info" sx={{ fontSize: 48 }} />;
      default:
        return <Warning color="warning" sx={{ fontSize: 48 }} />;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'error':
      case 'destructive':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const isConfirmDisabled = () => {
    if (loading || isConfirming) return true;
    
    if (requireTextConfirmation) {
      return textConfirmation.trim() !== requireTextConfirmation.expectedText;
    }
    
    if (requireCheckboxConfirmation) {
      return !checkboxConfirmation;
    }
    
    return false;
  };

  const handleConfirm = async () => {
    if (isConfirmDisabled()) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Error handling is done by the parent component
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    if (!isConfirming && !loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth
      disableEscapeKeyDown={isConfirming || loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          {getIcon()}
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" paragraph>
          {message}
        </Typography>

        {details && details.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              This action will:
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {details.map((detail, index) => (
                <Typography key={index} component="li" variant="body2" color="text.secondary">
                  {detail}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {warningMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {warningMessage}
          </Alert>
        )}

        {requireTextConfirmation && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {requireTextConfirmation.helperText || 
               `Type "${requireTextConfirmation.expectedText}" to confirm:`}
            </Typography>
            <TextField
              fullWidth
              value={textConfirmation}
              onChange={(e) => setTextConfirmation(e.target.value)}
              placeholder={requireTextConfirmation.placeholder || requireTextConfirmation.expectedText}
              disabled={isConfirming || loading}
              error={textConfirmation.length > 0 && textConfirmation !== requireTextConfirmation.expectedText}
              size="small"
            />
          </Box>
        )}

        {requireCheckboxConfirmation && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={checkboxConfirmation}
                  onChange={(e) => setCheckboxConfirmation(e.target.checked)}
                  disabled={isConfirming || loading}
                />
              }
              label={requireCheckboxConfirmation.label}
            />
            {requireCheckboxConfirmation.helperText && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                {requireCheckboxConfirmation.helperText}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isConfirming || loading}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={getConfirmButtonColor() as any}
          disabled={isConfirmDisabled()}
          startIcon={
            (isConfirming || loading) ? (
              <CircularProgress size={16} />
            ) : type === 'destructive' ? (
              <DeleteForever />
            ) : type === 'error' ? (
              <Error />
            ) : undefined
          }
        >
          {isConfirming || loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Predefined confirmation dialogs for common actions
export const DeleteConfirmationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemName: string;
  itemType?: string;
  loading?: boolean;
  additionalWarning?: string;
}> = ({
  open,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  loading = false,
  additionalWarning,
}) => (
  <ConfirmationDialog
    open={open}
    onClose={onClose}
    onConfirm={onConfirm}
    title={`Delete ${itemType}`}
    message={`Are you sure you want to delete "${itemName}"?`}
    confirmLabel="Delete"
    type="destructive"
    loading={loading}
    details={[
      `The ${itemType.toLowerCase()} will be permanently removed`,
      'All associated data will be deleted',
      'This action cannot be undone',
    ]}
    warningMessage={additionalWarning}
    requireCheckboxConfirmation={{
      label: `I understand that this ${itemType.toLowerCase()} will be permanently deleted`,
      helperText: 'This action cannot be undone',
    }}
  />
);

export const DestructiveActionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  actionName: string;
  confirmationText?: string;
  loading?: boolean;
  details?: string[];
}> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  actionName,
  confirmationText,
  loading = false,
  details,
}) => (
  <ConfirmationDialog
    open={open}
    onClose={onClose}
    onConfirm={onConfirm}
    title={title}
    message={message}
    confirmLabel={actionName}
    type="destructive"
    loading={loading}
    details={details}
    requireTextConfirmation={confirmationText ? {
      expectedText: confirmationText,
      helperText: `Type "${confirmationText}" to confirm this action`,
    } : undefined}
  />
);

export const SecurityActionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  loading?: boolean;
}> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
}) => (
  <ConfirmationDialog
    open={open}
    onClose={onClose}
    onConfirm={onConfirm}
    title={title}
    message={message}
    confirmLabel="Confirm"
    type="warning"
    loading={loading}
    requireCheckboxConfirmation={{
      label: 'I understand the security implications of this action',
      helperText: 'This action may affect system security',
    }}
  />
);

export default ConfirmationDialog;
