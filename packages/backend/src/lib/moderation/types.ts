/**
 * Content Moderation Types and Interfaces
 */

export enum ContentType {
  ACTIVITY = 'ACTIVITY',
  CLUB_INFO = 'CLUB_INFO',
  APPLICATION = 'APPLICATION',
  USER_PROFILE = 'USER_PROFILE'
}

export enum ModerationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
  UNDER_REVIEW = 'UNDER_REVIEW'
}

export enum ModerationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ModerationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  HIDE = 'HIDE',
  WARN_USER = 'WARN_USER',
  SUSPEND_USER = 'SUSPEND_USER'
}

export enum FlagCategory {
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  MISINFORMATION = 'MISINFORMATION',
  COPYRIGHT_VIOLATION = 'COPYRIGHT_VIOLATION',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  OTHER = 'OTHER'
}

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE'
}

export interface ContentModerationQueue {
  id: string;
  contentType: ContentType;
  contentId: string;
  contentData: any;
  authorId?: string;
  clubId?: string;
  status: ModerationStatus;
  priority: ModerationPriority;
  flaggedAt: Date;
  flaggedBy?: string;
  flagReason?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewAction?: ModerationAction;
  reviewComments?: string;
  autoFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentFlag {
  id: string;
  contentType: ContentType;
  contentId: string;
  flaggedBy?: string;
  flagCategory: FlagCategory;
  flagReason: string;
  additionalInfo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionAction?: ModerationAction;
  resolutionComments?: string;
}

export interface ContentModerationHistory {
  id: string;
  contentType: ContentType;
  contentId: string;
  action: ModerationAction;
  performedBy?: string;
  performedAt: Date;
  reason?: string;
  previousData?: any;
  newData?: any;
  automated: boolean;
}

export interface SuspiciousActivityPattern {
  id: string;
  patternName: string;
  patternDescription?: string;
  detectionRules: any;
  severityLevel: SeverityLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuspiciousActivityAlert {
  id: string;
  patternId: string;
  userId?: string;
  activityData: any;
  severityLevel: SeverityLevel;
  detectedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  status: AlertStatus;
  resolutionNotes?: string;
}

// Request/Response interfaces
export interface FlagContentRequest {
  contentType: ContentType;
  contentId: string;
  flagCategory: FlagCategory;
  flagReason: string;
  additionalInfo?: string;
}

export interface ReviewContentRequest {
  action: ModerationAction;
  comments?: string;
  editedContent?: any;
}

export interface ModerationFilters {
  status?: ModerationStatus;
  priority?: ModerationPriority;
  contentType?: ContentType;
  clubId?: string;
  authorId?: string;
  flaggedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  content: any;
  authorId?: string;
  clubId?: string;
  status: ModerationStatus;
  createdAt: Date;
  flaggedAt?: Date;
  flagReason?: string;
  priority: ModerationPriority;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  data: any;
  createdAt: Date;
  createdBy?: string;
  action: ModerationAction;
  reason?: string;
}

export interface ModerationStats {
  totalPending: number;
  totalFlagged: number;
  totalReviewed: number;
  averageReviewTime: number;
  flagsByCategory: Record<FlagCategory, number>;
  actionsByType: Record<ModerationAction, number>;
}

export interface SuspiciousActivityStats {
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  alertsBySeverity: Record<SeverityLevel, number>;
  alertsByStatus: Record<AlertStatus, number>;
}