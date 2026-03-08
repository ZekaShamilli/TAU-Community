/**
 * Application Management Types
 * 
 * This module defines TypeScript interfaces and types for the application management system.
 * Applications represent student requests to join specific clubs.
 */

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Application {
  id: string;
  clubId: string;
  studentId?: string; // Optional - may be null if user is deleted
  studentName: string;
  studentEmail: string;
  motivation: string;
  status: ApplicationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComments?: string;
}

export interface CreateApplicationRequest {
  clubId: string;
  studentId?: string; // Optional for non-authenticated students
  studentName: string;
  studentEmail: string;
  motivation: string;
}

export interface UpdateApplicationStatusRequest {
  status: ApplicationStatus;
  reviewComments?: string;
}

export interface ApplicationFilters {
  clubId?: string;
  status?: ApplicationStatus;
  studentEmail?: string;
  studentId?: string;
  submittedAfter?: Date;
  submittedBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ApplicationWithClubInfo extends Application {
  clubName: string;
  clubUrlSlug: string;
}

export interface ApplicationSummary {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
}

export interface NotificationData {
  type: 'APPLICATION_SUBMITTED' | 'APPLICATION_REVIEWED';
  applicationId: string;
  clubName: string;
  studentEmail: string;
  status?: ApplicationStatus;
  reviewComments?: string;
}