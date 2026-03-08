/**
 * TOTP Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { requireTOTP } from '../../lib/middleware/auth';
import { AuthService } from '../../lib/auth/service';
import { DatabaseUtils } from '../../lib/database';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../lib/auth/service');
jest.mock('../../lib/database');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockDatabaseUtils = DatabaseUtils as jest.Mocked<typeof DatabaseUtils>;

describe('TOTP Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {
        authorization: 'Bearer test-token',
      },
      user: {
        userId: 'user-id',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 900,
      },
      userRole: UserRole.SUPER_ADMIN,
      userId: 'user-id',
      ip: '127.0.0.1',
      route: { path: '/test' },
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
    mockDatabaseUtils.logAudit.mockResolvedValue(undefined);
  });

  describe('requireTOTP', () => {
    it('should allow access for non-Super Admin users', async () => {
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow access for Super Admin with TOTP enabled', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        totpEnabled: true,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      };

      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for Super Admin without TOTP enabled', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        totpEnabled: false,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      };

      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOTP_REQUIRED',
          message: 'Two-factor authentication must be enabled for Super Admin accounts',
        },
      });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOTP_NOT_ENABLED',
          success: false,
        })
      );
    });

    it('should deny access when no authentication is provided', async () => {
      mockRequest.user = undefined;
      mockRequest.userRole = undefined;

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    });

    it('should deny access when no token is provided', async () => {
      mockRequest.headers = {};

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required',
        },
      });
    });

    it('should deny access when user is not found', async () => {
      mockAuthService.getUserFromToken.mockResolvedValue(null);

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Database error'));

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOTP_VALIDATION_ERROR',
          message: 'TOTP validation service error',
        },
      });
    });
  });
});