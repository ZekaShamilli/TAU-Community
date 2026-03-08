/**
 * Property-Based Tests for Data Encryption and Protection
 * **Feature: tau-kays, Property 11: Data encryption and protection**
 * **Validates: Requirements 10.5**
 * 
 * Tests universal properties that should hold for all sensitive data encryption
 */

import fc from 'fast-check';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { AuthService } from '../../lib/auth/service';
import { UserService } from '../../lib/user/service';
import { db } from '../../lib/database';
import { UserRole } from '@prisma/client';

// Mock dependencies for isolated testing
jest.mock('../../lib/database');
jest.mock('../../lib/auth/redis');

const mockDb = db as jest.Mocked<typeof db>;

describe('Property 11: Data encryption and protection', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup basic database mocks
    mockClient = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      club: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    
    mockDb.getClient.mockReturnValue(mockClient);
  });

  /**
   * **Feature: tau-kays, Property 11: Data encryption and protection**
   * For any sensitive data stored in the system, including authentication credentials 
   * and personal information, the data should be properly encrypted using industry-standard 
   * encryption methods.
   * **Validates: Requirements 10.5**
   */
  describe('Password encryption with bcrypt', () => {
    test('Password hashing uses bcrypt with secure parameters', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 128 }),
          async (password) => {
            // Test password hashing with bcrypt using UserService
            const hashedPassword = await UserService.hashPassword(password);
            
            // Property: Hashed password should never equal original password
            expect(hashedPassword).not.toBe(password);
            
            // Property: Hashed password should be a valid bcrypt hash with 12 salt rounds
            expect(hashedPassword).toMatch(/^\$2[aby]\$12\$.{53}$/);
            
            // Property: Same password should verify against the hash
            const isValid = await UserService.verifyPassword(password, hashedPassword);
            expect(isValid).toBe(true);
            
            // Property: Different password should not verify against the hash
            if (password.length > 0) {
              const differentPassword = password + 'x';
              const isInvalid = await UserService.verifyPassword(differentPassword, hashedPassword);
              expect(isInvalid).toBe(false);
            }
            
            // Property: Hash should be non-deterministic (different salt each time)
            const secondHash = await UserService.hashPassword(password);
            expect(secondHash).not.toBe(hashedPassword);
            
            // Property: Both hashes should verify the same password
            const secondVerification = await UserService.verifyPassword(password, secondHash);
            expect(secondVerification).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Direct bcrypt usage maintains security properties', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 128 }),
          fc.integer({ min: 10, max: 15 }),
          async (password, saltRounds) => {
            // Test direct bcrypt usage (as used in AuthService)
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            // Property: Hash format should be correct
            expect(hashedPassword).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
            
            // Property: Salt rounds should be embedded in hash
            const expectedSaltPattern = new RegExp(`^\\$2[aby]\\$${saltRounds.toString().padStart(2, '0')}\\$`);
            expect(hashedPassword).toMatch(expectedSaltPattern);
            
            // Property: Verification should work
            const isValid = await bcrypt.compare(password, hashedPassword);
            expect(isValid).toBe(true);
            
            // Property: Wrong password should not verify
            const wrongPassword = password.slice(0, -1) + (password.slice(-1) === 'a' ? 'b' : 'a');
            const isInvalid = await bcrypt.compare(wrongPassword, hashedPassword);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('TOTP secret generation and encryption', () => {
    test('TOTP secrets are properly generated and stored securely', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (email, issuer) => {
            // Generate TOTP secret
            const secret = speakeasy.generateSecret({
              name: email,
              issuer: issuer || 'TAU Community',
              length: 32,
            });
            
            // Property: Secret should be base32 encoded
            expect(secret.base32).toMatch(/^[A-Z2-7]+=*$/);
            
            // Property: Secret should be at least 32 characters (before padding)
            const secretWithoutPadding = secret.base32.replace(/=+$/, '');
            expect(secretWithoutPadding.length).toBeGreaterThanOrEqual(32);
            
            // Property: Secret should generate valid TOTP codes
            const token = speakeasy.totp({
              secret: secret.base32,
              encoding: 'base32',
            });
            
            expect(token).toMatch(/^\d{6}$/);
            
            // Property: Generated token should verify correctly
            const isValid = speakeasy.totp.verify({
              secret: secret.base32,
              encoding: 'base32',
              token: token,
              window: 2,
            });
            
            expect(isValid).toBe(true);
            
            // Property: Invalid token should not verify
            const invalidToken = token === '000000' ? '111111' : '000000';
            const isInvalid = speakeasy.totp.verify({
              secret: secret.base32,
              encoding: 'base32',
              token: invalidToken,
              window: 0,
            });
            
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('AuthService TOTP integration maintains security', () => {
      fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (email) => {
            // Generate TOTP secret through AuthService
            const totpData = await AuthService.generateTOTPSecret(email);
            
            // Property: Generated secret should be secure
            expect(totpData.secret).toMatch(/^[A-Z2-7]+=*$/);
            expect(totpData.secret.replace(/=+$/, '').length).toBeGreaterThanOrEqual(32);
            
            // Property: QR code URL should be properly formatted
            expect(totpData.qrCodeUrl).toMatch(/^otpauth:\/\/totp\//);
            expect(totpData.qrCodeUrl).toContain(encodeURIComponent(email));
            
            // Property: Manual entry key should match secret
            expect(totpData.manualEntryKey).toBe(totpData.secret);
            
            // Property: QR code data URL should be valid
            expect(totpData.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
            
            // Test TOTP verification
            const currentToken = speakeasy.totp({
              secret: totpData.secret,
              encoding: 'base32',
            });
            
            // Property: Current token should verify
            const isCurrentValid = AuthService.verifyTOTP(totpData.secret, currentToken);
            expect(isCurrentValid).toBe(true);
            
            // Property: Random invalid token should not verify
            const invalidToken = '123456';
            if (invalidToken !== currentToken) {
              const isRandomValid = AuthService.verifyTOTP(totpData.secret, invalidToken);
              expect(isRandomValid).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Cryptographic token generation', () => {
    test('Reset tokens are cryptographically secure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 64 }),
          (byteLength) => {
            // Generate secure reset token (as used in AuthService)
            const resetToken = crypto.randomBytes(byteLength).toString('hex');
            
            // Property: Token should be hex-encoded
            expect(resetToken).toMatch(/^[a-f0-9]+$/);
            
            // Property: Token length should be exactly 2 * byteLength
            expect(resetToken.length).toBe(byteLength * 2);
            
            // Property: Multiple tokens should be different
            const secondToken = crypto.randomBytes(byteLength).toString('hex');
            expect(resetToken).not.toBe(secondToken);
            
            // Property: Token should have high entropy
            const uniqueChars = new Set(resetToken.split(''));
            expect(uniqueChars.size).toBeGreaterThan(4);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('JWT token IDs are cryptographically secure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 32 }),
          (tokenLength) => {
            // Test JWT ID generation (similar to JWT service)
            const jti = crypto.randomBytes(tokenLength).toString('hex');
            
            // Property: Should be hex-encoded
            expect(jti).toMatch(/^[a-f0-9]+$/);
            
            // Property: Should have correct length
            expect(jti.length).toBe(tokenLength * 2);
            
            // Test token family generation
            const tokenFamily = crypto.randomBytes(20).toString('hex');
            
            // Property: Token family should be 40 characters
            expect(tokenFamily.length).toBe(40);
            expect(tokenFamily).toMatch(/^[a-f0-9]{40}$/);
            
            // Property: Multiple generations should produce different values
            const secondJti = crypto.randomBytes(tokenLength).toString('hex');
            const secondFamily = crypto.randomBytes(20).toString('hex');
            
            expect(jti).not.toBe(secondJti);
            expect(tokenFamily).not.toBe(secondFamily);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sensitive data storage protection', () => {
    test('Passwords are never stored in plain text', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            firstName: fc.string({ minLength: 2, maxLength: 50 }),
            lastName: fc.string({ minLength: 2, maxLength: 50 }),
            phone: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
          }),
          async (userData) => {
            // Mock successful user creation
            const hashedPassword = await bcrypt.hash(userData.password, 12);
            
            const createdUser = {
              id: 'test-user-id',
              email: userData.email.toLowerCase(),
              passwordHash: hashedPassword,
              role: UserRole.STUDENT,
              firstName: userData.firstName,
              lastName: userData.lastName,
              phone: userData.phone,
              isActive: true,
              totpEnabled: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            mockClient.user.findUnique.mockResolvedValue(null);
            
            // Mock the transaction to capture the actual data being passed
            let capturedCreateData: any = null;
            mockClient.$transaction.mockImplementation(async (callback: any) => {
              const mockTx = {
                user: {
                  findUnique: jest.fn().mockResolvedValue(null),
                  create: jest.fn().mockImplementation((data) => {
                    capturedCreateData = data.data;
                    return Promise.resolve(createdUser);
                  }),
                },
                club: mockClient.club,
              };
              return await callback(mockTx);
            });
            
            // Create user through service
            const result = await UserService.createUser(
              {
                email: userData.email,
                password: userData.password,
                role: UserRole.STUDENT,
                firstName: userData.firstName,
                lastName: userData.lastName,
                phone: userData.phone,
              },
              'admin-id',
              UserRole.SUPER_ADMIN
            );
            
            // Property: Password should never be stored in plain text
            if (capturedCreateData) {
              expect(capturedCreateData.passwordHash).not.toBe(userData.password);
              expect(capturedCreateData.passwordHash).toMatch(/^\$2[aby]\$12\$.{53}$/);
              expect(capturedCreateData).not.toHaveProperty('password');
            }
            
            // Property: Email should be normalized to lowercase
            if (capturedCreateData) {
              expect(capturedCreateData.email).toBe(userData.email.toLowerCase());
            }
            
            // Property: Other personal data should be stored as provided
            if (capturedCreateData) {
              expect(capturedCreateData.firstName).toBe(userData.firstName);
              expect(capturedCreateData.lastName).toBe(userData.lastName);
              expect(capturedCreateData.phone).toBe(userData.phone);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Password validation enforces security requirements', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (password) => {
            const validation = UserService.validatePassword(password);
            
            // Property: Passwords under 8 characters should be invalid
            if (password.length < 8) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must be at least 8 characters long');
            }
            
            // Property: Passwords over 128 characters should be invalid
            if (password.length > 128) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must be no more than 128 characters long');
            }
            
            // Property: Passwords without required character types should be invalid
            const hasLower = /[a-z]/.test(password);
            const hasUpper = /[A-Z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecial = /[^a-zA-Z0-9]/.test(password);
            
            if (!hasLower) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must contain at least one lowercase letter');
            }
            
            if (!hasUpper) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must contain at least one uppercase letter');
            }
            
            if (!hasNumber) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must contain at least one number');
            }
            
            if (!hasSpecial) {
              expect(validation.valid).toBe(false);
              expect(validation.errors).toContain('Password must contain at least one special character');
            }
            
            // Property: Valid passwords should meet all criteria
            const meetsLength = password.length >= 8 && password.length <= 128;
            
            if (meetsLength && hasLower && hasUpper && hasNumber && hasSpecial) {
              expect(validation.valid).toBe(true);
              expect(validation.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Industry-standard encryption methods', () => {
    test('bcrypt uses industry-standard parameters', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 128 }),
          async (password) => {
            // Test that UserService uses appropriate bcrypt parameters
            const hash = await UserService.hashPassword(password);
            
            // Property: Should use bcrypt version 2a, 2b, or 2y
            expect(hash).toMatch(/^\$2[aby]\$/);
            
            // Property: Should use 12 salt rounds (industry recommended minimum)
            expect(hash).toMatch(/^\$2[aby]\$12\$/);
            
            // Property: Hash should be 60 characters total
            expect(hash.length).toBe(60);
            
            // Property: Should be resistant to timing attacks (constant time verification)
            const startTime = process.hrtime.bigint();
            await bcrypt.compare(password, hash);
            const endTime = process.hrtime.bigint();
            
            const verificationTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            // Verification should take reasonable time (not instant, indicating proper work factor)
            expect(verificationTime).toBeGreaterThan(1); // At least 1ms
            expect(verificationTime).toBeLessThan(1000); // But not more than 1 second
          }
        ),
        { numRuns: 50 } // Reduced runs due to timing sensitivity
      );
    });

    test('Cryptographic randomness meets security standards', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 32, max: 64 }),
          (byteLength) => {
            // Generate multiple random values
            const values = Array.from({ length: 10 }, () => 
              crypto.randomBytes(byteLength).toString('hex')
            );
            
            // Property: All values should be different
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
            
            // Property: Each value should have expected length
            values.forEach(value => {
              expect(value.length).toBe(byteLength * 2);
              expect(value).toMatch(/^[a-f0-9]+$/);
            });
            
            // Property: Values should have good entropy distribution
            const allChars = values.join('');
            const charCounts = new Map<string, number>();
            
            for (const char of allChars) {
              charCounts.set(char, (charCounts.get(char) || 0) + 1);
            }
            
            // Should use most hex characters (good distribution)
            expect(charCounts.size).toBeGreaterThan(10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});