/**
 * Club Service - PostgreSQL Implementation
 * Handles all club-related database operations
 */

import { db } from '../lib/db';

export interface Club {
  id: string;
  name: string;
  description: string;
  url_slug: string;
  president_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields
  activities_count?: number;
  applications_count?: number;
  president?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

export interface CreateClubData {
  name: string;
  description: string;
  presidentFirstName: string;
  presidentLastName: string;
  presidentEmail: string;
  presidentPhone?: string;
}

export class ClubService {
  // Generate URL slug from club name
  static generateUrlSlug(name: string): string {
    return name
      .toLowerCase()
      .trim() // Remove leading/trailing spaces
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length to 50 characters
  }

  // Get all clubs with pagination
  static async getClubs(page: number = 1, limit: number = 20, status: string = 'active', search?: string): Promise<{
    clubs: Club[];
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const offset = (page - 1) * limit;
    const isActive = status === 'active';

    // Build query parameters
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Get clubs with president info and counts
    let clubsQuery = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.url_slug,
        c.president_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        u.first_name as president_first_name,
        u.last_name as president_last_name,
        u.email as president_email,
        u.phone as president_phone,
        (SELECT COUNT(*) FROM activities WHERE club_id = c.id AND status != 'CANCELLED') as activities_count,
        (SELECT COUNT(*) FROM applications WHERE club_id = c.id) as applications_count
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      WHERE c.is_active = $${paramIndex}
    `;
    queryParams.push(isActive);
    paramIndex++;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM clubs
      WHERE is_active = $1
    `;

    // Add search filter if provided
    if (search && search.trim()) {
      const searchCondition = ` AND (
        LOWER(c.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(c.description) LIKE LOWER($${paramIndex})
      )`;
      clubsQuery += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Add ORDER BY and pagination
    clubsQuery += `
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    try {
      const [clubsResult, countResult] = await Promise.all([
        db.query(clubsQuery, queryParams),
        db.query(countQuery, queryParams.slice(0, search ? 2 : 1)) // Remove limit and offset for count
      ]);

      const clubs: Club[] = clubsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        url_slug: row.url_slug,
        president_id: row.president_id,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        activities_count: parseInt(row.activities_count) || 0,
        applications_count: parseInt(row.applications_count) || 0,
        president: row.president_first_name ? {
          id: row.president_id,
          first_name: row.president_first_name,
          last_name: row.president_last_name,
          email: row.president_email,
          phone: row.president_phone
        } : undefined
      }));

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        clubs,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      console.error('Error fetching clubs:', error);
      throw new Error('Failed to fetch clubs');
    }
  }

  // Get club by ID
  static async getClubById(id: string): Promise<Club | null> {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.url_slug,
        c.president_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        u.first_name as president_first_name,
        u.last_name as president_last_name,
        u.email as president_email,
        u.phone as president_phone,
        (SELECT COUNT(*) FROM activities WHERE club_id = c.id AND status != 'CANCELLED') as activities_count,
        (SELECT COUNT(*) FROM applications WHERE club_id = c.id) as applications_count
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      WHERE c.id = $1 AND c.is_active = true
    `;

    try {
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        url_slug: row.url_slug,
        president_id: row.president_id,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        activities_count: parseInt(row.activities_count) || 0,
        applications_count: parseInt(row.applications_count) || 0,
        president: row.president_first_name ? {
          id: row.president_id,
          first_name: row.president_first_name,
          last_name: row.president_last_name,
          email: row.president_email,
          phone: row.president_phone
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching club by ID:', error);
      throw new Error('Failed to fetch club');
    }
  }

  // Create new club with president
  static async createClub(data: CreateClubData): Promise<Club> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Generate URL slug
      const urlSlug = this.generateUrlSlug(data.name);

      // Check if club name or slug already exists
      const existingClub = await client.query(
        'SELECT id, name, url_slug FROM clubs WHERE (LOWER(name) = LOWER($1) OR url_slug = $2) AND is_active = true',
        [data.name, urlSlug]
      );

      if (existingClub.rows.length > 0) {
        const existing = existingClub.rows[0];
        if (existing.name.toLowerCase() === data.name.toLowerCase()) {
          throw new Error(`Club name "${data.name}" already exists`);
        } else {
          throw new Error(`URL slug "${urlSlug}" already exists (conflicts with "${existing.name}")`);
        }
      }

      // Check if president email already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [data.presidentEmail]
      );

      let presidentId: string;

      if (existingUser.rows.length > 0) {
        // User already exists, use existing user
        presidentId = existingUser.rows[0].id;
        
        // Update user role to CLUB_PRESIDENT if not already
        await client.query(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['CLUB_PRESIDENT', presidentId]
        );
      } else {
        // Create new president user
        const newUserResult = await client.query(`
          INSERT INTO users (email, password_hash, role, first_name, last_name, phone, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id
        `, [
          data.presidentEmail,
          'temp_password_hash', // In real app, generate proper hash
          'CLUB_PRESIDENT',
          data.presidentFirstName,
          data.presidentLastName,
          data.presidentPhone
        ]);

        presidentId = newUserResult.rows[0].id;
      }

      // Create club
      const clubResult = await client.query(`
        INSERT INTO clubs (name, description, url_slug, president_id, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, name, description, url_slug, president_id, is_active, created_at, updated_at
      `, [data.name, data.description, urlSlug, presidentId]);

      const clubId = clubResult.rows[0].id;

      // Update president's club_id
      await client.query(
        'UPDATE users SET club_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [clubId, presidentId]
      );

      await client.query('COMMIT');

      const club = clubResult.rows[0];
      return {
        id: club.id,
        name: club.name,
        description: club.description,
        url_slug: club.url_slug,
        president_id: club.president_id,
        is_active: club.is_active,
        created_at: club.created_at,
        updated_at: club.updated_at,
        activities_count: 0,
        applications_count: 0,
        president: {
          id: presidentId,
          first_name: data.presidentFirstName,
          last_name: data.presidentLastName,
          email: data.presidentEmail,
          phone: data.presidentPhone
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating club:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update club
  static async updateClub(id: string, updates: Partial<CreateClubData>): Promise<Club | null> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name) {
        updateFields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;

        // Also update URL slug if name changes
        const newSlug = this.generateUrlSlug(updates.name);
        updateFields.push(`url_slug = $${paramIndex}`);
        values.push(newSlug);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      // Handle president updates
      if (updates.presidentEmail || updates.presidentFirstName || updates.presidentLastName) {
        // For now, we'll just update the basic club info
        // President updates would require more complex logic to update the users table
        console.log('President updates not yet implemented in updateClub');
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id); // Add ID as last parameter

      const updateQuery = `
        UPDATE clubs 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND is_active = true
        RETURNING id, name, description, url_slug, president_id, is_active, created_at, updated_at
      `;

      const result = await client.query(updateQuery, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');

      // Get updated club with full details
      return await this.getClubById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating club:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete club (soft delete)
  static async deleteClub(id: string): Promise<boolean> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Check if club exists and get president_id
      const clubCheck = await client.query(
        'SELECT id, president_id FROM clubs WHERE id = $1 AND is_active = true',
        [id]
      );

      if (clubCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const presidentId = clubCheck.rows[0].president_id;

      // Soft delete club (set is_active to false)
      await client.query(
        'UPDATE clubs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      // Update president role to STUDENT and clear club_id
      if (presidentId) {
        await client.query(
          'UPDATE users SET role = $1, club_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['STUDENT', presidentId]
        );
      }

      // Cancel all future activities
      await client.query(`
        UPDATE activities 
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
        WHERE club_id = $1 AND start_date > CURRENT_TIMESTAMP
      `, [id]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting club:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Restore club (reactivate)
  static async restoreClub(id: string): Promise<boolean> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Check if club exists and is inactive
      const clubCheck = await client.query(
        'SELECT id FROM clubs WHERE id = $1 AND is_active = false',
        [id]
      );

      if (clubCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Restore club (set is_active to true)
      await client.query(
        'UPDATE clubs SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error restoring club:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get club by URL slug
  static async getClubBySlug(slug: string): Promise<Club | null> {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.url_slug,
        c.president_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        u.first_name as president_first_name,
        u.last_name as president_last_name,
        u.email as president_email,
        u.phone as president_phone,
        (SELECT COUNT(*) FROM activities WHERE club_id = c.id AND status != 'CANCELLED') as activities_count,
        (SELECT COUNT(*) FROM applications WHERE club_id = c.id) as applications_count
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      WHERE c.url_slug = $1 AND c.is_active = true
    `;

    try {
      const result = await db.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        url_slug: row.url_slug,
        president_id: row.president_id,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        activities_count: parseInt(row.activities_count) || 0,
        applications_count: parseInt(row.applications_count) || 0,
        president: row.president_first_name ? {
          id: row.president_id,
          first_name: row.president_first_name,
          last_name: row.president_last_name,
          email: row.president_email,
          phone: row.president_phone
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching club by slug:', error);
      throw new Error('Failed to fetch club');
    }
  }
}