/**
 * JWT Service Integration Test
 * Simple test to verify the JWT service works end-to-end
 */

import { JWTService } from '../../lib/auth/jwt';
import { redisManager } from '../../lib/auth/redis';
import { UserRole } from '@prisma/client';

describe('JWT Service Integration', () => {
  beforeAll(async () => {
    // Set required environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-integration';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    
    // Mock Redis for integration test
    jest.spyOn(redisManager, 'isReady').mockReturnValue(true);
    jest.spyOn(redisManager, 'getClient').mockReturnValue({
      setEx: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      sAdd: jest.fn(),
      expire: jest.fn(),
      sRem: jest.fn(),
      sMembers: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
    } as any);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  it('should complete full JWT workflow', async () => {
    const userId = 'test-user-id';
    const role = UserRole.STUDENT;

    // 1. Generate token pair
    const tokens = await JWTService.generateTokenPair(userId, role);
    
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBe(15 * 60); // 15 minutes
    expect(tokens.refreshExpiresIn).toBe(7 * 24 * 60 * 60); // 7 days

    // 2. Validate access token
    const validation = await JWTService.validateAccessToken(tokens.accessToken);
    
    expect(validation.valid).toBe(true);
    expect(validation.payload?.userId).toBe(userId);
    expect(validation.payload?.role).toBe(role);
    expect(Array.isArray(validation.payload?.permissions)).toBe(true);

    // 3. Extract user ID from token
    const extractedUserId = JWTService.extractUserIdFromToken(tokens.accessToken);
    expect(extractedUserId).toBe(userId);

    // 4. Check token expiration
    const expiration = JWTService.getTokenExpiration(tokens.accessToken);
    expect(expiration).toBeInstanceOf(Date);
    expect(expiration!.getTime()).toBeGreaterThan(Date.now());

    // 5. Revoke token
    await expect(JWTService.revokeToken(tokens.accessToken)).resolves.not.toThrow();

    console.log('✅ JWT Service integration test completed successfully');
  });

  it('should handle different user roles correctly', async () => {
    const roles = [UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT];
    
    for (const role of roles) {
      const tokens = await JWTService.generateTokenPair('user-id', role);
      const validation = await JWTService.validateAccessToken(tokens.accessToken);
      
      expect(validation.valid).toBe(true);
      expect(validation.payload?.role).toBe(role);
      expect(validation.payload?.permissions.length).toBeGreaterThan(0);
    }
  });

  it('should handle club president with club ID', async () => {
    const clubId = 'test-club-id';
    const tokens = await JWTService.generateTokenPair('user-id', UserRole.CLUB_PRESIDENT, clubId);
    const validation = await JWTService.validateAccessToken(tokens.accessToken);
    
    expect(validation.valid).toBe(true);
    expect(validation.payload?.clubId).toBe(clubId);
    expect(validation.payload?.role).toBe(UserRole.CLUB_PRESIDENT);
  });
});