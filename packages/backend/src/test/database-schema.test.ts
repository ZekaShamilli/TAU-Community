/**
 * Database Schema Tests for TAU Community
 * 
 * These tests verify that the database schema is correctly created with all
 * required tables, constraints, indexes, and functions.
 */

import { Pool } from 'pg';

// Database connection configuration for testing
const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tau_kays',
  user: process.env.DB_USER || 'tau_kays_user',
  password: process.env.DB_PASSWORD || 'tau_kays_password',
};

describe('Database Schema Tests', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool(testDbConfig);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Custom Types', () => {
    test('should have user_role enum type', async () => {
      const result = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'user_role'
        ORDER BY e.enumsortorder
      `);
      
      const roles = result.rows.map(row => row.enumlabel);
      expect(roles).toEqual(['SUPER_ADMIN', 'CLUB_PRESIDENT', 'STUDENT']);
    });

    test('should have activity_status enum type', async () => {
      const result = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'activity_status'
        ORDER BY e.enumsortorder
      `);
      
      const statuses = result.rows.map(row => row.enumlabel);
      expect(statuses).toEqual(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']);
    });

    test('should have application_status enum type', async () => {
      const result = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'application_status'
        ORDER BY e.enumsortorder
      `);
      
      const statuses = result.rows.map(row => row.enumlabel);
      expect(statuses).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
    });
  });

  describe('Tables Structure', () => {
    test('should have all required tables', async () => {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tableNames = result.rows.map(row => row.table_name);
      expect(tableNames).toEqual(
        expect.arrayContaining(['users', 'clubs', 'activities', 'applications', 'audit_log'])
      );
    });

    test('users table should have correct structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'email', 'password_hash', 'role', 'first_name', 'last_name',
          'phone', 'is_active', 'totp_secret', 'totp_enabled', 'created_at', 'updated_at'
        ])
      );
    });

    test('clubs table should have correct structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'clubs' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toEqual(
        expect.arrayContaining([
          'id', 'name', 'description', 'url_slug', 'president_id', 
          'is_active', 'created_at', 'updated_at'
        ])
      );
    });
  });

  describe('Constraints', () => {
    test('should have foreign key constraints', async () => {
      const result = await pool.query(`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // Check specific foreign keys
      const foreignKeys = result.rows.map(row => ({
        table: row.table_name,
        column: row.column_name,
        references: `${row.foreign_table_name}.${row.foreign_column_name}`
      }));
      
      expect(foreignKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'clubs',
            column: 'president_id',
            references: 'users.id'
          }),
          expect.objectContaining({
            table: 'activities',
            column: 'club_id',
            references: 'clubs.id'
          }),
          expect.objectContaining({
            table: 'activities',
            column: 'created_by',
            references: 'users.id'
          })
        ])
      );
    });

    test('should have unique constraints', async () => {
      const result = await pool.query(`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name
      `);
      
      const uniqueConstraints = result.rows.map(row => ({
        table: row.table_name,
        column: row.column_name
      }));
      
      expect(uniqueConstraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'users',
            column: 'email'
          }),
          expect.objectContaining({
            table: 'clubs',
            column: 'name'
          }),
          expect.objectContaining({
            table: 'clubs',
            column: 'url_slug'
          })
        ])
      );
    });
  });

  describe('Functions', () => {
    test('should have required utility functions', async () => {
      const result = await pool.query(`
        SELECT routine_name
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_type = 'FUNCTION'
        ORDER BY routine_name
      `);
      
      const functionNames = result.rows.map(row => row.routine_name);
      expect(functionNames).toEqual(
        expect.arrayContaining([
          'current_user_id',
          'current_user_role',
          'is_club_president',
          'get_president_club_id',
          'generate_url_slug',
          'update_updated_at_column'
        ])
      );
    });

    test('generate_url_slug function should work correctly', async () => {
      const testCases = [
        { input: 'TAU Robotics Club', expected: 'tau-robotics-club' },
        { input: 'Müzik Kulübü', expected: 'muzik-kulubu' },
        { input: 'Öğrenci Şenliği & Etkinlik', expected: 'ogrenci-senligi-etkinlik' }
      ];

      for (const testCase of testCases) {
        const result = await pool.query(
          'SELECT generate_url_slug($1) as slug',
          [testCase.input]
        );
        expect(result.rows[0].slug).toBe(testCase.expected);
      }
    });
  });

  describe('Indexes', () => {
    test('should have performance indexes', async () => {
      const result = await pool.query(`
        SELECT 
          tablename,
          indexname
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename IN ('users', 'clubs', 'activities', 'applications', 'audit_log')
        ORDER BY tablename, indexname
      `);
      
      const indexes = result.rows.map(row => ({
        table: row.tablename,
        index: row.indexname
      }));
      
      // Check for key indexes
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'users',
            index: 'idx_users_email'
          }),
          expect.objectContaining({
            table: 'clubs',
            index: 'idx_clubs_url_slug'
          }),
          expect.objectContaining({
            table: 'activities',
            index: 'idx_activities_club_id'
          })
        ])
      );
    });
  });

  describe('Triggers', () => {
    test('should have automatic triggers', async () => {
      const result = await pool.query(`
        SELECT 
          trigger_name,
          event_object_table,
          action_timing,
          event_manipulation
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      `);
      
      const triggers = result.rows.map(row => ({
        name: row.trigger_name,
        table: row.event_object_table,
        timing: row.action_timing,
        event: row.event_manipulation
      }));
      
      expect(triggers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'trigger_users_updated_at',
            table: 'users',
            timing: 'BEFORE',
            event: 'UPDATE'
          }),
          expect.objectContaining({
            name: 'trigger_clubs_auto_slug',
            table: 'clubs'
          })
        ])
      );
    });
  });

  describe('Seed Data', () => {
    test('should have seed data in all tables', async () => {
      const tables = ['users', 'clubs', 'activities', 'applications', 'audit_log'];
      
      for (const table of tables) {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
      }
    });

    test('should have correct user roles in seed data', async () => {
      const result = await pool.query(`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role 
        ORDER BY role
      `);
      
      const roleCounts = result.rows.reduce((acc, row) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);
      
      expect(roleCounts['SUPER_ADMIN']).toBeGreaterThanOrEqual(1);
      expect(roleCounts['CLUB_PRESIDENT']).toBeGreaterThanOrEqual(1);
      expect(roleCounts['STUDENT']).toBeGreaterThanOrEqual(1);
    });
  });
});