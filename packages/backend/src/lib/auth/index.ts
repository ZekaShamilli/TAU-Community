/**
 * Authentication module exports
 */

// Services
export { AuthService } from './service';
export { JWTService } from './jwt';
export { TokenBlacklistService, redisManager } from './redis';

// Types
export type {
  JWTPayload,
  TokenPair,
  RefreshTokenData,
  BlacklistedToken,
  AuthUser,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
  TokenValidationResult,
  RefreshTokenValidationResult,
  Permission,
} from './types';

export {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from './types';

// Re-export UserRole from Prisma for convenience
export { UserRole } from '@prisma/client';