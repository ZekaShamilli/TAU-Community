import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface SessionManagerProps {
  children: React.ReactNode;
}

const SessionManager: React.FC<SessionManagerProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = React.useState(false);
  const [showExpired, setShowExpired] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  
  const warningTimerRef = useRef<NodeJS.Timeout>();
  const expiredTimerRef = useRef<NodeJS.Timeout>();
  const countdownTimerRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // Session configuration
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry
  const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    // Set up activity tracking
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      resetTimers();
    };

    // Add event listeners for user activity
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start session timers
    resetTimers();

    return () => {
      // Clean up event listeners
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearTimers();
    };
  }, [isAuthenticated]);

  const clearTimers = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    if (expiredTimerRef.current) {
      clearTimeout(expiredTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
  };

  const resetTimers = () => {
    clearTimers();
    setShowWarning(false);
    setShowExpired(false);
    setCountdown(0);

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_TIME / 1000);
      
      // Start countdown
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setShowWarning(false);
            setShowExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set expiry timer
    expiredTimerRef.current = setTimeout(() => {
      handleSessionExpired();
    }, SESSION_TIMEOUT);
  };

  const handleSessionExpired = async () => {
    setShowWarning(false);
    setShowExpired(true);
    
    // Auto-logout after showing expired dialog for a few seconds
    setTimeout(async () => {
      await logout();
    }, 3000);
  };

  const handleExtendSession = () => {
    setShowWarning(false);
    setCountdown(0);
    lastActivityRef.current = Date.now();
    resetTimers();
  };

  const handleLogoutNow = async () => {
    setShowWarning(false);
    await logout();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {children}

      {/* Session Warning Dialog */}
      <Dialog
        open={showWarning}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning color="warning" />
            Session Expiring Soon
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Your session will expire in <strong>{formatTime(countdown)}</strong> due to inactivity.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Would you like to extend your session?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutNow} color="secondary">
            Logout Now
          </Button>
          <Button onClick={handleExtendSession} variant="contained" autoFocus>
            Extend Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Expired Dialog */}
      <Dialog
        open={showExpired}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning color="error" />
            Session Expired
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box textAlign="center" py={2}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              Your session has expired due to inactivity.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You will be redirected to the login page shortly...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SessionManager;
