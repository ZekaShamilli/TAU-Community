/**
 * End-to-End Integration Tests
 * Tests complete user workflows across the entire system
 */

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../lib/database';
import { UserRole, ActivityStatus, ApplicationStatus } from '@prisma/client';
import { AuthService } from '../../lib/auth/service';
import { JWTService } from '../../lib/auth/jwt';

describe('End-to-End Integration Tests', () => {
  let superAdminUser: any;
  let clubPresidentUser: any;
  let studentUser: any;
  let testClub: any;
  let testActivity: any;
  let testApplication: any;
  let superAdminTokens: any;
  let clubPresidentTokens: any;

  beforeAll(async () => {
    // Create test users
    const client = db.getClient();
    
    // Create Super Admin
    superAdminUser = await client.user.create({
      data: {
        email: 'superadmin@test.com',
        passwordHash: '$2b$10$test.hash.for.password',
        role: UserRole.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        totpEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
    });

    // Create Student
    studentUser = await client.user.create({
      data: {
        email: 'student@test.com',
        passwordHash: '$2b$10$test.hash.for.password',
        role: UserRole.STUDENT,
        firstName: 'Test',
        lastName: 'Student',
        isActive: true,
      },
    });

    // Generate tokens for Super Admin
    superAdminTokens = await JWTService.generateTokenPair(
      superAdminUser.id,
      UserRole.SUPER_ADMIN
    );
  });

  afterAll(async () => {
    // Clean up test data
    const client = db.getClient();
    
    if (testApplication) {
      await client.application.delete({ where: { id: testApplication.id } }).catch(() => {});
    }
    if (testActivity) {
      await client.activity.delete({ where: { id: testActivity.id } }).catch(() => {});
    }
    if (testClub) {
      await client.club.delete({ where: { id: testClub.id } }).catch(() => {});
    }
    if (clubPresidentUser) {
      await client.user.delete({ where: { id: clubPresidentUser.id } }).catch(() => {});
    }
    await client.user.delete({ where: { id: studentUser.id } }).catch(() => {});
    await client.user.delete({ where: { id: superAdminUser.id } }).catch(() => {});
  });

  describe('Complete Club Creation and Management Workflow', () => {
    it('should complete full club creation workflow', async () => {
      // 1. Super Admin creates a new club
      const clubResponse = await request(app)
        .post('/api/clubs')
 