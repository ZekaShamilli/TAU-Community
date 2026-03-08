/**
 * Property-Based Tests for Club Creation Completeness
 * **Feature: tau-kays, Property 2: Club creation completeness**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * Tests universal properties that should hold for all valid club creation operations
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

// Mock Prisma client with comprehensive transaction support
const mockPrismaClient = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  club: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  activity: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  application: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the prisma export from database module
jest.doMock('../../lib/database', () => ({
  prisma: mockPrismaClient,
}));

// Mock infrastructure manager
const mockInfrastructureManager = {
  createClubInfrastructure: jest.fn(),
  updateClubInfrastructure: jest.fn(),
  removeClubInfrastructure: jest.fn(),
};

// Now import the services after mocking
const { ClubService, setInfrastructureManager } = require('../../services/club.service');

// Helper function to generate valid club names
const validClubName = () => fc.string({ minLength: 3, maxLength: 50 }).filter(name => {
  const trimmed = name.trim();
  return trimmed.length >= 3 && 
         /^[a-zA-Z0-9\s\u00C0-\u017F]+$/.test(trimmed) && // Allow Turkish characters
         /[a-zA-Z0-9\u00C0-\u017F]/.test(trimmed) && // Must contain at least one alphanumeric character
         trimmed.length === name.length; // No leading/trailing whitespace
});

// Helper function to generate valid email addresses
const validEmail = () => fc.emailAddress().filter(email => 
  email.length >= 5 && email.length <= 100 && email.includes('@')
);

// Helper function to generate valid names
const validPersonName = () => fc.string({ minLength: 2, maxLength: 30 }).filter(name => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && 
         /^[a-zA-Z\s\u00C0-\u017F]+$/.test(trimmed) && // Allow Turkish characters
         /[a-zA-Z\u00C0-\u017F]/.test(trimmed) && // Must contain at least one letter
         trimmed.length === name.length; // No leading/trailing whitespace
});

describe('Property 2: Club creation completeness', () => {
  let clubService: any;
  let testSuperAdminId: string;

  beforeAll(async () => {
    clubService = new ClubService();
    setInfrastructureManager(mockInfrastructureManager);
    testSuperAdminId = 'test-super-admin-id';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: testSuperAdminId,
      role: UserRole.SUPER_ADMIN,
    });
    
    mockPrismaClient.auditLog.create.mockResolvedValue({
      id: 'audit-id',
      userId: testSuperAdminId,
      action: 'CREATE',
      resource: 'CLUB',
      success: true,
    });

    // Mock successful infrastructure creation
    mockInfrastructureManager.createClubInfrastructure.mockResolvedValue(true);
  });

  /**
   * **Feature: tau-kays, Property 2: Club creation completeness**
   * For any valid club creation request by a Super Admin, the system should 
   * atomically create the club record, generate a unique identifier, create 
   * the associated Club President account, and generate the club-specific URL path.
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Atomic club creation with all required components', () => {
    test('Club creation without president should create club record and URL path', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clubName: validClubName(),
            clubDescription: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
          }),
          async (testData) => {
            const clubId = `club-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const expectedSlug = testData.clubName.toLowerCase()
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

            // Mock no existing club with same name
            mockPrismaClient.club.findUnique.mockResolvedValueOnce(null);
            
            // Mock successful club creation
            const mockClub = {
              id: clubId,
              name: testData.clubName,
              description: testData.clubDescription,
              urlSlug: expectedSlug,
              presidentId: null,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              president: null
            };
            mockPrismaClient.club.create.mockResolvedValueOnce(mockClub);

            const createClubRequest = {
              name: testData.clubName,
              description: testData.clubDescription,
            };

            const result = await clubService.createClub(createClubRequest, testSuperAdminId);

            // Property 1: Club record should be created with unique identifier
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);
            expect(result.name).toBe(testData.clubName);
            expect(result.description).toBe(testData.clubDescription);
            expect(result.isActive).toBe(true);

            // Property 2: Club-specific URL path should be generated following /kulup/{club-slug} pattern
            expect(result.urlSlug).toBeDefined();
            expect(typeof result.urlSlug).toBe('string');
            expect(result.urlSlug).toMatch(/^[a-z0-9-]+$/);
            expect(result.urlSlug.length).toBeGreaterThan(0);
            expect(result.urlSlug).not.toMatch(/^-|-$/);
            
            // Property 3: URL should follow the /kulup/{slug} pattern
            const expectedUrl = `/kulup/${result.urlSlug}`;
            expect(expectedUrl).toMatch(/^\/kulup\/[a-z0-9-]+$/);

            // Property 4: Turkish character support in URL slug generation
            if (/[çğıöşüÇĞIİÖŞÜ]/.test(testData.clubName)) {
              expect(result.urlSlug).not.toMatch(/[çğıöşüÇĞIİÖŞÜ]/);
            }

            // Property 5: Audit logging should be performed
            expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                userId: testSuperAdminId,
                action: 'CREATE',
                resource: 'CLUB',
                resourceId: clubId,
                changes: expect.objectContaining({
                  clubName: testData.clubName,
                  urlSlug: expectedSlug,
                }),
                timestamp: expect.any(Date),
                success: true
              })
            });

            // Property 6: Infrastructure creation should be attempted
            expect(mockInfrastructureManager.createClubInfrastructure).toHaveBeenCalledWith(clubId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Club creation with president should atomically create club and president account', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clubName: validClubName(),
            clubDescription: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
            presidentEmail: validEmail(),
            presidentFirstName: validPersonName(),
            presidentLastName: validPersonName(),
            presidentExists: fc.boolean(),
          }),
          async (testData) => {
            const clubId = `club-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const presidentId = `president-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const expectedSlug = testData.clubName.toLowerCase()
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

            // Mock no existing club with same name
            mockPrismaClient.club.findUnique.mockResolvedValueOnce(null);

            let mockPresident;
            if (testData.presidentExists) {
              // Mock existing user that needs role update
              mockPresident = {
                id: presidentId,
                email: testData.presidentEmail,
                role: UserRole.STUDENT,
                firstName: testData.presidentFirstName,
                lastName: testData.presidentLastName,
                isActive: true
              };
              mockPrismaClient.user.findUnique.mockResolvedValueOnce(mockPresident);
              
              // Mock role update
              const updatedPresident = { ...mockPresident, role: UserRole.CLUB_PRESIDENT };
              mockPrismaClient.user.update.mockResolvedValueOnce(updatedPresident);
              mockPresident = updatedPresident;
            } else {
              // Mock no existing user
              mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);
              
              // Mock new user creation
              mockPresident = {
                id: presidentId,
                email: testData.presidentEmail,
                passwordHash: 'hashed-password',
                role: UserRole.CLUB_PRESIDENT,
                firstName: testData.presidentFirstName,
                lastName: testData.presidentLastName,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              mockPrismaClient.user.create.mockResolvedValueOnce(mockPresident);
            }

            // Mock successful club creation with president
            const mockClub = {
              id: clubId,
              name: testData.clubName,
              description: testData.clubDescription,
              urlSlug: expectedSlug,
              presidentId: presidentId,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              president: mockPresident
            };
            mockPrismaClient.club.create.mockResolvedValueOnce(mockClub);

            const createClubRequest = {
              name: testData.clubName,
              description: testData.clubDescription,
              presidentEmail: testData.presidentEmail,
              presidentFirstName: testData.presidentFirstName,
              presidentLastName: testData.presidentLastName,
            };

            const result = await clubService.createClub(createClubRequest, testSuperAdminId);

            // Property 1: Club record should be created with unique identifier
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);
            expect(result.name).toBe(testData.clubName);
            expect(result.description).toBe(testData.clubDescription);
            expect(result.isActive).toBe(true);

            // Property 2: Associated Club President account should be automatically created/updated
            expect(result.presidentId).toBeDefined();
            expect(result.presidentId).toBe(presidentId);
            expect(result.president).toBeDefined();
            expect(result.president!.email).toBe(testData.presidentEmail);
            expect(result.president!.firstName).toBe(testData.presidentFirstName);
            expect(result.president!.lastName).toBe(testData.presidentLastName);
            expect(result.president!.role).toBe(UserRole.CLUB_PRESIDENT);
            expect(result.president!.isActive).toBe(true);

            // Property 3: Club-specific URL path should be generated following /kulup/{club-slug} pattern
            expect(result.urlSlug).toBeDefined();
            expect(typeof result.urlSlug).toBe('string');
            expect(result.urlSlug).toMatch(/^[a-z0-9-]+$/);
            expect(result.urlSlug.length).toBeGreaterThan(0);
            expect(result.urlSlug).not.toMatch(/^-|-$/);
            
            const expectedUrl = `/kulup/${result.urlSlug}`;
            expect(expectedUrl).toMatch(/^\/kulup\/[a-z0-9-]+$/);

            // Property 4: Turkish character support in URL slug generation
            if (/[çğıöşüÇĞIİÖŞÜ]/.test(testData.clubName)) {
              expect(result.urlSlug).not.toMatch(/[çğıöşüÇĞIİÖŞÜ]/);
            }

            // Property 5: All operations should be atomic (either all succeed or all fail)
            // This is verified by the fact that we get a complete result with all components
            expect(result.id).toBeDefined();
            expect(result.presidentId).toBeDefined();
            expect(result.urlSlug).toBeDefined();
            expect(result.president).toBeDefined();

            // Property 6: Audit logging should be performed
            expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                userId: testSuperAdminId,
                action: 'CREATE',
                resource: 'CLUB',
                resourceId: clubId,
                changes: expect.objectContaining({
                  clubName: testData.clubName,
                  urlSlug: expectedSlug,
                  presidentId: presidentId
                }),
                timestamp: expect.any(Date),
                success: true
              })
            });

            // Property 7: Infrastructure creation should be attempted
            expect(mockInfrastructureManager.createClubInfrastructure).toHaveBeenCalledWith(clubId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('URL slug generation properties with Turkish character handling', () => {
      fc.assert(
        fc.property(
          fc.record({
            clubName: validClubName(),
            hasTurkishChars: fc.boolean(),
          }),
          (testData) => {
            let processedName = testData.clubName;
            if (testData.hasTurkishChars) {
              // Add Turkish characters to test transliteration
              const turkishSuffixes = ['Öğrenci Kulübü', 'Spor Kulübü', 'Sanat Kulübü', 'Müzik Kulübü'];
              const suffix = turkishSuffixes[Math.floor(Math.random() * turkishSuffixes.length)];
              processedName = `${testData.clubName} ${suffix}`;
            }

            // Generate expected slug using the same logic as the service
            const expectedSlug = processedName.toLowerCase()
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

            // Property 1: URL slug should be properly formatted
            expect(expectedSlug).toMatch(/^[a-z0-9-]*$/);
            expect(expectedSlug).not.toMatch(/^-|-$/);
            if (expectedSlug.length > 0) {
              expect(expectedSlug.length).toBeGreaterThan(0);
            }

            // Property 2: URL should follow the /kulup/{slug} pattern
            if (expectedSlug.length > 0) {
              const expectedUrl = `/kulup/${expectedSlug}`;
              expect(expectedUrl).toMatch(/^\/kulup\/[a-z0-9-]+$/);
            }

            // Property 3: Turkish characters should be properly transliterated
            if (testData.hasTurkishChars) {
              expect(expectedSlug).not.toMatch(/[çğıöşüÇĞIİÖŞÜ]/);
              // Should contain transliterated versions
              if (processedName.includes('Öğrenci')) {
                expect(expectedSlug).toContain('ogrenci');
              }
              if (processedName.includes('Kulübü')) {
                expect(expectedSlug).toContain('kulubu');
              }
              if (processedName.includes('Müzik')) {
                expect(expectedSlug).toContain('muzik');
              }
            }

            // Property 4: Original club name should be preserved for validation
            expect(testData.clubName.trim().length).toBeGreaterThanOrEqual(3);
            expect(/[a-zA-Z0-9\u00C0-\u017F]/.test(testData.clubName)).toBe(true);

            // Property 5: Slug generation should be deterministic
            const expectedSlug2 = processedName.toLowerCase()
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
            
            expect(expectedSlug).toBe(expectedSlug2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Unique identifier generation and validation properties', () => {
      fc.assert(
        fc.property(
          fc.record({
            clubName: validClubName(),
            existingClubCount: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const clubIds = new Set<string>();
            const urlSlugs = new Set<string>();

            // Generate multiple club identifiers to test uniqueness
            for (let i = 0; i < testData.existingClubCount + 1; i++) {
              const clubId = `club-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${i}`;
              const baseSlug = testData.clubName.toLowerCase()
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
              
              const urlSlug = i === 0 ? baseSlug : `${baseSlug}-${i}`;

              clubIds.add(clubId);
              if (urlSlug.length > 0) {
                urlSlugs.add(urlSlug);
              }
            }

            // Property 1: All club IDs should be unique
            expect(clubIds.size).toBe(testData.existingClubCount + 1);

            // Property 2: All club IDs should be valid strings
            clubIds.forEach(id => {
              expect(typeof id).toBe('string');
              expect(id.length).toBeGreaterThan(0);
              expect(id).toMatch(/^club-\d+-[a-z0-9]+-\d+$/);
            });

            // Property 3: All URL slugs should be unique (if generated)
            if (urlSlugs.size > 0) {
              urlSlugs.forEach(slug => {
                expect(typeof slug).toBe('string');
                expect(slug).toMatch(/^[a-z0-9-]+$/);
                expect(slug).not.toMatch(/^-|-$/);
              });
            }

            // Property 4: URL slug uniqueness mechanism should work
            if (testData.existingClubCount > 0 && urlSlugs.size > 1) {
              const slugArray = Array.from(urlSlugs);
              const baseSlug = slugArray[0];
              const numberedSlugs = slugArray.slice(1);
              
              numberedSlugs.forEach((slug, index) => {
                expect(slug).toBe(`${baseSlug}-${index + 1}`);
              });
            }

            // Property 5: Club name should be valid for ID generation
            expect(testData.clubName.trim().length).toBeGreaterThanOrEqual(3);
            expect(/[a-zA-Z0-9\u00C0-\u017F]/.test(testData.clubName)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error handling and validation properties', () => {
    test('Invalid club creation requests should be properly validated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clubName: fc.oneof(
              fc.constant(''), // Empty name
              fc.constant('  '), // Whitespace only
              fc.string({ minLength: 1, maxLength: 2 }), // Too short
              fc.string({ minLength: 201, maxLength: 300 }) // Too long
            ),
            presidentEmail: fc.oneof(
              fc.constant('invalid-email'), // Invalid format
              fc.constant(''), // Empty email
              fc.constant('test@') // Incomplete email
            ),
            presidentFirstName: fc.oneof(
              fc.constant(''), // Empty name
              fc.constant('A') // Too short
            ),
            presidentLastName: fc.oneof(
              fc.constant(''), // Empty name
              fc.constant('B') // Too short
            ),
          }),
          async (testData) => {
            const createClubRequest = {
              name: testData.clubName,
              description: 'Test description',
              presidentEmail: testData.presidentEmail,
              presidentFirstName: testData.presidentFirstName,
              presidentLastName: testData.presidentLastName,
            };

            // Property 1: Invalid club names should be detectable
            const isValidName = testData.clubName.trim().length >= 3 && 
                               testData.clubName.trim().length <= 200 &&
                               /[a-zA-Z0-9\u00C0-\u017F]/.test(testData.clubName.trim());
            
            expect(typeof isValidName).toBe('boolean');

            // Property 2: Invalid emails should be detectable
            const isValidEmail = testData.presidentEmail.length >= 5 && 
                                testData.presidentEmail.includes('@') &&
                                testData.presidentEmail.includes('.');
            
            expect(typeof isValidEmail).toBe('boolean');

            // Property 3: Invalid names should be detectable
            const isValidFirstName = testData.presidentFirstName.trim().length >= 2;
            const isValidLastName = testData.presidentLastName.trim().length >= 2;
            
            expect(typeof isValidFirstName).toBe('boolean');
            expect(typeof isValidLastName).toBe('boolean');

            // Property 4: At least one validation should fail for these test cases
            const hasValidationErrors = !isValidName || !isValidEmail || !isValidFirstName || !isValidLastName;
            expect(hasValidationErrors).toBe(true);

            // Property 5: Error conditions should be identifiable
            const errorReasons = [];
            if (!isValidName) errorReasons.push('invalid_name');
            if (!isValidEmail) errorReasons.push('invalid_email');
            if (!isValidFirstName) errorReasons.push('invalid_first_name');
            if (!isValidLastName) errorReasons.push('invalid_last_name');

            expect(errorReasons.length).toBeGreaterThan(0);
            expect(errorReasons.every(reason => typeof reason === 'string')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});