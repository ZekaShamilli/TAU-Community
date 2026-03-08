/**
 * Club Cleanup Service
 * Handles comprehensive cleanup of club resources when clubs are deleted
 * Ensures all associated data, URLs, and infrastructure are properly removed
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/database';

export interface CleanupReport {
  clubId: string;
  clubName: string;
  urlSlug: string;
  resourcesDeleted: {
    activities: number;
    applications: number;
    auditLogs: number;
    infrastructureRemoved: boolean;
  };
  errors: string[];
  success: boolean;
}

export interface CleanupConfirmation {
  clubId: string;
  clubName: string;
  urlSlug: string;
  resourceCounts: {
    activities: number;
    applications: number;
    auditLogs: number;
  };
  warnings: string[];
  confirmationRequired: boolean;
}

export class ClubCleanupService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Get cleanup confirmation details before deletion
   */
  async getCleanupConfirmation(clubId: string): Promise<CleanupConfirmation> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        president: true,
        activities: true,
        applications: true
      }
    });

    if (!club) {
      throw new Error('Club not found');
    }

    // Count related resources
    const [activityCount, applicationCount, auditLogCount] = await Promise.all([
      this.prisma.activity.count({ where: { clubId } }),
      this.prisma.application.count({ where: { clubId } }),
      this.prisma.auditLog.count({ where: { resourceId: clubId, resource: 'CLUB' } })
    ]);

    const warnings: string[] = [];
    let confirmationRequired = false;

    // Generate warnings based on data
    if (activityCount > 0) {
      warnings.push(`${activityCount} activities will be permanently deleted`);
      confirmationRequired = true;
    }

    if (applicationCount > 0) {
      warnings.push(`${applicationCount} student applications will be permanently deleted`);
      confirmationRequired = true;
    }

    if (auditLogCount > 0) {
      warnings.push(`${auditLogCount} audit log entries reference this club`);
    }

    if (club.president) {
      warnings.push(`Club president (${club.president.firstName} ${club.president.lastName}) will lose club access`);
    }

    warnings.push(`Club URL /kulup/${club.urlSlug} will become unavailable`);
    warnings.push('This action cannot be undone');

    return {
      clubId: club.id,
      clubName: club.name,
      urlSlug: club.urlSlug,
      resourceCounts: {
        activities: activityCount,
        applications: applicationCount,
        auditLogs: auditLogCount
      },
      warnings,
      confirmationRequired
    };
  }

  /**
   * Perform comprehensive club cleanup
   */
  async performCleanup(
    clubId: string, 
    deletedBy: string, 
    infrastructureManager?: any
  ): Promise<CleanupReport> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        president: true,
        activities: true,
        applications: true
      }
    });

    if (!club) {
      throw new Error('Club not found');
    }

    const report: CleanupReport = {
      clubId: club.id,
      clubName: club.name,
      urlSlug: club.urlSlug,
      resourcesDeleted: {
        activities: 0,
        applications: 0,
        auditLogs: 0,
        infrastructureRemoved: false
      },
      errors: [],
      success: false
    };

    try {
      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Count resources before deletion
        const [activityCount, applicationCount] = await Promise.all([
          tx.activity.count({ where: { clubId } }),
          tx.application.count({ where: { clubId } })
        ]);

        report.resourcesDeleted.activities = activityCount;
        report.resourcesDeleted.applications = applicationCount;

        // Delete the club (cascade will handle activities and applications)
        await tx.club.delete({
          where: { id: clubId }
        });

        // Log the deletion
        await tx.auditLog.create({
          data: {
            userId: deletedBy,
            userRole: 'SUPER_ADMIN', // Only super admins can delete clubs
            action: 'DELETE',
            resource: 'CLUB',
            resourceId: clubId,
            changes: {
              clubName: club.name,
              urlSlug: club.urlSlug,
              activitiesDeleted: activityCount,
              applicationsDeleted: applicationCount,
              presidentId: club.presidentId,
              deletionTimestamp: new Date().toISOString()
            },
            timestamp: new Date(),
            success: true
          }
        });

        // Count audit logs that reference this club
        const auditLogCount = await tx.auditLog.count({
          where: { resourceId: clubId, resource: 'CLUB' }
        });
        report.resourcesDeleted.auditLogs = auditLogCount;
      });

      // Remove infrastructure (outside transaction as it's not database-related)
      if (infrastructureManager) {
        try {
          await infrastructureManager.removeClubInfrastructure(clubId);
          report.resourcesDeleted.infrastructureRemoved = true;
        } catch (error) {
          const errorMsg = `Failed to remove infrastructure: ${error instanceof Error ? error.message : 'Unknown error'}`;
          report.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      report.success = true;
      console.log(`✅ Successfully cleaned up club: ${club.name} (${club.urlSlug})`);

    } catch (error) {
      const errorMsg = `Database cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      report.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return report;
  }

  /**
   * Validate that a club can be safely deleted
   */
  async validateDeletion(clubId: string): Promise<{ canDelete: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const club = await this.prisma.club.findUnique({
        where: { id: clubId },
        include: {
          activities: {
            where: {
              status: 'PUBLISHED',
              endDate: { gt: new Date() } // Future activities
            }
          }
        }
      });

      if (!club) {
        issues.push('Club not found');
        return { canDelete: false, issues };
      }

      // Check for future published activities
      if (club.activities.length > 0) {
        issues.push(`Club has ${club.activities.length} future published activities. Consider cancelling them first.`);
      }

      // Check for recent applications
      const recentApplications = await this.prisma.application.count({
        where: {
          clubId,
          submittedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      if (recentApplications > 0) {
        issues.push(`Club has ${recentApplications} applications submitted in the last 7 days. Consider reviewing them first.`);
      }

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      canDelete: issues.length === 0,
      issues
    };
  }

  /**
   * Get detailed club information for deletion confirmation
   */
  async getClubDeletionInfo(clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: {
        president: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        activities: {
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true
          },
          orderBy: { startDate: 'desc' },
          take: 10 // Show last 10 activities
        },
        applications: {
          select: {
            id: true,
            studentName: true,
            studentEmail: true,
            status: true,
            submittedAt: true
          },
          orderBy: { submittedAt: 'desc' },
          take: 10 // Show last 10 applications
        }
      }
    });

    if (!club) {
      throw new Error('Club not found');
    }

    // Get total counts
    const [totalActivities, totalApplications, totalAuditLogs] = await Promise.all([
      this.prisma.activity.count({ where: { clubId } }),
      this.prisma.application.count({ where: { clubId } }),
      this.prisma.auditLog.count({ where: { resourceId: clubId, resource: 'CLUB' } })
    ]);

    return {
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        urlSlug: club.urlSlug,
        isActive: club.isActive,
        createdAt: club.createdAt,
        updatedAt: club.updatedAt
      },
      president: club.president,
      statistics: {
        totalActivities,
        totalApplications,
        totalAuditLogs
      },
      recentActivities: club.activities,
      recentApplications: club.applications,
      urls: {
        publicUrl: `/kulup/${club.urlSlug}`,
        dashboardUrl: `/dashboard/club/${club.urlSlug}`
      }
    };
  }

  /**
   * Archive club instead of deleting (soft delete alternative)
   */
  async archiveClub(clubId: string, archivedBy: string): Promise<void> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId }
    });

    if (!club) {
      throw new Error('Club not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Deactivate the club
      await tx.club.update({
        where: { id: clubId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Cancel all future activities
      await tx.activity.updateMany({
        where: {
          clubId,
          status: 'PUBLISHED',
          startDate: { gt: new Date() }
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      // Log the archival
      await tx.auditLog.create({
        data: {
          userId: archivedBy,
          userRole: 'SUPER_ADMIN',
          action: 'ARCHIVE',
          resource: 'CLUB',
          resourceId: clubId,
          changes: {
            clubName: club.name,
            urlSlug: club.urlSlug,
            archivedAt: new Date().toISOString(),
            reason: 'Club archived instead of deleted'
          },
          timestamp: new Date(),
          success: true
        }
      });
    });

    console.log(`✅ Club archived: ${club.name} (${club.urlSlug})`);
  }
}

export default ClubCleanupService;