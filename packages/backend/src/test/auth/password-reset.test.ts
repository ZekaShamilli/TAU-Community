/**
 * Password Reset Functionality Tests
 */

import request from 'supertest';
import express from 'express';
import { AuthService } from '../../lib/auth/service';
import authRoutes from '../../routes/auth';
import { UserRole } from '@prisma/client';

// Mock the AuthService
jest.mock('../../lib/auth/service');
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Password Reset Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear rate limiting state between tests
    jest.clearAllTimers();
  });

  describe('POST /auth/password/reset-request', () => {
    it('should successfully request password reset', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('If the email exists in our system, a password reset link has been sent');
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should require email field', async () => {
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        success: false,
        error: 'Service error',
      });

      // Use a different email to avoid rate limiting from previous tests
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'service-error@example.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('PASSWORD_RESET_REQUEST_FAILED');
    });

    it('should handle server exceptions', async () => {
      mockAuthService.requestPasswordReset.mockRejectedValue(new Error('Server error'));

      // Use a different email to avoid rate limiting from previous tests
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'server-error@example.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /auth/password/reset-confirm', () => {
    it('should successfully confirm password reset', async () => {
      mockAuthService.confirmPasswordReset.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/password/reset-confirm')
        .send({
          token: 'valid-reset-token',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password has been reset successfully');
      expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith({
        token: 'valid-reset-token',
        newPassword: 'newSecurePassword123',
      });
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/auth/password/reset-confirm')
        .send({
          token: 'valid-reset-token',
          newPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should require token field', async () => {
      const response = await request(app)
        .post('/auth/password/reset-confirm')
        .send({
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid or expired tokens', async () => {
      mockAuthService.confirmPasswordReset.mockResolvedValue({
        success: false,
        error: 'Invalid or expired reset token',
      });

      const response = await request(app)
        .post('/auth/password/reset-confirm')
        .send({
          token: 'invalid-token',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PASSWORD_RESET_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired reset token');
    });

    it('should handle server exceptions', async () => {
      mockAuthService.confirmPasswordReset.mockRejectedValue(new Error('Server error'));

      const response = await request(app)
        .post('/auth/password/reset-confirm')
        .send({
          token: 'valid-reset-token',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /auth/password/change', () => {
    it('should successfully change password for authenticated user', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.STUDENT,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.changePassword.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', 'Bearer access-token')
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-id', {
        currentPassword: 'currentPassword123',
        newPassword: 'newSecurePassword123',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/password/change')
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should validate password lengths', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.STUDENT,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', 'Bearer access-token')
        .send({
          currentPassword: 'current',
          newPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle incorrect current password', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.STUDENT,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.changePassword.mockResolvedValue({
        success: false,
        error: 'Current password is incorrect',
      });

      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', 'Bearer access-token')
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PASSWORD_CHANGE_FAILED');
      expect(response.body.error.message).toBe('Current password is incorrect');
    });

    it('should handle server exceptions', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.STUDENT,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.changePassword.mockRejectedValue(new Error('Server error'));

      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', 'Bearer access-token')
        .send({
          currentPassword: 'currentPassword123',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});