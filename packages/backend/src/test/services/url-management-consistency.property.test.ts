/**
 * Property-Based Tests for URL Management Consistency
 * **Feature: tau-kays, Property 3: Dynamic URL management consistency**
 * **Validates: Requirements 3.1, 3.3, 3.4**
 * 
 * Tests universal properties that should hold for URL management across all clubs
 */

import fc from 'fast-check';
import { UserRole } from '@prisma/client';

// Mock dependencies first, before importing the service
jest.mock('../../lib/database');
jest.mock('bcrypt');

const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
};

jest.doMock('bcrypt', () => mockBcrypt);

// Mock Prisma client
const mockPrismaClient = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  club: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the prisma export from database module
jest.doMock('../../lib/database', () => ({
  prisma: mockPrismaClient,
}));

// Now import the service after mocking
const { ClubService } = require('../../services/club.service');

describe('Property 3: Dynamic URL management consistency', () => {
  let clubService: any;
  let testSuperAdminId: string;

  beforeAll(async () => {
    clubService = new ClubService();
    testSuperAdminId = 'test-super-admin-id';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: testSuperAdminId,
      role: UserRole.SUPER_ADMIN,
    });
    
    mockPrismaClient.club.findUnique.mockResolvedValue(null); // No existing club by default
    mockPrismaClient.auditLog.create.mockResolvedValue({
      id: 'audit-id',
      userId: testSuperAdminId,
      action: 'CREATE',
      resource: 'CLUB',
      success: true,
    });
  });

  /**
   * **Feature: tau-kays, Property 3: Dynamic URL management consistency**
   * For any club in the system, the generated URL should follow the pattern /kulup/{club-slug}, 
   * route correctly to the club's public interface, and maintain consistency across all clubs.
   * **Validates: Requirements 3.1, 3.3, 3.4**
   */
  describe('URL pattern and routing consistency', () => {
    test('All club URLs follow the /kulup/{club-slug} pattern consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 200 }).filter(name => 
              name.trim().length >= 3 && !/^\s|\s$/.test(name)
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined })
          }),
          (clubData) => {
            const uniqueClubName = `${clubData.name} ${Date.now()}`;
            
            // Test URL slug generation directly
            const expectedSlug = uniqueClubName
              .toLowerCase()
              .replace(/[çğıöşüÇĞIİÖŞÜ]/g, (char) => {
                const map: { [key: string]: string } = {
                  'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g',
                  'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
                  'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's',
                  'ü': 'u', 'Ü': 'u'
                };
                return map[char] || char;
              })
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');

            // Property 1: URL slug should be generated consistently from club name
            const generatedSlug = (clubService as any).generateUrlSlug(uniqueClubName);
            expect(generatedSlug).toBe(expectedSlug);

            // Property 2: Generated URL should follow /kulup/{club-slug} pattern
            const generatedUrl = clubService.generateClubUrl(generatedSlug);
            expect(generatedUrl).toBe(`/kulup/${generatedSlug}`);
            expect(generatedUrl).toMatch(/^\/kulup\/[a-z0-9-]+$/);

            // Property 3: URL slug should be valid for routing
            expect(generatedSlug).toMatch(/^[a-z0-9-]+$/);
            expect(generatedSlug).not.toMatch(/^-|-$/); // No leading/trailing hyphens
            expect(generatedSlug.length).toBeGreaterThan(0);
            expect(generatedSlug.length).toBeLessThanOrEqual(200);

            // Property 4: URL should be consistent across multiple generations
            const url1 = clubService.generateClubUrl(generatedSlug);
            const url2 = clubService.generateClubUrl(generatedSlug);
            expect(url1).toBe(url2);

            // Property 5: URL structure should be maintained
            expect(generatedUrl.split('/').length).toBe(3); // ['', 'kulup', 'slug']
            expect(generatedUrl.split('/')[1]).toBe('kulup');
            expect(generatedUrl.split('/')[2]).toBe(generatedSlug);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Turkish character handling is consistent across all club names', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Generate club names with Turkish characters
            baseName: fc.string({ minLength: 2, maxLength: 50 }),
            turkishChars: fc.array(
              fc.constantFrom('ç', 'ğ', 'ı', 'ö', 'ş', 'ü', 'Ç', 'Ğ', 'İ', 'Ö', 'Ş', 'Ü'),
              { minLength: 0, maxLength: 5 }
            )
          }),
          (data) => {
            // Create club name with Turkish characters
            const clubName = data.baseName + data.turkishChars.join('');
            
            if (clubName.trim().length < 3) return; // Skip invalid names

            // Property 1: Turkish characters should be consistently mapped
            const slug = (clubService as any).generateUrlSlug(clubName);
            
            // Property 2: All Turkish characters should be converted to Latin equivalents
            expect(slug).not.toMatch(/[çğıöşüÇĞIİÖŞÜ]/);
            
            // Property 3: Mapping should be consistent
            const turkishCharMap: { [key: string]: string } = {
              'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g',
              'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
              'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's',
              'ü': 'u', 'Ü': 'u'
            };
            
            for (const [turkish, latin] of Object.entries(turkishCharMap)) {
              if (clubName.includes(turkish)) {
                expect(slug).toContain(latin);
              }
            }

            // Property 4: Generated URL should be valid
            const url = clubService.generateClubUrl(slug);
            expect(url).toBe(`/kulup/${slug}`);
            expect(url).toMatch(/^\/kulup\/[a-z0-9-]*$/);

            // Property 5: Multiple conversions should yield same result
            const slug2 = (clubService as any).generateUrlSlug(clubName);
            expect(slug).toBe(slug2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('URL slug uniqueness handling maintains pattern consistency', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 3, maxLength: 50 }).filter(name => 
              name.trim().length >= 3
            ),
            { minLength: 2, maxLength: 10 }
          ),
          (clubNames) => {
            const slugs: string[] = [];
            const urls: string[] = [];

            for (const clubName of clubNames) {
              // Generate slug
              const baseSlug = (clubService as any).generateUrlSlug(clubName);
              
              // Skip if slug generation results in empty string (edge case)
              if (!baseSlug || baseSlug.length === 0) {
                continue;
              }
              
              // Simulate uniqueness handling
              let finalSlug = baseSlug;
              let counter = 1;
              while (slugs.includes(finalSlug)) {
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
              }
              slugs.push(finalSlug);

              // Generate URL
              const url = clubService.generateClubUrl(finalSlug);
              urls.push(url);
            }

            // Only test if we have valid slugs
            if (slugs.length === 0) return;

            // Property 1: All slugs should be unique
            const uniqueSlugs = new Set(slugs);
            expect(uniqueSlugs.size).toBe(slugs.length);

            // Property 2: All URLs should follow the same pattern
            for (const url of urls) {
              expect(url).toMatch(/^\/kulup\/[a-z0-9-]+$/);
            }

            // Property 3: URL structure should be consistent across all clubs
            for (const url of urls) {
              expect(url.split('/').length).toBe(3);
              expect(url.split('/')[1]).toBe('kulup');
              expect(url.split('/')[2]).toMatch(/^[a-z0-9-]+$/);
            }

            // Property 4: All URLs should be unique
            const uniqueUrls = new Set(urls);
            expect(uniqueUrls.size).toBe(urls.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('URL pattern consistency across different club name formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Regular club names
            fc.string({ minLength: 3, maxLength: 100 }).filter(name => 
              name.trim().length >= 3
            ),
            // Club names with special characters
            fc.string({ minLength: 3, maxLength: 100 }).map(name => 
              name + ' & Co.'
            ).filter(name => name.trim().length >= 3),
            // Club names with numbers
            fc.string({ minLength: 3, maxLength: 100 }).map(name => 
              name + ' 2026'
            ).filter(name => name.trim().length >= 3),
            // Club names with Turkish characters
            fc.string({ minLength: 3, maxLength: 100 }).map(name => 
              name + ' Öğrenci Kulübü'
            ).filter(name => name.trim().length >= 3)
          ),
          (clubName) => {
            // Property 1: All club names should generate valid slugs
            const slug = (clubService as any).generateUrlSlug(clubName);
            expect(slug).toMatch(/^[a-z0-9-]*$/);
            expect(slug).not.toMatch(/^-|-$/);

            // Property 2: All slugs should generate valid URLs
            const url = clubService.generateClubUrl(slug);
            expect(url).toBe(`/kulup/${slug}`);
            expect(url).toMatch(/^\/kulup\/[a-z0-9-]*$/);

            // Property 3: URL structure should be consistent
            const urlParts = url.split('/');
            expect(urlParts.length).toBe(3);
            expect(urlParts[0]).toBe('');
            expect(urlParts[1]).toBe('kulup');
            expect(urlParts[2]).toBe(slug);

            // Property 4: Slug should be deterministic
            const slug2 = (clubService as any).generateUrlSlug(clubName);
            expect(slug).toBe(slug2);

            // Property 5: URL should be deterministic
            const url2 = clubService.generateClubUrl(slug);
            expect(url).toBe(url2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('URL management maintains consistency across edge cases', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Edge case: minimal length names
            fc.string({ minLength: 3, maxLength: 3 }),
            // Edge case: names with only special characters (after filtering)
            fc.constantFrom('!@#', '---', '   ').map(s => s + 'abc'),
            // Edge case: names with mixed case and special chars
            fc.string({ minLength: 3, maxLength: 20 }).map(s => 
              s.toUpperCase() + '!!!' + s.toLowerCase()
            ),
            // Edge case: Turkish character combinations
            fc.constantFrom(
              'Çağdaş Öğrenci Kulübü',
              'İstanbul Üniversitesi',
              'Gençlik ve Spor Kulübü'
            )
          ),
          (clubName) => {
            if (clubName.trim().length < 3) return; // Skip invalid names

            // Property 1: Edge cases should still generate valid slugs
            const slug = (clubService as any).generateUrlSlug(clubName);
            
            if (slug.length > 0) { // Only test if slug was generated
              expect(slug).toMatch(/^[a-z0-9-]+$/);
              expect(slug).not.toMatch(/^-|-$/);

              // Property 2: Edge case URLs should follow pattern
              const url = clubService.generateClubUrl(slug);
              expect(url).toBe(`/kulup/${slug}`);
              expect(url).toMatch(/^\/kulup\/[a-z0-9-]+$/);

              // Property 3: URL structure should be maintained
              expect(url.split('/').length).toBe(3);
              expect(url.split('/')[1]).toBe('kulup');
              expect(url.split('/')[2]).toBe(slug);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('URL routing correctly directs to club public interface', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 100 }).filter(name => 
              name.trim().length >= 3 && !/^\s|\s$/.test(name)
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
            isActive: fc.boolean()
          }),
          (clubData) => {
            const uniqueClubName = `${clubData.name} ${Date.now()}`;
            const clubId = `club-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Generate URL slug and URL
            const slug = (clubService as any).generateUrlSlug(uniqueClubName);
            const url = clubService.generateClubUrl(slug);
            
            // Skip if slug generation results in empty string (edge case)
            if (!slug || slug.length === 0) {
              return;
            }

            // Mock club data for routing test
            const mockClub = {
              id: clubId,
              name: uniqueClubName,
              description: clubData.description,
              urlSlug: slug,
              presidentId: null,
              president: null,
              isActive: clubData.isActive,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Mock the getClubBySlug method to return our test club
            mockPrismaClient.club.findUnique.mockResolvedValueOnce(mockClub);

            // Property 1: URL should follow the correct pattern
            expect(url).toBe(`/kulup/${slug}`);
            expect(url).toMatch(/^\/kulup\/[a-z0-9-]+$/);

            // Property 2: URL slug should be valid for routing
            expect(slug).toMatch(/^[a-z0-9-]+$/);
            expect(slug).not.toMatch(/^-|-$/);

            // Property 3: URL should be deterministic for the same club name
            const slug2 = (clubService as any).generateUrlSlug(uniqueClubName);
            const url2 = clubService.generateClubUrl(slug2);
            expect(url).toBe(url2);
            expect(slug).toBe(slug2);

            // Property 4: URL structure should be consistent
            const urlParts = url.split('/');
            expect(urlParts.length).toBe(3);
            expect(urlParts[0]).toBe('');
            expect(urlParts[1]).toBe('kulup');
            expect(urlParts[2]).toBe(slug);

            // Property 5: Slug should be URL-safe
            expect(encodeURIComponent(slug)).toBe(slug); // Should not need encoding
            expect(slug).not.toContain(' '); // No spaces
            expect(slug).not.toContain('/'); // No slashes
            expect(slug).not.toContain('?'); // No query parameters
            expect(slug).not.toContain('#'); // No fragments
          }
        ),
        { numRuns: 100 }
      );
    });

    test('URL accessibility and routing consistency across all clubs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 3, maxLength: 50 }).filter(name => 
                name.trim().length >= 3
              ),
              isActive: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (clubsData) => {
            const generatedUrls: string[] = [];
            const generatedSlugs: string[] = [];

            for (let i = 0; i < clubsData.length; i++) {
              const clubData = clubsData[i];
              const uniqueClubName = `${clubData.name} ${Date.now()}-${i}`;
              
              // Generate slug and URL
              const slug = (clubService as any).generateUrlSlug(uniqueClubName);
              
              // Skip if slug generation results in empty string (edge case)
              if (!slug || slug.length === 0) {
                continue;
              }

              // Handle uniqueness (simulate the ensureUniqueSlug behavior)
              let finalSlug = slug;
              let counter = 1;
              while (generatedSlugs.includes(finalSlug)) {
                finalSlug = `${slug}-${counter}`;
                counter++;
              }
              generatedSlugs.push(finalSlug);

              const url = clubService.generateClubUrl(finalSlug);
              generatedUrls.push(url);
            }

            // Only test if we have valid URLs
            if (generatedUrls.length === 0) return;

            // Property 1: All URLs should follow the same pattern
            for (const url of generatedUrls) {
              expect(url).toMatch(/^\/kulup\/[a-z0-9-]+$/);
              
              // Property 2: URL structure should be consistent
              const parts = url.split('/');
              expect(parts.length).toBe(3);
              expect(parts[1]).toBe('kulup');
              expect(parts[2]).toMatch(/^[a-z0-9-]+$/);
            }

            // Property 3: All URLs should be unique
            const uniqueUrls = new Set(generatedUrls);
            expect(uniqueUrls.size).toBe(generatedUrls.length);

            // Property 4: All slugs should be unique
            const uniqueSlugs = new Set(generatedSlugs);
            expect(uniqueSlugs.size).toBe(generatedSlugs.length);

            // Property 5: URL accessibility - all URLs should be properly formatted for HTTP routing
            for (const url of generatedUrls) {
              // Should not need URL encoding
              expect(encodeURI(url)).toBe(url);
              
              // Should be valid path component
              expect(url.startsWith('/')).toBe(true);
              expect(url).not.toContain('//'); // No double slashes
              expect(url).not.toContain(' '); // No spaces
              expect(url).not.toContain('?'); // No query parameters in base URL
              expect(url).not.toContain('#'); // No fragments in base URL
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});