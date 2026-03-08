/**
 * Content Moderation Routes
 * Handles content flagging, review, and monitoring endpoints
 */

import express from 'express';
import { authenticate, requirePermission } from '../lib/middleware/auth';
import { validateBody, validateParams, validateQuery } from '../lib/validation/middleware';
import { validationSchemas } from '../lib/validation/schemas';
import { ModerationService, SuspiciousActivityService } from '../lib/moderation';
import {
  ContentType,
  ModerationStatus,
  ModerationPriority,
  ModerationAction,
  FlagCategory,
  SeverityLevel,
  AlertStatus
} from '../lib/moderation/types';
import { PERMISSIONS } from '../lib/auth/types';
import { DatabaseUtils } from '../lib/database';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const flagContentSchema = z.object({
  contentType: z.nativeEnum(ContentType),
  contentId: validationSchemas.base.uuid,
  flagCategory: z.nativeEnum(FlagCategory),
  flagReason: z.string().min(10).max(500),
  additionalInfo: z.string().max(1000).optional(),
});

const reviewContentSchema = z.object({
  action: z.nativeEnum(ModerationAction),
  comments: z.string().max(1000).optional(),
  editedContent: z.any().optional(),
});

const moderationIdSchema = z.object({
  moderationId: validationSchemas.base.uuid,
});

const contentIdSchema = z.object({
  contentId: validationSchemas.base.uuid,
});

const alertIdSchema = z.object({
  alertId: validationSchemas.base.uuid,
});

const reviewAlertSchema = z.object({
  status: z.nativeEnum(AlertStatus),
  resolutionNotes: z.string().max(1000).optional(),
});

const moderationFiltersSchema = z.object({
  status: z.nativeEnum(ModerationStatus).optional(),
  priority: z.nativeEnum(ModerationPriority).optional(),
  contentType: z.nativeEnum(ContentType).optional(),
  clubId: validationSchemas.base.uuid.optional(),
  authorId: validationSchemas.base.uuid.optional(),
  flaggedBy: validationSchemas.base.uuid.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

const alertFiltersSchema = z.object({
  status: z.nativeEnum(AlertStatus).optional(),
  severityLevel: z.nativeEnum(SeverityLevel).optional(),
  userId: validationSchemas.base.uuid.optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

/**
 * Flag content for review
 * POST /api/moderation/flag
 */
router.post('/flag', 
  authenticate, 
  requirePermission(PERMISSIONS.CONTENT_FLAG), 
  validateBody(flagContentSchema),
  async (req, res) => {
  try {
    const { contentType, contentId, flagCategory, flagReason, additionalInfo } = req.validatedData;

    const result = await ModerationService.flagContent(req.userId!, {
      contentType,
      contentId,
      flagCategory,
      flagReason,
      additionalInfo
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: result.error
        }
      });
    }

    // Monitor this action for suspicious activity
    await SuspiciousActivityService.monitorUserAction(
      req.userId!,
      'CONTENT_FLAG',
      'MODERATION',
      contentId,
      { contentType, flagCategory, flagReason }
    );

    res.json({
      success: true,
      message: 'Content flagged successfully',
      data: {
        flagId: result.flagId
      }
    });
  } catch (error) {
    console.error('Flag content error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to flag content'
      }
    });
  }
});

/**
 * Get content moderation queue (Super Admin only)
 * GET /api/moderation/queue
 */
router.get('/queue', 
  authenticate, 
  requirePermission(PERMISSIONS.CONTENT_MODERATE), 
  validateQuery(moderationFiltersSchema),
  async (req, res) => {
  try {
    const queryData = req.validatedData || req.query;
    const {
      status,
      priority,
      contentType,
      clubId,
      authorId,
      flaggedBy,
      dateFrom,
      dateTo,
      limit = '50',
      offset = '0'
    } = queryData;

    const filters: any = {};

    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (contentType) filters.contentType = contentType;
    if (clubId) filters.clubId = clubId;
    if (authorId) filters.authorId = authorId;
    if (flaggedBy) filters.flaggedBy = flaggedBy;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    filters.limit = parseInt(limit as string, 10);
    filters.offset = parseInt(offset as string, 10);

    const contentQueue = await ModerationService.getContentQueue(filters);

    res.json({
      success: true,
      data: contentQueue,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: contentQueue.length
      }
    });
  } catch (error) {
    console.error('Get content queue error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get content queue'
      }
    });
  }
});

/**
 * Review flagged content (Super Admin only)
 * POST /api/moderation/review/:moderationId
 */
router.post('/review/:moderationId', 
  authenticate, 
  requirePermission(PERMISSIONS.CONTENT_MODERATE), 
  validateParams(moderationIdSchema),
  validateBody(reviewContentSchema),
  async (req, res) => {
  try {
    const { moderationId } = req.validatedData.params;
    const { action, comments, editedContent } = req.validatedData;

    const result = await ModerationService.reviewContent(req.userId!, moderationId, {
      action,
      comments,
      editedContent
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: result.error
        }
      });
    }

    res.json({
      success: true,
      message: 'Content reviewed successfully'
    });
  } catch (error) {
    console.error('Review content error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to review content'
      }
    });
  }
});

/**
 * Get content moderation history
 * GET /api/moderation/history/:contentId
 */
router.get('/history/:contentId', 
  authenticate, 
  requirePermission(PERMISSIONS.CONTENT_MODERATE), 
  validateParams(contentIdSchema),
  async (req, res) => {
  try {
    const { contentId } = req.validatedData.params;

    const history = await ModerationService.getContentHistory(contentId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get content history error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get content history'
      }
    });
  }
});

/**
 * Get moderation statistics (Super Admin only)
 * GET /api/moderation/stats
 */
router.get('/stats', 
  authenticate, 
  requirePermission(PERMISSIONS.CONTENT_MODERATE), 
  async (req, res) => {
  try {
    const stats = await ModerationService.getModerationStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get moderation stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get moderation statistics'
      }
    });
  }
});

/**
 * Get suspicious activity alerts (Super Admin only)
 * GET /api/moderation/alerts
 */
router.get('/alerts', 
  authenticate, 
  requirePermission(PERMISSIONS.SYSTEM_MONITOR), 
  validateQuery(alertFiltersSchema),
  async (req, res) => {
  try {
    const queryData = req.validatedData || req.query;
    const {
      status,
      severityLevel,
      userId,
      limit = '50',
      offset = '0'
    } = queryData;

    const filters: any = {};

    if (status) filters.status = status;
    if (severityLevel) filters.severityLevel = severityLevel;
    if (userId) filters.userId = userId;

    filters.limit = parseInt(limit as string, 10);
    filters.offset = parseInt(offset as string, 10);

    const alerts = await SuspiciousActivityService.getAlerts(filters);

    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: alerts.length
      }
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get suspicious activity alerts'
      }
    });
  }
});

/**
 * Review suspicious activity alert (Super Admin only)
 * POST /api/moderation/alerts/:alertId/review
 */
router.post('/alerts/:alertId/review', 
  authenticate, 
  requirePermission(PERMISSIONS.SYSTEM_MONITOR), 
  validateParams(alertIdSchema),
  validateBody(reviewAlertSchema),
  async (req, res) => {
  try {
    const { alertId } = req.validatedData.params;
    const { status, resolutionNotes } = req.validatedData;

    const result = await SuspiciousActivityService.reviewAlert(
      alertId,
      req.userId!,
      status,
      resolutionNotes
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: result.error
        }
      });
    }

    res.json({
      success: true,
      message: 'Alert reviewed successfully'
    });
  } catch (error) {
    console.error('Review alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to review alert'
      }
    });
  }
});

/**
 * Get suspicious activity statistics (Super Admin only)
 * GET /api/moderation/alerts/stats
 */
router.get('/alerts/stats', 
  authenticate, 
  requirePermission(PERMISSIONS.SYSTEM_MONITOR), 
  async (req, res) => {
  try {
    const stats = await SuspiciousActivityService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get suspicious activity stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get suspicious activity statistics'
      }
    });
  }
});

export default router;