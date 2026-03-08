/**
 * Club Infrastructure Management
 * Handles dynamic creation and management of club-specific infrastructure
 * including URL routing, dashboard generation, and resource management.
 */

import { Express, Router } from 'express';
import { ClubService } from '../services/club.service';
import { authenticate } from './middleware/auth';
import { UserRole } from '@prisma/client';

export interface ClubInfrastructure {
  clubId: string;
  clubSlug: string;
  publicRoute: string;
  dashboardRoute: string;
  router: Router;
}

export class ClubInfrastructureManager {
  private clubService: ClubService;
  private registeredClubs: Map<string, ClubInfrastructure> = new Map();
  private app: Express | null = null;

  constructor() {
    this.clubService = new ClubService();
  }

  /**
   * Initialize the infrastructure manager with the Express app
   */
  initialize(app: Express): void {
    this.app = app;
    this.setupDynamicRouting();
  }

  /**
   * Setup dynamic routing for clubs
   */
  private setupDynamicRouting(): void {
    if (!this.app) return;

    // Dynamic club public page route
    this.app.get('/kulup/:slug', async (req, res) => {
      try {
        const { slug } = req.params;
        const club = await this.clubService.getClubBySlug(slug, true);

        if (!club || !club.isActive) {
          return res.status(404).json({
            error: {
              message: 'Club not found',
              code: 'CLUB_NOT_FOUND'
            }
          });
        }

        // Return club public page data
        res.json({
          success: true,
          data: {
            club: {
              id: club.id,
              name: club.name,
              description: club.description,
              urlSlug: club.urlSlug,
              president: club.president ? {
                firstName: club.president.firstName,
                lastName: club.president.lastName,
                email: club.president.email
              } : null,
              isActive: club.isActive,
              createdAt: club.createdAt
            },
            publicUrl: `/kulup/${club.urlSlug}`,
            dashboardUrl: `/dashboard/club/${club.urlSlug}`
          }
        });
      } catch (error) {
        console.error('Error serving club public page:', error);
        res.status(500).json({
          error: {
            message: 'Failed to load club page',
            code: 'INTERNAL_ERROR'
          }
        });
      }
    });

    // Dynamic club dashboard route (for club presidents)
    this.app.get('/dashboard/club/:slug', authenticate, async (req, res) => {
      try {
        const { slug } = req.params;
        const club = await this.clubService.getClubBySlug(slug, true);

        if (!club) {
          return res.status(404).json({
            error: {
              message: 'Club not found',
              code: 'CLUB_NOT_FOUND'
            }
          });
        }

        // Validate access - only club president or super admin
        const hasAccess = await this.clubService.validateClubAccess(
          club.id,
          req.user!.userId,
          req.user!.role as UserRole
        );

        if (!hasAccess) {
          return res.status(403).json({
            error: {
              message: 'Access denied to club dashboard',
              code: 'ACCESS_DENIED'
            }
          });
        }

        // Return club dashboard data
        res.json({
          success: true,
          data: {
            club: {
              id: club.id,
              name: club.name,
              description: club.description,
              urlSlug: club.urlSlug,
              president: club.president,
              isActive: club.isActive,
              createdAt: club.createdAt,
              updatedAt: club.updatedAt
            },
            dashboardConfig: {
              canEditClub: req.user!.role === UserRole.SUPER_ADMIN || 
                          (req.user!.role === UserRole.CLUB_PRESIDENT && club.presidentId === req.user!.userId),
              canManageActivities: req.user!.role === UserRole.SUPER_ADMIN || 
                                 (req.user!.role === UserRole.CLUB_PRESIDENT && club.presidentId === req.user!.userId),
              canViewApplications: req.user!.role === UserRole.SUPER_ADMIN || 
                                 (req.user!.role === UserRole.CLUB_PRESIDENT && club.presidentId === req.user!.userId),
              canDeleteClub: req.user!.role === UserRole.SUPER_ADMIN
            },
            navigation: {
              publicUrl: `/kulup/${club.urlSlug}`,
              dashboardUrl: `/dashboard/club/${club.urlSlug}`,
              activitiesUrl: `/dashboard/club/${club.urlSlug}/activities`,
              applicationsUrl: `/dashboard/club/${club.urlSlug}/applications`
            }
          }
        });
      } catch (error) {
        console.error('Error serving club dashboard:', error);
        res.status(500).json({
          error: {
            message: 'Failed to load club dashboard',
            code: 'INTERNAL_ERROR'
          }
        });
      }
    });
  }

  /**
   * Create infrastructure for a new club
   */
  async createClubInfrastructure(clubId: string): Promise<ClubInfrastructure> {
    const club = await this.clubService.getClub(clubId, false);
    
    if (!club) {
      throw new Error('Club not found');
    }

    const infrastructure: ClubInfrastructure = {
      clubId: club.id,
      clubSlug: club.urlSlug,
      publicRoute: `/kulup/${club.urlSlug}`,
      dashboardRoute: `/dashboard/club/${club.urlSlug}`,
      router: this.createClubRouter(club.id, club.urlSlug)
    };

    this.registeredClubs.set(clubId, infrastructure);
    
    console.log(`Created infrastructure for club: ${club.name} (${club.urlSlug})`);
    
    return infrastructure;
  }

  /**
   * Create a dedicated router for a club
   */
  private createClubRouter(clubId: string, clubSlug: string): Router {
    const router = Router();

    // Club-specific API endpoints
    router.get('/info', async (req, res) => {
      try {
        const club = await this.clubService.getClub(clubId, true);
        if (!club) {
          return res.status(404).json({ error: 'Club not found' });
        }
        res.json({ success: true, data: club });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get club info' });
      }
    });

    router.get('/activities', async (req, res) => {
      // This will be implemented when activity service is ready
      res.json({ 
        success: true, 
        data: [], 
        message: 'Activity management not yet implemented' 
      });
    });

    router.get('/applications', authenticate, async (req, res) => {
      // This will be implemented when application service is ready
      res.json({ 
        success: true, 
        data: [], 
        message: 'Application management not yet implemented' 
      });
    });

    return router;
  }

  /**
   * Remove infrastructure for a deleted club
   */
  async removeClubInfrastructure(clubId: string): Promise<void> {
    const infrastructure = this.registeredClubs.get(clubId);
    
    if (infrastructure) {
      // Remove from registry
      this.registeredClubs.delete(clubId);
      
      console.log(`Removed infrastructure for club: ${clubId} (${infrastructure.clubSlug})`);
    }
  }

  /**
   * Update infrastructure when club slug changes
   */
  async updateClubInfrastructure(clubId: string, newSlug: string): Promise<void> {
    const infrastructure = this.registeredClubs.get(clubId);
    
    if (infrastructure) {
      // Update the infrastructure
      infrastructure.clubSlug = newSlug;
      infrastructure.publicRoute = `/kulup/${newSlug}`;
      infrastructure.dashboardRoute = `/dashboard/club/${newSlug}`;
      infrastructure.router = this.createClubRouter(clubId, newSlug);
      
      console.log(`Updated infrastructure for club: ${clubId} (new slug: ${newSlug})`);
    }
  }

  /**
   * Get all registered club infrastructures
   */
  getRegisteredClubs(): ClubInfrastructure[] {
    return Array.from(this.registeredClubs.values());
  }

  /**
   * Get infrastructure for a specific club
   */
  getClubInfrastructure(clubId: string): ClubInfrastructure | undefined {
    return this.registeredClubs.get(clubId);
  }

  /**
   * Initialize infrastructure for all existing clubs
   */
  async initializeExistingClubs(): Promise<void> {
    try {
      const { clubs } = await this.clubService.listClubs({}, 1, 1000); // Get all clubs
      
      for (const club of clubs) {
        await this.createClubInfrastructure(club.id);
      }
      
      console.log(`Initialized infrastructure for ${clubs.length} existing clubs`);
    } catch (error) {
      console.error('Error initializing existing clubs:', error);
    }
  }

  /**
   * Generate management dashboard configuration for a club
   */
  async generateDashboardConfig(clubId: string, userId: string, userRole: UserRole) {
    const club = await this.clubService.getClub(clubId, true);
    
    if (!club) {
      throw new Error('Club not found');
    }

    const hasAccess = await this.clubService.validateClubAccess(clubId, userId, userRole);
    
    if (!hasAccess) {
      throw new Error('Access denied to club dashboard');
    }

    return {
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        urlSlug: club.urlSlug,
        president: club.president,
        isActive: club.isActive
      },
      permissions: {
        canEditClub: userRole === UserRole.SUPER_ADMIN || 
                    (userRole === UserRole.CLUB_PRESIDENT && club.presidentId === userId),
        canManageActivities: userRole === UserRole.SUPER_ADMIN || 
                           (userRole === UserRole.CLUB_PRESIDENT && club.presidentId === userId),
        canViewApplications: userRole === UserRole.SUPER_ADMIN || 
                           (userRole === UserRole.CLUB_PRESIDENT && club.presidentId === userId),
        canDeleteClub: userRole === UserRole.SUPER_ADMIN
      },
      navigation: {
        publicUrl: `/kulup/${club.urlSlug}`,
        dashboardUrl: `/dashboard/club/${club.urlSlug}`,
        activitiesUrl: `/dashboard/club/${club.urlSlug}/activities`,
        applicationsUrl: `/dashboard/club/${club.urlSlug}/applications`,
        settingsUrl: `/dashboard/club/${club.urlSlug}/settings`
      },
      widgets: [
        {
          id: 'club-info',
          title: 'Club Information',
          type: 'info',
          data: {
            name: club.name,
            description: club.description,
            president: club.president ? `${club.president.firstName} ${club.president.lastName}` : 'Not assigned',
            status: club.isActive ? 'Active' : 'Inactive',
            createdAt: club.createdAt
          }
        },
        {
          id: 'quick-stats',
          title: 'Quick Statistics',
          type: 'stats',
          data: {
            totalActivities: 0, // Will be populated when activity service is ready
            pendingApplications: 0, // Will be populated when application service is ready
            totalMembers: 0 // Will be populated when member management is ready
          }
        }
      ]
    };
  }
}

export default ClubInfrastructureManager;