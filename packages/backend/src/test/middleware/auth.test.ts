/**
 * Authentication Middleware Tests
 * Comprehensive tests for JWT verification, role-based authorization, and route protection
 */

import { Request, Response, NextFunction } from 'express';
import { 
  authenticate, 
  optionalAuthenticate, 
  requireRole, 
  requirePermission,
  requireSuperAdmin,
  requireClubAdmin,
  requireAuth,
  validateClubOwnership,
  authRateLimit,
  requireTOTP,
  auditLog
} from '../../lib/middleware/auth';
import { AuthService, UserRole, PERMISSIONS } from '../../lib/auth';
import { DatabaseUtils } from '../../lib/database';

// Mock dependencies
jest.mock('../../lib/auth');
jest.mock('../../lib/database');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockDatabaseUtils = DatabaseUtils as jest.Mocked<typeof DatabaseUtils>;

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn(),
      route: { path: '/test' },
      path: '/test',
      params: {},
      body: {},
      method: 'GET',
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    mockDatabaseUtils.logAudit.mockResolvedValue();
  });

  describe('authenticate middleware', () => {
    it('should reject requests without authorization header', async () => {
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with malformed authorization header', async () => {
      mockRequest.headers!.authorization = 'InvalidFormat';

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid tokens', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_FAILED',
          success: false,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired tokens', async () => {
      mockRequest.headers!.authorization = 'Bearer expired-token';
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        expired: true,
        error: 'Token expired',
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid tokens and set user context', async () => {
      const mockPayload = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        clubId: 'club-456',
        permissions: ['club:read'],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockRequest.userId).toBe('user-123');
      expect(mockRequest.userRole).toBe(UserRole.CLUB_PRESIDENT);
      expect(mockRequest.clubId).toBe('club-456');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle authentication service errors', async () => {
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockRejectedValue(new Error('Service error'));

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication service error',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthenticate middleware', () => {
    it('should continue without authentication when no token provided', async () => {
      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set user context when valid token provided', async () => {
      const mockPayload = {
        userId: 'user-123',
        role: UserRole.STUDENT,
        permissions: ['club:read'],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockRequest.userId).toBe('user-123');
      expect(mockRequest.userRole).toBe(UserRole.STUDENT);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without authentication when token is invalid', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should continue without authentication on service errors', async () => {
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockRejectedValue(new Error('Service error'));

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('requireRole middleware', () => {
    it('should reject unauthenticated requests', () => {
      const middleware = requireRole(UserRole.SUPER_ADMIN);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with insufficient role', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.STUDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.STUDENT;
      mockRequest.userId = 'user-123';

      const middleware = requireRole(UserRole.SUPER_ADMIN);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this resource',
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNAUTHORIZED_ACCESS',
          success: false,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests with sufficient role', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;

      const middleware = requireRole(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow requests with any of multiple allowed roles', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;

      const middleware = requireRole(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission middleware', () => {
    it('should reject unauthenticated requests', () => {
      const middleware = requirePermission(PERMISSIONS.CLUB_CREATE);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests without required permission', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.STUDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.STUDENT;
      mockRequest.userId = 'user-123';

      mockAuthService.hasPermission.mockReturnValue(false);

      const middleware = requirePermission(PERMISSIONS.CLUB_CREATE);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Permission denied for this action',
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERMISSION_DENIED',
          success: false,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests with required permission', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.userId = 'user-123';

      mockAuthService.hasPermission.mockReturnValue(true);

      const middleware = requirePermission(PERMISSIONS.CLUB_CREATE);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
        UserRole.SUPER_ADMIN,
        PERMISSIONS.CLUB_CREATE,
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('should pass context parameters to permission check', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        clubId: 'club-456',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;
      mockRequest.userId = 'user-123';
      mockRequest.clubId = 'club-456';
      mockRequest.params = { clubId: 'club-789', userId: 'user-456' };

      mockAuthService.hasPermission.mockReturnValue(true);

      const middleware = requirePermission(PERMISSIONS.ACTIVITY_CREATE);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
        UserRole.CLUB_PRESIDENT,
        PERMISSIONS.ACTIVITY_CREATE,
        {
          userId: 'user-123',
          clubId: 'club-456',
          resourceClubId: 'club-789',
          resourceOwnerId: 'user-456',
        }
      );
    });
  });

  describe('convenience middleware functions', () => {
    it('requireSuperAdmin should only allow Super Admins', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;
      mockRequest.userId = 'user-123';

      requireSuperAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('requireClubAdmin should allow Super Admins and Club Presidents', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;

      requireClubAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('requireAuth should allow any authenticated user', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.STUDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.STUDENT;

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('validateClubOwnership middleware', () => {
    it('should reject unauthenticated requests', () => {
      validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Super Admins to access any club', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.params = { clubId: 'any-club' };

      validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests without clubId parameter', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        clubId: 'club-456',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;
      mockRequest.clubId = 'club-456';
      mockRequest.params = {};

      validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_CLUB_ID',
          message: 'Club ID required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Club Presidents to access their own club', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        clubId: 'club-456',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;
      mockRequest.clubId = 'club-456';
      mockRequest.params = { clubId: 'club-456' };

      validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject Club Presidents accessing other clubs', () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        clubId: 'club-456',
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;
      mockRequest.userId = 'user-123';
      mockRequest.clubId = 'club-456';
      mockRequest.params = { clubId: 'club-789' };

      validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'CLUB_ACCESS_DENIED',
          message: 'Access denied to this club',
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNAUTHORIZED_CLUB_ACCESS',
          success: false,
          errorMessage: expect.stringContaining('Club President attempted to access club club-789 but owns club club-456'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authRateLimit middleware', () => {
    it('should allow requests within rate limit', () => {
      const middleware = authRateLimit(5, 60000);
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      // Temporarily override NODE_ENV to avoid test environment rate limiting
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const middleware = authRateLimit(2, 60000);
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      
      // First two requests should pass
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Third request should be blocked
      jest.clearAllMocks();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: expect.any(Number),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reset rate limit after window expires', (done) => {
      // Temporarily override NODE_ENV to avoid test environment rate limiting
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const middleware = authRateLimit(1, 100); // 100ms window
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      
      // First request should pass
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Second request should be blocked
      jest.clearAllMocks();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      
      // After window expires, request should pass again
      setTimeout(() => {
        jest.clearAllMocks();
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('requireTOTP middleware', () => {
    it('should reject unauthenticated requests', async () => {
      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow non-Super Admin users without TOTP', async () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.CLUB_PRESIDENT,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.CLUB_PRESIDENT;

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject Super Admins without TOTP enabled', async () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.userId = 'user-123';
      mockRequest.headers!.authorization = 'Bearer valid-token';

      mockAuthService.getUserFromToken.mockResolvedValue({
        id: 'user-123',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        totpEnabled: false,
      });

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

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
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow Super Admins with TOTP enabled', async () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.headers!.authorization = 'Bearer valid-token';

      mockAuthService.getUserFromToken.mockResolvedValue({
        id: 'user-123',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        totpEnabled: true,
      });

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockRequest.user = {
        userId: 'user-123',
        role: UserRole.SUPER_ADMIN,
        permissions: [],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.headers!.authorization = 'Bearer valid-token';

      mockAuthService.getUserFromToken.mockRejectedValue(new Error('Service error'));

      await requireTOTP(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOTP_VALIDATION_ERROR',
          message: 'TOTP validation service error',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('auditLog middleware', () => {
    it('should log successful operations', () => {
      const middleware = auditLog('CREATE_CLUB', 'CLUB');
      mockRequest.userId = 'user-123';
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.params = { id: 'club-456' };
      mockRequest.body = { name: 'Test Club' };
      mockRequest.method = 'POST';

      // Mock successful response
      const originalJson = mockResponse.json;
      mockResponse.json = jest.fn().mockImplementation((body) => {
        // Simulate successful response - ensure statusCode is set before json is called
        return originalJson?.call(mockResponse, body);
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Set status code to success before calling json
      mockResponse.statusCode = 200;
      // Simulate response being sent
      (mockResponse.json as jest.Mock)({ success: true });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: 'user-123',
        userRole: UserRole.SUPER_ADMIN,
        action: 'CREATE_CLUB',
        resource: 'CLUB',
        resourceId: 'club-456',
        changes: { name: 'Test Club' },
        ipAddress: '127.0.0.1',
        userAgent: undefined,
        success: true,
        errorMessage: undefined,
      });
    });

    it('should log failed operations', () => {
      const middleware = auditLog('DELETE_CLUB', 'CLUB');
      mockRequest.userId = 'user-123';
      mockRequest.userRole = UserRole.SUPER_ADMIN;
      mockRequest.params = { clubId: 'club-456' };

      // Mock error response
      const originalJson = mockResponse.json;
      mockResponse.json = jest.fn().mockImplementation((body) => {
        mockResponse.statusCode = 403;
        return originalJson?.call(mockResponse, body);
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate error response being sent
      (mockResponse.json as jest.Mock)({ 
        error: { message: 'Permission denied' } 
      });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: 'user-123',
        userRole: UserRole.SUPER_ADMIN,
        action: 'DELETE_CLUB',
        resource: 'CLUB',
        resourceId: 'club-456',
        changes: undefined, // GET requests don't log body
        ipAddress: '127.0.0.1',
        userAgent: undefined,
        success: false,
        errorMessage: 'Permission denied',
      });
    });

    it('should handle requests without user context', () => {
      const middleware = auditLog('VIEW_CLUB', 'CLUB');
      mockRequest.method = 'GET';

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate response
      const originalJson = mockResponse.json;
      mockResponse.json = jest.fn().mockImplementation((body) => {
        mockResponse.statusCode = 200;
        return originalJson?.call(mockResponse, body);
      });

      (mockResponse.json as jest.Mock)({ data: 'club info' });

      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: undefined,
        userRole: UserRole.STUDENT, // Default role
        action: 'VIEW_CLUB',
        resource: 'CLUB',
        resourceId: undefined,
        changes: undefined,
        ipAddress: '127.0.0.1',
        userAgent: undefined,
        success: true,
        errorMessage: undefined,
      });
    });
  });
});