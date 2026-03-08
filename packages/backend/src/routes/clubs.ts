/**
 * Club Routes
 * Handles HTTP requests for club management operations
 */

import express from 'express';
import { ClubService, CreateClubRequest, UpdateClubRequest } from '../services/club.service';
import ClubCleanupService from '../services/club-cleanup.service';
import { authenticate } from '../lib/middleware/auth';
import { requireSuperAdmin, requireClubPresident, requireClubOwnership, preventCrossClubAccess } from '../lib/middleware/rbac';
import { auditLog } from '../lib/middleware/audit';
import { validateBody, validateParams, validateQuery } from '../lib/validation/middleware';
import { validationSchemas } from '../lib/validation/schemas';
import { businessRuleSets } from '../lib/validation/business-rules';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const router = express.Router();
const clubService = new ClubService();
const clubCleanupService = new ClubCleanupService();

// Validation schemas for route parameters
const clubIdSchema = z.object({
  id: validationSchemas.base.uuid,
});

const clubSlugSchema = z.object({
  slug: validationSchemas.base.urlSlug,
});

/**
 * GET /api/clubs
 * List all clubs with filtering and pagination
 * Accessible by: All roles (with different visibility rules)
 */
router.get('/', 
  authenticate,
  validateQuery(validationSchemas.query.clubFilters),
  async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search, 
      isActive,
      presidentId 
    } = req.query;

    const filters: any = {};
    
    // Apply role-based filtering
    if (req.user?.role === UserRole.STUDENT) {
      // Students can only see active clubs
      filters.isActive = true;
    } else if (req.user?.role === UserRole.CLUB_PRESIDENT) {
      // Club presidents can see their own clubs (including inactive)
      filters.presidentId = req.user.userId;
    } else if (req.user?.role === UserRole.SUPER_ADMIN) {
      // Super admins can see all clubs with optional filtering
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }
      if (presidentId) {
        filters.presidentId = presidentId as string;
      }
    }

    if (search) {
      filters.search = search as string;
    }

    const result = await clubService.listClubs(
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error listing clubs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list clubs',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/clubs/:id
 * Get a specific club by ID
 * Accessible by: All roles (with access validation)
 */
router.get('/:id', 
  authenticate,
  validateParams(clubIdSchema),
  preventCrossClubAccess(),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    
    const club = await clubService.getClub(id);
    
    if (!club) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found'
        }
      });
    }

    res.json({
      success: true,
      data: club
    });
  } catch (error) {
    console.error('Error getting club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/clubs/slug/:slug
 * Get a club by URL slug (for public access)
 * Accessible by: All roles
 */
router.get('/slug/:slug', 
  authenticate,
  validateParams(clubSlugSchema),
  async (req, res) => {
  try {
    const { slug } = req.params;
    
    const club = await clubService.getClubBySlug(slug);
    
    if (!club) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found'
        }
      });
    }

    // Students can only see active clubs
    if (req.user?.role === UserRole.STUDENT && !club.isActive) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found'
        }
      });
    }

    res.json({
      success: true,
      data: club
    });
  } catch (error) {
    console.error('Error getting club by slug:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/clubs
 * Create a new club
 * Accessible by: Super Admin only
 */
router.post('/', 
  authenticate, 
  requireSuperAdmin(),
  validateBody(validationSchemas.club.createClub, businessRuleSets.createClub),
  auditLog('CREATE_CLUB', 'CLUB', { captureBeforeState: false }),
  async (req, res) => {
  try {
    const club = await clubService.createClub(req.validatedData, req.user!.userId);

    res.status(201).json({
      success: true,
      data: club,
      message: 'Club created successfully'
    });
  } catch (error) {
    console.error('Error creating club:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * PUT /api/clubs/:id
 * Update a club
 * Accessible by: Super Admin and Club President (for their own club)
 */
router.put('/:id', 
  authenticate,
  requireClubPresident(),
  validateParams(clubIdSchema),
  validateBody(validationSchemas.club.updateClub, businessRuleSets.updateClub),
  requireClubOwnership(),
  auditLog('UPDATE_CLUB', 'CLUB', { 
    captureBeforeState: true,
    customResourceId: (req) => req.validatedData.params.id 
  }),
  async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData;

    // Club presidents can only update certain fields
    if (req.user!.role === UserRole.CLUB_PRESIDENT) {
      const allowedFields = ['description'];
      const updateFields = Object.keys(updateData);
      const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            message: `Club presidents can only update: ${allowedFields.join(', ')}`
          }
        });
      }
    }

    const club = await clubService.updateClub(id, updateData, req.user!.userId);

    res.json({
      success: true,
      data: club,
      message: 'Club updated successfully'
    });
  } catch (error) {
    console.error('Error updating club:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          message: error.message
        }
      });
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/clubs/:id/deletion-info
 * Get detailed information for club deletion confirmation
 * Accessible by: Super Admin only
 */
router.get('/:id/deletion-info', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [deletionInfo, validation, confirmation] = await Promise.all([
      clubCleanupService.getClubDeletionInfo(id),
      clubCleanupService.validateDeletion(id),
      clubCleanupService.getCleanupConfirmation(id)
    ]);

    res.json({
      success: true,
      data: {
        ...deletionInfo,
        validation,
        confirmation
      }
    });
  } catch (error) {
    console.error('Error getting club deletion info:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
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
        message: 'Failed to get club deletion info',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/clubs/:id/archive
 * Archive a club instead of deleting it
 * Accessible by: Super Admin only
 */
router.post('/:id/archive', 
  authenticate, 
  requireSuperAdmin,
  auditLog('ARCHIVE_CLUB', 'CLUB', { 
    captureBeforeState: true,
    customResourceId: (req) => req.params.id 
  }),
  async (req, res) => {
  try {
    const { id } = req.params;

    await clubCleanupService.archiveClub(id, req.user!.userId);

    res.json({
      success: true,
      message: 'Club archived successfully. It has been deactivated and future activities cancelled.'
    });
  } catch (error) {
    console.error('Error archiving club:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
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
        message: 'Failed to archive club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * DELETE /api/clubs/:id
 * Delete a club and all associated resources
 * Accessible by: Super Admin only
 */
router.delete('/:id', 
  authenticate, 
  requireSuperAdmin,
  auditLog('DELETE_CLUB', 'CLUB', { 
    captureBeforeState: true,
    customResourceId: (req) => req.params.id 
  }),
  async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmed } = req.body;

    // Get cleanup confirmation first
    const confirmation = await clubCleanupService.getCleanupConfirmation(id);
    
    // If confirmation is required and not provided, return confirmation details
    if (confirmation.confirmationRequired && !confirmed) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Deletion confirmation required',
          code: 'CONFIRMATION_REQUIRED'
        },
        data: confirmation
      });
    }

    // Validate deletion
    const validation = await clubCleanupService.validateDeletion(id);
    if (!validation.canDelete) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Club cannot be safely deleted',
          code: 'DELETION_BLOCKED',
          issues: validation.issues
        }
      });
    }

    // Perform the cleanup
    const report = await clubCleanupService.performCleanup(id, req.user!.userId);

    if (report.success) {
      res.json({
        success: true,
        message: 'Club and all associated resources deleted successfully',
        data: report
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Club deletion completed with errors',
          code: 'PARTIAL_FAILURE'
        },
        data: report
      });
    }
  } catch (error) {
    console.error('Error deleting club:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
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
        message: 'Failed to delete club',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/clubs/:id/url
 * Get the public URL for a club
 * Accessible by: All roles
 */
router.get('/:id/url', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const club = await clubService.getClub(id, false);
    
    if (!club) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found'
        }
      });
    }

    const url = clubService.generateClubUrl(club.urlSlug);

    res.json({
      success: true,
      data: {
        clubId: club.id,
        clubName: club.name,
        urlSlug: club.urlSlug,
        publicUrl: url,
        fullUrl: `${req.protocol}://${req.get('host')}${url}`
      }
    });
  } catch (error) {
    console.error('Error getting club URL:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get club URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;