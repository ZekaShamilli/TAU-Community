/**
 * Authentication Service Unit Tests
 */

import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { AuthService } from '../../lib/auth/service';
import { JWTService } from '../../lib/auth/jwt';
import { redisManager } from '../../lib/auth/redis';
import { db, DatabaseUtils } from '../../lib/database';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../lib/auth/jwt');
jest.mock('../../lib/auth/redis');
jest.mock('../../lib/database');
jest.mock('bcrypt');
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

const mockJWTService = JWTService as jest.Mocked<typeof JWTService>;
const mockRedisManager = redisManager as jest.Mocked<typeof redisManager>;
const mockDb = db as jest.Mocked<typeof db>;
const mockDatabaseUtils = DatabaseUtils as jest.Mocked<typeof DatabaseUtils>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
const mockTotpVerify = mockSpeakeasy.totp.verify as jest.MockedFunction<typeof speakeasy.totp.verify>;

describe('AuthService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.STUDENT,
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    totpEnabled: false,
    totpSecret: null,
    presidedClub: null,
  };

  const mockSuperAdmin = {
    ...mockUser,
    id: 'super-admin-id',
    email: 'admin@example.com',
    role: UserRole.SUPER_ADMIN,
    totpEnabled: true,
    totpSecret: 'JBSWY3DPEHPK3PXP',
  };

  const mockClubPresident = {
    ...mockUser,
    id: 'president-id',
    email: 'president@example.com',
    role: UserRole.CLUB_PRESIDENT,
    presidedClub: [{ id: 'club-id' }],
  };

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisManager.isReady.mockReturnValue(true);
    mockDb.getClient.mockReturnValue(mockPrismaClient as any);
    mockDatabaseUtils.logAudit.mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize Redis connection if not ready', async () => {
      mockRedisManager.isReady.mockReturnValue(false);
      mockRedisManager.connect.mockResolvedValue(undefined);

      await AuthService.initialize();

      expect(mockRedisManager.connect).toHaveBeenCalled();
    });

    it('should not initialize Redis if already ready', async () => {
      mockRedisManager.isReady.mockReturnValue(true);

      await AuthService.initialize();

      expect(mockRedisManager.connect).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login a student user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      });

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        clubId: undefined,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        isActive: mockUser.isActive,
        totpEnabled: mockUser.totpEnabled,
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_SUCCESS',
          success: true,
        })
      );
    });

    it('should successfully login a club president with club ID', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockClubPresident);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      });

      const result = await AuthService.login({
        email: 'president@example.com',
        password: 'password',
      });

      expect(result.success).toBe(true);
      expect(result.user?.clubId).toBe('club-id');
      expect(mockJWTService.generateTokenPair).toHaveBeenCalledWith(
        mockClubPresident.id,
        UserRole.CLUB_PRESIDENT,
        'club-id'
      );
    });

    it('should require TOTP for Super Admin', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockSuperAdmin);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await AuthService.login({
        email: 'admin@example.com',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.requiresTOTP).toBe(true);
      expect(result.error).toBe('TOTP code required for Super Admin login');
    });

    it('should validate TOTP for Super Admin login', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockSuperAdmin);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockTotpVerify.mockReturnValue(true);
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      });

      const result = await AuthService.login({
        email: 'admin@example.com',
        password: 'password',
        totpCode: '123456',
      });

      expect(result.success).toBe(true);
      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: mockSuperAdmin.totpSecret,
        encoding: 'base32',
        token: '123456',
        window: 2,
      });
    });

    it('should reject invalid TOTP code', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockSuperAdmin);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockTotpVerify.mockReturnValue(false);

      const result = await AuthService.login({
        email: 'admin@example.com',
        password: 'password',
        totpCode: '000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authentication code');
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOTP_FAILED',
          success: false,
        })
      );
    });

    it('should reject invalid credentials', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.login({
        email: 'nonexistent@example.com',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject inactive users', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject wrong password', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          success: false,
          errorMessage: 'Invalid password',
        })
      );
    });

    it('should handle login errors gracefully', async () => {
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 604800,
      };
      mockJWTService.refreshAccessToken.mockResolvedValue(newTokens);
      mockJWTService.extractUserIdFromToken.mockReturnValue('user-id');

      const result = await AuthService.refreshToken({
        refreshToken: 'old-refresh-token',
      });

      expect(result.success).toBe(true);
      expect(result.tokens).toEqual(newTokens);
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOKEN_REFRESH',
          success: true,
        })
      );
    });

    it('should reject invalid refresh token', async () => {
      mockJWTService.refreshAccessToken.mockResolvedValue(null);

      const result = await AuthService.refreshToken({
        refreshToken: 'invalid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired refresh token');
    });

    it('should handle refresh errors gracefully', async () => {
      mockJWTService.refreshAccessToken.mockRejectedValue(new Error('Refresh error'));

      const result = await AuthService.refreshToken({
        refreshToken: 'refresh-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token refresh failed');
    });
  });

  describe('logout', () => {
    it('should successfully logout with access token only', async () => {
      mockJWTService.revokeToken.mockResolvedValue(undefined);
      mockJWTService.extractUserIdFromToken.mockReturnValue('user-id');

      const result = await AuthService.logout('access-token');

      expect(result.success).toBe(true);
      expect(mockJWTService.revokeToken).toHaveBeenCalledWith('access-token', 'LOGOUT');
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          success: true,
        })
      );
    });

    it('should logout with both access and refresh tokens', async () => {
      mockJWTService.revokeToken.mockResolvedValue(undefined);
      mockJWTService.extractUserIdFromToken.mockReturnValue('user-id');

      const result = await AuthService.logout('access-token', {
        refreshToken: 'refresh-token',
      });

      expect(result.success).toBe(true);
      expect(mockJWTService.revokeToken).toHaveBeenCalledTimes(2);
      expect(mockJWTService.revokeToken).toHaveBeenCalledWith('access-token', 'LOGOUT');
      expect(mockJWTService.revokeToken).toHaveBeenCalledWith('refresh-token', 'LOGOUT');
    });

    it('should handle logout errors gracefully', async () => {
      mockJWTService.revokeToken.mockRejectedValue(new Error('Revoke error'));

      const result = await AuthService.logout('access-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user tokens', async () => {
      mockJWTService.revokeAllUserTokens.mockResolvedValue(undefined);

      const result = await AuthService.logoutAll('user-id');

      expect(result.success).toBe(true);
      expect(mockJWTService.revokeAllUserTokens).toHaveBeenCalledWith('user-id', 'LOGOUT');
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT_ALL',
          success: true,
        })
      );
    });

    it('should handle logout all errors gracefully', async () => {
      mockJWTService.revokeAllUserTokens.mockRejectedValue(new Error('Revoke all error'));

      const result = await AuthService.logoutAll('user-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout all failed');
    });
  });

  describe('validateToken', () => {
    it('should validate tokens using JWTService', async () => {
      const mockValidation = { valid: true, payload: { userId: 'user-id' } };
      mockJWTService.validateAccessToken.mockResolvedValue(mockValidation as any);

      const result = await AuthService.validateToken('token');

      expect(result).toEqual(mockValidation);
      expect(mockJWTService.validateAccessToken).toHaveBeenCalledWith('token');
    });
  });

  describe('getUserFromToken', () => {
    it('should get user from valid token', async () => {
      mockJWTService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-id' } as any,
      });
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await AuthService.getUserFromToken('token');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        clubId: undefined,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        isActive: mockUser.isActive,
        totpEnabled: mockUser.totpEnabled,
      });
    });

    it('should return null for invalid token', async () => {
      mockJWTService.validateAccessToken.mockResolvedValue({
        valid: false,
      });

      const result = await AuthService.getUserFromToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      mockJWTService.validateAccessToken.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-id' } as any,
      });
      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await AuthService.getUserFromToken('token');

      expect(result).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should grant all permissions to Super Admin', () => {
      const hasPermission = AuthService.hasPermission(
        UserRole.SUPER_ADMIN,
        'any:permission'
      );

      expect(hasPermission).toBe(true);
    });

    it('should check role-based permissions for other roles', () => {
      const hasReadPermission = AuthService.hasPermission(
        UserRole.STUDENT,
        'club:read'
      );
      const hasCreatePermission = AuthService.hasPermission(
        UserRole.STUDENT,
        'club:create'
      );

      expect(hasReadPermission).toBe(true);
      expect(hasCreatePermission).toBe(false);
    });

    it('should enforce club ownership for Club Presidents', () => {
      const hasPermissionOwnClub = AuthService.hasPermission(
        UserRole.CLUB_PRESIDENT,
        'club:update',
        {
          clubId: 'club-1',
          resourceClubId: 'club-1',
        }
      );

      const hasPermissionOtherClub = AuthService.hasPermission(
        UserRole.CLUB_PRESIDENT,
        'club:update',
        {
          clubId: 'club-1',
          resourceClubId: 'club-2',
        }
      );

      expect(hasPermissionOwnClub).toBe(true);
      expect(hasPermissionOtherClub).toBe(false);
    });

    it('should enforce user ownership for Students', () => {
      const hasPermissionOwnProfile = AuthService.hasPermission(
        UserRole.STUDENT,
        'user:read',
        {
          userId: 'user-1',
          resourceOwnerId: 'user-1',
        }
      );

      const hasPermissionOtherProfile = AuthService.hasPermission(
        UserRole.STUDENT,
        'user:read',
        {
          userId: 'user-1',
          resourceOwnerId: 'user-2',
        }
      );

      expect(hasPermissionOwnProfile).toBe(true);
      expect(hasPermissionOtherProfile).toBe(false);
    });
  });

  describe('TOTP methods', () => {
    it('should generate TOTP secret', async () => {
      mockSpeakeasy.generateSecret.mockReturnValue({
        base32: 'SECRET',
        otpauth_url: 'otpauth://totp/test@example.com?secret=SECRET&issuer=TAU%20KAYS',
      } as any);

      // Mock QRCode.toDataURL
      const mockQRCode = require('qrcode');
      mockQRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mockqrcode');

      const result = await AuthService.generateTOTPSecret('test@example.com');

      expect(result).toEqual({
        secret: 'SECRET',
        qrCodeUrl: 'otpauth://totp/test@example.com?secret=SECRET&issuer=TAU%20KAYS',
        qrCodeDataUrl: 'data:image/png;base64,mockqrcode',
        manualEntryKey: 'SECRET',
      });
    });

    it('should verify TOTP code', () => {
      mockTotpVerify.mockReturnValue(true);

      const result = AuthService.verifyTOTP('SECRET', '123456');

      expect(result).toBe(true);
      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'SECRET',
        encoding: 'base32',
        token: '123456',
        window: 2,
      });
    });

    it('should enable TOTP for user', async () => {
      mockTotpVerify.mockReturnValue(true);
      mockPrismaClient.user.update.mockResolvedValue(mockUser);

      const result = await AuthService.enableTOTP('user-id', 'SECRET', '123456');

      expect(result.success).toBe(true);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          totpSecret: 'SECRET',
          totpEnabled: true,
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOTP_ENABLED',
          success: true,
        })
      );
    });

    it('should reject invalid TOTP code when enabling', async () => {
      mockTotpVerify.mockReturnValue(false);

      const result = await AuthService.enableTOTP('user-id', 'SECRET', '000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authentication code');
    });

    it('should disable TOTP for user', async () => {
      mockPrismaClient.user.update.mockResolvedValue(mockUser);

      const result = await AuthService.disableTOTP('user-id');

      expect(result.success).toBe(true);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          totpSecret: null,
          totpEnabled: false,
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOTP_DISABLED',
          success: true,
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status for all services', async () => {
      mockRedisManager.healthCheck.mockResolvedValue(true);
      mockDb.healthCheck.mockResolvedValue({ default: true });
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret';

      const health = await AuthService.healthCheck();

      expect(health).toEqual({
        redis: true,
        database: true,
        jwt: true,
      });
    });

    it('should handle health check errors', async () => {
      mockRedisManager.healthCheck.mockRejectedValue(new Error('Redis error'));

      const health = await AuthService.healthCheck();

      expect(health.redis).toBe(false);
    });
  });
});