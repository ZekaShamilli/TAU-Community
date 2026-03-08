/**
 * Application Service
 * 
 * This service handles all application-related operations including:
 * - Application submission by students
 * - Application review by club presidents
 * - Application status management
 * - Application listing and filtering
 */

import { PrismaClient } from '@prisma/client';
import { 
  Application, 
  CreateApplicationRequest, 
  UpdateApplicationStatusRequest,
  ApplicationFilters,
  ApplicationWithClubInfo,
  ApplicationSummary,
  ApplicationStatus
} from './types';

export class ApplicationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Submit a new application to join a club
   */
  async submitApplication(applicationData: CreateApplicationRequest): Promise<Application> {
    try {
      const application = await this.prisma.application.create({
        data: {
          clubId: applicationData.clubId,
          studentId: applicationData.studentId || null,
          studentName: applicationData.studentName,
          studentEmail: applicationData.studentEmail,
          motivation: applicationData.motivation,
        },
      });

      return this.mapPrismaToApplication(application);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('applications_unique_student_club')) {
        throw new Error('You have already submitted an application to this club');
      }
      throw error;
    }
  }

  /**
   * Get a specific application by ID
   */
  async getApplication(applicationId: string): Promise<Application | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    return application ? this.mapPrismaToApplication(application) : null;
  }

  /**
   * Get application with club information
   */
  async getApplicationWithClubInfo(applicationId: string): Promise<ApplicationWithClubInfo | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        club: true,
      },
    });

    if (!application) return null;

    return {
      ...this.mapPrismaToApplication(application),
      clubName: application.club.name,
      clubUrlSlug: application.club.urlSlug,
    };
  }

  /**
   * List applications with optional filtering
   */
  async listApplications(filters: ApplicationFilters = {}): Promise<Application[]> {
    const where: any = {};

    if (filters.clubId) {
      where.clubId = filters.clubId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.studentEmail) {
      where.studentEmail = {
        contains: filters.studentEmail,
        mode: 'insensitive',
      };
    }

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.submittedAfter) {
      where.submittedAt = {
        ...where.submittedAt,
        gte: filters.submittedAfter,
      };
    }

    if (filters.submittedBefore) {
      where.submittedAt = {
        ...where.submittedAt,
        lte: filters.submittedBefore,
      };
    }

    const applications = await this.prisma.application.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });

    return applications.map(app => this.mapPrismaToApplication(app));
  }

  /**
   * List applications with club information
   */
  async listApplicationsWithClubInfo(filters: ApplicationFilters = {}): Promise<ApplicationWithClubInfo[]> {
    const where: any = {};

    if (filters.clubId) {
      where.clubId = filters.clubId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.studentEmail) {
      where.studentEmail = {
        contains: filters.studentEmail,
        mode: 'insensitive',
      };
    }

    if (filters.submittedAfter) {
      where.submittedAt = {
        ...where.submittedAt,
        gte: filters.submittedAfter,
      };
    }

    if (filters.submittedBefore) {
      where.submittedAt = {
        ...where.submittedAt,
        lte: filters.submittedBefore,
      };
    }

    const applications = await this.prisma.application.findMany({
      where,
      include: {
        club: true,
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });

    return applications.map(app => ({
      ...this.mapPrismaToApplication(app),
      clubName: app.club.name,
      clubUrlSlug: app.club.urlSlug,
      student: app.student ? {
        id: app.student.id,
        email: app.student.email,
        firstName: app.student.firstName,
        lastName: app.student.lastName,
        phone: app.student.phone,
      } : undefined,
    }));
  }

  /**
   * Update application status (approve/reject)
   */
  async updateApplicationStatus(
    applicationId: string, 
    statusUpdate: UpdateApplicationStatusRequest,
    reviewedBy: string
  ): Promise<Application> {
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: statusUpdate.status,
        reviewedAt: new Date(),
        reviewedBy: reviewedBy,
        reviewComments: statusUpdate.reviewComments || null,
      },
    });

    return this.mapPrismaToApplication(application);
  }

  /**
   * Get application summary statistics for a club
   */
  async getApplicationSummary(clubId: string): Promise<ApplicationSummary> {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.application.count({ where: { clubId } }),
      this.prisma.application.count({ where: { clubId, status: 'PENDING' } }),
      this.prisma.application.count({ where: { clubId, status: 'APPROVED' } }),
      this.prisma.application.count({ where: { clubId, status: 'REJECTED' } }),
    ]);

    return {
      totalApplications: total,
      pendingApplications: pending,
      approvedApplications: approved,
      rejectedApplications: rejected,
    };
  }

  /**
   * Delete an application (for cleanup purposes)
   */
  async deleteApplication(applicationId: string): Promise<void> {
    try {
      await this.prisma.application.delete({
        where: { id: applicationId },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Application not found');
      }
      throw error;
    }
  }

  /**
   * Check if a student has already applied to a club
   */
  async hasStudentApplied(clubId: string, studentEmail: string): Promise<boolean> {
    const application = await this.prisma.application.findFirst({
      where: {
        clubId,
        studentEmail,
      },
    });

    return !!application;
  }

  /**
   * Get applications by student email
   */
  async getApplicationsByStudent(studentEmail: string): Promise<ApplicationWithClubInfo[]> {
    const applications = await this.prisma.application.findMany({
      where: { studentEmail },
      include: {
        club: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    return applications.map(app => ({
      ...this.mapPrismaToApplication(app),
      clubName: app.club.name,
      clubUrlSlug: app.club.urlSlug,
    }));
  }

  /**
   * Map Prisma application to our Application interface
   */
  private mapPrismaToApplication(prismaApp: any): Application {
    return {
      id: prismaApp.id,
      clubId: prismaApp.clubId,
      studentId: prismaApp.studentId,
      studentName: prismaApp.studentName,
      studentEmail: prismaApp.studentEmail,
      motivation: prismaApp.motivation,
      status: prismaApp.status as ApplicationStatus,
      submittedAt: prismaApp.submittedAt,
      reviewedAt: prismaApp.reviewedAt,
      reviewedBy: prismaApp.reviewedBy,
      reviewComments: prismaApp.reviewComments,
    };
  }
}