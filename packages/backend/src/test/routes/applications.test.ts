/**
 * Application Routes Tests
 * 
 * Integration tests for application management endpoints covering:
 * - Application submission
 * - Application retrieval and listing
 * - Application status updates
 * - Authorization and access control
 */

import request from 'supertest';
import { Pool } from 'pg';
import { app } from '../../app';
import { getTestDatabase, cleanupTestData } from '../setup';
import { generateToken } from '../../lib/auth/jwt';

describe('Application Routes', () => {
  let db: Pool;
  let testClubId: string;
  let testUserId: string;
  let testPresidentId: string;
  let studentToken: string;
  let presidentToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestData(db);

    // Create test users
    const studentResult = await db.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name)
      VALUES ('student@test.com', 'hash', 'STUDENT', 'Test', 'Student')
      RETURNING id
    `);
    testUserId = studentResult.rows[0].id;

    const presidentResult = await db.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name)
      VALUES ('president@test.com', 'hash', 'CLUB_PRESIDENT', 'Test', 'President')
      RETURNING id
    `);
    testPresidentId = presidentResult.rows[0].id;

    const superAdminResult = await db.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name)
      VALUES ('admin@test.com', 'hash', 'SUPER_ADMIN', 'Test', 'Admin')
      RETURNING id
    `);
    const superAdminId = superAdminResult.rows[0].id;

    // Create test club
    const clubResult = await db.query(`
      INSERT INTO clubs (name, description, url_slug, president_id)
      VALUES ('Test Club', 'A test club', 'test-club', $1)
      RETURNING id
    `, [testPresidentId]);
    testClubId = clubResult.rows[0].id;

    // Generate tokens
    studentToken = generateToken({
      userId: testUserId,
      email: 'student@test.com',
      role: 'STUDENT'
    });

    presidentToken = generateToken({
      userId: testPresidentId,
      email: 'president@test.com',
      role: 'CLUB_PRESIDENT',
      clubId: testClubId
    });

    superAdminToken = generateToken({
      userId: superAdminId,
      email: 'admin@test.com',
      role: 'SUPER_ADMIN'
    });
  });

  afterEach(async () => {
    await cleanupTestData(db);
  });

  afterAll(async () => {
    await db.end();
  });

  describe('POST /api/applications', () => {
    const validApplicationData = {
      clubId: '',
      studentName: 'Test Student',
      studentEmail: 'student@test.com',
      motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities and help organize meaningful events.'
    };

    beforeEach(() => {
      validApplicationData.clubId = testClubId;
    });

    it('should submit application successfully without authentication', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.clubId).toBe(testClubId);
      expect(response.body.studentName).toBe('Test Student');
      expect(response.body.status).toBe('PENDING');
    });

    it('should submit application with authenticated user', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(response.body.studentId).toBe(testUserId);
    });

    it('should reject application with missing required fields', async () => {
      const invalidData = { ...validApplicationData };
      delete invalidData.motivation;

      const response = await request(app)
        .post('/api/applications')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject application with motivation too short', async () => {
      const invalidData = {
        ...validApplicationData,
        motivation: 'Too short'
      };

      const response = await request(app)
        .post('/api/applications')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Motivation must be between 50 and 1000 characters');
    });

    it('should prevent duplicate applications', async () => {
      // Submit first application
      await request(app)
        .post('/api/applications')
        .send(validApplicationData);

      // Attempt duplicate
      const response = await request(app)
        .post('/api/applications')
        .send(validApplicationData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already submitted an application');
    });
  });

  describe('GET /api/applications/:id', () => {
    let applicationId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Test Student',
          studentEmail: 'student@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });
      applicationId = response.body.id;
    });

    it('should allow club president to view application to their club', async () => {
      const response = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(applicationId);
      expect(response.body.clubName).toBe('Test Club');
    });

    it('should allow super admin to view any application', async () => {
      const response = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(applicationId);
    });

    it('should deny access to unauthorized users', async () => {
      const response = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return 404 for non-existent application', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/applications/${nonExistentId}`)
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Application not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/applications/${applicationId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/applications', () => {
    beforeEach(async () => {
      // Create multiple applications
      await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Student One',
          studentEmail: 'student1@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });

      await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Student Two',
          studentEmail: 'student2@test.com',
          motivation: 'This club represents everything I am passionate about and I would love to be part of this amazing community of like-minded individuals.'
        });
    });

    it('should allow club president to list applications to their club', async () => {
      const response = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      response.body.forEach((app: any) => {
        expect(app.clubId).toBe(testClubId);
      });
    });

    it('should allow super admin to list all applications', async () => {
      const response = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should allow students to see their own applications', async () => {
      // Create application with authenticated student
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          clubId: testClubId,
          studentName: 'Authenticated Student',
          studentEmail: 'student@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });

      const response = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].studentEmail).toBe('student@test.com');
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/applications?status=PENDING')
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      response.body.forEach((app: any) => {
        expect(app.status).toBe('PENDING');
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/applications');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/applications/:id/status', () => {
    let applicationId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Test Student',
          studentEmail: 'student@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });
      applicationId = response.body.id;
    });

    it('should allow club president to approve application', async () => {
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({
          status: 'APPROVED',
          reviewComments: 'Great motivation!'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
      expect(response.body.reviewComments).toBe('Great motivation!');
      expect(response.body.reviewedBy).toBe(testPresidentId);
      expect(response.body.reviewedAt).toBeDefined();
    });

    it('should allow club president to reject application', async () => {
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({
          status: 'REJECTED',
          reviewComments: 'Unfortunately, we cannot accept your application at this time.'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
    });

    it('should allow super admin to update application status', async () => {
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'APPROVED'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
    });

    it('should deny access to students', async () => {
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          status: 'APPROVED'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({
          status: 'INVALID_STATUS'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should prevent updating already reviewed applications', async () => {
      // First, approve the application
      await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({ status: 'APPROVED' });

      // Try to update again
      const response = await request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({ status: 'REJECTED' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been approved');
    });

    it('should return 404 for non-existent application', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/applications/${nonExistentId}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Application not found');
    });
  });

  describe('GET /api/applications/summary/:clubId', () => {
    beforeEach(async () => {
      // Create applications with different statuses
      const app1Response = await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Student One',
          studentEmail: 'student1@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });

      await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Student Two',
          studentEmail: 'student2@test.com',
          motivation: 'This club represents everything I am passionate about and I would love to be part of this amazing community of like-minded individuals.'
        });

      // Approve one application
      await request(app)
        .put(`/api/applications/${app1Response.body.id}/status`)
        .set('Authorization', `Bearer ${presidentToken}`)
        .send({ status: 'APPROVED' });
    });

    it('should return application summary for club president', async () => {
      const response = await request(app)
        .get(`/api/applications/summary/${testClubId}`)
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalApplications).toBe(2);
      expect(response.body.pendingApplications).toBe(1);
      expect(response.body.approvedApplications).toBe(1);
      expect(response.body.rejectedApplications).toBe(0);
    });

    it('should allow super admin to view summary', async () => {
      const response = await request(app)
        .get(`/api/applications/summary/${testClubId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalApplications).toBe(2);
    });

    it('should deny access to students', async () => {
      const response = await request(app)
        .get(`/api/applications/summary/${testClubId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/applications/check/:clubId/:email', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Test Student',
          studentEmail: 'student@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });
    });

    it('should return true if student has applied', async () => {
      const response = await request(app)
        .get(`/api/applications/check/${testClubId}/student@test.com`);

      expect(response.status).toBe(200);
      expect(response.body.hasApplied).toBe(true);
    });

    it('should return false if student has not applied', async () => {
      const response = await request(app)
        .get(`/api/applications/check/${testClubId}/nonexistent@test.com`);

      expect(response.status).toBe(200);
      expect(response.body.hasApplied).toBe(false);
    });
  });

  describe('DELETE /api/applications/:id', () => {
    let applicationId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          clubId: testClubId,
          studentName: 'Test Student',
          studentEmail: 'student@test.com',
          motivation: 'I am very interested in joining this club because it aligns with my interests and goals. I believe I can contribute positively to the club activities.'
        });
      applicationId = response.body.id;
    });

    it('should allow super admin to delete application', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(204);

      // Verify application is deleted
      const getResponse = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should deny access to club presidents', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${presidentToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access to students', async () => {
      const response = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent application', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/applications/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
    });
  });
});