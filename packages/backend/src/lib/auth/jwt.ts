/**
 * JWT Token Service with refresh token support and blacklisting
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  JWTPayload, 
  TokenPair, 
  RefreshTokenData, 
  TokenValidationResult, 
  RefreshTokenValidationResult,
  BlacklistedToken,
  ROLE_PERMISSIONS
} from './types';
import { TokenBlacklistService } from './redis';
import { UserRole } from '@prisma/client';

export class JWTService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET!;
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private static readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  static {
    // Validate required environment variables
    if (!this.JWT_SECRET || !this.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets must be configured in environment variables');
    }
  }

  /**
   * Generate a unique JWT ID
   */
  private static generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a token family ID for refresh token rotation
   */
  private static generateTokenFamily(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  /**
   * Convert time string to seconds
   */
  private static parseTimeToSeconds(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  /**
   * Generate access and refresh token pair
   */
  public static async generateTokenPair(
    userId: string,
    role: UserRole,
    clubId?: string
  ): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenJTI = this.generateJTI();
    const refreshTokenJTI = this.generateJTI();
    const tokenFamily = this.generateTokenFamily();
    
    const accessExpiresIn = this.parseTimeToSeconds(this.JWT_EXPIRES_IN);
    const refreshExpiresIn = this.parseTimeToSeconds(this.JWT_REFRESH_EXPIRES_IN);

    // Get permissions for the user role
    const permissions = ROLE_PERMISSIONS[role] || [];

    // Create access token payload
    const accessPayload: JWTPayload = {
      userId,
      role,
      clubId,
      permissions,
      iat: now,
      exp: now + accessExpiresIn,
    };

    // Create refresh token payload
    const refreshPayload: RefreshTokenData = {
      userId,
      role,
      clubId,
      tokenFamily,
      version: 1,
      iat: now,
      exp: now + refreshExpiresIn,
    };

    // Sign tokens
    const accessToken = jwt.sign(
      { ...accessPayload, jti: accessTokenJTI },
      this.JWT_SECRET,
      { algorithm: 'HS256' }
    );

    const refreshToken = jwt.sign(
      { ...refreshPayload, jti: refreshTokenJTI },
      this.JWT_REFRESH_SECRET,
      { algorithm: 'HS256' }
    );

    // Store refresh token family in Redis
    await TokenBlacklistService.storeRefreshTokenFamily(
      tokenFamily,
      userId,
      1,
      new Date((now + refreshExpiresIn) * 1000)
    );

    // Track user tokens for logout functionality
    await TokenBlacklistService.addUserToken(
      userId,
      accessTokenJTI,
      new Date((now + accessExpiresIn) * 1000)
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn,
    };
  }

  /**
   * Validate access token
   */
  public static async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      // Check if token is blacklisted
      if (decoded.jti && await TokenBlacklistService.isTokenBlacklisted(decoded.jti)) {
        return {
          valid: false,
          error: 'Token has been revoked',
        };
      }

      // Validate payload structure
      if (!decoded.userId || !decoded.role || !decoded.permissions) {
        return {
          valid: false,
          error: 'Invalid token payload',
        };
      }

      const payload: JWTPayload = {
        userId: decoded.userId,
        role: decoded.role,
        clubId: decoded.clubId,
        permissions: decoded.permissions,
        iat: decoded.iat,
        exp: decoded.exp,
      };

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token expired',
          expired: true,
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token',
        };
      }

      return {
        valid: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Validate refresh token
   */
  public static async validateRefreshToken(token: string): Promise<RefreshTokenValidationResult> {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as any;
      
      // Check if token is blacklisted
      if (decoded.jti && await TokenBlacklistService.isTokenBlacklisted(decoded.jti)) {
        return {
          valid: false,
          error: 'Refresh token has been revoked',
        };
      }

      // Validate payload structure
      if (!decoded.userId || !decoded.role || !decoded.tokenFamily || !decoded.version) {
        return {
          valid: false,
          error: 'Invalid refresh token payload',
        };
      }

      // Check token family validity
      const familyInfo = await TokenBlacklistService.getRefreshTokenFamily(decoded.tokenFamily);
      if (!familyInfo) {
        return {
          valid: false,
          error: 'Refresh token family not found or expired',
        };
      }

      // Check if this is the current version
      if (familyInfo.version !== decoded.version) {
        // Token family has been rotated, invalidate the family for security
        await TokenBlacklistService.invalidateRefreshTokenFamily(decoded.tokenFamily);
        return {
          valid: false,
          error: 'Refresh token version mismatch - possible token reuse detected',
        };
      }

      const payload: RefreshTokenData = {
        userId: decoded.userId,
        role: decoded.role,
        clubId: decoded.clubId,
        tokenFamily: decoded.tokenFamily,
        version: decoded.version,
        iat: decoded.iat,
        exp: decoded.exp,
      };

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Refresh token expired',
          expired: true,
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid refresh token',
        };
      }

      return {
        valid: false,
        error: 'Refresh token validation failed',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public static async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    const validation = await this.validateRefreshToken(refreshToken);
    
    if (!validation.valid || !validation.payload) {
      return null;
    }

    const { userId, role, clubId, tokenFamily, version } = validation.payload;

    // Blacklist the old refresh token
    const oldDecoded = jwt.decode(refreshToken) as any;
    if (oldDecoded?.jti) {
      await TokenBlacklistService.blacklistToken({
        jti: oldDecoded.jti,
        userId,
        expiresAt: new Date(oldDecoded.exp * 1000),
        reason: 'REFRESH',
      });
    }

    // Generate new token pair with rotated refresh token
    const now = Math.floor(Date.now() / 1000);
    const accessTokenJTI = this.generateJTI();
    const refreshTokenJTI = this.generateJTI();
    const newVersion = version + 1;
    
    const accessExpiresIn = this.parseTimeToSeconds(this.JWT_EXPIRES_IN);
    const refreshExpiresIn = this.parseTimeToSeconds(this.JWT_REFRESH_EXPIRES_IN);

    // Get permissions for the user role
    const permissions = ROLE_PERMISSIONS[role] || [];

    // Create new access token payload
    const accessPayload: JWTPayload = {
      userId,
      role,
      clubId,
      permissions,
      iat: now,
      exp: now + accessExpiresIn,
    };

    // Create new refresh token payload with incremented version
    const refreshPayload: RefreshTokenData = {
      userId,
      role,
      clubId,
      tokenFamily, // Keep the same family
      version: newVersion,
      iat: now,
      exp: now + refreshExpiresIn,
    };

    // Sign new tokens
    const newAccessToken = jwt.sign(
      { ...accessPayload, jti: accessTokenJTI },
      this.JWT_SECRET,
      { algorithm: 'HS256' }
    );

    const newRefreshToken = jwt.sign(
      { ...refreshPayload, jti: refreshTokenJTI },
      this.JWT_REFRESH_SECRET,
      { algorithm: 'HS256' }
    );

    // Update refresh token family version in Redis
    await TokenBlacklistService.storeRefreshTokenFamily(
      tokenFamily,
      userId,
      newVersion,
      new Date((now + refreshExpiresIn) * 1000)
    );

    // Track new access token
    await TokenBlacklistService.addUserToken(
      userId,
      accessTokenJTI,
      new Date((now + accessExpiresIn) * 1000)
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn,
    };
  }

  /**
   * Revoke a specific token
   */
  public static async revokeToken(token: string, reason: BlacklistedToken['reason'] = 'LOGOUT'): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      
      if (!decoded || !decoded.jti || !decoded.userId || !decoded.exp) {
        throw new Error('Invalid token structure');
      }

      await TokenBlacklistService.blacklistToken({
        jti: decoded.jti,
        userId: decoded.userId,
        expiresAt: new Date(decoded.exp * 1000),
        reason,
      });

      // Remove from user's active tokens
      await TokenBlacklistService.removeUserToken(decoded.userId, decoded.jti);
    } catch (error) {
      console.error('Error revoking token:', error);
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Revoke all tokens for a user
   */
  public static async revokeAllUserTokens(userId: string, reason: BlacklistedToken['reason'] = 'LOGOUT'): Promise<void> {
    await TokenBlacklistService.blacklistAllUserTokens(userId, reason);
  }

  /**
   * Extract user ID from token without validation (for logging purposes)
   */
  public static extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.userId || null;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  public static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired (without validating signature)
   */
  public static isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration.getTime() < Date.now() : true;
  }
}