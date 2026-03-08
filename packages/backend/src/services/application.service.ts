/**
 * Application Service - PostgreSQL Implementation
 * Handles all application-related database operations
 */

import { db } from '../lib/db';

export interface Application {
  id: string;
  club_id: string;
  student_name: string;
  student_email: string;
  motivation: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_comments?: string;
  club?: {
    id: string;
    name: string;
  };
}

export interface ReviewApplicationData {
  status: 'APPROVED' | 'REJECTED';
  reviewComments: string;
  reviewedBy?: string;
}

export class ApplicationService {
  // Get all applications with pagination and optional clubId filtering
  static async getApplications(page: number = 1, limit: number = 20, clubId?: string): Promise<{
    applications: Application[];
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const offset = (page - 1) * limit;

    // Build query with optional clubId filter
    let applicationsQuery = `
      SELECT 
        a.id,
        a.club_id,
        a.student_name,
        a.student_email,
        a.motivation,
        a.status,
        a.submitted_at,
        a.reviewed_at,
        a.reviewed_by,
        a.review_comments,
        c.name as club_name
      FROM applications a
      LEFT JOIN clubs c ON a.club_id = c.id
    `;

    let countQuery = `SELECT COUNT(*) as total FROM applications`;
    let queryParams: any[] = [];
    let countParams: any[] = [];

    // Add clubId filter if provided
    if (clubId) {
      applicationsQuery += ` WHERE a.club_id = $1`;
      countQuery += ` WHERE club_id = $1`;
      queryParams.push(clubId);
      countParams.push(clubId);
      
      // Add pagination parameters
      applicationsQuery += ` ORDER BY a.submitted_at DESC LIMIT $2 OFFSET $3`;
      queryParams.push(limit, offset);
    } else {
      // No filter, just pagination
      applicationsQuery += ` ORDER BY a.submitted_at DESC LIMIT $1 OFFSET $2`;
      queryParams.push(limit, offset);
    }

    try {
      const [applicationsResult, countResult] = await Promise.all([
        db.query(applicationsQuery, queryParams),
        db.query(countQuery, countParams)
      ]);

      const applications: Application[] = applicationsResult.rows.map((row: any) => ({
        id: row.id,
        club_id: row.club_id,
        student_name: row.student_name,
        student_email: row.student_email,
        motivation: row.motivation,
        status: row.status,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        review_comments: row.review_comments,
        club: row.club_name ? {
          id: row.club_id,
          name: row.club_name
        } : undefined
      }));

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        applications,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      console.error('Error fetching applications:', error);
      throw new Error('Failed to fetch applications');
    }
  }

  // Get application by ID
  static async getApplicationById(id: string): Promise<Application | null> {
    const query = `
      SELECT 
        a.id,
        a.club_id,
        a.student_name,
        a.student_email,
        a.motivation,
        a.status,
        a.submitted_at,
        a.reviewed_at,
        a.reviewed_by,
        a.review_comments,
        c.name as club_name
      FROM applications a
      LEFT JOIN clubs c ON a.club_id = c.id
      WHERE a.id = $1
    `;

    try {
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        club_id: row.club_id,
        student_name: row.student_name,
        student_email: row.student_email,
        motivation: row.motivation,
        status: row.status,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        reviewed_by: row.reviewed_by,
        review_comments: row.review_comments,
        club: row.club_name ? {
          id: row.club_id,
          name: row.club_name
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching application by ID:', error);
      throw new Error('Failed to fetch application');
    }
  }

  // Review application (approve/reject)
  static async reviewApplication(id: string, data: ReviewApplicationData): Promise<Application | null> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Check if application exists and is pending
      const applicationCheck = await client.query(
        'SELECT id, status, student_name, student_email FROM applications WHERE id = $1',
        [id]
      );

      if (applicationCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const currentApplication = applicationCheck.rows[0];
      if (currentApplication.status !== 'PENDING') {
        await client.query('ROLLBACK');
        throw new Error('Application has already been reviewed');
      }

      // Get a valid admin user ID from the database
      const adminUserQuery = await client.query(
        "SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1"
      );
      
      const reviewedBy = adminUserQuery.rows.length > 0 
        ? adminUserQuery.rows[0].id 
        : null; // Allow null if no admin user found

      // If approving the application, create user account if it doesn't exist
      if (data.status === 'APPROVED') {
        const studentEmail = currentApplication.student_email;
        const studentName = currentApplication.student_name;
        
        // Check if user account already exists
        const existingUserCheck = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [studentEmail]
        );

        if (existingUserCheck.rows.length === 0) {
          // Create user account for approved applicant
          const nameParts = studentName.split(' ');
          const firstName = nameParts[0] || 'Student';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Generate a default password hash (in real app, send password reset email)
          const defaultPasswordHash = '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ';
          
          await client.query(`
            INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
            VALUES ($1, $2, 'STUDENT', $3, $4, true)
          `, [studentEmail, defaultPasswordHash, firstName, lastName]);
          
          console.log(`Created user account for approved applicant: ${studentEmail}`);
        }
      }

      // Update application
      const updateResult = await client.query(`
        UPDATE applications 
        SET 
          status = $1,
          review_comments = $2,
          reviewed_by = $3,
          reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id
      `, [data.status, data.reviewComments, reviewedBy, id]);

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');

      // Get updated application with full details
      return await this.getApplicationById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reviewing application:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete application
  static async deleteApplication(id: string): Promise<boolean> {
    try {
      const result = await db.query(
        'DELETE FROM applications WHERE id = $1',
        [id]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting application:', error);
      throw error;
    }
  }
}