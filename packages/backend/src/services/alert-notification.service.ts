/**
 * Alert Notification Service
 * Handles automated alerting for Super Admins when suspicious activity is detected
 */

import { SeverityLevel, AlertStatus, UserRole } from '@prisma/client';
import { db, DatabaseUtils } from '../lib/database';
import { NotificationService } from './notification.service';

export interface AlertNotificationConfig {
  emailEnabled: boolean;
  immediateAlertThreshold: SeverityLevel;
  batchAlertInterval: number; // minutes
  maxAlertsPerBatch: number;
}

export class AlertNotificationService {
  private static config: AlertNotificationConfig = {
    emailEnabled: true,
    immediateAlertThreshold: SeverityLevel.HIGH,
    batchAlertInterval: 30, // 30 minutes
    maxAlertsPerBatch: 10,
  };

  /**
   * Send immediate alert to Super Admins for critical/high severity issues
   */
  public static async sendImmediateAlert(
    alertId: string,
    severityLevel: SeverityLevel,
    activityData: any
  ): Promise<void> {
    try {
      if (severityLevel < this.config.immediateAlertThreshold) {
        return;
      }

      const superAdmins = await this.getSuperAdmins();
      
      for (const admin of superAdmins) {
        await this.sendAlertNotification(admin, {
          type: 'IMMEDIATE',
          alertId,
          severityLevel,
          activityData,
          timestamp: new Date(),
        });
      }

      // Log the alert notification
      await DatabaseUtils.logAudit({
        userRole: UserRole.SUPER_ADMIN,
        action: 'ALERT_NOTIFICATION_SENT',
        resource: 'SECURITY',
        resourceId: alertId,
        changes: {
          type: 'IMMEDIATE',
          severityLevel,
          recipientCount: superAdmins.length,
        },
        success: true,
      });
    } catch (error) {
      console.error('Send immediate alert error:', error);
    }
  }

  /**
   * Send batch summary of alerts to Super Admins
   */
  public static async sendBatchAlertSummary(): Promise<void> {
    try {
      const client = db.getClient();
      
      // Get unnotified alerts from the last batch interval
      const batchStart = new Date(Date.now() - this.config.batchAlertInterval * 60 * 1000);
      
      const alerts = await client.suspiciousActivityAlerts.findMany({
        where: {
          detectedAt: { gte: batchStart },
          status: AlertStatus.OPEN,
          severityLevel: { in: [SeverityLevel.HIGH, SeverityLevel.CRITICAL] },
        },
        take: this.config.maxAlertsPerBatch,
        include: {
          pattern: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [
          { severityLevel: 'desc' },
          { detectedAt: 'desc' },
        ],
      });

      if (alerts.length === 0) {
        return;
      }

      const superAdmins = await this.getSuperAdmins();
      
      for (const admin of superAdmins) {
        await this.sendAlertNotification(admin, {
          type: 'BATCH_SUMMARY',
          alerts,
          timestamp: new Date(),
          batchInterval: this.config.batchAlertInterval,
        });
      }

      // Log the batch notification
      await DatabaseUtils.logAudit({
        userRole: UserRole.SUPER_ADMIN,
        action: 'BATCH_ALERT_NOTIFICATION_SENT',
        resource: 'SECURITY',
        changes: {
          alertCount: alerts.length,
          recipientCount: superAdmins.length,
          batchInterval: this.config.batchAlertInterval,
        },
        success: true,
      });
    } catch (error) {
      console.error('Send batch alert summary error:', error);
    }
  }
  /**
   * Get all Super Admin users for alert notifications
   */
  private static async getSuperAdmins(): Promise<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>> {
    try {
      const client = db.getClient();
      
      const superAdmins = await client.user.findMany({
        where: {
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      return superAdmins;
    } catch (error) {
      console.error('Get super admins error:', error);
      return [];
    }
  }

  /**
   * Send alert notification to a specific admin
   */
  private static async sendAlertNotification(
    admin: { id: string; email: string; firstName: string; lastName: string },
    notificationData: any
  ): Promise<void> {
    try {
      if (!this.config.emailEnabled) {
        return;
      }

      let subject: string;
      let content: string;

      if (notificationData.type === 'IMMEDIATE') {
        subject = `🚨 Critical Security Alert - Suspicious Activity Detected`;
        content = this.generateImmediateAlertContent(notificationData);
      } else {
        subject = `📊 Security Alert Summary - ${notificationData.alerts.length} New Alerts`;
        content = this.generateBatchSummaryContent(notificationData);
      }

      await NotificationService.sendEmail({
        to: admin.email,
        subject,
        content,
        priority: notificationData.type === 'IMMEDIATE' ? 'HIGH' : 'NORMAL',
      });
    } catch (error) {
      console.error('Send alert notification error:', error);
    }
  }

  /**
   * Generate content for immediate alert notifications
   */
  private static generateImmediateAlertContent(data: any): string {
    const { alertId, severityLevel, activityData, timestamp } = data;
    
    return `
      <h2>🚨 Critical Security Alert</h2>
      
      <p><strong>Alert ID:</strong> ${alertId}</p>
      <p><strong>Severity:</strong> ${severityLevel}</p>
      <p><strong>Detected At:</strong> ${timestamp.toISOString()}</p>
      
      <h3>Activity Details:</h3>
      <ul>
        <li><strong>Action:</strong> ${activityData.action}</li>
        <li><strong>Resource Type:</strong> ${activityData.resourceType}</li>
        <li><strong>Resource ID:</strong> ${activityData.resourceId || 'N/A'}</li>
      </ul>
      
      <p><strong>Immediate Action Required:</strong> Please review this alert in the admin dashboard and take appropriate action.</p>
      
      <p>This is an automated security alert from the TAU Community system.</p>
    `;
  }

  /**
   * Generate content for batch summary notifications
   */
  private static generateBatchSummaryContent(data: any): string {
    const { alerts, timestamp, batchInterval } = data;
    
    let content = `
      <h2>📊 Security Alert Summary</h2>
      
      <p><strong>Report Generated:</strong> ${timestamp.toISOString()}</p>
      <p><strong>Time Period:</strong> Last ${batchInterval} minutes</p>
      <p><strong>Total Alerts:</strong> ${alerts.length}</p>
      
      <h3>Alert Breakdown:</h3>
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Pattern</th>
            <th>User</th>
            <th>Detected At</th>
          </tr>
        </thead>
        <tbody>
    `;

    alerts.forEach((alert: any) => {
      const userName = alert.user 
        ? `${alert.user.firstName} ${alert.user.lastName} (${alert.user.email})`
        : 'Unknown User';
      
      content += `
        <tr>
          <td>${alert.severityLevel}</td>
          <td>${alert.pattern?.patternName || 'Unknown Pattern'}</td>
          <td>${userName}</td>
          <td>${alert.detectedAt.toISOString()}</td>
        </tr>
      `;
    });

    content += `
        </tbody>
      </table>
      
      <p><strong>Action Required:</strong> Please review these alerts in the admin dashboard.</p>
      
      <p>This is an automated security summary from the TAU Community system.</p>
    `;

    return content;
  }

  /**
   * Update alert notification configuration
   */
  public static updateConfig(newConfig: Partial<AlertNotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current alert notification configuration
   */
  public static getConfig(): AlertNotificationConfig {
    return { ...this.config };
  }

  /**
   * Start automated batch alert notifications
   */
  public static startBatchNotifications(): void {
    // Send batch notifications every configured interval
    setInterval(async () => {
      await this.sendBatchAlertSummary();
    }, this.config.batchAlertInterval * 60 * 1000);
  }

  /**
   * Generate activity analysis report for Super Admins
   */
  public static async generateActivityReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAlerts: number;
    alertsBySeverity: Record<SeverityLevel, number>;
    alertsByPattern: Record<string, number>;
    topSuspiciousUsers: Array<{
      userId: string;
      userName: string;
      alertCount: number;
    }>;
    recommendations: string[];
  }> {
    try {
      const client = db.getClient();

      const alerts = await client.suspiciousActivityAlerts.findMany({
        where: {
          detectedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          pattern: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Analyze alerts by severity
      const alertsBySeverity: Record<SeverityLevel, number> = {
        [SeverityLevel.LOW]: 0,
        [SeverityLevel.MEDIUM]: 0,
        [SeverityLevel.HIGH]: 0,
        [SeverityLevel.CRITICAL]: 0,
      };

      // Analyze alerts by pattern
      const alertsByPattern: Record<string, number> = {};

      // Track suspicious users
      const userAlertCounts: Record<string, { count: number; user: any }> = {};

      alerts.forEach(alert => {
        // Count by severity
        alertsBySeverity[alert.severityLevel as SeverityLevel]++;

        // Count by pattern
        const patternName = alert.pattern?.patternName || 'Unknown';
        alertsByPattern[patternName] = (alertsByPattern[patternName] || 0) + 1;

        // Count by user
        if (alert.user) {
          const userId = alert.user.id;
          if (!userAlertCounts[userId]) {
            userAlertCounts[userId] = { count: 0, user: alert.user };
          }
          userAlertCounts[userId].count++;
        }
      });

      // Get top suspicious users
      const topSuspiciousUsers = Object.values(userAlertCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(item => ({
          userId: item.user.id,
          userName: `${item.user.firstName} ${item.user.lastName}`,
          alertCount: item.count,
        }));

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (alertsBySeverity[SeverityLevel.CRITICAL] > 0) {
        recommendations.push('Immediate review of critical alerts required');
      }
      
      if (alertsBySeverity[SeverityLevel.HIGH] > 5) {
        recommendations.push('High number of high-severity alerts - consider tightening security policies');
      }
      
      if (topSuspiciousUsers.length > 0 && topSuspiciousUsers[0].alertCount > 3) {
        recommendations.push(`User ${topSuspiciousUsers[0].userName} has ${topSuspiciousUsers[0].alertCount} alerts - consider manual review`);
      }

      const mostCommonPattern = Object.entries(alertsByPattern)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostCommonPattern && mostCommonPattern[1] > alerts.length * 0.3) {
        recommendations.push(`Pattern "${mostCommonPattern[0]}" is very common - consider adjusting detection rules`);
      }

      return {
        totalAlerts: alerts.length,
        alertsBySeverity,
        alertsByPattern,
        topSuspiciousUsers,
        recommendations,
      };
    } catch (error) {
      console.error('Generate activity report error:', error);
      return {
        totalAlerts: 0,
        alertsBySeverity: {
          [SeverityLevel.LOW]: 0,
          [SeverityLevel.MEDIUM]: 0,
          [SeverityLevel.HIGH]: 0,
          [SeverityLevel.CRITICAL]: 0,
        },
        alertsByPattern: {},
        topSuspiciousUsers: [],
        recommendations: ['Error generating report - please check system logs'],
      };
    }
  }
}