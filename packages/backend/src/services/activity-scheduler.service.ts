/**
 * Activity Scheduler Service
 * Handles scheduled tasks for activity management including automatic status updates
 * and session cleanup
 */

import * as cron from 'node-cron';
import ActivityService from './activity.service';
import SessionService from './session.service';
import { DatabaseUtils } from '../lib/database';

export class ActivitySchedulerService {
  private activityService: ActivityService;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.activityService = new ActivityService();
  }

  /**
   * Start all scheduled tasks
   */
  public startScheduledTasks(): void {
    this.scheduleActivityStatusUpdates();
    this.scheduleSessionCleanup();
    this.scheduleExpiredSessionCleanup();
    console.log('✅ Activity scheduler service started');
  }

  /**
   * Stop all scheduled tasks
   */
  public stopScheduledTasks(): void {
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      console.log(`⏹️ Stopped scheduled task: ${name}`);
    });
    this.scheduledTasks.clear();
    console.log('⏹️ Activity scheduler service stopped');
  }

  /**
   * Schedule automatic activity status updates
   * Runs every hour to check for activities that should be marked as completed
   */
  private scheduleActivityStatusUpdates(): void {
    const task = cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔄 Running scheduled activity status update...');
        
        // Use both the service method and database utility for redundancy
        const [serviceCount, dbUtilCount] = await Promise.all([
          this.activityService.updateActivityStatuses(),
          DatabaseUtils.updateActivityStatuses()
        ]);

        if (serviceCount > 0 || dbUtilCount > 0) {
          console.log(`✅ Activity status update completed. Service: ${serviceCount}, DB Util: ${dbUtilCount} activities updated`);
        } else {
          console.log('ℹ️ No activities required status updates');
        }
      } catch (error) {
        console.error('❌ Error in scheduled activity status update:', error);
      }
    }, {
      timezone: 'Europe/Istanbul' // TAU is in Turkey
    });

    this.scheduledTasks.set('activityStatusUpdate', task);
    task.start();
    console.log('⏰ Scheduled activity status updates (every hour)');
  }

  /**
   * Schedule session cleanup tasks
   * Runs every 30 minutes to clean up expired sessions
   */
  private scheduleSessionCleanup(): void {
    const task = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🧹 Running scheduled session cleanup...');
        
        const cleanedCount = await SessionService.cleanupExpiredSessions();
        
        if (cleanedCount > 0) {
          console.log(`✅ Session cleanup completed. ${cleanedCount} expired sessions removed`);
        } else {
          console.log('ℹ️ No expired sessions to clean up');
        }
      } catch (error) {
        console.error('❌ Error in scheduled session cleanup:', error);
      }
    }, {
      timezone: 'Europe/Istanbul' // TAU is in Turkey
    });

    this.scheduledTasks.set('sessionCleanup', task);
    task.start();
    console.log('⏰ Scheduled session cleanup (every 30 minutes)');
  }

  /**
   * Schedule expired session cleanup
   * Runs daily at 2 AM to perform deep cleanup of expired sessions
   */
  private scheduleExpiredSessionCleanup(): void {
    const task = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Running daily expired session cleanup...');
        
        // Perform comprehensive session cleanup
        const cleanedCount = await SessionService.cleanupExpiredSessions();
        
        // Log audit entry for cleanup
        await DatabaseUtils.logAudit({
          userRole: 'SUPER_ADMIN' as any,
          action: 'SESSION_CLEANUP',
          resource: 'SYSTEM',
          changes: {
            cleanedSessions: cleanedCount,
            cleanupType: 'daily_expired_cleanup',
            timestamp: new Date().toISOString()
          },
          success: true
        });
        
        console.log(`✅ Daily session cleanup completed. ${cleanedCount} expired sessions removed`);
      } catch (error) {
        console.error('❌ Error in daily session cleanup:', error);
        
        // Log error
        await DatabaseUtils.logAudit({
          userRole: 'SUPER_ADMIN' as any,
          action: 'SESSION_CLEANUP_ERROR',
          resource: 'SYSTEM',
          changes: {
            error: error instanceof Error ? error.message : 'Unknown error',
            cleanupType: 'daily_expired_cleanup',
            timestamp: new Date().toISOString()
          },
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, {
      timezone: 'Europe/Istanbul' // TAU is in Turkey
    });

    this.scheduledTasks.set('expiredSessionCleanup', task);
    task.start();
    console.log('⏰ Scheduled expired session cleanup (daily at 2 AM)');
  }

  /**
   * Manually trigger activity status update
   */
  public async triggerStatusUpdate(): Promise<{ serviceCount: number; dbUtilCount: number }> {
    console.log('🔄 Manually triggering activity status update...');
    
    const [serviceCount, dbUtilCount] = await Promise.all([
      this.activityService.updateActivityStatuses(),
      DatabaseUtils.updateActivityStatuses()
    ]);

    console.log(`✅ Manual activity status update completed. Service: ${serviceCount}, DB Util: ${dbUtilCount} activities updated`);
    
    return { serviceCount, dbUtilCount };
  }

  /**
   * Manually trigger session cleanup
   */
  public async triggerSessionCleanup(): Promise<number> {
    console.log('🧹 Manually triggering session cleanup...');
    
    const cleanedCount = await SessionService.cleanupExpiredSessions();
    
    console.log(`✅ Manual session cleanup completed. ${cleanedCount} expired sessions removed`);
    
    return cleanedCount;
  }

  /**
   * Manually trigger all cleanup tasks
   */
  public async triggerAllCleanupTasks(): Promise<{
    activityUpdates: { serviceCount: number; dbUtilCount: number };
    sessionCleanup: number;
  }> {
    console.log('🔄 Manually triggering all cleanup tasks...');
    
    const [activityUpdates, sessionCleanup] = await Promise.all([
      this.triggerStatusUpdate(),
      this.triggerSessionCleanup()
    ]);

    console.log('✅ All cleanup tasks completed');
    
    return {
      activityUpdates,
      sessionCleanup
    };
  }

  /**
   * Get status of all scheduled tasks
   */
  public getTaskStatus(): { [taskName: string]: { running: boolean; nextRun?: Date } } {
    const status: { [taskName: string]: { running: boolean; nextRun?: Date } } = {};

    this.scheduledTasks.forEach((task, name) => {
      status[name] = {
        running: true, // Assume running if task exists in our map
        // Note: node-cron doesn't provide next run time directly
        // This would need to be calculated based on the cron expression
      };
    });

    return status;
  }

  /**
   * Schedule a one-time activity status update at a specific time
   */
  public scheduleOneTimeUpdate(date: Date): void {
    const now = new Date();
    if (date <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    const delay = date.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        await this.triggerStatusUpdate();
      } catch (error) {
        console.error('❌ Error in one-time scheduled activity status update:', error);
      }
    }, delay);

    console.log(`⏰ One-time activity status update scheduled for ${date.toISOString()}`);
  }
}

// Singleton instance
let schedulerInstance: ActivitySchedulerService | null = null;

export function getActivityScheduler(): ActivitySchedulerService {
  if (!schedulerInstance) {
    schedulerInstance = new ActivitySchedulerService();
  }
  return schedulerInstance;
}

export default ActivitySchedulerService;