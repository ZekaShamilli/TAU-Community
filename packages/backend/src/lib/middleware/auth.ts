/**
 * Authentication and Authorization Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, JWTPayload, UserRole, PERMISSIONS } from '../auth';
import { DatabaseUtils } from '../database';

// Re-export RBAC middleware
export * from './rbac';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      userRole?: UserRole;
      clubId?: string;
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Authentication middleware - validates JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required',
        },
      });
      return;
    }

    const validation = await AuthService.validateToken(token);
    
    if (!validation.valid || !validation.payload) {
      // Log failed authentication attempt
      await DatabaseUtils.logAudit({
        userRole: UserRole.STUDENT, // Default role for logging
        action: 'AUTH_FAILED',
        resource: 'AUTH',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: validation.error || 'Token validation failed',
      });

      const statusCode = 401; // All authentication failures should return 401
      const errorCode = validation.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      
      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: validation.error || 'Authentication failed',
        },
      });
      return;
    }

    // Attach user information to request
    req.user = validation.payload;
    req.userId = validation.payload.userId;
    req.userRole = validation.payload.role;
    req.clubId = validation.payload.clubId;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication service error',
      },
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const validation = await AuthService.validateToken(token);
    
    if (validation.valid && validation.payload) {
      // Attach user information to request if token is valid
      req.user = validation.payload;
      req.userId = validation.payload.userId;
      req.userRole = validation.payload.role;
      req.clubId = validation.payload.clubId;
    }

    next();
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Continue without authentication on error
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.userRole)) {
      // Log unauthorized access attempt
      DatabaseUtils.logAudit({
        userId: req.userId,
        userRole: req.userRole,
        action: 'UNAUTHORIZED_ACCESS',
        resource: req.route?.path || req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: `Role ${req.userRole} not allowed for this resource`,
      }).catch(console.error);

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this resource',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const hasPermission = AuthService.hasPermission(
      req.userRole,
      permission,
      {
        userId: req.userId,
        clubId: req.clubId,
        // Additional context can be added based on request parameters
        resourceClubId: req.params.clubId,
        resourceOwnerId: req.params.userId,
      }
    );

    if (!hasPermission) {
      // Log unauthorized access attempt
      DatabaseUtils.logAudit({
        userId: req.userId,
        userRole: req.userRole,
        action: 'PERMISSION_DENIED',
        resource: req.route?.path || req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: `Permission ${permission} denied for role ${req.userRole}`,
      }).catch(console.error);

      res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Permission denied for this action',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Super Admin only middleware
 */
export const requireSuperAdmin = () => requireRole(UserRole.SUPER_ADMIN);

/**
 * Club President or Super Admin middleware
 */
export const requireClubAdmin = () => requireRole(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT);

/**
 * Any authenticated user middleware
 */
export const requireAuth = () => requireRole(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT);

/**
 * Club ownership validation middleware
 * Ensures Club Presidents can only access their own club resources
 */
export const validateClubOwnership = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.userRole) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Super Admins can access any club
  if (req.userRole === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Club Presidents can only access their own club
  if (req.userRole === UserRole.CLUB_PRESIDENT) {
    const requestedClubId = req.params.clubId;
    
    if (!requestedClubId) {
      res.status(400).json({
        error: {
          code: 'MISSING_CLUB_ID',
          message: 'Club ID required',
        },
      });
      return;
    }

    if (req.clubId !== requestedClubId) {
      // Log unauthorized club access attempt
      DatabaseUtils.logAudit({
        userId: req.userId,
        userRole: req.userRole,
        action: 'UNAUTHORIZED_CLUB_ACCESS',
        resource: 'CLUB',
        resourceId: requestedClubId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: `Club President attempted to access club ${requestedClubId} but owns club ${req.clubId}`,
      }).catch(console.error);

      res.status(403).json({
        error: {
          code: 'CLUB_ACCESS_DENIED',
          message: 'Access denied to this club',
        },
      });
      return;
    }
  }

  next();
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  // In test environment, use higher limits to avoid interference
  if (process.env.NODE_ENV === 'test') {
    maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000');
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  }

  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const userAttempts = attempts.get(key);
    
    if (!userAttempts || now > userAttempts.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (userAttempts.count >= maxAttempts) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
        },
      });
      return;
    }

    userAttempts.count++;
    next();
  };
};

/**
 * TOTP validation middleware - enforces 2FA for Super Admins
 */
export const requireTOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.userRole) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Only Super Admins require TOTP
    if (req.userRole !== UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // Get user from database to check TOTP status
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required',
        },
      });
      return;
    }

    const user = await AuthService.getUserFromToken(token);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Check if TOTP is enabled for Super Admin
    if (!user.totpEnabled) {
      // Log unauthorized access attempt
      await DatabaseUtils.logAudit({
        userId: req.userId,
        userRole: req.userRole,
        action: 'TOTP_NOT_ENABLED',
        resource: req.route?.path || req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'Super Admin attempted to access resource without TOTP enabled',
      });

      res.status(403).json({
        error: {
          code: 'TOTP_REQUIRED',
          message: 'Two-factor authentication must be enabled for Super Admin accounts',
        },
      });
      return;
    }

    next();
  } catch (error) {
    console.error('TOTP validation middleware error:', error);
    
    res.status(500).json({
      error: {
        code: 'TOTP_VALIDATION_ERROR',
        message: 'TOTP validation service error',
      },
    });
  }
};

/**
 * Audit logging middleware for sensitive operations
 */
export const auditLog = (action: string, resource: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Log the operation after response is sent
      const success = res.statusCode < 400;
      
      DatabaseUtils.logAudit({
        userId: req.userId,
        userRole: req.userRole || UserRole.STUDENT,
        action,
        resource,
        resourceId: req.params.id || req.params.clubId || req.params.activityId,
        changes: req.method !== 'GET' ? req.body : undefined,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage: success ? undefined : body?.error?.message,
      }).catch(console.error);

      return originalJson.call(this, body);
    };

    next();
  };
};