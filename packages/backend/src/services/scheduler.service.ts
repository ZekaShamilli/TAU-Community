/**
 * Scheduler Service
 * Handles automated background tasks and scheduled operations
 */

import { AlertNotificationService } from './alert-notification.service';
import { SuspiciousActivityService } from '../lib/moderation/suspicious-activity.service';
import { DatabaseUtils } from '../lib/database';
import { UserRole } from '@prisma/client';

export class SchedulerService {
  private static intervals: NodeJS.Timeout[] = [];
  private static isRunning = false;

  /**
   * Start all scheduled tasks
   */
  public static start(): void {
    if (this.isRunning) {
      console.log('Scheduler service is already running');
      return;
    }

    console.log('Starting scheduler service...');
    this.isRunning = true;

    // Start batch alert notifications (every 30 minutes)
    const alertInterval = setInterval(async () => {
      try {
        await AlertNotificationService.sendBatchAlertSummary();
      } catch (error) {
        console.error('Batch alert notification error:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    this.intervals.push(alertInterval);

    // Initialize suspicious activity patterns (run once on startup)
    this.initializePatterns();

    // Log scheduler start
    DatabaseUtils.logAudit({
      userRole: UserRole.SUPER_ADMIN,
      action: 'SCHEDULER_STARTED',
      resource: 'SYSTEM',
      changes: {
        tasks: ['batch_alert_notifications'],
        interval: '30 minutes',
      },
      success: true,
    }).catch(console.error);

    console.log('Scheduler service started successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  public static stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler service is not running');
      return;
    }

    console.log('Stopping scheduler service...');

    // Clear all intervals
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals = [];
    this.isRunning = false;

    // Log scheduler stop
    DatabaseUtils.logAudit({
      userRole: UserRole.SUPER_ADMIN,
      action: 'SCHEDULER_STOPPED',
      resource: 'SYSTEM',
      success: true,
    }).catch(console.error);

    console.log('Scheduler service stopped');
  }

  /**
   * Initialize suspicious activity patterns
   */
  private static async initializePatterns(): Promise<void> {
    try {
      await SuspiciousActivityService.initializePatterns();
      console.log('Suspicious activity patterns initialized');
    } catch (error) {
      console.error('Failed to initialize suspicious activity patterns:', error);
    }
  }

  /**
   * Get scheduler status
   */
  public static getStatus(): {
    isRunning: boolean;
    activeIntervals: number;
    uptime?: number;
  } {
    return {
      isRunning: this.isRunning,
      activeIntervals: this.intervals.length,
    };
  }

  /**
   * Restart scheduler service
   */
  public static restart(): void {
    this.stop();
    setTimeout(() => {
      this.start();
    }, 1000);
  }
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping scheduler...');
  SchedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping scheduler...');
  SchedulerService.stop();
  process.exit(0);
});