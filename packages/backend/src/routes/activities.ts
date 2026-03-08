/**
 * Activity Routes
 * Handles all activity-related HTTP endpoints with proper authentication and authorization
 */

import express from 'express';
import { ActivityStatus, UserRole } from '@prisma/client';
import ActivityService, { CreateActivityRequest, UpdateActivityRequest, ActivityFilters } from '../services/activity.service';
import { authenticate } from '../lib/middleware/auth';
import { requireAuthenticated } from '../lib/middleware/rbac';
import { auditLog } from '../lib/middleware/audit';
import { validateBody, validateParams, validateQuery } from '../lib/validation/middleware';
import { validationSchemas } from '../lib/validation/schemas';
import { z } from 'zod';

const router = express.Router();
const activityService = new ActivityService();

// Validation schemas
const activityIdSchema = z.object({
  id: validationSchemas.base.uuid,
});

const clubIdSchema = z.object({
  clubId: validationSchemas.base.uuid,
});

const createActivitySchema = z.object({
  clubId: validationSchemas.base.uuid,
  title: z.string().min(5).max(300),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().max(200).optional(),
  maxParticipants: z.number().int().positive().optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
});

const updateActivitySchema = z.object({
  title: z.string().min(5).max(300).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().max(200).optional(),
  maxParticipants: z.number().int().positive().optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
});

const activityFiltersSchema = z.object({
  clubId: validationSchemas.base.uuid.optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  createdBy: validationSchemas.base.uuid.optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  orderBy: z.enum(['startDate', 'createdAt', 'title']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

/**
 * Create a new activity
 * POST /api/activities
 * Requires: CLUB_PRESIDENT or SUPER_ADMIN role
 */
router.post('/', 
  requireAuthenticated(),
  validateBody(createActivitySchema),
  auditLog('CREATE_ACTIVITY', 'ACTIVITY', { captureBeforeState: false }),
  async (req, res) => {
  try {
    const { clubId, title, description, startDate, endDate, location, maxParticipants, status } = req.validatedData;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    const activityData: CreateActivityRequest = {
      clubId,
      title,
      description,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      location,
      maxParticipants,
      status: status || ActivityStatus.DRAFT
    };

    const activity = await activityService.createActivity(activityData, userId, userRole);

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: activity
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to create activity'
      }
    });
  }
});

/**
 * Get all activities with filtering and pagination
 * GET /api/activities
 * Query parameters: clubId, status, startDateFrom, startDateTo, search, page, limit, orderBy, orderDirection
 */
router.get('/', 
  validateQuery(activityFiltersSchema),
  async (req, res) => {
  try {
    const {
      clubId,
      status,
      startDateFrom,
      startDateTo,
      search,
      createdBy,
      page = '1',
      limit = '20',
      orderBy = 'startDate',
      orderDirection = 'asc'
    } = req.validatedData || req.query;

    const filters: ActivityFilters = {};

    if (clubId) filters.clubId = clubId as string;
    if (status) filters.status = status as ActivityStatus;
    if (createdBy) filters.createdBy = createdBy as string;
    if (search) filters.search = search as string;
    if (startDateFrom) filters.startDateFrom = new Date(startDateFrom as string);
    if (startDateTo) filters.startDateTo = new Date(startDateTo as string);

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const orderByField = ['startDate', 'createdAt', 'title'].includes(orderBy as string) 
      ? (orderBy as 'startDate' | 'createdAt' | 'title') 
      : 'startDate';
    const orderDir = orderDirection === 'desc' ? 'desc' : 'asc';

    const result = await activityService.listActivities(
      filters,
      pageNum,
      limitNum,
      orderByField,
      orderDir
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error listing activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve activities'
      }
    });
  }
});

/**
 * Get upcoming public activities
 * GET /api/activities/upcoming
 * Public endpoint for displaying upcoming published activities
 */
router.get('/upcoming', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string) || 10;

    const activities = await activityService.getUpcomingActivities(limitNum);

    res.json({
      success: true,
      data: {
        activities,
        count: activities.length
      }
    });
  } catch (error) {
    console.error('Error getting upcoming activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve upcoming activities'
      }
    });
  }
});

/**
 * Get activities for a specific club
 * GET /api/activities/club/:clubId
 * Public endpoint for club page display
 */
router.get('/club/:clubId', 
  validateParams(clubIdSchema),
  async (req, res) => {
  try {
    const { clubId } = req.validatedData.params;
    const { includeCompleted = 'true', limit } = req.query;

    const includeCompletedBool = includeCompleted === 'true';
    const limitNum = limit ? parseInt(limit as string) : undefined;

    const activities = await activityService.getClubActivities(
      clubId,
      includeCompletedBool,
      limitNum
    );

    res.json({
      success: true,
      data: {
        activities,
        count: activities.length
      }
    });
  } catch (error) {
    console.error('Error getting club activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve club activities'
      }
    });
  }
});

/**
 * Get a specific activity by ID
 * GET /api/activities/:id
 */
router.get('/:id', 
  validateParams(activityIdSchema),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const activity = await activityService.getActivity(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Activity not found'
        }
      });
    }

    // Check access permissions if user is authenticated
    if (req.user) {
      const hasAccess = await activityService.validateActivityAccess(
        id,
        req.user.userId,
        req.user.role,
        'READ'
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Access denied'
          }
        });
      }
    } else {
      // For unauthenticated users, only show published activities from active clubs
      if (activity.status !== ActivityStatus.PUBLISHED || !activity.club?.isActive) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Activity not found'
          }
        });
      }
    }

    res.json({ 
      success: true,
      data: activity 
    });
  } catch (error) {
    console.error('Error getting activity:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve activity'
      }
    });
  }
});

/**
 * Update an activity
 * PUT /api/activities/:id
 * Requires: CLUB_PRESIDENT (for own club) or SUPER_ADMIN role
 */
router.put('/:id', 
  requireAuthenticated(),
  validateParams(activityIdSchema),
  validateBody(updateActivitySchema),
  auditLog('UPDATE_ACTIVITY', 'ACTIVITY', { 
    captureBeforeState: true,
    customResourceId: (req) => req.params.id 
  }),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const { title, description, startDate, endDate, location, maxParticipants, status } = req.validatedData;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const updateData: UpdateActivityRequest = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants;
    if (status !== undefined) updateData.status = status;

    // Parse dates if provided
    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = new Date(endDate);
    }

    const activity = await activityService.updateActivity(id, updateData, userId, userRole);

    res.json({
      success: true,
      message: 'Activity updated successfully',
      data: activity
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to update activity'
      }
    });
  }
});

/**
 * Delete an activity
 * DELETE /api/activities/:id
 * Requires: CLUB_PRESIDENT (for own club) or SUPER_ADMIN role
 */
router.delete('/:id', 
  requireAuthenticated(),
  validateParams(activityIdSchema),
  auditLog('DELETE_ACTIVITY', 'ACTIVITY', { 
    captureBeforeState: true,
    customResourceId: (req) => req.params.id 
  }),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    await activityService.deleteActivity(id, userId, userRole);

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete activity'
      }
    });
  }
});

/**
 * Get activity version history
 * GET /api/activities/:id/history
 * Requires: CLUB_PRESIDENT (for own club) or SUPER_ADMIN role
 */
router.get('/:id/history', 
  requireAuthenticated(), 
  validateParams(activityIdSchema),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check if user has access to view this activity's history
    const hasAccess = await activityService.validateActivityAccess(
      id,
      userId,
      userRole,
      'READ'
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied'
        }
      });
    }

    const history = await activityService.getActivityVersionHistory(id);

    res.json({
      success: true,
      data: {
        history,
        count: history.length
      }
    });
  } catch (error) {
    console.error('Error getting activity history:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve activity history'
      }
    });
  }
});

/**
 * Rollback activity to a previous version
 * POST /api/activities/:id/rollback
 * Requires: CLUB_PRESIDENT (for own club) or SUPER_ADMIN role
 */
router.post('/:id/rollback', 
  requireAuthenticated(), 
  validateParams(activityIdSchema),
  validateBody(z.object({
    targetVersionId: validationSchemas.base.uuid
  })),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const { targetVersionId } = req.validatedData;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const activity = await activityService.rollbackActivity(id, targetVersionId, userId, userRole);

    res.json({
      success: true,
      message: 'Activity rolled back successfully',
      data: activity
    });
  } catch (error) {
    console.error('Error rolling back activity:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to rollback activity'
      }
    });
  }
});

/**
 * Compare two activity versions
 * GET /api/activities/:id/compare/:version1Id/:version2Id
 * Requires: CLUB_PRESIDENT (for own club) or SUPER_ADMIN role
 */
router.get('/:id/compare/:version1Id/:version2Id', 
  requireAuthenticated(), 
  validateParams(z.object({
    id: validationSchemas.base.uuid,
    version1Id: validationSchemas.base.uuid,
    version2Id: validationSchemas.base.uuid
  })),
  async (req, res) => {
  try {
    const { id, version1Id, version2Id } = req.validatedData.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check if user has access to view this activity's history
    const hasAccess = await activityService.validateActivityAccess(
      id,
      userId,
      userRole,
      'READ'
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied'
        }
      });
    }

    const comparison = await activityService.compareActivityVersions(id, version1Id, version2Id);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing activity versions:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to compare activity versions'
      }
    });
  }
});

/**
 * Update activity statuses (scheduled task endpoint)
 * POST /api/activities/update-statuses
 * Requires: SUPER_ADMIN role (typically called by scheduled tasks)
 */
router.post('/update-statuses', requireAuthenticated(), async (req, res) => {
  try {
    const userRole = req.user!.role;

    if (userRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied: Super Admin role required'
        }
      });
    }

    const updatedCount = await activityService.updateActivityStatuses();

    res.json({
      success: true,
      message: 'Activity statuses updated successfully',
      data: {
        updatedCount
      }
    });
  } catch (error) {
    console.error('Error updating activity statuses:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update activity statuses'
      }
    });
  }
});

export default router;