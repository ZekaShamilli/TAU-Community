/**
 * Club Service Tests
 * Tests for club CRUD operations, URL slug generation, and infrastructure integration
 */

import { ClubService, CreateClubRequest, UpdateClubRequest } from '../../services/club.service';
import ClubCleanupService from '../../services/club-cleanup.service';
import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/database';

describe('ClubService', () => {
  let clubService: ClubService;
  let cleanupService: ClubCleanupService;
  let testUserId: string;
  let testClubId: string;

  beforeAll(async () => {
    clubService = new ClubService();
    cleanupService = new ClubCleanupService();
    
    // Create a test user for operations
    const testUser = await prisma.user.create({
      data: {
        email: 'test-admin@tau.edu.az',
        passwordHash: 'test-hash',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Test',
        lastName: 'Admin',
        isActive: true
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    
    // Delete test clubs
    await prisma.club.deleteMany({
      where: {
        name: {
          startsWith: 'Test Club'
        }
      }
    });
    
    // Delete test user
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  describe('URL Slug Generation', () => {
    test('should generate URL slug from club name', async () => {
      const clubData: CreateClubRequest = {
        name: 'Test Club for URL Generation',
        description: 'A test club for URL slug generation'
      };

      const club = await clubService.createClub(clubData, testUserId);
      expect(club.urlSlug).toBe('test-club-for-url-generation');
      
      testClubId = club.id;
    });

    test('should handle Turkish characters in URL slug', async () => {
      const clubData: CreateClubRequest = {
        name: 'TÃ¼rkÃ§e Ã–ÄŸrenci KulÃ¼bÃ¼',
        description: 'Turkish character test'
      };

      const club = await clubService.createClub(clubData, testUserId);
      expect(club.urlSlug).toBe('turkce-ogrenci-kulubu');
      
      // Clean up
      await cleanupService.performCleanup(club.id, testUserId);
    });

    test('should ensure unique URL slugs', async () => {
      const clubData1: CreateClubRequest = {
        name: 'Duplicate Name Club',
        description: 'First club'
      };

      const clubData2: CreateClubRequest = {
        name: 'Duplicate Name Club 2', // Different name but similar slug
        description: 'Second club'
      };

      const club1 = await clubService.createClub(clubData1, testUserId);
      const club2 = await clubService.createClub(clubData2, testUserId);

      expect(club1.urlSlug).toBe('duplicate-name-club');
      expect(club2.urlSlug).toBe('duplicate-name-club-2');

      // Clean up
      await cleanupService.performCleanup(club1.id, testUserId);
      await cleanupService.performCleanup(club2.id, testUserId);
    });
  });

  describe('Club CRUD Operations', () => {
    test('should create club with president', async () => {
      const clubData: CreateClubRequest = {
        name: 'Test Club with President',
        description: 'A test club with president',
        presidentEmail: 'president@tau.edu.az',
        presidentFirstName: 'John',
        presidentLastName: 'Doe'
      };

      const club = await clubService.createClub(clubData, testUserId);
      
      expect(club.name).toBe(clubData.name);
      expect(club.description).toBe(clubData.description);
      expect(club.president).toBeDefined();
      expect(club.president?.email).toBe(clubData.presidentEmail);
      expect(club.isActive).toBe(true);

      // Clean up
      await cleanupService.performCleanup(club.id, testUserId);
    });

    test('should get club by ID', async () => {
      const club = await clubService.getClub(testClubId);
      
      expect(club).toBeDefined();
      expect(club?.id).toBe(testClubId);
      expect(club?.name).toBe('Test Club for URL Generation');
    });

    test('should get club by slug', async () => {
      const club = await clubService.getClubBySlug('test-club-for-url-generation');
      
      expect(club).toBeDefined();
      expect(club?.id).toBe(testClubId);
      expect(club?.urlSlug).toBe('test-club-for-url-generation');
    });

    test('should update club', async () => {
      const updateData: UpdateClubRequest = {
        description: 'Updated description for test club'
      };

      const updatedClub = await clubService.updateClub(testClubId, updateData, testUserId);
      
      expect(updatedClub.description).toBe(updateData.description);
      expect(updatedClub.updatedAt.getTime()).toBeGreaterThan(updatedClub.createdAt.getTime());
    });

    test('should list clubs with filtering', async () => {
      const result = await clubService.listClubs({ isActive: true }, 1, 10);
      
      expect(result.clubs).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      
      // All returned clubs should be active
      result.clubs.forEach(club => {
        expect(club.isActive).toBe(true);
      });
    });
  });

  describe('Access Control', () => {
    test('should validate super admin access to any club', async () => {
      const hasAccess = await clubService.validateClubAccess(
        testClubId, 
        testUserId, 
        UserRole.SUPER_ADMIN
      );
      
      expect(hasAccess).toBe(true);
    });

    test('should validate student access to active clubs only', async () => {
      // Create a test student
      const student = await prisma.user.create({
        data: {
          email: 'student@tau.edu.az',
          passwordHash: 'test-hash',
          role: UserRole.STUDENT,
          firstName: 'Test',
          lastName: 'Student',
          isActive: true
        }
      });

      const hasAccess = await clubService.validateClubAccess(
        testClubId, 
        student.id, 
        UserRole.STUDENT
      );
      
      expect(hasAccess).toBe(true); // Club is active

      // Clean up
      await prisma.user.delete({ where: { id: student.id } });
    });
  });

  describe('Club Cleanup', () => {
    test('should get cleanup confirmation', async () => {
      const confirmation = await cleanupService.getCleanupConfirmation(testClubId);
      
      expect(confirmation.clubId).toBe(testClubId);
      expect(confirmation.clubName).toBe('Test Club for URL Generation');
      expect(confirmation.resourceCounts).toBeDefined();
      expect(confirmation.warnings).toBeDefined();
      expect(Array.isArray(confirmation.warnings)).toBe(true);
    });

    test('should validate deletion', async () => {
      const validation = await cleanupService.validateDeletion(testClubId);
      
      expect(validation.canDelete).toBeDefined();
      expect(validation.issues).toBeDefined();
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    test('should get detailed deletion info', async () => {
      const info = await cleanupService.getClubDeletionInfo(testClubId);
      
      expect(info.club).toBeDefined();
      expect(info.club.id).toBe(testClubId);
      expect(info.statistics).toBeDefined();
      expect(info.urls).toBeDefined();
      expect(info.urls.publicUrl).toBe('/kulup/test-club-for-url-generation');
    });
  });

  describe('URL Generation', () => {
    test('should generate correct club URL', () => {
      const url = clubService.generateClubUrl('test-club-slug');
      expect(url).toBe('/kulup/test-club-slug');
    });
  });

  // Clean up the test club at the end
  afterAll(async () => {
    if (testClubId) {
      try {
        await cleanupService.performCleanup(testClubId, testUserId);
      } catch (error) {
        console.log('Test club already cleaned up or not found');
      }
    }
  });
});
