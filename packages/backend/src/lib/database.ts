/**
 * Database connection utility with role-based access control
 * Provides connection pooling and role-based database connections
 */

import { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';

// Connection pool configuration
const CONNECTION_POOL_CONFIG = {
  connectionLimit: 10,
  acquireTimeoutMillis: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
};

// Database connection URLs for different roles
const DATABASE_URLS = {
  SUPER_ADMIN: process.env.DATABASE_URL_SUPER_ADMIN || process.env.DATABASE_URL,
  CLUB_PRESIDENT: process.env.DATABASE_URL_CLUB_PRESIDENT || process.env.DATABASE_URL,
  STUDENT: process.env.DATABASE_URL_STUDENT || process.env.DATABASE_URL,
  DEFAULT: process.env.DATABASE_URL,
} as const;

// Prisma client instances for different roles
class DatabaseManager {
  private static instance: DatabaseManager;
  private clients: Map<string, PrismaClient> = new Map();

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get Prisma client for a specific role
   */
  public getClient(role?: UserRole): PrismaClient {
    const clientKey = role || 'DEFAULT';
    
    if (!this.clients.has(clientKey)) {
      const databaseUrl = role ? DATABASE_URLS[role] : DATABASE_URLS.DEFAULT;
      
      const client = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });

      this.clients.set(clientKey, client);
    }

    return this.clients.get(clientKey)!;
  }

  /**
   * Set session context for Row-Level Security
   */
  public async setSessionContext(
    client: PrismaClient,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    await client.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await client.$executeRaw`SELECT set_config('app.current_user_role', ${userRole}, true)`;
  }

  /**
   * Clear session context
   */
  public async clearSessionContext(client: PrismaClient): Promise<void> {
    await client.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
    await client.$executeRaw`SELECT set_config('app.current_user_role', '', true)`;
  }

  /**
   * Execute a database operation with proper session context
   */
  public async withContext<T>(
    userId: string,
    userRole: UserRole,
    operation: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    const client = this.getClient(userRole);
    
    try {
      await this.setSessionContext(client, userId, userRole);
      return await operation(client);
    } finally {
      await this.clearSessionContext(client);
    }
  }

  /**
   * Health check for database connections
   */
  public async healthCheck(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    for (const [role, client] of this.clients.entries()) {
      try {
        await client.$queryRaw`SELECT 1`;
        results[role] = true;
      } catch (error) {
        console.error(`Database health check failed for ${role}:`, error);
        results[role] = false;
      }
    }

    return results;
  }

  /**
   * Close all database connections
   */
  public async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => 
      client.$disconnect()
    );
    
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }
}

// Export singleton instance
export const db = DatabaseManager.getInstance();

// Export default client for general use
export const prisma = db.getClient();

// Export function to get database pool (for compatibility with existing code)
export const getDatabase = () => {
  // For now, return the prisma client as it provides the same functionality
  // In a real implementation, this would return a pg.Pool instance
  return prisma as any;
};

// Export role-specific clients
export const superAdminClient = () => db.getClient(UserRole.SUPER_ADMIN);
export const clubPresidentClient = () => db.getClient(UserRole.CLUB_PRESIDENT);
export const studentClient = () => db.getClient(UserRole.STUDENT);

// Utility functions for common database operations
export class DatabaseUtils {
  /**
   * Generate URL slug from club name
   */
  static async generateUrlSlug(name: string): Promise<string> {
    const client = db.getClient();
    
    const result = await client.$queryRaw<Array<{ generate_url_slug: string }>>`
      SELECT generate_url_slug(${name}) as generate_url_slug
    `;
    
    return result[0]!.generate_url_slug;
  }

  /**
   * Update activity statuses based on dates
   */
  static async updateActivityStatuses(): Promise<number> {
    const client = db.getClient();
    
    const result = await client.$executeRaw`
      UPDATE activities 
      SET status = 'COMPLETED'::activity_status, updated_at = CURRENT_TIMESTAMP
      WHERE end_date < CURRENT_TIMESTAMP 
      AND status = 'PUBLISHED'::activity_status
    `;
    
    return result;
  }

  /**
   * Get user's club ID if they are a club president
   */
  static async getPresidentClubId(userId: string): Promise<string | null> {
    const client = db.getClient();
    
    const result = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM clubs WHERE president_id = ${userId}::uuid LIMIT 1
    `;
    
    return result.length > 0 ? result[0]!.id : null;
  }

  /**
   * Check if user is president of a specific club
   */
  static async isClubPresident(userId: string, clubId: string): Promise<boolean> {
    const client = db.getClient();
    
    const result = await client.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM clubs 
        WHERE id = ${clubId}::uuid 
        AND president_id = ${userId}::uuid
      ) as exists
    `;
    
    return result[0]!.exists;
  }

  /**
   * Log audit entry
   */
  static async logAudit(params: {
    userId?: string;
    userRole: UserRole;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const client = db.getClient();
    
    await client.auditLog.create({
      data: {
        userId: params.userId,
        userRole: params.userRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        changes: params.changes,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
      },
    });

    // Trigger suspicious activity monitoring if user ID is available and action was successful
    if (params.userId && (params.success ?? true)) {
      // Import here to avoid circular dependency
      const { SuspiciousActivityService } = await import('./moderation/suspicious-activity.service');
      
      // Monitor the user action in background
      setImmediate(async () => {
        try {
          await SuspiciousActivityService.monitorUserAction(
            params.userId!,
            params.action,
            params.resource,
            params.resourceId,
            params.changes
          );
        } catch (error) {
          console.error('Suspicious activity monitoring error:', error);
        }
      });
    }
  }
}

// Export types for use in other modules
export type { UserRole, ActivityStatus, ApplicationStatus } from '@prisma/client';
export type DatabaseClient = PrismaClient;

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await db.disconnect();
});

process.on('SIGINT', async () => {
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.disconnect();
  process.exit(0);
});