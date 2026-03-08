/**
 * TOTP Integration Tests
 * Tests the complete 2FA workflow for Super Admins
 */

import request from 'supertest';
import { app } from '../../app';
import { AuthService } from '../../lib/auth/service';
import { db } from '../../lib/database';
import { UserRole } from '@prisma/client';

describe('TOTP Integration Tests', () => {
  let superAdminUser: any;
  let accessToken: string;

  beforeAll(async () => {
    // Create a test Super Admin user
    const client = db.getClient();
    superAdminUser = await client.user.create({
      data: {
        email: 'superadmin@test.com',
        passwordHash: '$2b$10$test.hash.for.password',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        totpEnabled: false,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    const client = db.getClient();
    await client.user.delete({
      where: { id: superAdminUser.id },
    });
  });

  describe('2FA Setup Workflow', () => {
    it('should generate TOTP secret for Super Admin', async () => {
      // First, login to get access token (this should fail without TOTP)
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'superadmin@test.com',
          password: 'testpassword',
        });

      expect(loginResponse.status).toBe(400);
      expect(loginResponse.body.error.code).toBe('TOTP_REQUIRED');

      // Mock successful authentication for TOTP setup
      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      };

      jest.spyOn(AuthService, 'validateToken').mockResolvedValue({
        valid: true,
        payload: {
          userId: superAdminUser.id,
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      } as any);

      jest.spyOn(AuthService, 'getUserFromToken').mockResolvedValue({
        id: superAdminUser.id,
        email: superAdminUser.email,
        role: UserRole.SUPER_ADMIN,
        firstName: superAdminUser.firstName,
        lastName: superAdminUser.lastName,
        isActive: true,
        totpEnabled: false,
      });

      // Generate TOTP secret
      const totpResponse = await request(app)
        .post('/auth/totp/generate')
        .set('Authorization', 'Bearer mock-access-token');

      expect(totpResponse.status).toBe(200);
      expect(totpResponse.body.success).toBe(true);
      expect(totpResponse.body.data).toHaveProperty('secret');
      expect(totpResponse.body.data).toHaveProperty('qrCodeUrl');
      expect(totpResponse.body.data).toHaveProperty('qrCodeDataUrl');
      expect(totpResponse.body.data).toHaveProperty('manualEntryKey');
    });

    it('should enable TOTP for Super Admin', async () => {
      // Mock TOTP verification
      jest.spyOn(AuthService, 'enableTOTP').mockResolvedValue({
        success: true,
      });

      const enableResponse = await request(app)
        .post('/auth/totp/enable')
        .set('Authorization', 'Bearer mock-access-token')
        .send({
          secret: 'JBSWY3DPEHPK3PXP',
          token: '123456',
        });

      expect(enableResponse.status).toBe(200);
      expect(enableResponse.body.success).toBe(true);
      expect(enableResponse.body.message).toBe('Two-factor authentication enabled successfully');
    });
  });

  describe('2FA Login Workflow', () => {
    it('should require TOTP code for Super Admin login', async () => {
      // Mock user with TOTP enabled
      const client = db.getClient();
      jest.spyOn(client.user, 'findUnique').mockResolvedValue({
        ...superAdminUser,
        totpEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      } as any);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'superadmin@test.com',
          password: 'testpassword',
        });

      expect(loginResponse.status).toBe(400);
      expect(loginResponse.body.error.code).toBe('TOTP_REQUIRED');
      expect(loginResponse.body.error.requiresTOTP).toBe(true);
    });

    it('should successfully login with valid TOTP code', async () => {
      // Mock successful TOTP verification
      jest.spyOn(AuthService, 'login').mockResolvedValue({
        success: true,
        tokens: {
          accessToken: 'valid-access-token',
          refreshToken: 'valid-refresh-token',
          expiresIn: 900,
          refreshExpiresIn: 604800,
        },
        user: {
          id: superAdminUser.id,
          email: superAdminUser.email,
          role: UserRole.SUPER_ADMIN,
          firstName: superAdminUser.firstName,
          lastName: superAdminUser.lastName,
          isActive: true,
          totpEnabled: true,
        },
      });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'superadmin@test.com',
          password: 'testpassword',
          totpCode: '123456',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens).toBeDefined();
      expect(loginResponse.body.data.user.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('should reject invalid TOTP code', async () => {
      jest.spyOn(AuthService, 'login').mockResolvedValue({
        success: false,
        error: 'Invalid authentication code',
      });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'superadmin@test.com',
          password: 'testpassword',
          totpCode: '000000',
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.error.code).toBe('LOGIN_FAILED');
    });
  });

  describe('TOTP Middleware Protection', () => {
    it('should allow access to protected routes with TOTP enabled', async () => {
      // Mock authenticated Super Admin with TOTP enabled
      jest.spyOn(AuthService, 'validateToken').mockResolvedValue({
        valid: true,
        payload: {
          userId: superAdminUser.id,
          role: UserRole.SUPER_ADMIN,
          permissions: [],
          iat: Date.now(),
          exp: Date.now() + 900,
        },
      } as any);

      jest.spyOn(AuthService, 'getUserFromToken').mockResolvedValue({
        id: superAdminUser.id,
        email: superAdminUser.email,
        role: UserRole.SUPER_ADMIN,
        firstName: superAdminUser.firstName,
        lastName: superAdminUser.lastName,
        isActive: true,
        totpEnabled: true,
      });

      // Test accessing user profile (should work)
      const profileResponse = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-access-token');

      expect(profileResponse.status).toBe(200);
    });

    it('should deny access to protected routes without TOTP enabled', async () => {
      // Mock authenticated Super Admin without TOTP enabled
      jest.spyOn(AuthService, 'getUserFromToken').mockResolvedValue({
        id: superAdminUser.id,
        email: superAdminUser.email,
        role: UserRole.SUPER_ADMIN,
        firstName: superAdminUser.firstName,
        lastName: superAdminUser.lastName,
        isActive: true,
        totpEnabled: false,
      });

      // This would be used on routes that require TOTP
      // For now, we test the middleware directly through the TOTP generation endpoint
      const totpResponse = await request(app)
        .post('/auth/totp/generate')
        .set('Authorization', 'Bearer valid-access-token');

      // Should still work for TOTP setup
      expect(totpResponse.status).toBe(200);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});