/**
 * Enhanced Audit Middleware for comprehensive logging
 * Provides before/after state tracking and detailed audit logging
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { auditService } from '../../services/audit.service';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        action: string;
        resource: string;
        beforeState?: any;
        skipAudit?: boolean;
      };
    }
  }
}

/**
 * Enhanced audit logging middleware with before/after state tracking
 */
export const auditLog = (action: string, resource: string, options: {
  captureBeforeState?: boolean;
  skipOnError?: boolean;
  customResourceId?: (req: Request) => string | undefined;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Set audit context
      req.auditContext = {
        action,
        resource,
        skipAudit: false,
      };

      // Capture before state if requested
      if (options.captureBeforeState) {
        req.auditContext.beforeState = await captureResourceState(req, resource);
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      const originalSend = res.send;

      let responseBody: any;

      // Override res.json to capture response
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      // Override res.send to capture response
      res.send = function(body: any) {
        if (!responseBody) {
          responseBody = body;
        }
        return originalSend.call(this, body);
      };

      // Handle response completion
      res.on('finish', async () => {
        try {
          // Skip audit if explicitly requested or if it's a GET request and failed
          if (req.auditContext?.skipAudit || 
              (req.method === 'GET' && res.statusCode >= 400 && options.skipOnError)) {
            return;
          }

          const success = res.statusCode < 400;
          let afterState: any;

          // Capture after state for successful operations that modify data
          if (success && options.captureBeforeState && 
              ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            afterState = await captureResourceState(req, resource);
          }

          // Determine resource ID
          let resourceId: string | undefined;
          if (options.customResourceId) {
            resourceId = options.customResourceId(req);
          } else {
            resourceId = req.params.id || req.params.clubId || req.params.activityId || 
                        req.params.applicationId || req.params.userId;
          }

          // If we created a new resource, try to get the ID from response
          if (!resourceId && req.method === 'POST' && success && responseBody) {
            resourceId = responseBody.id || responseBody.data?.id;
          }

          await auditService.logAction({
            userId: req.userId,
            userRole: req.userRole || UserRole.STUDENT,
            action,
            resource,
            resourceId,
            beforeState: req.auditContext?.beforeState,
            afterState,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success,
            errorMessage: success ? undefined : getErrorMessage(responseBody),
          });
        } catch (error) {
          console.error('Audit logging error:', error);
          // Don't throw error to avoid breaking the response
        }
      });

      next();
    } catch (error) {
      console.error('Audit middleware error:', error);
      next(); // Continue without audit logging
    }
  };
};

/**
 * Middleware to skip audit logging for the current request
 */
export const skipAudit = (req: Request, res: Response, next: NextFunction): void => {
  if (req.auditContext) {
    req.auditContext.skipAudit = true;
  }
  next();
};

/**
 * Middleware for logging bulk operations
 */
export const auditBulkOperation = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      const success = res.statusCode < 400;
      
      // Log bulk operation
      auditService.logAction({
        userId: req.userId,
        userRole: req.userRole || UserRole.STUDENT,
        action: `BULK_${action}`,
        resource,
        beforeState: req.body,
        afterState: success ? body : undefined,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage: success ? undefined : getErrorMessage(body),
      }).catch(console.error);

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Capture the current state of a resource before modification
 */
async function captureResourceState(req: Request, resource: string): Promise<any> {
  try {
    const { prisma } = await import('../database');
    
    // Determine resource ID
    const resourceId = req.params.id || req.params.clubId || req.params.activityId || 
                      req.params.applicationId || req.params.userId;

    if (!resourceId) {
      return null;
    }

    // Capture state based on resource type
    switch (resource.toLowerCase()) {
      case 'club':
      case 'clubs':
        return await prisma.club.findUnique({
          where: { id: resourceId },
          include: {
            president: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        });

      case 'activity':
      case 'activities':
        return await prisma.activity.findUnique({
          where: { id: resourceId },
          include: {
            club: {
              select: { id: true, name: true }
            },
            creator: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        });

      case 'application':
      case 'applications':
        return await prisma.application.findUnique({
          where: { id: resourceId },
          include: {
            club: {
              select: { id: true, name: true }
            },
            student: {
              select: { id: true, email: true, firstName: true, lastName: true }
            },
            reviewer: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        });

      case 'user':
      case 'users':
        return await prisma.user.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            totpEnabled: true,
            createdAt: true,
            updatedAt: true
          }
        });

      default:
        return null;
    }
  } catch (error) {
    console.error('Error capturing resource state:', error);
    return null;
  }
}

/**
 * Extract error message from response body
 */
function getErrorMessage(responseBody: any): string | undefined {
  if (!responseBody) return undefined;
  
  if (typeof responseBody === 'string') {
    return responseBody;
  }
  
  if (responseBody.error) {
    return responseBody.error.message || responseBody.error;
  }
  
  if (responseBody.message) {
    return responseBody.message;
  }
  
  return undefined;
}

/**
 * Middleware for logging authentication events
 */
export const auditAuth = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      const success = res.statusCode < 400;
      
      auditService.logAction({
        userId: req.userId || (req.body?.email ? undefined : req.userId),
        userRole: req.userRole || UserRole.STUDENT,
        action,
        resource: 'AUTH',
        beforeState: {
          email: req.body?.email,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        },
        afterState: success ? { success: true } : undefined,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage: success ? undefined : getErrorMessage(body),
      }).catch(console.error);

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for logging content moderation actions
 */
export const auditModeration = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      const success = res.statusCode < 400;
      
      auditService.logAction({
        userId: req.userId,
        userRole: req.userRole || UserRole.SUPER_ADMIN,
        action: `MODERATION_${action}`,
        resource: 'CONTENT',
        resourceId: req.params.contentId || req.params.id,
        beforeState: req.body,
        afterState: success ? body : undefined,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage: success ? undefined : getErrorMessage(body),
      }).catch(console.error);

      return originalJson.call(this, body);
    };

    next();
  };
};