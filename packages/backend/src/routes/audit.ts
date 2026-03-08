/**
 * Audit Log API Routes
 * Provides endpoints for Super Admins to access and search audit logs
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authenticate, requireRole } from '../lib/middleware/auth';
import { auditLog } from '../lib/middleware/audit';
import { auditService, AuditFilters, AuditSearchQuery } from '../services/audit.service';

const router = Router();

// Validation schemas
const auditFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  userRole: z.nativeEnum(UserRole).optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  success: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ipAddress: z.string().ip().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

const searchQuerySchema = z.object({
  query: z.string().min(1),
  filters: auditFiltersSchema.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * GET /api/audit/logs
 * Get audit log entries with filtering and pagination
 * Requires: Super Admin role
 */
router.get('/logs',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('VIEW_AUDIT_LOGS', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      // Parse and validate query parameters
      const filters: AuditFilters = {};
      
      if (req.query.userId) {
        filters.userId = req.query.userId as string;
      }
      
      if (req.query.userRole) {
        filters.userRole = req.query.userRole as UserRole;
      }
      
      if (req.query.action) {
        filters.action = req.query.action as string;
      }
      
      if (req.query.resource) {
        filters.resource = req.query.resource as string;
      }
      
      if (req.query.resourceId) {
        filters.resourceId = req.query.resourceId as string;
      }
      
      if (req.query.success !== undefined) {
        filters.success = req.query.success === 'true';
      }
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.ipAddress) {
        filters.ipAddress = req.query.ipAddress as string;
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        filters.offset = parseInt(req.query.offset as string);
      }

      const auditEntries = await auditService.getAuditLog(filters);

      res.json({
        success: true,
        data: auditEntries,
        pagination: {
          limit: filters.limit || 100,
          offset: filters.offset || 0,
          total: auditEntries.length,
        },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_FETCH_ERROR',
          message: 'Failed to fetch audit logs',
        },
      });
    }
  }
);

/**
 * POST /api/audit/search
 * Search audit logs with text-based queries
 * Requires: Super Admin role
 */
router.post('/search',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('SEARCH_AUDIT_LOGS', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      const validatedData = searchQuerySchema.parse(req.body);
      
      // Convert date strings to Date objects in filters
      const searchQuery: AuditSearchQuery = {
        query: validatedData.query,
        limit: validatedData.limit,
        offset: validatedData.offset,
        filters: validatedData.filters ? {
          ...validatedData.filters,
          startDate: validatedData.filters.startDate ? new Date(validatedData.filters.startDate) : undefined,
          endDate: validatedData.filters.endDate ? new Date(validatedData.filters.endDate) : undefined,
        } : undefined
      };

      const searchResults = await auditService.searchAuditLog(searchQuery);

      res.json({
        success: true,
        data: searchResults,
        query: validatedData.query,
        pagination: {
          limit: validatedData.limit || 100,
          offset: validatedData.offset || 0,
          total: searchResults.length,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid search parameters',
            details: error.errors,
          },
        });
      }

      console.error('Error searching audit logs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_SEARCH_ERROR',
          message: 'Failed to search audit logs',
        },
      });
    }
  }
);

/**
 * GET /api/audit/statistics
 * Get audit log statistics and analytics
 * Requires: Super Admin role
 */
router.get('/statistics',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('VIEW_AUDIT_STATISTICS', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      // Parse optional date filters
      const filters: AuditFilters = {};
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      const statistics = await auditService.getAuditStatistics(filters);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Error fetching audit statistics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_STATISTICS_ERROR',
          message: 'Failed to fetch audit statistics',
        },
      });
    }
  }
);

/**
 * GET /api/audit/resource/:resource/:resourceId
 * Get audit trail for a specific resource
 * Requires: Super Admin role
 */
router.get('/resource/:resource/:resourceId',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('VIEW_RESOURCE_AUDIT_TRAIL', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      const { resource, resourceId } = req.params;

      // Validate resource ID format
      if (!resourceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
      }

      const auditTrail = await auditService.getResourceAuditTrail(resource, resourceId);

      res.json({
        success: true,
        data: auditTrail,
        resource,
        resourceId,
      });
    } catch (error) {
      console.error('Error fetching resource audit trail:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESOURCE_AUDIT_TRAIL_ERROR',
          message: 'Failed to fetch resource audit trail',
        },
      });
    }
  }
);

/**
 * GET /api/audit/user/:userId
 * Get user activity history
 * Requires: Super Admin role
 */
router.get('/user/:userId',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('VIEW_USER_ACTIVITY_HISTORY', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Validate user ID format
      if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID format',
          },
        });
      }

      // Parse optional filters
      const filters: AuditFilters = {};
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        filters.offset = parseInt(req.query.offset as string);
      }

      const activityHistory = await auditService.getUserActivityHistory(userId, filters);

      res.json({
        success: true,
        data: activityHistory,
        userId,
        pagination: {
          limit: filters.limit || 100,
          offset: filters.offset || 0,
          total: activityHistory.length,
        },
      });
    } catch (error) {
      console.error('Error fetching user activity history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'USER_ACTIVITY_HISTORY_ERROR',
          message: 'Failed to fetch user activity history',
        },
      });
    }
  }
);

/**
 * GET /api/audit/export
 * Export audit logs to JSON format
 * Requires: Super Admin role
 */
router.get('/export',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('EXPORT_AUDIT_LOGS', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      // Parse optional filters
      const filters: AuditFilters = {};
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.userRole) {
        filters.userRole = req.query.userRole as UserRole;
      }
      
      if (req.query.resource) {
        filters.resource = req.query.resource as string;
      }

      const auditLogs = await auditService.exportAuditLogs(filters);

      // Set headers for file download
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.json({
        exportDate: new Date().toISOString(),
        filters,
        totalEntries: auditLogs.length,
        data: auditLogs,
      });
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_EXPORT_ERROR',
          message: 'Failed to export audit logs',
        },
      });
    }
  }
);

/**
 * DELETE /api/audit/cleanup
 * Clean up old audit entries (maintenance endpoint)
 * Requires: Super Admin role
 */
router.delete('/cleanup',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  auditLog('CLEANUP_AUDIT_LOGS', 'AUDIT'),
  async (req: Request, res: Response) => {
    try {
      const olderThanDays = req.query.days ? parseInt(req.query.days as string) : 365;

      if (olderThanDays < 30) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CLEANUP_PERIOD',
            message: 'Cannot cleanup entries newer than 30 days',
          },
        });
      }

      const deletedCount = await auditService.cleanupOldEntries(olderThanDays);

      res.json({
        success: true,
        data: {
          deletedCount,
          olderThanDays,
        },
      });
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_CLEANUP_ERROR',
          message: 'Failed to cleanup audit logs',
        },
      });
    }
  }
);

export default router;