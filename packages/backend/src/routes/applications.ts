/**
 * Application Routes
 * 
 * This module defines all HTTP endpoints for application management including:
 * - Application submission by students
 * - Application review by club presidents
 * - Application listing and filtering
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { ApplicationService } from '../lib/application';
import { NotificationService } from '../services/notification.service';
import { authenticate, requireRole } from '../lib/middleware/auth';
import { validateBody, validateParams, validateQuery } from '../lib/validation/middleware';
import { validationSchemas } from '../lib/validation/schemas';
import { CreateApplicationRequest, UpdateApplicationStatusRequest, ApplicationFilters } from '../lib/application/types';
import { z } from 'zod';

export function createApplicationRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const applicationService = new ApplicationService(prisma);
  const notificationService = new NotificationService(prisma);

  // Validation schemas
  const applicationIdSchema = z.object({
    id: validationSchemas.base.uuid,
  });

  const clubIdSchema = z.object({
    clubId: validationSchemas.base.uuid,
  });

  const createApplicationSchema = z.object({
    clubId: validationSchemas.base.uuid,
    studentName: z.string().min(2).max(200),
    studentEmail: validationSchemas.base.email,
    motivation: z.string().min(50).max(1000),
    studentId: validationSchemas.base.uuid.optional(),
  });

  const updateApplicationStatusSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewComments: z.string().max(500).optional(),
  });

  const applicationFiltersSchema = z.object({
    clubId: validationSchemas.base.uuid.optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    studentEmail: validationSchemas.base.email.optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  });

  /**
   * Submit a new application to join a club
   * POST /api/applications
   * Public endpoint - no authentication required for students
   */
  router.post('/', 
    validateBody(createApplicationSchema),
    async (req: Request, res: Response) => {
    try {
      const applicationData: CreateApplicationRequest = req.validatedData;

      // Check if student has already applied to this club
      const hasApplied = await applicationService.hasStudentApplied(
        applicationData.clubId, 
        applicationData.studentEmail
      );

      if (hasApplied) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_APPLICATION',
            message: 'You have already submitted an application to this club'
          }
        });
      }

      // If user is authenticated, use their ID
      if (req.user) {
        applicationData.studentId = req.user.userId;
      }

      const application = await applicationService.submitApplication(applicationData);

      // Send notification to club president
      const applicationWithClub = await applicationService.getApplicationWithClubInfo(application.id);
      if (applicationWithClub) {
        await notificationService.notifyApplicationSubmitted({
          type: 'APPLICATION_SUBMITTED',
          applicationId: application.id,
          clubName: applicationWithClub.clubName,
          studentEmail: application.studentEmail
        });
      }

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: application
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: error.message || 'Failed to submit application'
        }
      });
    }
  });

  /**
   * Get a specific application by ID
   * GET /api/applications/:id
   * Requires authentication - users can only see their own applications or club presidents can see applications to their club
   */
  router.get('/:id', 
    authenticate, 
    validateParams(applicationIdSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.validatedData.params;
      const application = await applicationService.getApplicationWithClubInfo(id);

      if (!application) {
        return res.status(404).json({ 
          success: false,
          error: {
            message: 'Application not found'
          }
        });
      }

      // Authorization check
      const canView = 
        req.user?.role === 'SUPER_ADMIN' ||
        (req.user?.role === 'CLUB_PRESIDENT' && req.user.clubId === application.clubId) ||
        (req.user?.role === 'STUDENT' && req.user.userId === application.studentId);

      if (!canView) {
        return res.status(403).json({ 
          success: false,
          error: {
            message: 'Access denied'
          }
        });
      }

      res.json({
        success: true,
        data: application
      });
    } catch (error: any) {
      console.error('Error getting application:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: 'Failed to get application'
        }
      });
    }
  });

  /**
   * List applications with filtering
   * GET /api/applications
   * Requires authentication - returns applications based on user role
   */
  router.get('/', 
    authenticate, 
    validateQuery(applicationFiltersSchema),
    async (req: Request, res: Response) => {
    try {
      const filters: ApplicationFilters = {};

      // Apply role-based filtering
      if (req.user?.role === 'CLUB_PRESIDENT') {
        filters.clubId = req.user.clubId;
      } else if (req.user?.role === 'STUDENT') {
        // Students can only see their own applications
        filters.studentId = req.userId;
      }
      // SUPER_ADMIN can see all applications

      // Apply query parameters from validated data
      const queryData = req.validatedData || req.query;
      if (queryData.clubId) {
        filters.clubId = queryData.clubId as string;
      }
      if (queryData.status) {
        filters.status = queryData.status as any;
      }
      if (queryData.studentEmail) {
        filters.studentEmail = queryData.studentEmail as string;
      }
      if (queryData.limit) {
        filters.limit = parseInt(queryData.limit as string);
      }
      if (queryData.offset) {
        filters.offset = parseInt(queryData.offset as string);
      }

      const applications = await applicationService.listApplicationsWithClubInfo(filters);
      res.json({
        success: true,
        data: applications
      });
    } catch (error: any) {
      console.error('Error listing applications:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: 'Failed to list applications'
        }
      });
    }
  });

  /**
   * Update application status (approve/reject)
   * PUT /api/applications/:id/status
   * Requires CLUB_PRESIDENT or SUPER_ADMIN role
   */
  router.put('/:id/status', 
    authenticate, 
    validateParams(applicationIdSchema),
    validateBody(updateApplicationStatusSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.validatedData.params;
      const statusUpdate: UpdateApplicationStatusRequest = req.validatedData;

      // Get the application to check permissions
      const application = await applicationService.getApplicationWithClubInfo(id);
      if (!application) {
        return res.status(404).json({ 
          success: false,
          error: {
            message: 'Application not found'
          }
        });
      }

      // Authorization check
      const canReview = 
        req.user?.role === 'SUPER_ADMIN' ||
        (req.user?.role === 'CLUB_PRESIDENT' && req.user.clubId === application.clubId);

      if (!canReview) {
        return res.status(403).json({ 
          success: false,
          error: {
            message: 'Access denied'
          }
        });
      }

      // Prevent reviewing already reviewed applications
      if (application.status !== 'PENDING') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_REVIEWED',
            message: `Application has already been ${application.status.toLowerCase()}`
          }
        });
      }

      const updatedApplication = await applicationService.updateApplicationStatus(
        id,
        statusUpdate,
        req.user!.userId
      );

      // Send notification to student
      await notificationService.notifyApplicationReviewed({
        type: 'APPLICATION_REVIEWED',
        applicationId: updatedApplication.id,
        clubName: application.clubName,
        studentEmail: updatedApplication.studentEmail,
        status: updatedApplication.status,
        reviewComments: updatedApplication.reviewComments
      });

      res.json({
        success: true,
        message: 'Application status updated successfully',
        data: updatedApplication
      });
    } catch (error: any) {
      console.error('Error updating application status:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: error.message || 'Failed to update application status'
        }
      });
    }
  });

  /**
   * Get application summary statistics for a club
   * GET /api/applications/summary/:clubId
   * Requires CLUB_PRESIDENT or SUPER_ADMIN role
   */
  router.get('/summary/:clubId', 
    authenticate, 
    validateParams(clubIdSchema),
    async (req: Request, res: Response) => {
    try {
      const { clubId } = req.validatedData.params;

      // Authorization check
      const canView = 
        req.user?.role === 'SUPER_ADMIN' ||
        (req.user?.role === 'CLUB_PRESIDENT' && req.user.clubId === clubId);

      if (!canView) {
        return res.status(403).json({ 
          success: false,
          error: {
            message: 'Access denied'
          }
        });
      }

      const summary = await applicationService.getApplicationSummary(clubId);
      res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      console.error('Error getting application summary:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: 'Failed to get application summary'
        }
      });
    }
  });

  /**
   * Delete an application (for cleanup purposes)
   * DELETE /api/applications/:id
   * Requires SUPER_ADMIN role
   */
  router.delete('/:id', 
    authenticate, 
    requireRole(UserRole.SUPER_ADMIN), 
    validateParams(applicationIdSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.validatedData.params;
      await applicationService.deleteApplication(id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting application:', error);
      if (error.message === 'Application not found') {
        return res.status(404).json({ 
          success: false,
          error: {
            message: error.message
          }
        });
      }
      res.status(500).json({ 
        success: false,
        error: {
          message: 'Failed to delete application'
        }
      });
    }
  });

  /**
   * Check if a student has already applied to a club
   * GET /api/applications/check/:clubId/:email
   * Public endpoint
   */
  router.get('/check/:clubId/:email', 
    validateParams(z.object({
      clubId: validationSchemas.base.uuid,
      email: validationSchemas.base.email
    })),
    async (req: Request, res: Response) => {
    try {
      const { clubId, email } = req.validatedData.params;
      const hasApplied = await applicationService.hasStudentApplied(clubId, email);
      res.json({ 
        success: true,
        data: {
          hasApplied
        }
      });
    } catch (error: any) {
      console.error('Error checking application status:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: 'Failed to check application status'
        }
      });
    }
  });

  return router;
}