/**
 * Redis client for token blacklisting and session management
 */

import { createClient, RedisClientType } from 'redis';
import { BlacklistedToken } from './types';

// In-memory fallback for development when Redis is not available
class InMemoryStore {
  private blacklist = new Map<string, any>();
  private refreshFamilies = new Map<string, any>();
  private userTokens = new Map<string, Set<string>>();

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    this.blacklist.set(key, JSON.parse(value));
    // In a real implementation, you'd handle TTL
    setTimeout(() => this.blacklist.delete(key), ttl * 1000);
  }

  async get(key: string): Promise<string | null> {
    const value = this.blacklist.get(key);
    return value ? JSON.stringify(value) : null;
  }

  async del(key: string): Promise<void> {
    this.blacklist.delete(key);
    this.refreshFamilies.delete(key);
    this.userTokens.delete(key);
  }

  async sAdd(key: string, value: string): Promise<void> {
    if (!this.userTokens.has(key)) {
      this.userTokens.set(key, new Set());
    }
    this.userTokens.get(key)!.add(value);
  }

  async sRem(key: string, value: string): Promise<void> {
    this.userTokens.get(key)?.delete(value);
  }

  async sMembers(key: string): Promise<string[]> {
    return Array.from(this.userTokens.get(key) || []);
  }

  async expire(key: string, ttl: number): Promise<void> {
    // In a real implementation, you'd handle TTL
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType | InMemoryStore | null = null;
  private isConnected = false;
  private useInMemory = false;

  private constructor() {}

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        console.log('Falling back to in-memory store for development');
        this.useInMemory = true;
        this.client = new InMemoryStore();
        this.isConnected = true;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis, using in-memory store:', error);
      this.useInMemory = true;
      this.client = new InMemoryStore();
      this.isConnected = true;
    }
  }

  /**
   * Get Redis client instance
   */
  public getClient(): RedisClientType | InMemoryStore {
    if (!this.client || !this.isConnected) {
      // Auto-initialize with in-memory store if not connected
      this.useInMemory = true;
      this.client = new InMemoryStore();
      this.isConnected = true;
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.client && !this.useInMemory) {
      await (this.client as RedisClientType).disconnect();
    }
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Health check for Redis connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isReady()) {
        return false;
      }
      await this.client!.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

/**
 * Token blacklist service using Redis
 */
export class TokenBlacklistService {
  private static readonly BLACKLIST_PREFIX = 'blacklist:';
  private static readonly REFRESH_FAMILY_PREFIX = 'refresh_family:';
  private static readonly USER_TOKENS_PREFIX = 'user_tokens:';

  /**
   * Add token to blacklist
   */
  public static async blacklistToken(token: BlacklistedToken): Promise<void> {
    const client = redisManager.getClient();
    const key = `${this.BLACKLIST_PREFIX}${token.jti}`;
    
    const ttl = Math.max(0, Math.floor((token.expiresAt.getTime() - Date.now()) / 1000));
    
    if (ttl > 0) {
      await client.setEx(key, ttl, JSON.stringify({
        userId: token.userId,
        reason: token.reason,
        blacklistedAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Check if token is blacklisted
   */
  public static async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const client = redisManager.getClient();
      const key = `${this.BLACKLIST_PREFIX}${jti}`;
      const result = await client.get(key);
      return result !== null;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      // Fail secure - if we can't check, assume it's blacklisted
      return true;
    }
  }

  /**
   * Store refresh token family for rotation
   */
  public static async storeRefreshTokenFamily(
    tokenFamily: string,
    userId: string,
    version: number,
    expiresAt: Date
  ): Promise<void> {
    const client = redisManager.getClient();
    const key = `${this.REFRESH_FAMILY_PREFIX}${tokenFamily}`;
    
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    
    if (ttl > 0) {
      await client.setEx(key, ttl, JSON.stringify({
        userId,
        version,
        createdAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Get refresh token family info
   */
  public static async getRefreshTokenFamily(tokenFamily: string): Promise<{
    userId: string;
    version: number;
    createdAt: string;
  } | null> {
    try {
      const client = redisManager.getClient();
      const key = `${this.REFRESH_FAMILY_PREFIX}${tokenFamily}`;
      const result = await client.get(key);
      
      if (!result) {
        return null;
      }
      
      return JSON.parse(result);
    } catch (error) {
      console.error('Error getting refresh token family:', error);
      return null;
    }
  }

  /**
   * Invalidate refresh token family (for security breaches)
   */
  public static async invalidateRefreshTokenFamily(tokenFamily: string): Promise<void> {
    const client = redisManager.getClient();
    const key = `${this.REFRESH_FAMILY_PREFIX}${tokenFamily}`;
    await client.del(key);
  }

  /**
   * Store user's active tokens for logout all functionality
   */
  public static async addUserToken(userId: string, jti: string, expiresAt: Date): Promise<void> {
    const client = redisManager.getClient();
    const key = `${this.USER_TOKENS_PREFIX}${userId}`;
    
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    
    if (ttl > 0) {
      await client.sAdd(key, jti);
      await client.expire(key, ttl);
    }
  }

  /**
   * Remove user token from active set
   */
  public static async removeUserToken(userId: string, jti: string): Promise<void> {
    const client = redisManager.getClient();
    const key = `${this.USER_TOKENS_PREFIX}${userId}`;
    await client.sRem(key, jti);
  }

  /**
   * Get all active tokens for a user
   */
  public static async getUserTokens(userId: string): Promise<string[]> {
    try {
      const client = redisManager.getClient();
      const key = `${this.USER_TOKENS_PREFIX}${userId}`;
      return await client.sMembers(key);
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return [];
    }
  }

  /**
   * Blacklist all tokens for a user (logout all)
   */
  public static async blacklistAllUserTokens(userId: string, reason: BlacklistedToken['reason']): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    const client = redisManager.getClient();
    
    const blacklistPromises = tokens.map(async (jti) => {
      const blacklistKey = `${this.BLACKLIST_PREFIX}${jti}`;
      // Set a reasonable TTL for blacklisted tokens (24 hours)
      await client.setEx(blacklistKey, 24 * 60 * 60, JSON.stringify({
        userId,
        reason,
        blacklistedAt: new Date().toISOString(),
      }));
    });
    
    await Promise.all(blacklistPromises);
    
    // Clear the user's token set
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    await client.del(userTokensKey);
  }

  /**
   * Clean up expired entries (called periodically)
   */
  public static async cleanup(): Promise<void> {
    // Redis automatically handles TTL expiration, so this is mainly for logging
    console.log('Token blacklist cleanup completed');
  }
}

// Initialize Redis connection on module load
if (process.env.NODE_ENV !== 'test') {
  redisManager.connect().catch(console.error);
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await redisManager.disconnect();
});

process.on('SIGINT', async () => {
  await redisManager.disconnect();
});

process.on('SIGTERM', async () => {
  await redisManager.disconnect();
});