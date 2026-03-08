/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides comprehensive authorization enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../auth/types';
import { DatabaseUtils, db } from '../database';

export interface Permission {
  resource: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  scope: 'OWN' | 'ALL' | 'NONE';
}

export interface RolePermissions {
  [UserRole.SUPER_ADMIN]: Permission[];
  [UserRole.CLUB_PRESIDENT]: Permission[];
  [UserRole.STUDENT]: Permission[];
}

// Define comprehensive permission matrix
export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.SUPER_ADMIN]: [
    // Super Admin has full access to everything
    { resource: 'CLUB', action: 'CREATE', scope: 'ALL' },
    { resource: 'CLUB', action: 'READ', scope: 'ALL' },
    { resource: 'CLUB', action: 'UPDATE', scope: 'ALL' },
    { resource: 'CLUB', action: 'DELETE', scope: 'ALL' },
    { resource: 'ACTIVITY', action: 'CREATE', scope: 'ALL' },
    { resource: 'ACTIVITY', action: 'READ', scope: 'ALL' },
    { resource: 'ACTIVITY', action: 'UPDATE', scope: 'ALL' },
    { resource: 'ACTIVITY', action: 'DELETE', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'CREATE', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'READ', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'UPDATE', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'DELETE', scope: 'ALL' },
    { resource: 'USER', action: 'CREATE', scope: 'ALL' },
    { resource: 'USER', action: 'READ', scope: 'ALL' },
    { resource: 'USER', action: 'UPDATE', scope: 'ALL' },
    { resource: 'USER', action: 'DELETE', scope: 'ALL' },
    { resource: 'AUDIT', action: 'READ', scope: 'ALL' },
    { resource: 'MODERATION', action: 'CREATE', scope: 'ALL' },
    { resource: 'MODERATION', action: 'READ', scope: 'ALL' },
    { resource: 'MODERATION', action: 'UPDATE', scope: 'ALL' },
    { resource: 'MODERATION', action: 'DELETE', scope: 'ALL' },
  ],
  
  [UserRole.CLUB_PRESIDENT]: [
    // Club President can only manage their own club
    { resource: 'CLUB', action: 'READ', scope: 'OWN' },
    { resource: 'CLUB', action: 'UPDATE', scope: 'OWN' },
    { resource: 'ACTIVITY', action: 'CREATE', scope: 'OWN' },
    { resource: 'ACTIVITY', action: 'READ', scope: 'OWN' },
    { resource: 'ACTIVITY', action: 'UPDATE', scope: 'OWN' },
    { resource: 'ACTIVITY', action: 'DELETE', scope: 'OWN' },
    { resource: 'APPLICATION', action: 'READ', scope: 'OWN' },
    { resource: 'APPLICATION', action: 'UPDATE', scope: 'OWN' },
    { resource: 'USER', action: 'READ', scope: 'OWN' },
    { resource: 'USER', action: 'UPDATE', scope: 'OWN' },
  ],
  
  [UserRole.STUDENT]: [
    // Students have read-only access to public content
    { resource: 'CLUB', action: 'READ', scope: 'ALL' },
    { resource: 'ACTIVITY', action: 'READ', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'CREATE', scope: 'ALL' },
    { resource: 'APPLICATION', action: 'READ', scope: 'OWN' },
    { resource: 'USER', action: 'READ', scope: 'OWN' },
    { resource: 'USER', action: 'UPDATE', scope: 'OWN' },
  ],
};

/**
 * Check if user has permission for a specific resource and action
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  scope: 'OWN' | 'ALL' = 'ALL'
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  
  return rolePermissions.some(permission => 
    permission.resource === resource &&
    permission.action === action &&
    (permission.scope === 'ALL' || permission.scope === scope)
  );
}

/**
 * Middleware to require specific role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userRole) {
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
        await DatabaseUtils.logAudit({
          userId: req.userId,
          userRole: req.userRole,
          action: 'UNAUTHORIZED_ACCESS',
          resource: 'RBAC',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          errorMessage: `Role ${req.userRole} not in allowed roles: ${allowedRoles.join(', ')}`,
        });

        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions for this operation',
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization service error',
        },
      });
    }
  };
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(
  resource: string,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  scope: 'OWN' | 'ALL' = 'ALL'
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userRole) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      if (!hasPermission(req.userRole, resource, action, scope)) {
        // Log unauthorized access attempt
        await DatabaseUtils.logAudit({
          userId: req.userId,
          userRole: req.userRole,
          action: 'UNAUTHORIZED_ACCESS',
          resource: resource,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          errorMessage: `Permission denied: ${resource}:${action}:${scope}`,
        });

        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions for this operation',
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission authorization error:', error);
      res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization service error',
        },
      });
    }
  };
}

/**
 * Middleware to enforce club ownership for Club Presidents
 */
export function requireClubOwnership() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userRole || !req.userId) {
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
        const targetClubId = req.params.clubId || req.body.clubId || req.query.clubId;
        
        if (!targetClubId) {
          res.status(400).json({
            error: {
              code: 'MISSING_CLUB_ID',
              message: 'Club ID required for this operation',
            },
          });
          return;
        }

        // Check if user is president of the target club
        const club = await db.getClient().$queryRaw<Array<{ president_id: string }>>`
          SELECT president_id FROM clubs WHERE id = ${targetClubId}::uuid
        `;

        if (club.length === 0) {
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found',
            },
          });
          return;
        }

        if (club[0]!.president_id !== req.userId) {
          // Log unauthorized club access attempt
          await DatabaseUtils.logAudit({
            userId: req.userId,
            userRole: req.userRole,
            action: 'UNAUTHORIZED_CLUB_ACCESS',
            resource: 'CLUB',
            resourceId: targetClubId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: false,
            errorMessage: `Club President attempted to access club ${targetClubId} they don't own`,
          });

          res.status(403).json({
            error: {
              code: 'CLUB_ACCESS_DENIED',
              message: 'You can only access your own club resources',
            },
          });
          return;
        }
      }

      // Students cannot access club management functions
      if (req.userRole === UserRole.STUDENT) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Students cannot access club management functions',
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Club ownership authorization error:', error);
      res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization service error',
        },
      });
    }
  };
}

/**
 * Middleware to prevent cross-club access
 */
export function preventCrossClubAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userRole || !req.userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Super Admins can access anything
      if (req.userRole === UserRole.SUPER_ADMIN) {
        next();
        return;
      }

      // For Club Presidents, ensure they only access their club's resources
      if (req.userRole === UserRole.CLUB_PRESIDENT) {
        const resourceId = req.params.id || req.params.activityId || req.params.applicationId;
        
        if (resourceId) {
          // Check if the resource belongs to the user's club
          let query = '';
          let params = [resourceId, req.userId];

          if (req.route.path.includes('activities')) {
            const result = await db.getClient().$queryRaw<Array<{ id: string }>>`
              SELECT a.id FROM activities a 
              JOIN clubs c ON a.club_id = c.id 
              WHERE a.id = ${resourceId}::uuid AND c.president_id = ${req.userId}::uuid
            `;
            
            if (result.length === 0) {
              // Log cross-club access attempt
              await DatabaseUtils.logAudit({
                userId: req.userId,
                userRole: req.userRole,
                action: 'CROSS_CLUB_ACCESS_ATTEMPT',
                resource: 'ACTIVITY',
                resourceId: resourceId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: `Club President attempted to access resource ${resourceId} from another club`,
              });

              res.status(403).json({
                error: {
                  code: 'CROSS_CLUB_ACCESS_DENIED',
                  message: 'You can only access resources from your own club',
                },
              });
              return;
            }
          } else if (req.route.path.includes('applications')) {
            const result = await db.getClient().$queryRaw<Array<{ id: string }>>`
              SELECT app.id FROM applications app 
              JOIN clubs c ON app.club_id = c.id 
              WHERE app.id = ${resourceId}::uuid AND c.president_id = ${req.userId}::uuid
            `;
            
            if (result.length === 0) {
              // Log cross-club access attempt
              await DatabaseUtils.logAudit({
                userId: req.userId,
                userRole: req.userRole,
                action: 'CROSS_CLUB_ACCESS_ATTEMPT',
                resource: 'APPLICATION',
                resourceId: resourceId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: `Club President attempted to access resource ${resourceId} from another club`,
              });

              res.status(403).json({
                error: {
                  code: 'CROSS_CLUB_ACCESS_DENIED',
                  message: 'You can only access resources from your own club',
                },
              });
              return;
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('Cross-club access prevention error:', error);
      res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization service error',
        },
      });
    }
  };
}

// Convenience functions for common role checks
export const requireSuperAdmin = () => requireRole(UserRole.SUPER_ADMIN);
export const requireClubPresident = () => requireRole(UserRole.CLUB_PRESIDENT, UserRole.SUPER_ADMIN);
export const requireAuthenticated = () => requireRole(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT);