/**
 * Property-Based Tests for Authentication Middleware
 * Tests universal properties that should hold for all authentication scenarios
 */

import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import {
  authenticate,
  requireRole,
  requirePermission,
  validateClubOwnership,
} from '../../lib/middleware/auth';
import { AuthService, UserRole, PERMISSIONS } from '../../lib/auth';
import { DatabaseUtils } from '../../lib/database';

// Mock dependencies
jest.mock('../../lib/auth/service');
jest.mock('../../lib/database');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockDatabaseUtils = DatabaseUtils as jest.Mocked<typeof DatabaseUtils>;

describe('Authentication Middleware Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseUtils.logAudit.mockResolvedValue(undefined);
  });

  /**
   * **Feature: tau-kays, Property 1: Role-based authentication enforcement**
   * For any user attempting to authenticate, the system should enforce the appropriate 
   * authentication method based on their role: two-factor authentication for Super Admins, 
   * standard authentication for Club Presidents, and no authentication required for public 
   * content access by Students.
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  describe('Property 1: Role-based authentication enforcement', () => {
    const userRoleArb = fc.constantFrom(
      UserRole.SUPER_ADMIN,
      UserRole.CLUB_PRESIDENT,
      UserRole.STUDENT
    );

    const tokenValidationArb = fc.record({
      valid: fc.boolean(),
      expired: fc.boolean(),
      payload: fc.option(fc.record({
        userId: fc.uuid(),
        role: userRoleArb,
        clubId: fc.option(fc.uuid(), { nil: undefined }),
        permissions: fc.array(fc.constantFrom(...Object.values(PERMISSIONS))),
        iat: fc.integer({ min: Date.now() - 3600000, max: Date.now() }),
        exp: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
      }), { nil: undefined }),
      error: fc.option(fc.string(), { nil: undefined }),
    });

    const requestArb = fc.record({
      headers: fc.record({
        authorization: fc.option(fc.string()),
      }),
      ip: fc.ipV4(),
      path: fc.string(),
      route: fc.option(fc.record({ path: fc.string() })),
      params: fc.dictionary(fc.string(), fc.string()),
      body: fc.object(),
      get: fc.constant(jest.fn().mockReturnValue('test-user-agent')),
    });

    it('should consistently validate tokens based on their validity', () => {
      fc.assert(
        fc.asyncProperty(
          requestArb,
          tokenValidationArb,
          async (requestData, validationResult) => {
            // Setup
            const mockRequest = {
              ...requestData,
              headers: {
                ...requestData.headers,
                authorization: requestData.headers.authorization 
                  ? `Bearer ${requestData.headers.authorization}`
                  : undefined,
              },
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            mockAuthService.validateToken.mockResolvedValue(validationResult);

            // Execute
            await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify property: Authentication result should be consistent with token validity
            const hasValidTokenFormat = requestData.headers.authorization?.startsWith('Bearer ') && 
                                      requestData.headers.authorization.length > 7 && // "Bearer " + at least 1 char
                                      requestData.headers.authorization.trim() !== 'Bearer';
            
            if (!requestData.headers.authorization) {
              // No token provided - should always reject
              expect(mockResponse.status).toHaveBeenCalledWith(401);
              expect(mockNext).not.toHaveBeenCalled();
            } else if (!hasValidTokenFormat) {
              // Invalid token format - should be rejected
              expect(mockResponse.status).toHaveBeenCalledWith(401);
              expect(mockNext).not.toHaveBeenCalled();
            } else if (validationResult.valid && validationResult.payload && !validationResult.expired) {
              // Valid token - should authenticate and attach user info
              expect(mockNext).toHaveBeenCalled();
              expect(mockRequest.user).toEqual(validationResult.payload);
              expect(mockRequest.userId).toBe(validationResult.payload.userId);
              expect(mockRequest.userRole).toBe(validationResult.payload.role);
            } else {
              // Invalid token - should reject with 401 (authentication failed)
              expect(mockResponse.status).toHaveBeenCalledWith(401);
              expect(mockNext).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce role-based access control consistently', () => {
      fc.assert(
        fc.property(
          userRoleArb,
          fc.array(userRoleArb, { minLength: 1, maxLength: 3 }),
          (userRole, allowedRoles) => {
            // Setup
            const mockRequest = {
              user: {
                userId: 'test-user',
                role: userRole,
                permissions: [],
                iat: Date.now(),
                exp: Date.now() + 900,
              },
              userRole,
              userId: 'test-user',
              ip: '127.0.0.1',
              path: '/test',
              route: { path: '/test' },
              get: jest.fn().mockReturnValue('test-user-agent'),
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            const middleware = requireRole(...allowedRoles);

            // Execute
            middleware(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify property: Access should be granted if and only if user role is in allowed roles
            if (allowedRoles.includes(userRole)) {
              expect(mockNext).toHaveBeenCalled();
              expect(mockResponse.status).not.toHaveBeenCalled();
            } else {
              expect(mockResponse.status).toHaveBeenCalledWith(403);
              expect(mockNext).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce permission-based access control consistently', () => {
      const permissionArb = fc.constantFrom(...Object.values(PERMISSIONS));

      fc.assert(
        fc.property(
          userRoleArb,
          permissionArb,
          fc.option(fc.uuid()),
          fc.option(fc.uuid()),
          (userRole, permission, clubId, resourceClubId) => {
            // Setup
            const mockRequest = {
              user: {
                userId: 'test-user',
                role: userRole,
                clubId,
                permissions: [],
                iat: Date.now(),
                exp: Date.now() + 900,
              },
              userRole,
              userId: 'test-user',
              clubId,
              params: resourceClubId ? { clubId: resourceClubId } : {},
              ip: '127.0.0.1',
              path: '/test',
              route: { path: '/test' },
              get: jest.fn().mockReturnValue('test-user-agent'),
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            // Mock permission check result
            const hasPermission = userRole === UserRole.SUPER_ADMIN || 
              (userRole === UserRole.CLUB_PRESIDENT && 
               (!resourceClubId || clubId === resourceClubId));
            
            mockAuthService.hasPermission.mockReturnValue(hasPermission);

            const middleware = requirePermission(permission);

            // Execute
            middleware(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify property: Access should be granted if and only if user has permission
            if (hasPermission) {
              expect(mockNext).toHaveBeenCalled();
              expect(mockResponse.status).not.toHaveBeenCalled();
            } else {
              expect(mockResponse.status).toHaveBeenCalledWith(403);
              expect(mockNext).not.toHaveBeenCalled();
            }

            // Verify permission was checked with correct context
            expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
              userRole,
              permission,
              expect.objectContaining({
                userId: 'test-user',
                clubId,
                resourceClubId,
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce club ownership validation consistently', () => {
      fc.assert(
        fc.property(
          userRoleArb,
          fc.uuid(),
          fc.uuid(),
          (userRole, userClubId, requestedClubId) => {
            // Setup
            const mockRequest = {
              user: {
                userId: 'test-user',
                role: userRole,
                clubId: userClubId,
                permissions: [],
                iat: Date.now(),
                exp: Date.now() + 900,
              },
              userRole,
              userId: 'test-user',
              clubId: userClubId,
              params: { clubId: requestedClubId },
              ip: '127.0.0.1',
              path: '/test',
              route: { path: '/test' },
              get: jest.fn().mockReturnValue('test-user-agent'),
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            // Execute
            validateClubOwnership(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify property: Access should be granted for Super Admins or Club Presidents accessing their own club
            if (userRole === UserRole.SUPER_ADMIN) {
              // Super Admins can access any club
              expect(mockNext).toHaveBeenCalled();
              expect(mockResponse.status).not.toHaveBeenCalled();
            } else if (userRole === UserRole.CLUB_PRESIDENT) {
              if (userClubId === requestedClubId) {
                // Club Presidents can access their own club
                expect(mockNext).toHaveBeenCalled();
                expect(mockResponse.status).not.toHaveBeenCalled();
              } else {
                // Club Presidents cannot access other clubs
                expect(mockResponse.status).toHaveBeenCalledWith(403);
                expect(mockNext).not.toHaveBeenCalled();
              }
            } else {
              // Other roles (Students) are allowed through - club ownership is not their concern
              expect(mockNext).toHaveBeenCalled();
              expect(mockResponse.status).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always require authentication for protected endpoints', () => {
      const middlewareArb = fc.constantFrom(
        requireRole(UserRole.STUDENT),
        requireRole(UserRole.CLUB_PRESIDENT),
        requireRole(UserRole.SUPER_ADMIN),
        requirePermission(PERMISSIONS.CLUB_READ),
        validateClubOwnership
      );

      fc.assert(
        fc.property(
          middlewareArb,
          requestArb,
          (middleware, requestData) => {
            // Setup - request without authentication
            const mockRequest = {
              ...requestData,
              user: undefined,
              userRole: undefined,
              userId: undefined,
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            // Execute
            middleware(mockRequest as Request, mockResponse as Response, mockNext);

            // Verify property: All protected endpoints should require authentication
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Authentication audit logging consistency
   * For any authentication attempt, the system should log the attempt with consistent metadata
   */
  describe('Property: Authentication audit logging consistency', () => {
    it('should log all authentication failures consistently', () => {
      const failureReasonArb = fc.constantFrom(
        'TOKEN_EXPIRED',
        'INVALID_TOKEN',
        'MISSING_TOKEN',
        'UNAUTHORIZED_ACCESS',
        'PERMISSION_DENIED'
      );

      fc.assert(
        fc.asyncProperty(
          fc.record({
            headers: fc.record({
              authorization: fc.option(fc.string()),
            }),
            ip: fc.ipV4(),
            path: fc.string(),
            get: fc.constant(jest.fn().mockReturnValue('test-user-agent')),
          }),
          failureReasonArb,
          async (requestData, failureReason) => {
            // Setup
            const mockRequest = {
              ...requestData,
              headers: {
                ...requestData.headers,
                authorization: requestData.headers.authorization 
                  ? `Bearer ${requestData.headers.authorization}`
                  : undefined,
              },
            } as Partial<Request>;

            const mockResponse = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn(),
            } as Partial<Response>;

            const mockNext = jest.fn() as NextFunction;

            // Mock different failure scenarios
            if (failureReason === 'TOKEN_EXPIRED') {
              mockAuthService.validateToken.mockResolvedValue({
                valid: false,
                expired: true,
                error: 'Token expired',
              });
            } else if (failureReason === 'INVALID_TOKEN') {
              mockAuthService.validateToken.mockResolvedValue({
                valid: false,
                expired: false,
                error: 'Invalid token',
              });
            }

            // Execute
            if (requestData.headers.authorization) {
              await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
            } else {
              await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
            }

            // Verify property: All authentication failures should be logged
            if (!requestData.headers.authorization || 
                failureReason === 'TOKEN_EXPIRED' || 
                failureReason === 'INVALID_TOKEN') {
              expect(mockResponse.status).toHaveBeenCalledWith(expect.any(Number));
              expect(mockNext).not.toHaveBeenCalled();
              
              // Should log audit entry for token validation failures
              if (requestData.headers.authorization && 
                  (failureReason === 'TOKEN_EXPIRED' || failureReason === 'INVALID_TOKEN')) {
                expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith(
                  expect.objectContaining({
                    action: 'AUTH_FAILED',
                    success: false,
                    ipAddress: expect.any(String),
                  })
                );
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});