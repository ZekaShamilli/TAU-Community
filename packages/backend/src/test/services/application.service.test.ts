/**
 * Application Service Tests
 * 
 * Unit tests for the ApplicationService class covering:
 * - Application submission
 * - Application retrieval and listing
 * - Application status updates
 * - Application validation and constraints
 */

import { PrismaClient } from '@prisma/client';
import { ApplicationService } from '../../lib/application/service';
import { CreateApplicationRequest, UpdateApplicationStatusRequest } from '../../lib/application/types';

// Mock Prisma Client
const mockPrisma = {
  application: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

describe('ApplicationService', () => {
  let applicationService: ApplicationService;
  const testClubId = 'test-club-id';
  const testUserId = 'test-user-id';
  const testPresidentId = 'test-president-id';

  beforeEach(() => {
    applicationService = new ApplicationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('submitApplication', () => {
    it('should successfully submit a new application', async () => {
      const applicationData: CreateApplicationRequest = {
        clubId: testClubId,
        studentId: testUserId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
      };

      const mockApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentId: testUserId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: applicationData.motivation,
        status: 'PENDING',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewComments: null,
      };

      (mockPrisma.application.create as jest.Mock).mockResolvedValue(mockApplication);

      const application = await applicationService.submitApplication(applicationData);

      expect(application).toBeDefined();
      expect(application.id).toBe('app-id');
      expect(application.clubId).toBe(testClubId);
      expect(application.studentId).toBe(testUserId);
      expect(application.status).toBe('PENDING');
      expect(mockPrisma.application.create).toHaveBeenCalledWith({
        data: {
          clubId: testClubId,
          studentId: testUserId,
          studentName: 'Test Student',
          studentEmail: 'student@test.com',
          motivation: applicationData.motivation,
        },
      });
    });

    it('should prevent duplicate applications from the same student to the same club', async () => {
      const applicationData: CreateApplicationRequest = {
        clubId: testClubId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
      };

      const duplicateError = new Error('Duplicate application');
      (duplicateError as any).code = 'P2002';
      (duplicateError as any).meta = { target: ['applications_unique_student_club'] };

      (mockPrisma.application.create as jest.Mock).mockRejectedValue(duplicateError);

      await expect(applicationService.submitApplication(applicationData))
        .rejects.toThrow('You have already submitted an application to this club');
    });

    it('should handle applications without studentId (non-authenticated users)', async () => {
      const applicationData: CreateApplicationRequest = {
        clubId: testClubId,
        studentName: 'Anonymous Student',
        studentEmail: 'anonymous@test.com',
        motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
      };

      const mockApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentId: null,
        studentName: 'Anonymous Student',
        studentEmail: 'anonymous@test.com',
        motivation: applicationData.motivation,
        status: 'PENDING',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewComments: null,
      };

      (mockPrisma.application.create as jest.Mock).mockResolvedValue(mockApplication);

      const application = await applicationService.submitApplication(applicationData);

      expect(application).toBeDefined();
      expect(application.studentId).toBeNull();
      expect(application.studentName).toBe('Anonymous Student');
      expect(mockPrisma.application.create).toHaveBeenCalledWith({
        data: {
          clubId: testClubId,
          studentId: null,
          studentName: 'Anonymous Student',
          studentEmail: 'anonymous@test.com',
          motivation: applicationData.motivation,
        },
      });
    });
  });

  describe('getApplication', () => {
    it('should retrieve an application by ID', async () => {
      const mockApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentId: testUserId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'Test motivation',
        status: 'PENDING',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewComments: null,
      };

      (mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(mockApplication);

      const application = await applicationService.getApplication('app-id');

      expect(application).toBeDefined();
      expect(application!.id).toBe('app-id');
      expect(application!.clubId).toBe(testClubId);
      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-id' },
      });
    });

    it('should return null for non-existent application', async () => {
      (mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(null);

      const application = await applicationService.getApplication('non-existent-id');
      expect(application).toBeNull();
    });
  });

  describe('getApplicationWithClubInfo', () => {
    it('should retrieve application with club information', async () => {
      const mockApplicationWithClub = {
        id: 'app-id',
        clubId: testClubId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'Test motivation',
        status: 'PENDING',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewComments: null,
        club: {
          name: 'Test Club',
          urlSlug: 'test-club',
        },
      };

      (mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(mockApplicationWithClub);

      const applicationWithClub = await applicationService.getApplicationWithClubInfo('app-id');

      expect(applicationWithClub).toBeDefined();
      expect(applicationWithClub!.id).toBe('app-id');
      expect(applicationWithClub!.clubName).toBe('Test Club');
      expect(applicationWithClub!.clubUrlSlug).toBe('test-club');
      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-id' },
        include: { club: true },
      });
    });
  });

  describe('listApplications', () => {
    it('should list all applications without filters', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          clubId: testClubId,
          studentName: 'Student One',
          studentEmail: 'student1@test.com',
          motivation: 'Test motivation 1',
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewComments: null,
        },
        {
          id: 'app-2',
          clubId: testClubId,
          studentName: 'Student Two',
          studentEmail: 'student2@test.com',
          motivation: 'Test motivation 2',
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewComments: null,
        },
      ];

      (mockPrisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const applications = await applicationService.listApplications();
      expect(applications).toHaveLength(2);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { submittedAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
    });

    it('should filter applications by club ID', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          clubId: testClubId,
          studentName: 'Student One',
          studentEmail: 'student1@test.com',
          motivation: 'Test motivation',
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewComments: null,
        },
      ];

      (mockPrisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const applications = await applicationService.listApplications({ clubId: testClubId });
      expect(applications).toHaveLength(1);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: { clubId: testClubId },
        orderBy: { submittedAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
    });

    it('should apply pagination', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          clubId: testClubId,
          studentName: 'Student One',
          studentEmail: 'student1@test.com',
          motivation: 'Test motivation',
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewComments: null,
        },
      ];

      (mockPrisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const applications = await applicationService.listApplications({ limit: 1, offset: 0 });
      expect(applications).toHaveLength(1);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { submittedAt: 'desc' },
        take: 1,
        skip: 0,
      });
    });
  });

  describe('updateApplicationStatus', () => {
    it('should approve an application', async () => {
      const statusUpdate: UpdateApplicationStatusRequest = {
        status: 'APPROVED',
        reviewComments: 'Great motivation and background!'
      };

      const mockUpdatedApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'Test motivation',
        status: 'APPROVED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: testPresidentId,
        reviewComments: 'Great motivation and background!',
      };

      (mockPrisma.application.update as jest.Mock).mockResolvedValue(mockUpdatedApplication);

      const updatedApplication = await applicationService.updateApplicationStatus(
        'app-id',
        statusUpdate,
        testPresidentId
      );

      expect(updatedApplication.status).toBe('APPROVED');
      expect(updatedApplication.reviewComments).toBe('Great motivation and background!');
      expect(updatedApplication.reviewedBy).toBe(testPresidentId);
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-id' },
        data: {
          status: 'APPROVED',
          reviewedAt: expect.any(Date),
          reviewedBy: testPresidentId,
          reviewComments: 'Great motivation and background!',
        },
      });
    });

    it('should reject an application', async () => {
      const statusUpdate: UpdateApplicationStatusRequest = {
        status: 'REJECTED',
        reviewComments: 'Unfortunately, we cannot accept your application at this time.'
      };

      const mockUpdatedApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentName: 'Test Student',
        studentEmail: 'student@test.com',
        motivation: 'Test motivation',
        status: 'REJECTED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: testPresidentId,
        reviewComments: 'Unfortunately, we cannot accept your application at this time.',
      };

      (mockPrisma.application.update as jest.Mock).mockResolvedValue(mockUpdatedApplication);

      const updatedApplication = await applicationService.updateApplicationStatus(
        'app-id',
        statusUpdate,
        testPresidentId
      );

      expect(updatedApplication.status).toBe('REJECTED');
      expect(updatedApplication.reviewComments).toBe('Unfortunately, we cannot accept your application at this time.');
    });
  });

  describe('getApplicationSummary', () => {
    it('should return correct application summary', async () => {
      (mockPrisma.application.count as jest.Mock)
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1) // pending
        .mockResolvedValueOnce(1) // approved
        .mockResolvedValueOnce(0); // rejected

      const summary = await applicationService.getApplicationSummary(testClubId);

      expect(summary.totalApplications).toBe(2);
      expect(summary.pendingApplications).toBe(1);
      expect(summary.approvedApplications).toBe(1);
      expect(summary.rejectedApplications).toBe(0);
    });
  });

  describe('hasStudentApplied', () => {
    it('should return true if student has applied', async () => {
      const mockApplication = {
        id: 'app-id',
        clubId: testClubId,
        studentEmail: 'student@test.com',
      };

      (mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);

      const hasApplied = await applicationService.hasStudentApplied(testClubId, 'student@test.com');
      expect(hasApplied).toBe(true);
      expect(mockPrisma.application.findFirst).toHaveBeenCalledWith({
        where: {
          clubId: testClubId,
          studentEmail: 'student@test.com',
        },
      });
    });

    it('should return false if student has not applied', async () => {
      (mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(null);

      const hasApplied = await applicationService.hasStudentApplied(testClubId, 'nonexistent@test.com');
      expect(hasApplied).toBe(false);
    });
  });

  describe('deleteApplication', () => {
    it('should delete an application', async () => {
      (mockPrisma.application.delete as jest.Mock).mockResolvedValue({});

      await applicationService.deleteApplication('app-id');

      expect(mockPrisma.application.delete).toHaveBeenCalledWith({
        where: { id: 'app-id' },
      });
    });

    it('should throw error when deleting non-existent application', async () => {
      const notFoundError = new Error('Record not found');
      (notFoundError as any).code = 'P2025';

      (mockPrisma.application.delete as jest.Mock).mockRejectedValue(notFoundError);

      await expect(applicationService.deleteApplication('non-existent-id'))
        .rejects.toThrow('Application not found');
    });
  });
});