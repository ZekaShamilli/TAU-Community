import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { ClubService } from './services/club.service';
import { ApplicationService } from './services/application.service';
import { db } from './lib/db';
import authRoutes from './routes/auth';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
      };
    }
  }
}

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Register auth routes
// app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  res.status(dbHealth ? 200 : 503).json({
    status: dbHealth ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    service: 'TAU Community Backend',
    version: '1.0.0',
    database: dbHealth ? 'Connected' : 'Disconnected',
  });
});

// Basic API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'TAU Community API Server',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      clubs: '/api/clubs',
      activities: '/api/activities',
      applications: '/api/applications',
    },
  });
});

// Google OAuth endpoints
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Google credential is required',
        },
      });
    }

    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
      return res.status(500).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in environment variables.',
        },
      });
    }

    // Verify Google token
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      console.error('Google token verification failed:', error);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid Google token',
        },
      });
    }

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name || '';
    const lastName = payload.family_name || '';

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email not provided by Google',
        },
      });
    }

    // Check if user exists with Google ID
    let userResult = await db.query(
      'SELECT id, email, role, first_name, last_name, is_active, google_id FROM users WHERE google_id = $1 AND is_active = true',
      [googleId]
    );

    let user;
    if (userResult.rows.length > 0) {
      // User exists with Google ID
      user = userResult.rows[0];
    } else {
      // Check if user exists with same email
      const emailResult = await db.query(
        'SELECT id, email, role, first_name, last_name, is_active, google_id FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (emailResult.rows.length > 0) {
        // Link existing account to Google
        user = emailResult.rows[0];
        await db.query(
          'UPDATE users SET google_id = $1, auth_provider = $2 WHERE id = $3',
          [googleId, 'google', user.id]
        );
        user.google_id = googleId;
      } else {
        // Create new user
        const insertResult = await db.query(`
          INSERT INTO users (email, first_name, last_name, google_id, auth_provider, role, password_hash)
          VALUES ($1, $2, $3, $4, $5, 'STUDENT', 'google-oauth-no-password')
          RETURNING id, email, first_name, last_name, role, is_active, google_id
        `, [email, firstName, lastName, googleId, 'google']);

        user = insertResult.rows[0];
      }
    }

    // Check if user has club president role
    const clubResult = await db.query(
      'SELECT id, name FROM clubs WHERE president_id = $1 AND is_active = true',
      [user.id]
    );

    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: user.is_active,
      clubId: clubResult.rows.length > 0 ? clubResult.rows[0].id : undefined,
      clubName: clubResult.rows.length > 0 ? clubResult.rows[0].name : undefined,
    };

    const { JWTService } = require('./lib/auth/jwt');
    const tokens = await JWTService.generateTokenPair(
      user.id,
      user.role,
      userData.clubId
    );

    res.json({
      success: true,
      data: {
        user: userData,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      },
    });
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Google authentication failed',
      },
    });
  }
});

// Simple password reset endpoints for testing
app.post('/api/auth/password/reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
        },
      });
    }

    // Check if user exists
    const userResult = await db.query('SELECT id, email FROM users WHERE email = $1 AND is_active = true', [email]);
    
    if (userResult.rows.length === 0) {
      // For security, always return success even if user doesn't exist
      return res.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been sent',
      });
    }

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, userResult.rows[0].id]
    );

    // In a real app, send email here
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: http://localhost:3001/reset-password?token=${resetToken}`);

    res.json({
      success: true,
      message: 'If the email exists in our system, a password reset link has been sent',
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process password reset request',
      },
    });
  }
});

app.post('/api/auth/password/reset-confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token and new password are required',
        },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters long',
        },
      });
    }

    // Find user with valid reset token
    const userResult = await db.query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP AND is_active = true',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token',
        },
      });
    }

    // Hash new password (in real app, use bcrypt)
    const passwordHash = '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ';

    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, userResult.rows[0].id]
    );

    console.log(`Password reset completed for user: ${userResult.rows[0].email}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error: any) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset password',
      },
    });
  }
});
app.get('/api/auth/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Authentication Service',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'First name, last name, email, and password are required',
        },
      });
    }

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email already exists',
        },
      });
    }

    // Hash password (in real app, use bcrypt)
    const passwordHash = '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ';

    // Insert new user
    const result = await db.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, 'STUDENT', $3, $4, $5)
      RETURNING id, email, first_name, last_name, role, created_at
    `, [email, passwordHash, firstName, lastName, phone || null]);

    const newUser = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          role: newUser.role,
          createdAt: newUser.created_at,
        },
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create account. Please try again.',
      },
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    // Check if user exists in database
    const userResult = await db.query(`
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.first_name, 
        u.last_name, 
        u.is_active,
        c.id as club_id,
        c.name as club_name
      FROM users u
      LEFT JOIN clubs c ON u.id = c.president_id
      WHERE u.email = $1 AND u.is_active = true
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const user = userResult.rows[0];

    // In a real app, verify password hash here
    // For now, we'll accept any password for testing

    // Mock successful login
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          isActive: user.is_active,
          clubId: user.club_id || undefined,
          clubName: user.club_name || undefined,
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 900,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed. Please try again.',
      },
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  // Mock current user endpoint - in real app, this would be from JWT token
  const authHeader = req.headers.authorization;
  
  // For mock purposes, return a default user based on token
  // In real implementation, decode JWT token to get user info
  res.json({
    success: true,
    data: {
      user: {
        id: '123',
        email: 'admin@tau.edu.az',
        role: 'SUPER_ADMIN',
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
      },
    },
  });
});

// PostgreSQL Club endpoints
app.get('/api/clubs/names', async (req, res) => {
  try {
    const result = await db.query('SELECT name FROM clubs WHERE is_active = true ORDER BY name');
    const names = result.rows.map((row: any) => row.name);
    
    res.json({
      success: true,
      data: names,
    });
  } catch (error: any) {
    console.error('Error fetching club names:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch club names',
        details: error.message
      },
    });
  }
});

app.get('/api/clubs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string || 'active'; // 'active' or 'archived'
    const search = req.query.search as string; // Search parameter
    
    const result = await ClubService.getClubs(page, limit, status, search);
    
    res.json({
      success: true,
      data: result.clubs,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
    });
  } catch (error: any) {
    console.error('Error fetching clubs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch clubs',
        details: error.message
      },
    });
  }
});

app.post('/api/clubs', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Club name and description are required',
        },
      });
    }

    // Generate URL slug from name
    const urlSlug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if club name already exists
    const existingClub = await db.query('SELECT id FROM clubs WHERE name = $1', [name]);
    if (existingClub.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CLUB_EXISTS',
          message: 'A club with this name already exists',
        },
      });
    }

    // Insert new club without president
    const result = await db.query(`
      INSERT INTO clubs (name, description, url_slug)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, url_slug, president_id, is_active, created_at, updated_at
    `, [name, description, urlSlug]);

    const newClub = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: newClub.id,
        name: newClub.name,
        description: newClub.description,
        urlSlug: newClub.url_slug,
        presidentId: newClub.president_id,
        isActive: newClub.is_active,
        createdAt: newClub.created_at,
        updatedAt: newClub.updated_at,
        president: null,
      },
      message: 'Club created successfully',
    });
  } catch (error: any) {
    console.error('Error creating club:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: error.message || 'Failed to create club',
      },
    });
  }
});

app.post('/api/clubs/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await ClubService.restoreClub(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found or already active',
        },
      });
    }
    
    res.json({
      success: true,
      message: 'Club restored successfully',
    });
  } catch (error: any) {
    console.error('Error restoring club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to restore club',
        details: error.message
      },
    });
  }
});

app.delete('/api/clubs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await ClubService.deleteClub(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found',
        },
      });
    }
    
    res.json({
      success: true,
      message: 'Club deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete club',
        details: error.message
      },
    });
  }
});

app.put('/api/clubs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedClub = await ClubService.updateClub(id, updates);
    
    if (!updatedClub) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found',
        },
      });
    }
    
    res.json({
      success: true,
      data: updatedClub,
      message: 'Club updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update club',
        details: error.message
      },
    });
  }
});

app.get('/api/clubs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const club = await ClubService.getClubById(id);
    
    if (!club) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found',
        },
      });
    }

    res.json({
      success: true,
      data: club,
    });
  } catch (error: any) {
    console.error('Error fetching club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch club',
        details: error.message
      },
    });
  }
});

app.get('/api/clubs/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Get club from database by slug
    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.url_slug,
        c.is_active,
        c.created_at,
        c.updated_at,
        u.id as president_id,
        u.first_name as president_first_name,
        u.last_name as president_last_name,
        u.email as president_email,
        u.phone as president_phone,
        COUNT(DISTINCT a.id) as activities_count,
        COUNT(DISTINCT app.id) as applications_count
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      LEFT JOIN activities a ON c.id = a.club_id AND a.status = 'PUBLISHED'
      LEFT JOIN applications app ON c.id = app.club_id
      WHERE c.url_slug = $1 AND c.is_active = true
      GROUP BY c.id, u.id
    `, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found',
        },
      });
    }

    const row = result.rows[0];
    const club = {
      id: row.id,
      name: row.name,
      description: row.description,
      urlSlug: row.url_slug,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activitiesCount: parseInt(row.activities_count) || 0,
      applicationsCount: parseInt(row.applications_count) || 0,
      president: row.president_id ? {
        id: row.president_id,
        firstName: row.president_first_name,
        lastName: row.president_last_name,
        email: row.president_email,
        phone: row.president_phone,
      } : null,
    };

    res.json({
      success: true,
      data: club,
    });
  } catch (error: any) {
    console.error('Error fetching club by slug:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch club',
        details: error.message
      },
    });
  }
});


// Simple activity endpoints for testing
app.get('/api/activities/upcoming', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);
    
    const result = await db.query(`
      SELECT 
        a.id,
        a.club_id,
        a.title,
        a.description,
        a.start_date,
        a.end_date,
        a.location,
        a.status,
        c.name as club_name,
        c.url_slug as club_url_slug
      FROM activities a
      INNER JOIN clubs c ON a.club_id = c.id
      WHERE a.start_date > CURRENT_TIMESTAMP 
        AND a.status = 'PUBLISHED'
        AND c.is_active = true
      ORDER BY a.start_date ASC
      LIMIT $1
    `, [limitNum]);

    const activities = result.rows.map((row: any) => ({
      id: row.id,
      clubId: row.club_id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      status: row.status,
      club: {
        id: row.club_id,
        name: row.club_name,
        urlSlug: row.club_url_slug,
      },
    }));

    res.json({
      success: true,
      data: activities,
    });
  } catch (error: any) {
    console.error('Error fetching upcoming activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch upcoming activities',
        details: error.message
      },
    });
  }
});

app.get('/api/activities', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const [activitiesResult, countResult] = await Promise.all([
      db.query(`
        SELECT 
          a.id,
          a.club_id,
          a.title,
          a.description,
          a.start_date,
          a.end_date,
          a.location,
          a.status,
          c.name as club_name,
          c.url_slug as club_url_slug
        FROM activities a
        INNER JOIN clubs c ON a.club_id = c.id
        WHERE a.status = 'PUBLISHED' AND c.is_active = true
        ORDER BY a.start_date DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query(`
        SELECT COUNT(*) as total 
        FROM activities a
        INNER JOIN clubs c ON a.club_id = c.id
        WHERE a.status = 'PUBLISHED' AND c.is_active = true
      `)
    ]);

    const activities = activitiesResult.rows.map((row: any) => ({
      id: row.id,
      clubId: row.club_id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      status: row.status,
      club: {
        name: row.club_name,
        urlSlug: row.club_url_slug,
      },
    }));

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch activities',
        details: error.message
      },
    });
  }
});

app.get('/api/activities/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Get activities from database for this club
    const result = await db.query(`
      SELECT 
        a.id,
        a.club_id,
        a.title,
        a.description,
        a.start_date,
        a.end_date,
        a.location,
        a.max_participants,
        a.status,
        a.created_at,
        a.updated_at
      FROM activities a
      WHERE a.club_id = $1
      ORDER BY a.start_date DESC
    `, [clubId]);

    const activities = result.rows.map((row: any) => ({
      id: row.id,
      clubId: row.club_id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      maxParticipants: row.max_participants,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json({
      success: true,
      data: activities,
    });
  } catch (error: any) {
    console.error('Error fetching club activities:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch club activities',
        details: error.message
      },
    });
  }
});

// Content moderation endpoints
app.get('/api/admin/content-queue', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        type: 'ACTIVITY',
        content: { title: 'Sample Activity', description: 'This is a sample activity description' },
        authorId: 'user1',
        author: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        clubId: 'club1',
        club: { name: 'Sample Club' },
        status: 'FLAGGED',
        createdAt: new Date().toISOString(),
        flaggedAt: new Date().toISOString(),
        flagReason: 'Inappropriate content',
      },
      {
        id: '2',
        type: 'APPLICATION',
        content: { motivation: 'I want to join this club because...' },
        authorId: 'user2',
        author: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        clubId: 'club2',
        club: { name: 'Photography Club' },
        status: 'PENDING',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  });
});

app.post('/api/admin/content/:id/review', (req, res) => {
  const { id } = req.params;
  const { action, changes } = req.body;
  
  res.json({
    success: true,
    message: `Content ${action.toLowerCase()}ed successfully`,
  });
});

// Audit log endpoints
app.get('/api/admin/audit-logs', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        userId: 'user1',
        user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        userRole: 'CLUB_PRESIDENT',
        action: 'CREATE_ACTIVITY',
        resource: 'ACTIVITY',
        resourceId: 'activity1',
        changes: { title: 'New Activity', description: 'Activity description' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date().toISOString(),
        success: true,
      },
      {
        id: '2',
        userId: 'admin1',
        user: { firstName: 'Admin', lastName: 'User', email: 'admin@example.com' },
        userRole: 'SUPER_ADMIN',
        action: 'DELETE_CLUB',
        resource: 'CLUB',
        resourceId: 'club1',
        changes: null,
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        success: true,
      },
      {
        id: '3',
        userId: 'user3',
        user: { firstName: 'Student', lastName: 'User', email: 'student@example.com' },
        userRole: 'STUDENT',
        action: 'SUBMIT_APPLICATION',
        resource: 'APPLICATION',
        resourceId: 'app1',
        changes: { clubId: 'club1', motivation: 'I want to join...' },
        ipAddress: '192.168.1.3',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        success: true,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });
});

// Dashboard stats endpoint
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Get real statistics from database
    const [
      clubsResult,
      activitiesResult,
      applicationsResult,
      usersResult,
      upcomingActivitiesResult,
      pendingApplicationsResult
    ] = await Promise.all([
      // Total clubs
      db.query('SELECT COUNT(*) as total FROM clubs WHERE is_active = true'),
      
      // Total activities
      db.query('SELECT COUNT(*) as total FROM activities WHERE status = \'PUBLISHED\''),
      
      // Total applications
      db.query('SELECT COUNT(*) as total FROM applications'),
      
      // Total users
      db.query('SELECT COUNT(*) as total FROM users WHERE is_active = true'),
      
      // Upcoming activities (next 5)
      db.query(`
        SELECT 
          a.id,
          a.title,
          a.start_date,
          c.name as club_name
        FROM activities a
        LEFT JOIN clubs c ON a.club_id = c.id
        WHERE a.start_date > CURRENT_TIMESTAMP 
          AND a.status = 'PUBLISHED'
          AND c.is_active = true
        ORDER BY a.start_date ASC
        LIMIT 5
      `),
      
      // Pending applications (latest 5)
      db.query(`
        SELECT 
          a.id,
          a.student_name,
          a.submitted_at,
          c.name as club_name
        FROM applications a
        LEFT JOIN clubs c ON a.club_id = c.id
        WHERE a.status = 'PENDING'
          AND c.is_active = true
        ORDER BY a.submitted_at DESC
        LIMIT 5
      `)
    ]);

    const stats = {
      totalClubs: parseInt(clubsResult.rows[0].total),
      totalActivities: parseInt(activitiesResult.rows[0].total),
      totalApplications: parseInt(applicationsResult.rows[0].total),
      totalUsers: parseInt(usersResult.rows[0].total),
      recentActivities: upcomingActivitiesResult.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        club: { name: row.club_name },
        startDate: row.start_date,
      })),
      pendingApplications: pendingApplicationsResult.rows.map((row: any) => ({
        id: row.id,
        studentName: row.student_name,
        club: { name: row.club_name },
        submittedAt: row.submitted_at,
      })),
      flaggedContent: [], // For now, empty - can be implemented later
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch dashboard statistics',
        details: error.message
      },
    });
  }
});

// User Management Endpoints
app.get('/api/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string; // Filter by role
    const clubId = req.query.clubId as string; // Filter by club (for club presidents)
    const search = req.query.search as string; // Search by name or email
    const offset = (page - 1) * limit;

    // Build query with filters
    let usersQuery = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.first_name,
        u.last_name,
        u.phone,
        u.is_active,
        u.created_at,
        u.updated_at,
        c.id as club_id,
        c.name as club_name,
        COUNT(DISTINCT app.id) as applications_count
      FROM users u
      LEFT JOIN clubs c ON u.id = c.president_id
      LEFT JOIN applications app ON u.email = app.student_email
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT u.id) as total 
      FROM users u
      LEFT JOIN clubs c ON u.id = c.president_id
      LEFT JOIN applications app ON u.email = app.student_email
    `;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Add role filter
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    // Add club filter (for club presidents to see their members)
    if (clubId) {
      whereConditions.push(`(c.id = $${paramIndex} OR app.club_id = $${paramIndex})`);
      queryParams.push(clubId);
      paramIndex++;
    }

    // Add search filter
    if (search) {
      whereConditions.push(`(
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(u.email) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      usersQuery += whereClause;
      countQuery += whereClause;
    }

    // Add GROUP BY and pagination
    usersQuery += ` 
      GROUP BY u.id, c.id, c.name
      ORDER BY u.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      db.query(usersQuery, queryParams),
      db.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const users = usersResult.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      club: row.club_id ? {
        id: row.club_id,
        name: row.club_name
      } : null,
      applicationsCount: parseInt(row.applications_count) || 0
    }));

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch users',
        details: error.message
      },
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.first_name,
        u.last_name,
        u.phone,
        u.is_active,
        u.totp_enabled,
        u.created_at,
        u.updated_at,
        c.id as club_id,
        c.name as club_name
      FROM users u
      LEFT JOIN clubs c ON u.id = c.president_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isActive: user.is_active,
        totpEnabled: user.totp_enabled,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        club: user.club_id ? {
          id: user.club_id,
          name: user.club_name
        } : null
      },
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user',
        details: error.message
      },
    });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, isActive } = req.body;
    
    const result = await db.query(`
      UPDATE users 
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, email, role, first_name, last_name, phone, is_active, created_at, updated_at
    `, [firstName, lastName, phone, isActive, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      message: 'User updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update user',
        details: error.message
      },
    });
  }
});

// Get club members (for club presidents)
app.get('/api/clubs/:clubId/members', async (req, res) => {
  try {
    const { clubId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Get club members (students who have approved applications)
    let membersQuery = `
      SELECT DISTINCT
        COALESCE(u.id, app.id) as id,
        COALESCE(u.email, app.student_email) as email,
        COALESCE(u.role, 'STUDENT') as role,
        COALESCE(u.first_name, SPLIT_PART(app.student_name, ' ', 1)) as first_name,
        COALESCE(u.last_name, SPLIT_PART(app.student_name, ' ', 2)) as last_name,
        u.phone,
        COALESCE(u.is_active, true) as is_active,
        COALESCE(u.created_at, app.submitted_at) as created_at,
        app.status as membership_status,
        app.submitted_at as joined_at,
        app.reviewed_at,
        CASE WHEN u.id IS NULL THEN false ELSE true END as has_account
      FROM applications app
      LEFT JOIN users u ON app.student_email = u.email
      WHERE app.club_id = $1 AND app.status = 'APPROVED'
    `;

    let countQuery = `
      SELECT COUNT(DISTINCT app.id) as total
      FROM applications app
      LEFT JOIN users u ON app.student_email = u.email
      WHERE app.club_id = $1 AND app.status = 'APPROVED'
    `;

    let queryParams: any[] = [clubId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      const searchCondition = ` AND (
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(u.email) LIKE LOWER($${paramIndex})
      )`;
      membersQuery += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add pagination
    membersQuery += ` 
      ORDER BY app.reviewed_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const [membersResult, countResult] = await Promise.all([
      db.query(membersQuery, queryParams),
      db.query(countQuery, queryParams.slice(0, -2))
    ]);

    const members = membersResult.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
      membershipStatus: row.membership_status,
      joinedAt: row.joined_at,
      approvedAt: row.reviewed_at,
      hasAccount: row.has_account
    }));

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching club members:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch club members',
        details: error.message
      },
    });
  }
});

// Remove member from club (for club presidents and super admins)
app.delete('/api/clubs/:clubId/members/:memberEmail', async (req, res) => {
  try {
    const { clubId, memberEmail } = req.params;
    const decodedEmail = decodeURIComponent(memberEmail);

    // Check if member exists in the club
    const memberCheck = await db.query(
      `SELECT a.id, u.email 
       FROM applications a
       JOIN users u ON a.student_id = u.id
       WHERE a.club_id = $1 AND u.email = $2 AND a.status = $3`,
      [clubId, decodedEmail, 'APPROVED']
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Member not found in this club'
        }
      });
    }

    // Delete the application (removes member from club)
    await db.query(
      `DELETE FROM applications 
       WHERE club_id = $1 
         AND student_id IN (SELECT id FROM users WHERE email = $2)`,
      [clubId, decodedEmail]
    );

    res.json({
      success: true,
      message: 'Member removed from club successfully'
    });
  } catch (error: any) {
    console.error('Error removing member from club:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to remove member from club',
        details: error.message
      }
    });
  }
});

// PostgreSQL Application endpoints
app.get('/api/applications', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const clubId = req.query.clubId as string; // Optional clubId filter
    
    const result = await ApplicationService.getApplications(page, limit, clubId);
    
    res.json({
      success: true,
      data: result.applications,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
    });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch applications',
        details: error.message
      },
    });
  }
});

app.get('/api/applications/summary/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Get application counts by status
    const statusCounts = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM applications 
      WHERE club_id = $1 
      GROUP BY status
    `, [clubId]);

    // Get recent applications (last 5)
    const recentApplications = await db.query(`
      SELECT 
        a.id,
        a.student_name,
        a.student_email,
        a.status,
        a.submitted_at,
        c.name as club_name
      FROM applications a
      LEFT JOIN clubs c ON a.club_id = c.id
      WHERE a.club_id = $1
      ORDER BY a.submitted_at DESC
      LIMIT 5
    `, [clubId]);

    // Process status counts
    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    statusCounts.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      summary.total += count;
      
      switch (row.status) {
        case 'PENDING':
          summary.pending = count;
          break;
        case 'APPROVED':
          summary.approved = count;
          break;
        case 'REJECTED':
          summary.rejected = count;
          break;
      }
    });

    // Format recent applications
    const recent = recentApplications.rows.map((row: any) => ({
      id: row.id,
      studentName: row.student_name,
      studentEmail: row.student_email,
      status: row.status,
      submittedAt: row.submitted_at,
      club: row.club_name ? {
        name: row.club_name
      } : undefined
    }));

    res.json({
      success: true,
      data: {
        ...summary,
        recent
      },
    });
  } catch (error: any) {
    console.error('Error fetching application summary:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch application summary',
        details: error.message
      },
    });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const { clubId, title, description, startDate, endDate, location, maxParticipants } = req.body;
    
    if (!clubId || !title || !description || !startDate || !endDate || !location) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All required fields must be provided',
        },
      });
    }

    // Check if club exists
    const clubCheck = await db.query('SELECT id FROM clubs WHERE id = $1 AND is_active = true', [clubId]);
    if (clubCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CLUB_NOT_FOUND',
          message: 'Club not found or inactive',
        },
      });
    }

    // Get a default user ID for created_by (in real app, this would come from JWT token)
    const userQuery = await db.query("SELECT id FROM users WHERE role = 'CLUB_PRESIDENT' LIMIT 1");
    const createdBy = userQuery.rows.length > 0 ? userQuery.rows[0].id : null;

    // Insert new activity
    const result = await db.query(`
      INSERT INTO activities (club_id, title, description, start_date, end_date, location, max_participants, created_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED')
      RETURNING id, club_id, title, description, start_date, end_date, location, max_participants, status, created_at, updated_at
    `, [clubId, title, description, startDate, endDate, location, maxParticipants || null, createdBy]);

    const newActivity = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: newActivity.id,
        clubId: newActivity.club_id,
        title: newActivity.title,
        description: newActivity.description,
        startDate: newActivity.start_date,
        endDate: newActivity.end_date,
        location: newActivity.location,
        maxParticipants: newActivity.max_participants,
        status: newActivity.status,
        createdAt: newActivity.created_at,
        updatedAt: newActivity.updated_at,
      },
      message: 'Activity created successfully',
    });
  } catch (error: any) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create activity. Please try again.',
      },
    });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, location, maxParticipants, status } = req.body;
    
    // Check if activity exists
    const activityCheck = await db.query('SELECT id FROM activities WHERE id = $1', [id]);
    if (activityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Activity not found',
        },
      });
    }

    // Update activity
    const result = await db.query(`
      UPDATE activities 
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        location = COALESCE($5, location),
        max_participants = COALESCE($6, max_participants),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, club_id, title, description, start_date, end_date, location, max_participants, status, created_at, updated_at
    `, [title, description, startDate, endDate, location, maxParticipants, status, id]);

    const updatedActivity = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: updatedActivity.id,
        clubId: updatedActivity.club_id,
        title: updatedActivity.title,
        description: updatedActivity.description,
        startDate: updatedActivity.start_date,
        endDate: updatedActivity.end_date,
        location: updatedActivity.location,
        maxParticipants: updatedActivity.max_participants,
        status: updatedActivity.status,
        createdAt: updatedActivity.created_at,
        updatedAt: updatedActivity.updated_at,
      },
      message: 'Activity updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update activity',
        details: error.message
      },
    });
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM activities WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Activity not found',
        },
      });
    }
    
    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete activity',
        details: error.message
      },
    });
  }
});

app.get('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        a.id,
        a.club_id,
        a.title,
        a.description,
        a.start_date,
        a.end_date,
        a.location,
        a.max_participants,
        a.status,
        a.created_at,
        a.updated_at,
        c.name as club_name,
        c.url_slug as club_url_slug
      FROM activities a
      LEFT JOIN clubs c ON a.club_id = c.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Activity not found',
        },
      });
    }

    const activity = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: activity.id,
        clubId: activity.club_id,
        title: activity.title,
        description: activity.description,
        startDate: activity.start_date,
        endDate: activity.end_date,
        location: activity.location,
        maxParticipants: activity.max_participants,
        status: activity.status,
        createdAt: activity.created_at,
        updatedAt: activity.updated_at,
        club: {
          id: activity.club_id,
          name: activity.club_name,
          urlSlug: activity.club_url_slug,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch activity',
        details: error.message
      },
    });
  }
});

// Application management endpoints
app.put('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewComments } = req.body;
    
    console.log('PUT /api/applications/:id called with:', { id, status, reviewComments });
    
    if (!status || !reviewComments) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status and review comments are required',
        },
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status must be APPROVED or REJECTED',
        },
      });
    }

    // Check if ID is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Invalid UUID format:', id);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid application ID format',
        },
      });
    }

    // Use ApplicationService to review the application
    const reviewData = {
      status: status as 'APPROVED' | 'REJECTED',
      reviewComments
    };

    const updatedApplication = await ApplicationService.reviewApplication(id, reviewData);
    
    if (!updatedApplication) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Application not found',
        },
      });
    }
    
    res.json({
      success: true,
      data: updatedApplication,
      message: 'Application reviewed successfully',
    });
  } catch (error: any) {
    console.error('Error reviewing application:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to review application',
        details: error.message
      },
    });
  }
});

app.delete('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await ApplicationService.deleteApplication(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Application not found',
        },
      });
    }
    
    res.json({
      success: true,
      message: 'Application deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete application',
        details: error.message
      },
    });
  }
});

// Test endpoint for frontend integration
app.get('/api/test/integration', (req, res) => {
  res.json({
    success: true,
    message: 'Frontend-Backend integration is working!',
    timestamp: new Date().toISOString(),
    data: {
      backend: 'TAU Community Backend',
      version: '1.0.0',
      status: 'Connected',
    },
  });
});

app.get('/api/applications/check/:clubId/:email', async (req, res) => {
  try {
    const { clubId, email } = req.params;
    
    const result = await db.query(
      'SELECT id, status, submitted_at FROM applications WHERE club_id = $1 AND student_email = $2',
      [clubId, decodeURIComponent(email)]
    );

    if (result.rows.length > 0) {
      const application = result.rows[0];
      res.json({
        success: true,
        data: {
          exists: true,
          application: {
            id: application.id,
            status: application.status,
            submittedAt: application.submitted_at,
          },
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          exists: false,
        },
      });
    }
  } catch (error: any) {
    console.error('Error checking existing application:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to check existing application',
        details: error.message
      },
    });
  }
});

// Simple authentication middleware for applications
const requireAuthentication = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    console.log('Authentication middleware called');
    
    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token required',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT token using JWTService
    const { JWTService } = require('./lib/auth/jwt');
    const validation = await JWTService.validateAccessToken(token);
    
    if (!validation.valid || !validation.payload) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: validation.error || 'Invalid or expired token',
        },
      });
    }

    // Get user from database
    const userResult = await db.query(`
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [validation.payload.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive',
        },
      });
    }

    const user = userResult.rows[0];
    req.authUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };
    return next();
    
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
};

app.post('/api/applications', requireAuthentication, async (req, res) => {
  try {
    const { clubId, motivation } = req.body;
    const user = req.authUser; // From authentication middleware
    
    if (!clubId || !motivation) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Club ID and motivation are required',
        },
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Please sign in to submit applications',
        },
      });
    }

    // Use authenticated user's information
    const studentName = `${user.firstName} ${user.lastName}`;
    const studentEmail = user.email;

    // Check if club exists
    const clubCheck = await db.query('SELECT id, name FROM clubs WHERE id = $1 AND is_active = true', [clubId]);
    if (clubCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CLUB_NOT_FOUND',
          message: 'Club not found or inactive',
        },
      });
    }

    // Check if user already applied to this club
    const existingApplication = await db.query(
      'SELECT id FROM applications WHERE club_id = $1 AND student_email = $2',
      [clubId, studentEmail]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_APPLICATION',
          message: 'You have already applied to this club',
        },
      });
    }

    // Insert new application
    const result = await db.query(`
      INSERT INTO applications (club_id, student_name, student_email, motivation)
      VALUES ($1, $2, $3, $4)
      RETURNING id, club_id, student_name, student_email, motivation, status, submitted_at
    `, [clubId, studentName, studentEmail, motivation]);

    const newApplication = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: newApplication.id,
        clubId: newApplication.club_id,
        studentName: newApplication.student_name,
        studentEmail: newApplication.student_email,
        motivation: newApplication.motivation,
        status: newApplication.status,
        submittedAt: newApplication.submitted_at,
        club: {
          id: clubCheck.rows[0].id,
          name: clubCheck.rows[0].name,
        },
      },
      message: 'Application submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting application:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      query: error.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit application. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      },
    });
  }
});

// Change Club President endpoint
app.put('/api/clubs/:id/president', async (req, res) => {
  try {
    const { id } = req.params;
    const { presidentId } = req.body;
    
    if (!presidentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'President ID is required',
        },
      });
    }

    // Check if club exists
    const clubCheck = await db.query('SELECT id, name FROM clubs WHERE id = $1', [id]);
    if (clubCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Club not found',
        },
      });
    }

    // Check if user exists and can be a president
    const userCheck = await db.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1 AND is_active = true', [presidentId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found or inactive',
        },
      });
    }

    const user = userCheck.rows[0];

    // Update user role to CLUB_PRESIDENT if not already
    if (user.role !== 'CLUB_PRESIDENT') {
      await db.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['CLUB_PRESIDENT', presidentId]);
    }

    // Remove current president from this club (if any)
    await db.query('UPDATE clubs SET president_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Set new president
    const result = await db.query(`
      UPDATE clubs 
      SET 
        president_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, description, url_slug, president_id, is_active, created_at, updated_at
    `, [presidentId, id]);

    const updatedClub = result.rows[0];

    res.json({
      success: true,
      data: {
        id: updatedClub.id,
        name: updatedClub.name,
        description: updatedClub.description,
        urlSlug: updatedClub.url_slug,
        presidentId: updatedClub.president_id,
        isActive: updatedClub.is_active,
        createdAt: updatedClub.created_at,
        updatedAt: updatedClub.updated_at,
        president: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
        },
      },
      message: 'Club president updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating club president:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update club president',
        details: error.message
      },
    });
  }
});

// Get available users for president assignment
app.get('/api/admin/available-presidents', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        c.name as current_club
      FROM users u
      LEFT JOIN clubs c ON u.id = c.president_id
      WHERE u.is_active = true 
        AND (u.role = 'CLUB_PRESIDENT' OR u.role = 'STUDENT')
      ORDER BY u.role DESC, u.first_name, u.last_name
    `);

    const users = result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      currentClub: row.current_club || null,
      displayName: `${row.first_name} ${row.last_name} (${row.email})`,
    }));

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('Error fetching available presidents:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch available presidents',
        details: error.message
      },
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.originalUrl,
    },
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(`ðŸš€ TAU Community Backend server running on port ${PORT}`);
  console.log(`ðŸ“Š Health check: http://localhost:${PORT}/health`);
  console.log(`ðŸ”— API base: http://localhost:${PORT}/api`);
  console.log(`ðŸŒ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('âœ… Basic server initialized - ready for integration testing');
});

export default app;
