/**
 * Authentication Service
 * Main service for user authentication, token management, and authorization
 */

import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { 
  AuthUser, 
  LoginRequest, 
  RefreshRequest, 
  LogoutRequest, 
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  TokenPair,
  TokenValidationResult,
  PERMISSIONS,
  UserRole
} from './types';
import { JWTService } from './jwt';
import { TokenBlacklistService, redisManager } from './redis';
import { db, DatabaseUtils } from '../database';

export class AuthService {
  /**
   * Initialize the authentication service
   */
  public static async initialize(): Promise<void> {
    // Ensure Redis connection is established
    if (!redisManager.isReady()) {
      await redisManager.connect();
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  public static async login(request: LoginRequest): Promise<{
    success: boolean;
    tokens?: TokenPair;
    user?: AuthUser;
    error?: string;
    requiresTOTP?: boolean;
  }> {
    try {
      const { email, password, totpCode } = request;

      // Find user by email
      const client = db.getClient();
      const user = await client.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          presidedClub: {
            select: { id: true }
          }
        }
      });

      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return {
          success: false,
          error: 'Please verify your email before logging in. Check your inbox for the verification code.',
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        // Log failed login attempt
        await DatabaseUtils.logAudit({
          userId: user.id,
          userRole: user.role,
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          ipAddress: '0.0.0.0', // Will be set by middleware
          success: false,
          errorMessage: 'Invalid password',
        });

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Check if TOTP is required for Super Admins
      if (user.role === UserRole.SUPER_ADMIN) {
        if (!user.totpEnabled) {
          return {
            success: false,
            error: 'Two-factor authentication must be enabled for Super Admin accounts',
            requiresTOTP: true,
          };
        }

        if (!totpCode) {
          return {
            success: false,
            error: 'TOTP code required for Super Admin login',
            requiresTOTP: true,
          };
        }

        // Verify TOTP code
        const totpValid = speakeasy.totp.verify({
          secret: user.totpSecret!,
          encoding: 'base32',
          token: totpCode,
          window: 2, // Allow 2 time steps (60 seconds) of drift
        });

        if (!totpValid) {
          // Log failed TOTP attempt
          await DatabaseUtils.logAudit({
            userId: user.id,
            userRole: user.role,
            action: 'TOTP_FAILED',
            resource: 'AUTH',
            ipAddress: '0.0.0.0',
            success: false,
            errorMessage: 'Invalid TOTP code',
          });

          return {
            success: false,
            error: 'Invalid authentication code',
          };
        }
      }

      // Get club ID for Club Presidents (get the first club they preside over)
      const clubId = user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].id : undefined;

      // Generate token pair
      const tokens = await JWTService.generateTokenPair(
        user.id,
        user.role,
        clubId
      );

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        totpEnabled: user.totpEnabled,
      };

      // Log successful login
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'LOGIN_SUCCESS',
        resource: 'AUTH',
        ipAddress: '0.0.0.0',
        success: true,
      });

      return {
        success: true,
        tokens,
        user: authUser,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Refresh access token
   */
  public static async refreshToken(request: RefreshRequest): Promise<{
    success: boolean;
    tokens?: TokenPair;
    error?: string;
  }> {
    try {
      const { refreshToken } = request;

      const newTokens = await JWTService.refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        return {
          success: false,
          error: 'Invalid or expired refresh token',
        };
      }

      // Log token refresh
      const userId = JWTService.extractUserIdFromToken(refreshToken);
      if (userId) {
        await DatabaseUtils.logAudit({
          userId,
          userRole: UserRole.STUDENT, // Will be updated with actual role
          action: 'TOKEN_REFRESH',
          resource: 'AUTH',
          success: true,
        });
      }

      return {
        success: true,
        tokens: newTokens,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }
  }

  /**
   * Logout user and revoke tokens
   */
  public static async logout(
    accessToken: string,
    request: LogoutRequest = {}
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { refreshToken } = request;

      // Revoke access token
      await JWTService.revokeToken(accessToken, 'LOGOUT');

      // Revoke refresh token if provided
      if (refreshToken) {
        await JWTService.revokeToken(refreshToken, 'LOGOUT');
      }

      // Log logout
      const userId = JWTService.extractUserIdFromToken(accessToken);
      if (userId) {
        await DatabaseUtils.logAudit({
          userId,
          userRole: UserRole.STUDENT, // Will be updated with actual role
          action: 'LOGOUT',
          resource: 'AUTH',
          success: true,
        });
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Logout failed',
      };
    }
  }

  /**
   * Logout from all devices
   */
  public static async logoutAll(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await JWTService.revokeAllUserTokens(userId, 'LOGOUT');

      // Log logout all
      await DatabaseUtils.logAudit({
        userId,
        userRole: UserRole.STUDENT, // Will be updated with actual role
        action: 'LOGOUT_ALL',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Logout all error:', error);
      return {
        success: false,
        error: 'Logout all failed',
      };
    }
  }

  /**
   * Validate access token
   */
  public static async validateToken(token: string): Promise<TokenValidationResult> {
    return await JWTService.validateAccessToken(token);
  }

  /**
   * Get user information from token
   */
  public static async getUserFromToken(token: string): Promise<AuthUser | null> {
    try {
      const validation = await this.validateToken(token);
      
      if (!validation.valid || !validation.payload) {
        return null;
      }

      const { userId } = validation.payload;

      // Get user from database
      const client = db.getClient();
      const user = await client.user.findUnique({
        where: { id: userId },
        include: {
          presidedClub: {
            select: { id: true }
          }
        }
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].id : undefined,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        totpEnabled: user.totpEnabled,
      };
    } catch (error) {
      console.error('Get user from token error:', error);
      return null;
    }
  }

  /**
   * Check if user has specific permission
   */
  public static hasPermission(
    userRole: UserRole,
    permission: string,
    context?: {
      userId?: string;
      clubId?: string;
      resourceOwnerId?: string;
      resourceClubId?: string;
    }
  ): boolean {
    // Super Admin has all permissions
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Get role permissions
    const rolePermissions = {
      [UserRole.SUPER_ADMIN]: Object.values(PERMISSIONS),
      [UserRole.CLUB_PRESIDENT]: [
        PERMISSIONS.CLUB_READ,
        PERMISSIONS.CLUB_UPDATE,
        PERMISSIONS.ACTIVITY_CREATE,
        PERMISSIONS.ACTIVITY_READ,
        PERMISSIONS.ACTIVITY_UPDATE,
        PERMISSIONS.ACTIVITY_DELETE,
        PERMISSIONS.APPLICATION_READ,
        PERMISSIONS.APPLICATION_UPDATE,
        PERMISSIONS.USER_READ,
        PERMISSIONS.CONTENT_FLAG,
      ],
      [UserRole.STUDENT]: [
        PERMISSIONS.CLUB_READ,
        PERMISSIONS.ACTIVITY_READ,
        PERMISSIONS.APPLICATION_SUBMIT,
        PERMISSIONS.USER_READ,
      ],
    };

    const userPermissions = rolePermissions[userRole] || [];
    
    if (!userPermissions.includes(permission as any)) {
      return false;
    }

    // Additional context-based checks
    if (context) {
      // Club Presidents can only manage their own club
      if (userRole === UserRole.CLUB_PRESIDENT) {
        if (permission.startsWith('club:') && permission !== PERMISSIONS.CLUB_READ) {
          if (context.resourceClubId && context.clubId !== context.resourceClubId) {
            return false;
          }
        }
        
        if (permission.startsWith('activity:')) {
          if (context.resourceClubId && context.clubId !== context.resourceClubId) {
            return false;
          }
        }
        
        if (permission.startsWith('application:')) {
          if (context.resourceClubId && context.clubId !== context.resourceClubId) {
            return false;
          }
        }
      }

      // Students can only read their own profile
      if (userRole === UserRole.STUDENT && permission === PERMISSIONS.USER_READ) {
        if (context.resourceOwnerId && context.userId !== context.resourceOwnerId) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Generate TOTP secret for 2FA setup
   */
  public static async generateTOTPSecret(userEmail: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    qrCodeDataUrl: string;
    manualEntryKey: string;
  }> {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: process.env.TOTP_ISSUER || 'TAU Community',
      length: 32,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url!,
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify TOTP code
   */
  public static verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  /**
   * Enable TOTP for user
   */
  public static async enableTOTP(userId: string, secret: string, token: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify the TOTP token first
      if (!this.verifyTOTP(secret, token)) {
        return {
          success: false,
          error: 'Invalid authentication code',
        };
      }

      // Update user record
      const client = db.getClient();
      await client.user.update({
        where: { id: userId },
        data: {
          totpSecret: secret,
          totpEnabled: true,
        },
      });

      // Log TOTP enablement
      await DatabaseUtils.logAudit({
        userId,
        userRole: UserRole.SUPER_ADMIN, // Typically only Super Admins enable TOTP
        action: 'TOTP_ENABLED',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Enable TOTP error:', error);
      return {
        success: false,
        error: 'Failed to enable two-factor authentication',
      };
    }
  }

  /**
   * Disable TOTP for user
   */
  public static async disableTOTP(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = db.getClient();
      await client.user.update({
        where: { id: userId },
        data: {
          totpSecret: null,
          totpEnabled: false,
        },
      });

      // Log TOTP disablement
      await DatabaseUtils.logAudit({
        userId,
        userRole: UserRole.SUPER_ADMIN,
        action: 'TOTP_DISABLED',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Disable TOTP error:', error);
      return {
        success: false,
        error: 'Failed to disable two-factor authentication',
      };
    }
  }

  /**
   * Health check for authentication service
   */
  public static async healthCheck(): Promise<{
    redis: boolean;
    database: boolean;
    jwt: boolean;
  }> {
    const health = {
      redis: false,
      database: false,
      jwt: false,
    };

    try {
      // Check Redis
      health.redis = await redisManager.healthCheck();

      // Check Database
      const dbHealth = await db.healthCheck();
      health.database = Object.values(dbHealth).some(status => status);

      // Check JWT configuration
      health.jwt = !!(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      console.error('Auth service health check error:', error);
    }

    return health;
  }

  /**
   * Request password reset - generates reset token and sends email
   */
  public static async requestPasswordReset(request: PasswordResetRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { email } = request;

      // Find user by email
      const client = db.getClient();
      const user = await client.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Always return success to prevent email enumeration attacks
      if (!user || !user.isActive) {
        // Log the attempt for security monitoring
        await DatabaseUtils.logAudit({
          userRole: UserRole.STUDENT,
          action: 'PASSWORD_RESET_ATTEMPT',
          resource: 'AUTH',
          success: false,
          errorMessage: `Password reset attempted for non-existent email: ${email}`,
        });

        return {
          success: true, // Don't reveal that email doesn't exist
        };
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Update user with reset token
      await client.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });

      // Log password reset request
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'AUTH',
        success: true,
      });

      // TODO: Send password reset email
      // In a real implementation, you would send an email here
      // For now, we'll just log the token (remove this in production)
      console.log(`Password reset token for ${email}: ${resetToken}`);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        error: 'Failed to process password reset request',
      };
    }
  }

  /**
   * Confirm password reset with token and new password
   */
  public static async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { token, newPassword } = request;

      // Validate password strength
      if (newPassword.length < 8) {
        return {
          success: false,
          error: 'Password must be at least 8 characters long',
        };
      }

      // Find user by reset token
      const client = db.getClient();
      const user = await client.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: {
            gt: new Date(), // Token must not be expired
          },
          isActive: true,
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired reset token',
        };
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password and clear reset token
      await client.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      // Revoke all existing tokens for security
      await JWTService.revokeAllUserTokens(user.id, 'SECURITY');

      // Log password reset completion
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'PASSWORD_RESET_COMPLETED',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      return {
        success: false,
        error: 'Failed to reset password',
      };
    }
  }

  /**
   * Change password for authenticated user
   */
  public static async changePassword(userId: string, request: ChangePasswordRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { currentPassword, newPassword } = request;

      // Validate new password strength
      if (newPassword.length < 8) {
        return {
          success: false,
          error: 'New password must be at least 8 characters long',
        };
      }

      // Find user
      const client = db.getClient();
      const user = await client.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      // Verify current password
      const currentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentPasswordValid) {
        // Log failed password change attempt
        await DatabaseUtils.logAudit({
          userId: user.id,
          userRole: user.role,
          action: 'PASSWORD_CHANGE_FAILED',
          resource: 'AUTH',
          success: false,
          errorMessage: 'Invalid current password',
        });

        return {
          success: false,
          error: 'Current password is incorrect',
        };
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password
      await client.user.update({
        where: { id: userId },
        data: {
          passwordHash,
        },
      });

      // Log successful password change
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'PASSWORD_CHANGED',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        error: 'Failed to change password',
      };
    }
  }

  /**
   * Generate and send email verification code
   */
  public static async sendVerificationCode(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = db.getClient();
      
      // Find user by email
      const user = await client.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          error: 'Email already verified',
        };
      }

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration to 10 minutes from now
      const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

      // Update user with verification code
      await client.user.update({
        where: { id: user.id },
        data: {
          verificationCode,
          verificationCodeExpires,
        },
      });

      // Send verification email
      const { NotificationService } = await import('../../services/notification.service');
      await NotificationService.sendEmail({
        to: user.email,
        subject: '🔐 TAU Community - Email Verification Code',
        content: `
          <h2>Email Verification</h2>
          <p>Dear ${user.firstName} ${user.lastName},</p>
          <p>Thank you for signing up for TAU Community!</p>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px; color: #00f0ff; text-align: center; padding: 20px; background: rgba(0, 240, 255, 0.1); border-radius: 8px;">${verificationCode}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>TAU Community Team</p>
        `,
        priority: 'HIGH',
      });

      // Log verification code sent
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'VERIFICATION_CODE_SENT',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Send verification code error:', error);
      return {
        success: false,
        error: 'Failed to send verification code',
      };
    }
  }

  /**
   * Verify email with code
   */
  public static async verifyEmail(email: string, code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = db.getClient();
      
      // Find user by email
      const user = await client.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          error: 'Email already verified',
        };
      }

      if (!user.verificationCode || !user.verificationCodeExpires) {
        return {
          success: false,
          error: 'No verification code found. Please request a new code.',
        };
      }

      // Check if code is expired
      if (new Date() > user.verificationCodeExpires) {
        return {
          success: false,
          error: 'Verification code has expired. Please request a new code.',
        };
      }

      // Verify code
      if (user.verificationCode !== code) {
        // Log failed verification attempt
        await DatabaseUtils.logAudit({
          userId: user.id,
          userRole: user.role,
          action: 'EMAIL_VERIFICATION_FAILED',
          resource: 'AUTH',
          success: false,
          errorMessage: 'Invalid verification code',
        });

        return {
          success: false,
          error: 'Invalid verification code',
        };
      }

      // Mark email as verified and clear verification code
      await client.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationCode: null,
          verificationCodeExpires: null,
        },
      });

      // Log successful verification
      await DatabaseUtils.logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'EMAIL_VERIFIED',
        resource: 'AUTH',
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Verify email error:', error);
      return {
        success: false,
        error: 'Failed to verify email',
      };
    }
  }
}