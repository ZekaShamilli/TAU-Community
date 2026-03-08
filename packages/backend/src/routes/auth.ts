/**
 * Authentication routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../lib/auth';
import { authenticate, authRateLimit, auditLog } from '../lib/middleware/auth';
import { validateBody } from '../lib/validation/middleware';
import { validationSchemas } from '../lib/validation/schemas';

const router = Router();

// Additional validation schemas for auth-specific endpoints
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

const enableTOTPSchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  token: validationSchemas.base.totpCode,
});

const passwordResetRequestSchema = z.object({
  email: validationSchemas.base.email,
});

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', 
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  auditLog('LOGIN_ATTEMPT', 'AUTH'),
  validateBody(validationSchemas.user.login),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.login(req.validatedData);

      if (!result.success) {
        const statusCode = result.requiresTOTP ? 400 : 401;
        res.status(statusCode).json({
          error: {
            code: result.requiresTOTP ? 'TOTP_REQUIRED' : 'LOGIN_FAILED',
            message: result.error,
            requiresTOTP: result.requiresTOTP,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          tokens: result.tokens,
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Login route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed due to server error',
        },
      });
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  authRateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  validateBody(refreshTokenSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.refreshToken(req.validatedData);

      if (!result.success) {
        res.status(401).json({
          error: {
            code: 'REFRESH_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          tokens: result.tokens,
        },
      });
    } catch (error) {
      console.error('Refresh token route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Token refresh failed due to server error',
        },
      });
    }
  }
);

/**
 * POST /auth/logout
 * Logout user and revoke tokens
 */
router.post('/logout',
  authenticate,
  auditLog('LOGOUT', 'AUTH'),
  validateBody(logoutSchema),
  async (req: Request, res: Response) => {
    try {
      // Extract access token from Authorization header
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];

      if (!accessToken) {
        res.status(400).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token required for logout',
          },
        });
        return;
      }

      const result = await AuthService.logout(accessToken, req.validatedData);

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'LOGOUT_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout failed due to server error',
        },
      });
    }
  }
);

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all',
  authenticate,
  auditLog('LOGOUT_ALL', 'AUTH'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await AuthService.logoutAll(req.userId);

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'LOGOUT_ALL_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      console.error('Logout all route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout all failed due to server error',
        },
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Extract access token from Authorization header
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];

      if (!accessToken) {
        res.status(400).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token required',
          },
        });
        return;
      }

      const user = await AuthService.getUserFromToken(accessToken);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or inactive',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      console.error('Get user route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user information',
        },
      });
    }
  }
);

/**
 * POST /auth/totp/generate
 * Generate TOTP secret for 2FA setup
 */
router.post('/totp/generate',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Extract access token to get user email
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];

      if (!accessToken) {
        res.status(400).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token required',
          },
        });
        return;
      }

      const user = await AuthService.getUserFromToken(accessToken);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      const totpData = await AuthService.generateTOTPSecret(user.email);

      res.json({
        success: true,
        data: {
          secret: totpData.secret,
          qrCodeUrl: totpData.qrCodeUrl,
          qrCodeDataUrl: totpData.qrCodeDataUrl,
          manualEntryKey: totpData.manualEntryKey,
        },
      });
    } catch (error) {
      console.error('Generate TOTP route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate TOTP secret',
        },
      });
    }
  }
);

/**
 * POST /auth/totp/enable
 * Enable TOTP for user account
 */
router.post('/totp/enable',
  authenticate,
  auditLog('TOTP_ENABLE', 'AUTH'),
  validateBody(enableTOTPSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await AuthService.enableTOTP(
        req.userId,
        req.validatedData.secret,
        req.validatedData.token
      );

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'TOTP_ENABLE_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
      });
    } catch (error) {
      console.error('Enable TOTP route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to enable two-factor authentication',
        },
      });
    }
  }
);

/**
 * POST /auth/totp/disable
 * Disable TOTP for user account
 */
router.post('/totp/disable',
  authenticate,
  auditLog('TOTP_DISABLE', 'AUTH'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await AuthService.disableTOTP(req.userId);

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'TOTP_DISABLE_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully',
      });
    } catch (error) {
      console.error('Disable TOTP route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to disable two-factor authentication',
        },
      });
    }
  }
);

/**
 * POST /auth/password/reset-request
 * Request password reset - sends reset email
 */
router.post('/password/reset-request',
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  auditLog('PASSWORD_RESET_REQUEST', 'AUTH'),
  validateBody(passwordResetRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.requestPasswordReset(req.validatedData);

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'PASSWORD_RESET_REQUEST_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been sent',
      });
    } catch (error) {
      console.error('Password reset request route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process password reset request',
        },
      });
    }
  }
);

/**
 * POST /auth/password/reset-confirm
 * Confirm password reset with token
 */
router.post('/password/reset-confirm',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  auditLog('PASSWORD_RESET_CONFIRM', 'AUTH'),
  validateBody(validationSchemas.user.resetPassword),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.confirmPasswordReset(req.validatedData);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'PASSWORD_RESET_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      console.error('Password reset confirm route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset password',
        },
      });
    }
  }
);

/**
 * POST /auth/password/change
 * Change password for authenticated user
 */
router.post('/password/change',
  authenticate,
  auditLog('PASSWORD_CHANGE', 'AUTH'),
  validateBody(validationSchemas.user.changePassword),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await AuthService.changePassword(req.userId, req.validatedData);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'PASSWORD_CHANGE_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Password change route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change password',
        },
      });
    }
  }
);

/**
 * GET /auth/health
 * Health check for authentication service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await AuthService.healthCheck();
    
    const isHealthy = health.redis && health.database && health.jwt;
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: isHealthy,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services: health,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Auth health check route error:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
      },
    });
  }
});

/**
 * POST /auth/send-verification-code
 * Send email verification code to user
 */
router.post('/send-verification-code',
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  auditLog('SEND_VERIFICATION_CODE', 'AUTH'),
  validateBody(z.object({
    email: validationSchemas.base.email,
  })),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.sendVerificationCode(req.validatedData.email);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'SEND_CODE_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Verification code sent to your email',
      });
    } catch (error) {
      console.error('Send verification code route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send verification code',
        },
      });
    }
  }
);

/**
 * POST /auth/verify-email
 * Verify email with code
 */
router.post('/verify-email',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  auditLog('VERIFY_EMAIL', 'AUTH'),
  validateBody(z.object({
    email: validationSchemas.base.email,
    code: z.string().length(6, 'Verification code must be 6 digits'),
  })),
  async (req: Request, res: Response) => {
    try {
      const result = await AuthService.verifyEmail(
        req.validatedData.email,
        req.validatedData.code
      );

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      console.error('Verify email route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify email',
        },
      });
    }
  }
);

export default router;