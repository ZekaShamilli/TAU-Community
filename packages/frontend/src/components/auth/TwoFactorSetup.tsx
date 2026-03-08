import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Security,
  QrCode,
  CheckCircle,
  Warning,
  ContentCopy,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';

interface TwoFactorSetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface VerificationFormData {
  totpCode: string;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpData, setTotpData] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { refreshUser } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VerificationFormData>({
    defaultValues: {
      totpCode: '',
    },
  });

  useEffect(() => {
    generateTotpSecret();
  }, []);

  const generateTotpSecret = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await authService.generateTotpSecret();
      setTotpData(data);
      setActiveStep(1);
    } catch (error: any) {
      console.error('Failed to generate TOTP secret:', error);
      setError(error.response?.data?.error?.message || 'Failed to generate setup code');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: VerificationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.enableTotp(data.totpCode);
      setBackupCodes(result.backupCodes);
      setActiveStep(2);
      
      // Refresh user data to reflect 2FA enabled status
      await refreshUser();
      
      toast.success('Two-factor authentication enabled successfully!');
    } catch (error: any) {
      console.error('Failed to enable TOTP:', error);
      setError(error.response?.data?.error?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const copyAllBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    toast.success('All backup codes copied to clipboard!');
  };

  const steps = [
    'Generate Setup Code',
    'Scan QR Code',
    'Save Backup Codes',
  ];

  return (
    <Box maxWidth={600} mx="auto" p={2}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Security sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" component="h1" gutterBottom>
              Set Up Two-Factor Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Secure your account with an additional layer of protection
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Generate Setup Code</StepLabel>
              <StepContent>
                <Box textAlign="center" py={2}>
                  {isLoading ? (
                    <CircularProgress />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Generating your unique setup code...
                    </Typography>
                  )}
                </Box>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Scan QR Code</StepLabel>
              <StepContent>
                {totpData && (
                  <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        1. Install an authenticator app (Google Authenticator, Authy, etc.)
                        <br />
                        2. Scan the QR code below or manually enter the secret key
                        <br />
                        3. Enter the 6-digit code from your app to verify
                      </Typography>
                    </Alert>

                    <Box textAlign="center" mb={3}>
                      <img
                        src={totpData.qrCode}
                        alt="QR Code for 2FA setup"
                        style={{ maxWidth: '200px', height: 'auto' }}
                      />
                    </Box>

                    <Box mb={3}>
                      <Typography variant="subtitle2" gutterBottom>
                        Manual Entry Key:
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={totpData.secret}
                          variant="outlined"
                          sx={{ fontFamily: 'monospace' }}
                        />
                        <Button
                          size="small"
                          startIcon={<ContentCopy />}
                          onClick={() => copyToClipboard(totpData.secret)}
                        >
                          Copy
                        </Button>
                      </Box>
                    </Box>

                    <form onSubmit={handleSubmit(onSubmit)}>
                      <Controller
                        name="totpCode"
                        control={control}
                        rules={{
                          required: 'Verification code is required',
                          pattern: {
                            value: /^\d{6}$/,
                            message: 'Code must be 6 digits',
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Verification Code"
                            type="text"
                            error={!!errors.totpCode}
                            helperText={errors.totpCode?.message || 'Enter the 6-digit code from your authenticator app'}
                            margin="normal"
                            disabled={isLoading}
                            inputProps={{
                              maxLength: 6,
                              pattern: '[0-9]*',
                            }}
                          />
                        )}
                      />

                      <Box display="flex" gap={2} mt={2}>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={isLoading}
                          startIcon={isLoading ? <CircularProgress size={20} /> : <CheckCircle />}
                        >
                          {isLoading ? 'Verifying...' : 'Verify & Enable'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={handleCancel}
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </form>
                  </Box>
                )}
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Save Backup Codes</StepLabel>
              <StepContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Important:</strong> Save these backup codes in a secure location. 
                    You can use them to access your account if you lose your authenticator device.
                  </Typography>
                </Alert>

                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Backup Codes:
                  </Typography>
                  <List dense>
                    {backupCodes.map((code, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontFamily="monospace">
                              {code}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Box display="flex" gap={2} mb={3}>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={copyAllBackupCodes}
                  >
                    Copy All Codes
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowBackupCodes(true)}
                  >
                    View Codes Again
                  </Button>
                </Box>

                <Button
                  variant="contained"
                  onClick={handleComplete}
                  startIcon={<CheckCircle />}
                  fullWidth
                >
                  Complete Setup
                </Button>
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>

      {/* Backup Codes Dialog */}
      <Dialog
        open={showBackupCodes}
        onClose={() => setShowBackupCodes(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Backup Codes</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Store these codes securely. Each code can only be used once.
          </Alert>
          <List>
            {backupCodes.map((code, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={
                    <Typography variant="body1" fontFamily="monospace">
                      {code}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={copyAllBackupCodes} startIcon={<ContentCopy />}>
            Copy All
          </Button>
          <Button onClick={() => setShowBackupCodes(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TwoFactorSetup;
