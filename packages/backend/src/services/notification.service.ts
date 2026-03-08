/**
 * Notification Service
 * 
 * This service handles sending notifications for various system events,
 * particularly application status changes and club-related notifications.
 */

import { PrismaClient } from '@prisma/client';
import { NotificationData } from '../lib/application/types';

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Send notification for application submission
   */
  async notifyApplicationSubmitted(data: NotificationData): Promise<void> {
    // Get club president email for notification
    const application = await this.prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        club: {
          include: {
            president: true,
          },
        },
      },
    });

    if (!application?.club?.president) {
      console.warn(`No club president found for application ${data.applicationId}`);
      return;
    }

    const president = application.club.president;
    
    const notification: EmailNotification = {
      to: president.email,
      subject: `New Application for ${data.clubName}`,
      body: `Dear ${president.firstName} ${president.lastName},

A new student has applied to join ${data.clubName}.

Student: ${data.studentEmail}
Application ID: ${data.applicationId}

Please log in to your dashboard to review the application.

Best regards,
TAU Community System`,
      html: `
        <h2>New Application for ${data.clubName}</h2>
        <p>Dear ${president.firstName} ${president.lastName},</p>
        <p>A new student has applied to join <strong>${data.clubName}</strong>.</p>
        <ul>
          <li><strong>Student:</strong> ${data.studentEmail}</li>
          <li><strong>Application ID:</strong> ${data.applicationId}</li>
        </ul>
        <p>Please log in to your dashboard to review the application.</p>
        <p>Best regards,<br>TAU Community System</p>
      `
    };

    await this.sendEmail(notification);
    
    // Log the notification
    await this.logNotification({
      type: 'APPLICATION_SUBMITTED',
      recipient: president.email,
      applicationId: data.applicationId,
      clubName: data.clubName,
      success: true
    });
  }

  /**
   * Send notification for application review (approval/rejection)
   */
  async notifyApplicationReviewed(data: NotificationData): Promise<void> {
    if (!data.status) {
      throw new Error('Status is required for application review notification');
    }

    const statusText = data.status === 'APPROVED' ? 'approved' : 'rejected';
    const statusEmoji = data.status === 'APPROVED' ? '✅' : '❌';

    const notification: EmailNotification = {
      to: data.studentEmail,
      subject: `${statusEmoji} Your application to ${data.clubName} has been ${statusText}`,
      body: `Dear Student,

Your application to join ${data.clubName} has been ${statusText}.

Application ID: ${data.applicationId}
Status: ${data.status}
${data.reviewComments ? `\nComments from club president:\n${data.reviewComments}` : ''}

${data.status === 'APPROVED' 
  ? 'Congratulations! You can now participate in club activities.' 
  : 'Thank you for your interest. You may apply to other clubs that interest you.'}

Best regards,
TAU Community System`,
      html: `
        <h2>${statusEmoji} Application ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h2>
        <p>Dear Student,</p>
        <p>Your application to join <strong>${data.clubName}</strong> has been <strong>${statusText}</strong>.</p>
        <ul>
          <li><strong>Application ID:</strong> ${data.applicationId}</li>
          <li><strong>Status:</strong> ${data.status}</li>
          ${data.reviewComments ? `<li><strong>Comments:</strong> ${data.reviewComments}</li>` : ''}
        </ul>
        <p>${data.status === 'APPROVED' 
          ? 'Congratulations! You can now participate in club activities.' 
          : 'Thank you for your interest. You may apply to other clubs that interest you.'}</p>
        <p>Best regards,<br>TAU Community System</p>
      `
    };

    await this.sendEmail(notification);
    
    // Log the notification
    await this.logNotification({
      type: 'APPLICATION_REVIEWED',
      recipient: data.studentEmail,
      applicationId: data.applicationId,
      clubName: data.clubName,
      status: data.status,
      success: true
    });
  }

  /**
   * Send email notification (placeholder implementation)
   * In a real system, this would integrate with an email service like SendGrid, AWS SES, etc.
   */
  private async sendEmail(notification: EmailNotification): Promise<void> {
    // For development/testing, we'll just log the email
    console.log('📧 Email Notification:', {
      to: notification.to,
      subject: notification.subject,
      body: notification.body.substring(0, 100) + '...'
    });

    // In production, you would implement actual email sending here:
    // await emailProvider.send(notification);
    
    // Simulate async email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Static method for sending emails (used by other services)
   */
  static async sendEmail(notification: { to: string; subject: string; content: string; priority?: string }): Promise<void> {
    // For development/testing, we'll just log the email
    console.log('📧 Static Email Notification:', {
      to: notification.to,
      subject: notification.subject,
      content: notification.content.substring(0, 100) + '...',
      priority: notification.priority || 'NORMAL'
    });

    // In production, you would implement actual email sending here:
    // await emailProvider.send(notification);
    
    // Simulate async email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Log notification for audit purposes
   */
  private async logNotification(data: {
    type: string;
    recipient: string;
    applicationId: string;
    clubName: string;
    status?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    const changes = {
      type: data.type,
      recipient: data.recipient,
      clubName: data.clubName,
      status: data.status
    };

    await this.prisma.auditLog.create({
      data: {
        userId: null,
        userRole: 'STUDENT', // System notifications
        action: `SEND_${data.type}`,
        resource: 'NOTIFICATION',
        resourceId: data.applicationId,
        changes: changes,
        success: data.success,
        errorMessage: data.error || null,
      },
    });
  }

  /**
   * Get notification history for an application
   */
  async getNotificationHistory(applicationId: string): Promise<any[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        resource: 'NOTIFICATION',
        resourceId: applicationId,
      },
      orderBy: { timestamp: 'desc' },
    });

    return logs.map(log => ({
      action: log.action,
      changes: log.changes,
      timestamp: log.timestamp,
      success: log.success,
      errorMessage: log.errorMessage,
    }));
  }
}