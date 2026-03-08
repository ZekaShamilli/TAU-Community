/**
 * Authentication Routes Integration Tests
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

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        totpEnabled: false,
      };

      mockAuthService.login.mockResolvedValue({
        success: true,
        tokens: mockTokens,
        user: mockUser,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          tokens: mockTokens,
          user: mockUser,
        },
      });
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 400 when TOTP is required', async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: 'TOTP code required for Super Admin login',
        requiresTOTP: true,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOTP_REQUIRED');
      expect(response.body.error.requiresTOTP).toBe(true);
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should handle server errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Server error'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should successfully refresh tokens', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      };

      mockAuthService.refreshToken.mockResolvedValue({
        success: true,
        tokens: mockTokens,
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'old-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          tokens: mockTokens,
        },
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        success: false,
        error: 'Invalid or expired refresh token',
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('REFRESH_FAILED');
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout', async () => {
      // Mock authentication middleware
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

      mockAuthService.logout.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer access-token')
        .send({
          refreshToken: 'refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should handle logout errors', async () => {
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

      mockAuthService.logout.mockResolvedValue({
        success: false,
        error: 'Logout failed',
      });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer access-token')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('LOGOUT_FAILED');
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should successfully logout from all devices', async () => {
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

      mockAuthService.logoutAll.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/logout-all')
        .set('Authorization', 'Bearer access-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out from all devices successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/logout-all');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user information', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        totpEnabled: false,
      };

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

      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer access-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          user: mockUser,
        },
      });
    });

    it('should return 404 if user not found', async () => {
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

      mockAuthService.getUserFromToken.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer access-token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /auth/totp/generate', () => {
    it('should generate TOTP secret', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        totpEnabled: false,
      };

      const mockTOTPData = {
        secret: 'SECRET',
        qrCodeUrl: 'otpauth://totp/test@example.com?secret=SECRET',
        qrCodeDataUrl: 'data:image/png;base64,mockqrcode',
        manualEntryKey: 'SECRET',
      };

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockAuthService.generateTOTPSecret.mockResolvedValue(mockTOTPData);

      const response = await request(app)
        .post('/auth/totp/generate')
        .set('Authorization', 'Bearer access-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockTOTPData,
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/totp/generate');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /auth/totp/enable', () => {
    it('should enable TOTP', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.enableTOTP.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/totp/enable')
        .set('Authorization', 'Bearer access-token')
        .send({
          secret: 'SECRET',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Two-factor authentication enabled successfully');
    });

    it('should validate request data', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      const response = await request(app)
        .post('/auth/totp/enable')
        .set('Authorization', 'Bearer access-token')
        .send({
          secret: 'SECRET',
          token: '12345', // Invalid length
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle enable TOTP errors', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.enableTOTP.mockResolvedValue({
        success: false,
        error: 'Invalid authentication code',
      });

      const response = await request(app)
        .post('/auth/totp/enable')
        .set('Authorization', 'Bearer access-token')
        .send({
          secret: 'SECRET',
          token: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOTP_ENABLE_FAILED');
    });
  });

  describe('POST /auth/totp/disable', () => {
    it('should disable TOTP', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-id',
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      });

      mockAuthService.disableTOTP.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/auth/totp/disable')
        .set('Authorization', 'Bearer access-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Two-factor authentication disabled successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/totp/disable');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /auth/health', () => {
    it('should return healthy status', async () => {
      mockAuthService.healthCheck.mockResolvedValue({
        redis: true,
        database: true,
        jwt: true,
      });

      const response = await request(app)
        .get('/auth/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toEqual({
        redis: true,
        database: true,
        jwt: true,
      });
    });

    it('should return unhealthy status when services are down', async () => {
      mockAuthService.healthCheck.mockResolvedValue({
        redis: false,
        database: true,
        jwt: true,
      });

      const response = await request(app)
        .get('/auth/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });

    it('should handle health check errors', async () => {
      mockAuthService.healthCheck.mockRejectedValue(new Error('Health check error'));

      const response = await request(app)
        .get('/auth/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HEALTH_CHECK_FAILED');
    });
  });
});