/**
 * Content Moderation Routes Tests
 */

import express from 'express';
import {
  ContentType,
  ModerationStatus,
  ModerationAction,
  FlagCategory,
  AlertStatus,
  SeverityLevel
} from '../../lib/moderation/types';
import { UserRole } from '@prisma/client';

// Mock the moderation services
const mockModerationService = {
  flagContent: jest.fn(),
  getContentQueue: jest.fn(),
  reviewContent: jest.fn(),
  getContentHistory: jest.fn(),
  getModerationStats: jest.fn(),
};

const mockSuspiciousActivityService = {
  getAlerts: jest.fn(),
  reviewAlert: jest.fn(),
  getStats: jest.fn(),
  monitorUserAction: jest.fn(),
};

// Mock the auth middleware
const mockAuthenticate = jest.fn((req, res, next) => {
  req.user = {
    id: 'test-user-id',
    role: UserRole.SUPER_ADMIN,
    clubId: 'test-club-id'
  };
  req.userId = 'test-user-id';
  req.userRole = UserRole.SUPER_ADMIN;
  req.clubId = 'test-club-id';
  next();
});

const mockRequirePermission = jest.fn(() => (req: any, res: any, next: any) => next());

// Mock the imports
jest.mock('../../lib/moderation', () => ({
  ModerationService: mockModerationService,
  SuspiciousActivityService: mockSuspiciousActivityService,
}));

jest.mock('../../lib/middleware/auth', () => ({
  authenticate: mockAuthenticate,
  requirePermission: mockRequirePermission,
}));

// Import after mocking
import request from 'supertest';
import moderationRoutes from '../../routes/moderation';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/moderation', moderationRoutes);

describe('Moderation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/moderation/flag', () => {
    it('should successfully flag content', async () => {
      const flagRequest = {
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        flagCategory: FlagCategory.INAPPROPRIATE_CONTENT,
        flagReason: 'This content is inappropriate',
        additionalInfo: 'Contains offensive language'
      };

      mockModerationService.flagContent.mockResolvedValue({
        success: true,
        flagId: 'flag-123'
      });

      const response = await request(app)
        .post('/api/moderation/flag')
        .send(flagRequest);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        flagId: 'flag-123'
      });

      expect(mockModerationService.flagContent).toHaveBeenCalledWith(
        'test-user-id',
        flagRequest
      );

      expect(mockSuspiciousActivityService.monitorUserAction).toHaveBeenCalledWith(
        'test-user-id',
        'CONTENT_FLAG',
        'MODERATION',
        'activity-123',
        {
          contentType: ContentType.ACTIVITY,
          flagCategory: FlagCategory.INAPPROPRIATE_CONTENT,
          flagReason: 'This content is inappropriate'
        }
      );
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteRequest = {
        contentType: ContentType.ACTIVITY,
        // Missing contentId, flagCategory, flagReason
      };

      const response = await request(app)
        .post('/api/moderation/flag')
        .send(incompleteRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Missing required fields: contentType, contentId, flagCategory, flagReason'
      );
    });

    it('should return 400 for invalid content type', async () => {
      const invalidRequest = {
        contentType: 'INVALID_TYPE',
        contentId: 'activity-123',
        flagCategory: FlagCategory.SPAM,
        flagReason: 'This is spam'
      };

      const response = await request(app)
        .post('/api/moderation/flag')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid content type');
    });

    it('should return 400 when flagging fails', async () => {
      const flagRequest = {
        contentType: ContentType.ACTIVITY,
        contentId: 'activity-123',
        flagCategory: FlagCategory.SPAM,
        flagReason: 'This is spam'
      };

      mockModerationService.flagContent.mockResolvedValue({
        success: false,
        error: 'Content not found'
      });

      const response = await request(app)
        .post('/api/moderation/flag')
        .send(flagRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Content not found');
    });
  });

  describe('GET /api/moderation/queue', () => {
    it('should return content moderation queue', async () => {
      const mockQueue = [
        {
          id: 'moderation-1',
          type: ContentType.ACTIVITY,
          content: { title: 'Test Activity' },
          status: ModerationStatus.FLAGGED,
          priority: 'HIGH',
          createdAt: new Date(),
          flaggedAt: new Date(),
          flagReason: 'Inappropriate content'
        }
      ];

      mockModerationService.getContentQueue.mockResolvedValue(mockQueue);

      const response = await request(app)
        .get('/api/moderation/queue')
        .query({
          status: ModerationStatus.FLAGGED,
          priority: 'HIGH',
          limit: '10',
          offset: '0'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockQueue);
      expect(response.body.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: 1
      });

      expect(mockModerationService.getContentQueue).toHaveBeenCalledWith({
        status: ModerationStatus.FLAGGED,
        priority: 'HIGH',
        limit: 10,
        offset: 0
      });
    });

    it('should handle filters correctly', async () => {
      mockModerationService.getContentQueue.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/moderation/queue')
        .query({
          contentType: ContentType.CLUB_INFO,
          clubId: 'club-123',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31'
        });

      expect(response.status).toBe(200);
      expect(mockModerationService.getContentQueue).toHaveBeenCalledWith({
        contentType: ContentType.CLUB_INFO,
        clubId: 'club-123',
        dateFrom: new Date('2026-01-01'),
        dateTo: new Date('2026-01-31'),
        limit: 50,
        offset: 0
      });
    });
  });

  describe('POST /api/moderation/review/:moderationId', () => {
    it('should successfully review content', async () => {
      const moderationId = 'moderation-123';
      const reviewRequest = {
        action: ModerationAction.APPROVE,
        comments: 'Content is appropriate'
      };

      mockModerationService.reviewContent.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .post(`/api/moderation/review/${moderationId}`)
        .send(reviewRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockModerationService.reviewContent).toHaveBeenCalledWith(
        'test-user-id',
        moderationId,
        reviewRequest
      );
    });

    it('should return 400 for missing action', async () => {
      const moderationId = 'moderation-123';
      const incompleteRequest = {
        comments: 'Some comments'
        // Missing action
      };

      const response = await request(app)
        .post(`/api/moderation/review/${moderationId}`)
        .send(incompleteRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: action');
    });

    it('should return 400 for invalid action', async () => {
      const moderationId = 'moderation-123';
      const invalidRequest = {
        action: 'INVALID_ACTION',
        comments: 'Some comments'
      };

      const response = await request(app)
        .post(`/api/moderation/review/${moderationId}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid moderation action');
    });
  });

  describe('GET /api/moderation/history/:contentId', () => {
    it('should return content moderation history', async () => {
      const contentId = 'content-123';
      const mockHistory = [
        {
          id: 'history-1',
          contentId,
          version: 1,
          data: { title: 'Original Title' },
          createdAt: new Date(),
          action: ModerationAction.APPROVE,
          reason: 'Content approved'
        }
      ];

      mockModerationService.getContentHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/moderation/history/${contentId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);

      expect(mockModerationService.getContentHistory).toHaveBeenCalledWith(contentId);
    });
  });

  describe('GET /api/moderation/stats', () => {
    it('should return moderation statistics', async () => {
      const mockStats = {
        totalPending: 5,
        totalFlagged: 3,
        totalReviewed: 10,
        averageReviewTime: 2.5,
        flagsByCategory: {
          [FlagCategory.SPAM]: 2,
          [FlagCategory.INAPPROPRIATE_CONTENT]: 3
        },
        actionsByType: {
          [ModerationAction.APPROVE]: 7,
          [ModerationAction.REJECT]: 3
        }
      };

      mockModerationService.getModerationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/moderation/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/moderation/alerts', () => {
    it('should return suspicious activity alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          patternId: 'pattern-1',
          userId: 'user-1',
          activityData: { action: 'RAPID_CREATION' },
          severityLevel: SeverityLevel.HIGH,
          detectedAt: new Date(),
          status: AlertStatus.OPEN
        }
      ];

      mockSuspiciousActivityService.getAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/api/moderation/alerts')
        .query({
          status: AlertStatus.OPEN,
          severityLevel: SeverityLevel.HIGH,
          limit: '20'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);

      expect(mockSuspiciousActivityService.getAlerts).toHaveBeenCalledWith({
        status: AlertStatus.OPEN,
        severityLevel: SeverityLevel.HIGH,
        limit: 20,
        offset: 0
      });
    });
  });

  describe('POST /api/moderation/alerts/:alertId/review', () => {
    it('should successfully review alert', async () => {
      const alertId = 'alert-123';
      const reviewRequest = {
        status: AlertStatus.RESOLVED,
        resolutionNotes: 'False positive'
      };

      mockSuspiciousActivityService.reviewAlert.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .post(`/api/moderation/alerts/${alertId}/review`)
        .send(reviewRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSuspiciousActivityService.reviewAlert).toHaveBeenCalledWith(
        alertId,
        'test-user-id',
        AlertStatus.RESOLVED,
        'False positive'
      );
    });

    it('should return 400 for missing status', async () => {
      const alertId = 'alert-123';
      const incompleteRequest = {
        resolutionNotes: 'Some notes'
        // Missing status
      };

      const response = await request(app)
        .post(`/api/moderation/alerts/${alertId}/review`)
        .send(incompleteRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: status');
    });

    it('should return 400 for invalid status', async () => {
      const alertId = 'alert-123';
      const invalidRequest = {
        status: 'INVALID_STATUS',
        resolutionNotes: 'Some notes'
      };

      const response = await request(app)
        .post(`/api/moderation/alerts/${alertId}/review`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid alert status');
    });
  });

  describe('GET /api/moderation/alerts/stats', () => {
    it('should return suspicious activity statistics', async () => {
      const mockStats = {
        totalAlerts: 15,
        openAlerts: 5,
        criticalAlerts: 2,
        alertsBySeverity: {
          [SeverityLevel.HIGH]: 3,
          [SeverityLevel.MEDIUM]: 7,
          [SeverityLevel.LOW]: 5
        },
        alertsByStatus: {
          [AlertStatus.OPEN]: 5,
          [AlertStatus.RESOLVED]: 8,
          [AlertStatus.FALSE_POSITIVE]: 2
        }
      };

      mockSuspiciousActivityService.getStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/moderation/alerts/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });
});