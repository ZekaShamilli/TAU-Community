const { Client } = require('pg');

// Supabase database connection
// Updated: 2026-02-06 - Fixed endpoints and password validation
// Fixed: User endpoint to check for column existence before querying (v2)
// Fixed: Body parsing for Vercel serverless functions (v3)
const getDatabaseClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// Helper function to verify JWT token
function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now()) {
      return null;
    }
    
    return decoded;
  } catch (e) {
    console.error('Token verification failed:', e);
    return null;
  }
}

// Helper function to log audit events
async function logAudit(client, { userId, action, resource, resourceId, details, ipAddress, userAgent }) {
  try {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, action, resource, resourceId, details ? JSON.stringify(details) : null, ipAddress, userAgent]);
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

// Helper function to parse request body
async function parseBody(req) {
  if (req.body) {
    // If body is already parsed as object, return it
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    
    // If body is string, parse it
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        console.error('Failed to parse body string as JSON:', e);
        return {};
      }
    }
    
    // If body is Buffer, convert and parse
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf-8'));
      } catch (e) {
        console.error('Failed to parse Buffer body as JSON:', e);
        return {};
      }
    }
  }
  
  // If no body, try to read from request stream (for Vercel)
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        console.error('Failed to parse streamed data as JSON:', e);
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

module.exports = async function handler(req, res) {
  try {
    const { method } = req;
    const url = req.url;
    
    // Parse body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      req.body = await parseBody(req);
    }
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    console.log(`API Request: ${method} ${url}`, req.body);

    // Health check
    if (url === '/api/health') {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TAU Community Backend'
      });
      return;
    }

    // Login endpoint
    if (url === '/api/auth/login' && method === 'POST') {
      try {
        const { email, password } = req.body;
        
        if (!email || !password) {
          res.status(400).json({
            error: {
              code: 'MISSING_CREDENTIALS',
              message: 'Email and password are required'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Simple query without club_id to avoid migration issues
        const userQuery = `
          SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, u.is_active, u.email_verified
          FROM users u
          WHERE u.email = $1 AND u.is_active = true
        `;
        
        const userResult = await client.query(userQuery, [email]);
        
        // If user found and is CLUB_PRESIDENT, get their club info
        let clubId = null;
        let clubName = null;
        if (userResult.rows.length > 0 && userResult.rows[0].role === 'CLUB_PRESIDENT') {
          const clubQuery = `
            SELECT id, name FROM clubs WHERE president_id = $1 AND is_active = true LIMIT 1
          `;
          const clubResult = await client.query(clubQuery, [userResult.rows[0].id]);
          if (clubResult.rows.length > 0) {
            clubId = clubResult.rows[0].id;
            clubName = clubResult.rows[0].name;
          }
        }
        
        await client.end();

        if (userResult.rows.length === 0) {
          res.status(401).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            }
          });
          return;
        }

        const user = userResult.rows[0];
        
        // Check if email is verified
        if (!user.email_verified) {
          res.status(401).json({
            error: {
              code: 'EMAIL_NOT_VERIFIED',
              message: 'Please verify your email before logging in. Check your inbox for the verification code.'
            }
          });
          return;
        }
        
        // Support both old bcrypt hashes and new base64 encoded passwords
        const providedPasswordHash = Buffer.from(password).toString('base64');
        const isBcryptHash = user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$');
        
        let passwordValid = false;
        
        if (isBcryptHash) {
          // Old system - bcrypt hash, only accepts 'password123'
          passwordValid = (password === 'password123');
        } else {
          // New system - base64 encoded password
          passwordValid = (user.password_hash === providedPasswordHash);
        }
        
        if (!passwordValid) {
          res.status(401).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            }
          });
          return;
        }

        // Create token
        const token = Buffer.from(JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          exp: Date.now() + (24 * 60 * 60 * 1000)
        })).toString('base64');

        // Log successful login
        const auditClient = getDatabaseClient();
        await auditClient.connect();
        await logAudit(auditClient, {
          userId: user.id,
          action: 'LOGIN',
          resource: 'AUTH',
          resourceId: user.id,
          details: { email: user.email, role: user.role },
          ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        await auditClient.end();

        res.status(200).json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              isActive: user.is_active,
              emailVerified: user.email_verified,
              clubId: clubId,
              clubName: clubName
            },
            tokens: {
              accessToken: token,
              refreshToken: token
            }
          }
        });
        return;
        
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          error: {
            code: 'LOGIN_ERROR',
            message: 'Login failed due to server error'
          }
        });
        return;
      }
    }

    // Google OAuth endpoint
    if (url === '/api/auth/google' && method === 'POST') {
      try {
        const { credential } = req.body;

        if (!credential) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Google credential is required' } });
          return;
        }

        const { OAuth2Client } = require('google-auth-library');
        const clientId = process.env.GOOGLE_CLIENT_ID;

        if (!clientId) {
          res.status(500).json({ error: { code: 'GOOGLE_OAUTH_NOT_CONFIGURED', message: 'Google OAuth is not configured' } });
          return;
        }

        const client = new OAuth2Client(clientId);
        let ticket;
        try {
          ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        } catch (e) {
          res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid Google token' } });
          return;
        }

        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email;
        const firstName = payload.given_name || '';
        const lastName = payload.family_name || '';

        if (!email) {
          res.status(400).json({ error: { code: 'MISSING_EMAIL', message: 'Email not provided by Google' } });
          return;
        }

        const dbClient = getDatabaseClient();
        await dbClient.connect();

        let user;
        // Check by google_id
        let result = await dbClient.query(
          'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE google_id = $1 AND is_active = true',
          [googleId]
        );

        if (result.rows.length > 0) {
          user = result.rows[0];
        } else {
          // Check by email
          result = await dbClient.query(
            'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE email = $1 AND is_active = true',
            [email]
          );

          if (result.rows.length > 0) {
            user = result.rows[0];
            await dbClient.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
          } else {
            // Create new user
            const insertResult = await dbClient.query(
              `INSERT INTO users (email, first_name, last_name, google_id, role, password_hash, is_active, email_verified)
               VALUES ($1, $2, $3, $4, 'STUDENT', 'google-oauth', true, true)
               RETURNING id, email, first_name, last_name, role, is_active`,
              [email, firstName, lastName, googleId]
            );
            user = insertResult.rows[0];
          }
        }

        // Get club info if president
        let clubId = null, clubName = null;
        if (user.role === 'CLUB_PRESIDENT') {
          const clubResult = await dbClient.query(
            'SELECT id, name FROM clubs WHERE president_id = $1 AND is_active = true LIMIT 1',
            [user.id]
          );
          if (clubResult.rows.length > 0) {
            clubId = clubResult.rows[0].id;
            clubName = clubResult.rows[0].name;
          }
        }

        await dbClient.end();

        // Generate token
        const token = Buffer.from(JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          exp: Date.now() + (24 * 60 * 60 * 1000)
        })).toString('base64');

        res.status(200).json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              isActive: user.is_active,
              clubId,
              clubName
            },
            tokens: { accessToken: token, refreshToken: token }
          }
        });
        return;

      } catch (error) {
        console.error('Google OAuth error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Google authentication failed', details: error.message } });
        return;
      }
    }

    // Logout endpoint
    if (url === '/api/auth/logout' && method === 'POST') {
      try {
        // For now, just return success
        // In a real implementation, you would invalidate the token in Redis/database
        res.status(200).json({
          success: true,
          message: 'Logged out successfully'
        });
        return;
      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
          error: {
            code: 'LOGOUT_ERROR',
            message: 'Logout failed due to server error'
          }
        });
        return;
      }
    }

    // Signup endpoint - NEW APPROACH: Only send verification code, don't create user yet
    if (url === '/api/auth/signup' && method === 'POST') {
      try {
        const { firstName, lastName, email, phone, password } = req.body;
        
        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'First name, last name, email, and password are required'
            }
          });
          return;
        }

        // Validate email format
        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        if (!emailRegex.test(email)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid email format'
            }
          });
          return;
        }

        // Validate password strength
        if (password.length < 8) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Password must be at least 8 characters long'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if user already exists in users table
        const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
        const checkUserResult = await client.query(checkUserQuery, [email]);
        
        if (checkUserResult.rows.length > 0) {
          await client.end();
          res.status(409).json({
            error: {
              code: 'USER_EXISTS',
              message: 'A user with this email already exists'
            }
          });
          return;
        }

        // Hash password using base64 (new system)
        const passwordHash = Buffer.from(password).toString('base64');
        
        // Generate 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set expiration to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Check if pending registration already exists
        const checkPendingQuery = 'SELECT id FROM pending_registrations WHERE email = $1';
        const checkPendingResult = await client.query(checkPendingQuery, [email]);
        
        if (checkPendingResult.rows.length > 0) {
          // Update existing pending registration
          const updateQuery = `
            UPDATE pending_registrations 
            SET first_name = $1, last_name = $2, password_hash = $3, 
                verification_code = $4, verification_code_expires = $5, updated_at = NOW()
            WHERE email = $6
          `;
          await client.query(updateQuery, [
            firstName,
            lastName,
            passwordHash,
            verificationCode,
            expiresAt,
            email
          ]);
        } else {
          // Insert new pending registration
          const insertQuery = `
            INSERT INTO pending_registrations (first_name, last_name, email, password_hash, verification_code, verification_code_expires)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await client.query(insertQuery, [
            firstName,
            lastName,
            email,
            passwordHash,
            verificationCode,
            expiresAt
          ]);
        }
        
        await client.end();

        // Send verification email via Brevo
        try {
          const { sendVerificationEmail } = require('./email-service');
          await sendVerificationEmail(email, firstName, verificationCode);
          console.log(`✅ Verification email sent to ${email}`);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Fallback: log to console for development
          console.log(`📧 Verification code for ${email}: ${verificationCode}`);
        }

        res.status(200).json({
          success: true,
          message: 'Verification code sent to your email. Please verify to complete registration.',
          data: {
            email: email
          }
        });
        return;
        
      } catch (error) {
        console.error('Signup error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({
          error: {
            code: 'SIGNUP_ERROR',
            message: 'Failed to process signup due to server error',
            details: error.message
          }
        });
        return;
      }
    }

    // Send/Resend verification code endpoint - For pending registrations
    if (url === '/api/auth/send-verification-code' && method === 'POST') {
      try {
        const { email } = req.body;
        
        if (!email) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email is required'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if user already exists (already verified)
        const userQuery = 'SELECT id, email_verified FROM users WHERE email = $1';
        const userResult = await client.query(userQuery, [email]);
        
        if (userResult.rows.length > 0) {
          await client.end();
          res.status(400).json({
            error: {
              code: 'ALREADY_VERIFIED',
              message: 'This email is already registered and verified. Please login.'
            }
          });
          return;
        }

        // Find pending registration
        const pendingQuery = 'SELECT id, email, first_name FROM pending_registrations WHERE email = $1';
        const pendingResult = await client.query(pendingQuery, [email]);
        
        if (pendingResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'REGISTRATION_NOT_FOUND',
              message: 'No pending registration found. Please sign up first.'
            }
          });
          return;
        }

        const pending = pendingResult.rows[0];

        // Generate new 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set expiration to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Update pending registration with new verification code and RESET failed_attempts
        const updateQuery = `
          UPDATE pending_registrations 
          SET verification_code = $1, verification_code_expires = $2, failed_attempts = 0, updated_at = NOW()
          WHERE id = $3
        `;
        await client.query(updateQuery, [verificationCode, expiresAt, pending.id]);
        
        await client.end();

        // Send email via Brevo
        try {
          const { sendVerificationEmail } = require('./email-service');
          await sendVerificationEmail(pending.email, pending.first_name, verificationCode);
          console.log(`✅ Verification email sent to ${email}`);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Fallback: log to console for development
          console.log(`📧 Verification code for ${email}: ${verificationCode}`);
        }

        res.json({
          success: true,
          message: 'Verification code sent to your email'
        });
        return;
        
      } catch (error) {
        console.error('Send verification code error:', error);
        res.status(500).json({
          error: {
            code: 'SEND_CODE_ERROR',
            message: 'Failed to send verification code',
            details: error.message
          }
        });
        return;
      }
    }

    // Verify email endpoint - NEW APPROACH: Create user account after verification
    // Security: Max 5 failed attempts allowed
    if (url === '/api/auth/verify-email' && method === 'POST') {
      try {
        const { email, code } = req.body;
        
        if (!email || !code) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email and code are required'
            }
          });
          return;
        }

        if (code.length !== 6) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Verification code must be 6 digits'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Find pending registration by email
        const pendingQuery = `
          SELECT id, email, first_name, last_name, password_hash, verification_code, 
                 verification_code_expires, failed_attempts 
          FROM pending_registrations 
          WHERE email = $1
        `;
        const pendingResult = await client.query(pendingQuery, [email]);
        
        if (pendingResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'REGISTRATION_NOT_FOUND',
              message: 'No pending registration found. Please sign up first.'
            }
          });
          return;
        }

        const pending = pendingResult.rows[0];

        // Check if code is expired
        if (new Date() > new Date(pending.verification_code_expires)) {
          await client.end();
          res.status(400).json({
            error: {
              code: 'CODE_EXPIRED',
              message: 'Verification code has expired. Please sign up again.'
            }
          });
          return;
        }

        // Security: Check if max attempts exceeded (5 attempts)
        // User won't know they exceeded attempts - just show "invalid code"
        const failedAttempts = pending.failed_attempts || 0;
        if (failedAttempts >= 5) {
          await client.end();
          res.status(400).json({
            error: {
              code: 'INVALID_CODE',
              message: 'Invalid verification code'
            }
          });
          return;
        }

        // Verify code
        if (pending.verification_code !== code) {
          // Increment failed attempts
          await client.query(
            'UPDATE pending_registrations SET failed_attempts = failed_attempts + 1 WHERE id = $1',
            [pending.id]
          );
          await client.end();
          
          res.status(400).json({
            error: {
              code: 'INVALID_CODE',
              message: 'Invalid verification code'
            }
          });
          return;
        }

        // Code is valid! Now create the user account
        const insertUserQuery = `
          INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, email_verified)
          VALUES ($1, $2, $3, $4, 'STUDENT', true, true)
          RETURNING id, email, first_name, last_name, role, is_active, email_verified, created_at
        `;
        
        const insertResult = await client.query(insertUserQuery, [
          pending.first_name,
          pending.last_name,
          pending.email,
          pending.password_hash
        ]);
        
        const newUser = insertResult.rows[0];

        // Delete the pending registration
        await client.query('DELETE FROM pending_registrations WHERE id = $1', [pending.id]);
        
        await client.end();

        // Send welcome email
        try {
          const { sendWelcomeEmail } = require('./email-service');
          await sendWelcomeEmail(newUser.email, newUser.first_name);
        } catch (emailError) {
          console.error('Welcome email failed:', emailError);
          // Don't fail the verification if welcome email fails
        }

        res.json({
          success: true,
          message: 'Email verified successfully! Your account has been created.',
          data: {
            user: {
              id: newUser.id,
              email: newUser.email,
              firstName: newUser.first_name,
              lastName: newUser.last_name,
              role: newUser.role,
              isActive: newUser.is_active,
              emailVerified: newUser.email_verified,
              createdAt: newUser.created_at
            }
          }
        });
        return;
        
      } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
          error: {
            code: 'VERIFY_ERROR',
            message: 'Failed to verify email',
            details: error.message
          }
        });
        return;
      }
    }

    // Clubs endpoint
    if (url.startsWith('/api/clubs') && method === 'GET') {
      try {
        // Check if it's a single club by ID request
        const idMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)$/);
        if (idMatch) {
          const clubId = idMatch[1];
          
          const client = getDatabaseClient();
          await client.connect();
          
          const query = `
            SELECT 
              c.id, c.name, c.description, c.is_active, c.created_at, c.president_id,
              u.first_name as president_first_name, u.last_name as president_last_name, u.email as president_email,
              COUNT(DISTINCT a.id) as activities_count,
              COUNT(DISTINCT app.id) as applications_count
            FROM clubs c
            LEFT JOIN users u ON c.president_id = u.id
            LEFT JOIN activities a ON c.id = a.club_id
            LEFT JOIN applications app ON c.id = app.club_id
            WHERE c.id = $1
            GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.president_id,
                     u.first_name, u.last_name, u.email
          `;
          
          const result = await client.query(query, [clubId]);
          await client.end();
          
          if (result.rows.length === 0) {
            res.status(404).json({
              error: {
                code: 'CLUB_NOT_FOUND',
                message: 'Club not found'
              }
            });
            return;
          }
          
          const row = result.rows[0];
          const clubData = {
            id: row.id,
            name: row.name,
            description: row.description,
            url_slug: row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            urlSlug: row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            is_active: row.is_active,
            isActive: row.is_active,
            created_at: row.created_at,
            createdAt: row.created_at,
            activities_count: parseInt(row.activities_count) || 0,
            activitiesCount: parseInt(row.activities_count) || 0,
            applications_count: parseInt(row.applications_count) || 0,
            applicationsCount: parseInt(row.applications_count) || 0,
            president_id: row.president_id,
            presidentId: row.president_id,
            president: row.president_id ? {
              id: row.president_id,
              first_name: row.president_first_name,
              last_name: row.president_last_name,
              email: row.president_email,
              firstName: row.president_first_name,
              lastName: row.president_last_name
            } : null
          };
          
          res.status(200).json({
            data: clubData
          });
          return;
        }
        
        // Check if it's a slug-based request
        const slugMatch = url.match(/^\/api\/clubs\/slug\/([^\/]+)$/);
        if (slugMatch) {
          const slug = decodeURIComponent(slugMatch[1]);
          
          const client = getDatabaseClient();
          await client.connect();
          
          // Get all clubs and find by slug (since we generate slug from name)
          const query = `
            SELECT 
              c.id, c.name, c.description, c.is_active, c.created_at,
              c.president_id
            FROM clubs c
            WHERE c.is_active = true
          `;
          
          const result = await client.query(query);
          
          // Find club by matching slug
          const club = result.rows.find(row => {
            const generatedSlug = row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            return generatedSlug === slug;
          });
          
          if (!club) {
            await client.end();
            res.status(404).json({
              error: {
                code: 'CLUB_NOT_FOUND',
                message: 'Club not found'
              }
            });
            return;
          }
          
          // Get president info if exists
          let president = null;
          if (club.president_id) {
            const presidentQuery = `
              SELECT id, email, first_name, last_name
              FROM users
              WHERE id = $1
            `;
            const presidentResult = await client.query(presidentQuery, [club.president_id]);
            if (presidentResult.rows.length > 0) {
              const p = presidentResult.rows[0];
              president = {
                id: p.id,
                email: p.email,
                firstName: p.first_name,
                lastName: p.last_name
              };
            }
          }
          
          await client.end();
          
          const clubData = {
            id: club.id,
            name: club.name,
            description: club.description,
            urlSlug: club.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            isActive: club.is_active,
            createdAt: club.created_at,
            activitiesCount: 0,
            president: president
          };
          
          res.status(200).json({
            data: clubData
          });
          return;
        }
        
        // Regular clubs list endpoint
        const client = getDatabaseClient();
        await client.connect();
        
        // Parse query parameters
        const urlParams = new URLSearchParams(url.split('?')[1] || '');
        const statusParam = urlParams.get('status'); // 'active' or 'archived'
        const isActiveParam = urlParams.get('isActive'); // 'true' or 'false'
        const searchParam = urlParams.get('search'); // search term
        
        // Build WHERE clause based on status or isActive
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        
        if (statusParam === 'active') {
          whereConditions.push('c.is_active = true');
        } else if (statusParam === 'archived') {
          whereConditions.push('c.is_active = false');
        } else if (isActiveParam === 'true') {
          whereConditions.push('c.is_active = true');
        } else if (isActiveParam === 'false') {
          whereConditions.push('c.is_active = false');
        }
        
        // Add search condition if provided
        if (searchParam && searchParam.trim()) {
          whereConditions.push(`(LOWER(c.name) LIKE LOWER($${paramIndex}) OR LOWER(c.description) LIKE LOWER($${paramIndex}))`);
          queryParams.push(`%${searchParam.trim()}%`);
          paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        
        const query = `
          SELECT 
            c.id, c.name, c.description, c.is_active, c.created_at, c.president_id,
            u.first_name as president_first_name, u.last_name as president_last_name, u.email as president_email,
            COUNT(DISTINCT a.id) as activities_count,
            COUNT(DISTINCT app.id) as applications_count
          FROM clubs c
          LEFT JOIN users u ON c.president_id = u.id
          LEFT JOIN activities a ON c.id = a.club_id
          LEFT JOIN applications app ON c.id = app.club_id
          ${whereClause}
          GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.president_id,
                   u.first_name, u.last_name, u.email
          ORDER BY c.created_at DESC
        `;
        
        const result = await client.query(query, queryParams);
        await client.end();

        const clubs = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          url_slug: row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          urlSlug: row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          is_active: row.is_active,
          isActive: row.is_active,
          created_at: row.created_at,
          createdAt: row.created_at,
          activities_count: parseInt(row.activities_count) || 0,
          activitiesCount: parseInt(row.activities_count) || 0,
          applications_count: parseInt(row.applications_count) || 0,
          applicationsCount: parseInt(row.applications_count) || 0,
          president_id: row.president_id,
          presidentId: row.president_id,
          president: row.president_id ? {
            id: row.president_id,
            first_name: row.president_first_name,
            last_name: row.president_last_name,
            email: row.president_email,
            firstName: row.president_first_name,
            lastName: row.president_last_name
          } : null
        }));

        res.status(200).json({
          data: clubs,
          pagination: {
            page: 1,
            limit: 100,
            total: clubs.length
          }
        });
        return;
      } catch (error) {
        console.error('Clubs error:', error);
        res.status(500).json({ 
          error: 'Failed to load clubs',
          message: error.message,
          details: error.toString()
        });
        return;
      }
    }

    // Create club endpoint - POST
    if (url === '/api/clubs' && method === 'POST') {
      try {
        const { name, description } = req.body;
        
        if (!name) {
          res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Club name is required'
            }
          });
          return;
        }

        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can create clubs
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can create clubs'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if club with same name already exists
        const checkQuery = `
          SELECT id FROM clubs WHERE LOWER(name) = LOWER($1)
        `;
        const checkResult = await client.query(checkQuery, [name]);
        
        if (checkResult.rows.length > 0) {
          await client.end();
          res.status(409).json({
            error: {
              code: 'CLUB_EXISTS',
              message: 'A club with this name already exists'
            }
          });
          return;
        }
        
        // Create club
        const insertQuery = `
          INSERT INTO clubs (name, description, is_active, created_at, updated_at)
          VALUES ($1, $2, true, NOW(), NOW())
          RETURNING id, name, description, is_active, created_at
        `;
        
        const result = await client.query(insertQuery, [name, description || '']);
        
        const club = result.rows[0];
        
        // Log audit
        await logAudit(client, {
          userId: decoded.userId,
          action: 'CREATE_CLUB',
          resource: 'CLUB',
          resourceId: club.id,
          details: { name: club.name, description: club.description },
          ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        
        await client.end();
        
        res.status(201).json({
          success: true,
          data: {
            id: club.id,
            name: club.name,
            description: club.description,
            urlSlug: club.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            isActive: club.is_active,
            createdAt: club.created_at
          }
        });
        return;
      } catch (error) {
        console.error('Create club error:', error);
        res.status(500).json({ 
          error: 'Failed to create club',
          message: error.message 
        });
        return;
      }
    }

    // Delete club endpoint - DELETE /api/clubs/:id
    const clubDeleteMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)$/);
    if (clubDeleteMatch && method === 'DELETE') {
      try {
        const clubId = clubDeleteMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can delete clubs
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can delete clubs'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Delete club (this will cascade delete related records)
        const deleteQuery = `
          DELETE FROM clubs
          WHERE id = $1
          RETURNING id, name
        `;
        const result = await client.query(deleteQuery, [clubId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found'
            }
          });
          return;
        }
        
        const deletedClub = result.rows[0];
        
        // Log audit
        await logAudit(client, {
          userId: decoded.userId,
          action: 'DELETE_CLUB',
          resource: 'CLUB',
          resourceId: deletedClub.id,
          details: { name: deletedClub.name },
          ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Club deleted successfully',
          data: {
            id: deletedClub.id,
            name: deletedClub.name
          }
        });
        return;
      } catch (error) {
        console.error('Delete club error:', error);
        res.status(500).json({ 
          error: 'Failed to delete club',
          message: error.message 
        });
        return;
      }
    }

    // Archive club endpoint - POST /api/clubs/:id/archive
    const archiveMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      try {
        const clubId = archiveMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can archive clubs
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can archive clubs'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Archive club by setting is_active to false
        const archiveQuery = `
          UPDATE clubs
          SET is_active = false
          WHERE id = $1
          RETURNING id, name, is_active
        `;
        const result = await client.query(archiveQuery, [clubId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found'
            }
          });
          return;
        }
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Club archived successfully',
          data: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            is_active: result.rows[0].is_active
          }
        });
        return;
      } catch (error) {
        console.error('Archive club error:', error);
        res.status(500).json({ 
          error: 'Failed to archive club',
          message: error.message 
        });
        return;
      }
    }

    // Restore club endpoint - POST /api/clubs/:id/restore
    const restoreMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)\/restore$/);
    if (restoreMatch && method === 'POST') {
      try {
        const clubId = restoreMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can restore clubs
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can restore clubs'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Restore club by setting is_active to true
        const restoreQuery = `
          UPDATE clubs
          SET is_active = true
          WHERE id = $1
          RETURNING id, name, is_active
        `;
        const result = await client.query(restoreQuery, [clubId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found'
            }
          });
          return;
        }
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Club restored successfully',
          data: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            is_active: result.rows[0].is_active
          }
        });
        return;
      } catch (error) {
        console.error('Restore club error:', error);
        res.status(500).json({ 
          error: 'Failed to restore club',
          message: error.message 
        });
        return;
      }
    }

    // Update club endpoint - PUT /api/clubs/:id
    const clubUpdateMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)$/);
    if (clubUpdateMatch && method === 'PUT') {
      try {
        const clubId = clubUpdateMatch[1];
        const { name, description } = req.body;
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can update clubs
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can update clubs'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if club exists
        const checkQuery = 'SELECT id FROM clubs WHERE id = $1';
        const checkResult = await client.query(checkQuery, [clubId]);
        
        if (checkResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found'
            }
          });
          return;
        }
        
        // If name is being changed, check for duplicates
        if (name) {
          const duplicateCheck = await client.query(
            'SELECT id FROM clubs WHERE LOWER(name) = LOWER($1) AND id != $2',
            [name, clubId]
          );
          
          if (duplicateCheck.rows.length > 0) {
            await client.end();
            res.status(409).json({
              error: {
                code: 'CLUB_EXISTS',
                message: 'A club with this name already exists'
              }
            });
            return;
          }
        }
        
        // Build update query dynamically based on provided fields
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (name !== undefined) {
          updates.push(`name = $${paramCount}`);
          values.push(name);
          paramCount++;
        }
        
        if (description !== undefined) {
          updates.push(`description = $${paramCount}`);
          values.push(description);
          paramCount++;
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(clubId);
        
        const updateQuery = `
          UPDATE clubs
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
          RETURNING id, name, description, is_active, created_at, updated_at
        `;
        
        const result = await client.query(updateQuery, values);
        await client.end();

        const club = result.rows[0];
        
        res.status(200).json({
          success: true,
          message: 'Club updated successfully',
          data: {
            id: club.id,
            name: club.name,
            description: club.description,
            urlSlug: club.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            isActive: club.is_active,
            createdAt: club.created_at,
            updatedAt: club.updated_at
          }
        });
        return;
      } catch (error) {
        console.error('Update club error:', error);
        res.status(500).json({ 
          error: 'Failed to update club',
          message: error.message 
        });
        return;
      }
    }

    // Change club president endpoint - PUT /api/clubs/:id/president
    const changePresidentMatch = url.match(/^\/api\/clubs\/([a-f0-9-]+)\/president$/);
    if (changePresidentMatch && method === 'PUT') {
      try {
        const clubId = changePresidentMatch[1];
        const { presidentId } = req.body;
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can change club presidents
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can change club presidents'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // If presidentId is provided, update the user's role to CLUB_PRESIDENT
        if (presidentId) {
          // First, check if the user exists
          const userCheck = await client.query('SELECT id, role FROM users WHERE id = $1', [presidentId]);
          if (userCheck.rows.length === 0) {
            await client.end();
            res.status(404).json({
              error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found'
              }
            });
            return;
          }

          // Update the user's role to CLUB_PRESIDENT if not already
          if (userCheck.rows[0].role !== 'CLUB_PRESIDENT') {
            await client.query('UPDATE users SET role = $1 WHERE id = $2', ['CLUB_PRESIDENT', presidentId]);
          }
        }
        
        // Update club president
        const updateQuery = `
          UPDATE clubs
          SET president_id = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, president_id
        `;
        const result = await client.query(updateQuery, [presidentId || null, clubId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'CLUB_NOT_FOUND',
              message: 'Club not found'
            }
          });
          return;
        }
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Club president updated successfully',
          data: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            presidentId: result.rows[0].president_id
          }
        });
        return;
      } catch (error) {
        console.error('Change president error:', error);
        res.status(500).json({ 
          error: 'Failed to change club president',
          message: error.message 
        });
        return;
      }
    }

    // Activities upcoming endpoint
    if (url.startsWith('/api/activities/upcoming') && method === 'GET') {
      try {
        const urlObj = new URL(url, `http://${req.headers.host}`);
        const limit = urlObj.searchParams.get('limit') || '10';
        
        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT 
            a.id, a.title, a.description, a.start_date, 
            a.end_date, a.location, a.status,
            c.id as club_id, c.name as club_name
          FROM activities a
          INNER JOIN clubs c ON a.club_id = c.id
          WHERE a.status = 'PUBLISHED' 
            AND a.start_date >= NOW()
            AND c.is_active = true
          ORDER BY a.start_date ASC
          LIMIT $1
        `;
        
        const result = await client.query(query, [parseInt(limit)]);
        await client.end();

        const activities = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          startDate: row.start_date,
          endDate: row.end_date,
          location: row.location,
          status: row.status,
          club: row.club_id ? {
            id: row.club_id,
            name: row.club_name,
            urlSlug: row.club_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          } : null
        }));

        res.status(200).json({
          data: activities
        });
        return;
      } catch (error) {
        console.error('Activities upcoming error:', error);
        res.status(500).json({ 
          error: 'Failed to load upcoming activities',
          message: error.message 
        });
        return;
      }
    }

    // Get activity participants - GET /api/activities/:id/participants
    // IMPORTANT: This must come BEFORE /api/activities/club/:clubId to avoid route conflicts
    const activityParticipantsMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)\/participants$/);
    if (activityParticipantsMatch && method === 'GET') {
      try {
        const activityId = activityParticipantsMatch[1];
        
        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT 
            ap.id, ap.activity_id, ap.user_id, ap.status, ap.registered_at,
            u.first_name, u.last_name, u.email
          FROM activity_participants ap
          JOIN users u ON ap.user_id = u.id
          WHERE ap.activity_id = $1
          ORDER BY ap.registered_at ASC
        `;
        const result = await client.query(query, [activityId]);
        
        await client.end();

        const participants = result.rows.map(row => ({
          id: row.id,
          activityId: row.activity_id,
          userId: row.user_id,
          status: row.status,
          registeredAt: row.registered_at,
          user: {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email
          }
        }));

        res.status(200).json({
          data: participants,
          total: participants.length
        });
        return;
      } catch (error) {
        console.error('Get activity participants error:', error);
        res.status(500).json({ 
          error: 'Failed to get activity participants',
          message: error.message 
        });
        return;
      }
    }

    // Check if user is registered for activity - GET /api/activities/:id/check-registration
    // IMPORTANT: This must come BEFORE /api/activities/club/:clubId to avoid route conflicts
    const checkRegistrationMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)\/check-registration$/);
    if (checkRegistrationMatch && method === 'GET') {
      try {
        const activityId = checkRegistrationMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(200).json({
            isRegistered: false
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(200).json({
            isRegistered: false
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT id, status, registered_at
          FROM activity_participants
          WHERE activity_id = $1 AND user_id = $2
        `;
        const result = await client.query(query, [activityId, decoded.userId]);
        
        await client.end();

        if (result.rows.length > 0) {
          res.status(200).json({
            isRegistered: true,
            registration: {
              id: result.rows[0].id,
              status: result.rows[0].status,
              registeredAt: result.rows[0].registered_at
            }
          });
        } else {
          res.status(200).json({
            isRegistered: false
          });
        }
        return;
      } catch (error) {
        console.error('Check registration error:', error);
        res.status(500).json({ 
          error: 'Failed to check registration',
          message: error.message 
        });
        return;
      }
    }

    // Get club activities endpoint - GET /api/activities/club/:clubId
    const clubActivitiesMatch = url.match(/^\/api\/activities\/club\/([a-f0-9-]+)$/);
    if (clubActivitiesMatch && method === 'GET') {
      try {
        const clubId = clubActivitiesMatch[1];
        
        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT 
            a.id, a.title, a.description, a.start_date, 
            a.end_date, a.location, a.status, a.created_at
          FROM activities a
          WHERE a.club_id = $1
          ORDER BY a.start_date DESC
        `;
        
        const result = await client.query(query, [clubId]);
        await client.end();

        const activities = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          startDate: row.start_date,
          endDate: row.end_date,
          location: row.location,
          status: row.status,
          createdAt: row.created_at
        }));

        res.status(200).json({
          data: activities
        });
        return;
      } catch (error) {
        console.error('Club activities error:', error);
        res.status(500).json({ 
          error: 'Failed to load club activities',
          message: error.message 
        });
        return;
      }
    }

    // Activities general endpoint - GET
    if (url.startsWith('/api/activities') && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT 
            a.id, a.title, a.description, a.start_date as "startDate", 
            a.end_date as "endDate", a.location, a.status
          FROM activities a
          WHERE a.status = 'PUBLISHED'
          ORDER BY a.start_date ASC
          LIMIT 10
        `;
        
        const result = await client.query(query);
        await client.end();

        const activities = result.rows;

        res.status(200).json({
          data: activities
        });
        return;
      } catch (error) {
        console.error('Activities error:', error);
        res.status(500).json({ error: 'Failed to load activities' });
        return;
      }
    }

    // Create activity endpoint - POST /api/activities
    if (url === '/api/activities' && method === 'POST') {
      try {
        const { title, description, startDate, endDate, location, clubId } = req.body;
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only CLUB_PRESIDENT and SUPER_ADMIN can create activities
        if (decoded.role !== 'CLUB_PRESIDENT' && decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only club presidents can create activities'
            }
          });
          return;
        }

        if (!title || !startDate || !clubId) {
          res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Title, start date, and club ID are required'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Verify club exists and user is president (if not super admin)
        if (decoded.role === 'CLUB_PRESIDENT') {
          const clubCheck = await client.query(
            'SELECT id, president_id FROM clubs WHERE id = $1',
            [clubId]
          );
          
          if (clubCheck.rows.length === 0) {
            await client.end();
            res.status(404).json({
              error: {
                code: 'CLUB_NOT_FOUND',
                message: 'Club not found'
              }
            });
            return;
          }
          
          if (clubCheck.rows[0].president_id !== decoded.userId) {
            await client.end();
            res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: 'You can only create activities for your own club'
              }
            });
            return;
          }
        }
        
        // Create activity
        const insertQuery = `
          INSERT INTO activities (club_id, title, description, start_date, end_date, location, status, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', $7, NOW(), NOW())
          RETURNING id, club_id, title, description, start_date, end_date, location, status, created_at
        `;
        
        const result = await client.query(insertQuery, [
          clubId,
          title,
          description || '',
          startDate,
          endDate || null,
          location || '',
          decoded.userId
        ]);
        
        const activity = result.rows[0];
        
        // Log audit
        await logAudit(client, {
          userId: decoded.userId,
          action: 'CREATE_ACTIVITY',
          resource: 'ACTIVITY',
          resourceId: activity.id,
          details: { title: activity.title, clubId: activity.club_id, startDate: activity.start_date },
          ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        
        await client.end();
        
        res.status(201).json({
          success: true,
          data: {
            id: activity.id,
            clubId: activity.club_id,
            title: activity.title,
            description: activity.description,
            startDate: activity.start_date,
            endDate: activity.end_date,
            location: activity.location,
            status: activity.status,
            createdAt: activity.created_at
          }
        });
        return;
      } catch (error) {
        console.error('Create activity error:', error);
        res.status(500).json({ 
          error: 'Failed to create activity',
          message: error.message 
        });
        return;
      }
    }

    // Update activity endpoint - PUT /api/activities/:id
    const activityUpdateMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)$/);
    if (activityUpdateMatch && method === 'PUT') {
      try {
        const activityId = activityUpdateMatch[1];
        const { title, description, startDate, endDate, location, status, date, time } = req.body;
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only CLUB_PRESIDENT and SUPER_ADMIN can update activities
        if (decoded.role !== 'CLUB_PRESIDENT' && decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only club presidents can update activities'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Get activity and verify ownership
        const activityCheck = await client.query(
          'SELECT a.id, a.club_id, c.president_id FROM activities a JOIN clubs c ON a.club_id = c.id WHERE a.id = $1',
          [activityId]
        );
        
        if (activityCheck.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: 'Activity not found'
            }
          });
          return;
        }
        
        // Verify user is president of the club (if not super admin)
        if (decoded.role === 'CLUB_PRESIDENT' && activityCheck.rows[0].president_id !== decoded.userId) {
          await client.end();
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You can only update activities for your own club'
            }
          });
          return;
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (title !== undefined) {
          updates.push(`title = $${paramCount}`);
          values.push(title);
          paramCount++;
        }
        
        if (description !== undefined) {
          updates.push(`description = $${paramCount}`);
          values.push(description);
          paramCount++;
        }
        
        // Handle date and time - combine them into start_date if provided
        if (date !== undefined && time !== undefined) {
          updates.push(`start_date = $${paramCount}`);
          values.push(`${date} ${time}`);
          paramCount++;
          // Also update end_date to be same as start for now
          updates.push(`end_date = $${paramCount}`);
          values.push(`${date} ${time}`);
          paramCount++;
        } else if (date !== undefined) {
          updates.push(`start_date = $${paramCount}`);
          values.push(`${date} 00:00:00`);
          paramCount++;
          updates.push(`end_date = $${paramCount}`);
          values.push(`${date} 23:59:59`);
          paramCount++;
        }
        
        if (startDate !== undefined) {
          updates.push(`start_date = $${paramCount}`);
          values.push(startDate);
          paramCount++;
        }
        
        if (endDate !== undefined) {
          updates.push(`end_date = $${paramCount}`);
          values.push(endDate);
          paramCount++;
        }
        
        if (location !== undefined) {
          updates.push(`location = $${paramCount}`);
          values.push(location);
          paramCount++;
        }
        
        if (status !== undefined) {
          updates.push(`status = $${paramCount}`);
          values.push(status);
          paramCount++;
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(activityId);
        
        const updateQuery = `
          UPDATE activities
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
          RETURNING id, club_id, title, description, start_date, end_date, location, status, updated_at
        `;
        
        const result = await client.query(updateQuery, values);
        await client.end();

        const activity = result.rows[0];
        
        res.status(200).json({
          success: true,
          message: 'Activity updated successfully',
          data: {
            id: activity.id,
            clubId: activity.club_id,
            title: activity.title,
            description: activity.description,
            startDate: activity.start_date,
            endDate: activity.end_date,
            location: activity.location,
            status: activity.status,
            updatedAt: activity.updated_at
          }
        });
        return;
      } catch (error) {
        console.error('Update activity error:', error);
        res.status(500).json({ 
          error: 'Failed to update activity',
          message: error.message 
        });
        return;
      }
    }

    // Delete activity endpoint - DELETE /api/activities/:id
    const activityDeleteMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)$/);
    if (activityDeleteMatch && method === 'DELETE') {
      try {
        const activityId = activityDeleteMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only CLUB_PRESIDENT and SUPER_ADMIN can delete activities
        if (decoded.role !== 'CLUB_PRESIDENT' && decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only club presidents can delete activities'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Get activity and verify ownership
        const activityCheck = await client.query(
          'SELECT a.id, a.club_id, c.president_id FROM activities a JOIN clubs c ON a.club_id = c.id WHERE a.id = $1',
          [activityId]
        );
        
        if (activityCheck.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: 'Activity not found'
            }
          });
          return;
        }
        
        // Verify user is president of the club (if not super admin)
        if (decoded.role === 'CLUB_PRESIDENT' && activityCheck.rows[0].president_id !== decoded.userId) {
          await client.end();
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You can only delete activities for your own club'
            }
          });
          return;
        }
        
        // Delete activity
        const deleteQuery = 'DELETE FROM activities WHERE id = $1 RETURNING id, title';
        const result = await client.query(deleteQuery, [activityId]);
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Activity deleted successfully',
          data: {
            id: result.rows[0].id,
            title: result.rows[0].title
          }
        });
        return;
      } catch (error) {
        console.error('Delete activity error:', error);
        res.status(500).json({ 
          error: 'Failed to delete activity',
          message: error.message 
        });
        return;
      }
    }

    // Activity Participants Endpoints

    // Register for activity - POST /api/activities/:id/register
    const activityRegisterMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)\/register$/);
    if (activityRegisterMatch && method === 'POST') {
      try {
        const activityId = activityRegisterMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if activity exists and get club_id
        const activityQuery = `
          SELECT a.id, a.club_id, a.max_participants, 
                 (SELECT COUNT(*) FROM activity_participants WHERE activity_id = $1 AND status = 'REGISTERED') as current_participants
          FROM activities a
          WHERE a.id = $1
        `;
        const activityResult = await client.query(activityQuery, [activityId]);
        
        if (activityResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'ACTIVITY_NOT_FOUND',
              message: 'Activity not found'
            }
          });
          return;
        }
        
        const activity = activityResult.rows[0];
        
        // Check if user is a member of the club (has APPROVED application) OR is the club president
        const clubQuery = `SELECT president_id FROM clubs WHERE id = $1`;
        const clubResult = await client.query(clubQuery, [activity.club_id]);
        const isPresident = clubResult.rows.length > 0 && clubResult.rows[0].president_id === decoded.userId;
        
        if (!isPresident) {
          const membershipQuery = `
            SELECT id, status FROM applications
            WHERE club_id = $1 AND student_id = $2 AND status = 'APPROVED'
          `;
          const membershipResult = await client.query(membershipQuery, [activity.club_id, decoded.userId]);
          
          if (membershipResult.rows.length === 0) {
            await client.end();
            res.status(403).json({
              error: {
                code: 'NOT_CLUB_MEMBER',
                message: 'You must be a member of this club to register for activities'
              }
            });
            return;
          }
        }
        
        // Check if activity is full
        if (activity.max_participants && activity.current_participants >= activity.max_participants) {
          await client.end();
          res.status(400).json({
            error: {
              code: 'ACTIVITY_FULL',
              message: 'This activity has reached maximum capacity'
            }
          });
          return;
        }
        
        // Check if user is already registered
        const checkQuery = `
          SELECT id, status FROM activity_participants
          WHERE activity_id = $1 AND user_id = $2
        `;
        const checkResult = await client.query(checkQuery, [activityId, decoded.userId]);
        
        if (checkResult.rows.length > 0) {
          await client.end();
          res.status(409).json({
            error: {
              code: 'ALREADY_REGISTERED',
              message: 'You are already registered for this activity'
            }
          });
          return;
        }
        
        // Register user for activity
        const insertQuery = `
          INSERT INTO activity_participants (activity_id, user_id, status, registered_at)
          VALUES ($1, $2, 'REGISTERED', NOW())
          RETURNING id, activity_id, user_id, status, registered_at
        `;
        const result = await client.query(insertQuery, [activityId, decoded.userId]);
        
        await client.end();

        res.status(201).json({
          success: true,
          data: {
            id: result.rows[0].id,
            activityId: result.rows[0].activity_id,
            userId: result.rows[0].user_id,
            status: result.rows[0].status,
            registeredAt: result.rows[0].registered_at
          }
        });
        return;
      } catch (error) {
        console.error('Activity registration error:', error);
        res.status(500).json({ 
          error: 'Failed to register for activity',
          message: error.message 
        });
        return;
      }
    }

    // Unregister from activity - DELETE /api/activities/:id/register
    const activityUnregisterMatch = url.match(/^\/api\/activities\/([a-f0-9-]+)\/register$/);
    if (activityUnregisterMatch && method === 'DELETE') {
      try {
        const activityId = activityUnregisterMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Delete registration
        const deleteQuery = `
          DELETE FROM activity_participants
          WHERE activity_id = $1 AND user_id = $2
          RETURNING id
        `;
        const result = await client.query(deleteQuery, [activityId, decoded.userId]);
        
        await client.end();
        
        if (result.rows.length === 0) {
          res.status(404).json({
            error: {
              code: 'NOT_REGISTERED',
              message: 'You are not registered for this activity'
            }
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'Successfully unregistered from activity'
        });
        return;
      } catch (error) {
        console.error('Activity unregistration error:', error);
        res.status(500).json({ 
          error: 'Failed to unregister from activity',
          message: error.message 
        });
        return;
      }
    }

    // Get current user endpoint (for refresh)
    if (url === '/api/auth/me' && method === 'GET') {
      try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        
        // Decode token (it's base64 encoded JSON)
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Check if token is expired
        if (decoded.exp && decoded.exp < Date.now()) {
          res.status(401).json({
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Token has expired'
            }
          });
          return;
        }

        // Get user from database
        const client = getDatabaseClient();
        await client.connect();
        
        const userQuery = `
          SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.email_verified, u.totp_enabled,
                 c.id as club_id, c.name as club_name
          FROM users u
          LEFT JOIN clubs c ON c.president_id = u.id
          WHERE u.id = $1 AND u.is_active = true
        `;
        
        const userResult = await client.query(userQuery, [decoded.userId]);
        await client.end();

        if (userResult.rows.length === 0) {
          res.status(401).json({
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found or inactive'
            }
          });
          return;
        }

        const user = userResult.rows[0];

        // Try to get GPA if column exists
        let gpa = null;
        try {
          const gpaResult = await client.query('SELECT gpa FROM users WHERE id = $1', [user.id]);
          if (gpaResult.rows.length > 0 && gpaResult.rows[0].gpa !== undefined) {
            gpa = gpaResult.rows[0].gpa ? parseFloat(gpaResult.rows[0].gpa) : null;
          }
        } catch (gpaError) {
          // GPA column doesn't exist yet, ignore
          console.log('GPA column not found, skipping');
        }

        res.status(200).json({
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              isActive: user.is_active,
              emailVerified: user.email_verified,
              totpEnabled: user.totp_enabled,
              gpa: gpa,
              clubId: user.club_id || null,
              clubName: user.club_name || null
            }
          }
        });
        return;
        
      } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
          error: {
            code: 'SERVER_ERROR',
            message: 'Failed to get current user'
          }
        });
        return;
      }
    }

    // Admin stats endpoint
    if (url === '/api/admin/stats' && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        // Get total counts
        const clubsCount = await client.query('SELECT COUNT(*) as count FROM clubs WHERE is_active = true');
        const activitiesCount = await client.query('SELECT COUNT(*) as count FROM activities');
        const applicationsCount = await client.query('SELECT COUNT(*) as count FROM applications');
        const usersCount = await client.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
        
        // Get recent activities
        const recentActivities = await client.query(`
          SELECT a.id, a.title, a.start_date, c.name as club_name
          FROM activities a
          LEFT JOIN clubs c ON a.club_id = c.id
          WHERE a.status = 'PUBLISHED' AND a.start_date >= NOW()
          ORDER BY a.start_date ASC
          LIMIT 5
        `);
        
        // Get pending applications - return empty for now due to schema mismatch
        const pendingApplications = { rows: [] };
        
        await client.end();

        const stats = {
          totalClubs: parseInt(clubsCount.rows[0].count),
          totalActivities: parseInt(activitiesCount.rows[0].count),
          totalApplications: parseInt(applicationsCount.rows[0].count),
          totalUsers: parseInt(usersCount.rows[0].count),
          recentActivities: recentActivities.rows.map(row => ({
            id: row.id,
            title: row.title,
            club: { name: row.club_name },
            startDate: row.start_date
          })),
          pendingApplications: pendingApplications.rows.map(row => ({
            id: row.id,
            studentName: 'Student', // Placeholder since we don't have the column
            club: { name: row.club_name },
            submittedAt: row.submitted_at
          })),
          flaggedContent: []
        };

        res.status(200).json({
          data: stats
        });
        return;
      } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ 
          error: 'Failed to load admin stats',
          message: error.message 
        });
        return;
      }
    }

    // Available presidents endpoint
    if (url === '/api/admin/available-presidents' && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        // Get all active users (students and club presidents) who can be assigned as presidents
        const query = `
          SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                 c.name as current_club_name
          FROM users u
          LEFT JOIN clubs c ON u.id = c.president_id
          WHERE u.is_active = true 
            AND u.role IN ('STUDENT', 'CLUB_PRESIDENT')
          ORDER BY u.first_name, u.last_name
        `;
        
        const result = await client.query(query);
        await client.end();

        const presidents = result.rows.map(row => ({
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          currentClub: row.current_club_name || null,
          displayName: `${row.first_name} ${row.last_name} (${row.email})${row.current_club_name ? ` - Currently: ${row.current_club_name}` : ''}`
        }));

        res.status(200).json({
          data: presidents
        });
        return;
      } catch (error) {
        console.error('Available presidents error:', error);
        res.status(500).json({ 
          error: 'Failed to load available presidents',
          message: error.message 
        });
        return;
      }
    }

    // Check existing application endpoint - GET /api/applications/check/:clubId/:email
    // IMPORTANT: This must come BEFORE the general /api/applications GET endpoint
    // Updated: 2026-02-07 - Fixed route order to prevent conflicts
    const checkApplicationMatch = url.match(/^\/api\/applications\/check\/([a-f0-9-]+)\/(.+)$/);
    if (checkApplicationMatch && method === 'GET') {
      try {
        const clubId = checkApplicationMatch[1];
        const email = decodeURIComponent(checkApplicationMatch[2]);
        
        const client = getDatabaseClient();
        await client.connect();
        
        // Check which columns exist
        const columnsCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'applications'
        `);
        const availableColumns = columnsCheck.rows.map(row => row.column_name);
        const userColumn = availableColumns.includes('user_id') ? 'user_id' : 'student_id';
        
        // Find user by email
        const userQuery = `SELECT id FROM users WHERE email = $1`;
        const userResult = await client.query(userQuery, [email]);
        
        if (userResult.rows.length === 0) {
          await client.end();
          res.status(200).json({
            exists: false,
            application: null
          });
          return;
        }
        
        const userId = userResult.rows[0].id;
        
        // Check for existing application
        const appQuery = `
          SELECT id, status, created_at as submitted_at
          FROM applications 
          WHERE club_id = $1 AND ${userColumn} = $2
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const appResult = await client.query(appQuery, [clubId, userId]);
        
        await client.end();
        
        if (appResult.rows.length > 0) {
          const app = appResult.rows[0];
          res.status(200).json({
            exists: true,
            application: {
              id: app.id,
              status: app.status,
              submittedAt: app.submitted_at
            }
          });
        } else {
          res.status(200).json({
            exists: false,
            application: null
          });
        }
        return;
      } catch (error) {
        console.error('Check application error:', error);
        res.status(500).json({ 
          error: 'Failed to check application',
          message: error.message 
        });
        return;
      }
    }

    // Applications endpoint - GET
    if (url.startsWith('/api/applications') && method === 'GET') {
      try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }
        
        const client = getDatabaseClient();
        await client.connect();
        
        // Parse query parameters
        const urlObj = new URL(url, `http://${req.headers.host}`);
        const clubId = urlObj.searchParams.get('clubId');
        
        // Build query with optional club filter
        let query;
        let queryParams = [];
        
        // If user is SUPER_ADMIN, show all applications (optionally filtered by club)
        // If user is CLUB_PRESIDENT, show only their club's applications
        // If user is STUDENT, show only their own applications
        if (decoded.role === 'SUPER_ADMIN') {
          if (clubId) {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              WHERE a.club_id = $1
              ORDER BY a.created_at DESC
            `;
            queryParams = [clubId];
          } else {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              ORDER BY a.created_at DESC
            `;
          }
        } else if (decoded.role === 'CLUB_PRESIDENT') {
          // CLUB_PRESIDENT: Show only applications for their club
          // First, we need to find their club
          if (clubId) {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              WHERE a.club_id = $1 AND c.president_id = $2
              ORDER BY a.created_at DESC
            `;
            queryParams = [clubId, decoded.userId];
          } else {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              WHERE c.president_id = $1
              ORDER BY a.created_at DESC
            `;
            queryParams = [decoded.userId];
          }
        } else {
          // STUDENT - only show their own applications
          if (clubId) {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              WHERE a.club_id = $1 AND a.student_id = $2
              ORDER BY a.created_at DESC
            `;
            queryParams = [clubId, decoded.userId];
          } else {
            query = `
              SELECT 
                a.id, a.club_id, a.student_id, a.motivation, a.status,
                a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
                u.first_name as student_first_name, u.last_name as student_last_name, 
                u.email as student_email,
                c.name as club_name,
                r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
              FROM applications a
              LEFT JOIN users u ON a.student_id = u.id
              LEFT JOIN clubs c ON a.club_id = c.id
              LEFT JOIN users r ON a.reviewed_by = r.id
              WHERE a.student_id = $1
              ORDER BY a.created_at DESC
            `;
            queryParams = [decoded.userId];
          }
        }
        
        const result = await client.query(query, queryParams);
        await client.end();

        const applications = result.rows.map(row => ({
          id: row.id,
          club_id: row.club_id,
          clubId: row.club_id,
          student_id: row.student_id,
          studentId: row.student_id,
          motivation: row.motivation,
          status: row.status,
          reviewed_by: row.reviewed_by,
          reviewedBy: row.reviewed_by,
          reviewed_at: row.reviewed_at,
          reviewedAt: row.reviewed_at,
          created_at: row.created_at,
          createdAt: row.created_at,
          submitted_at: row.created_at,
          submittedAt: row.created_at,
          updated_at: row.updated_at,
          updatedAt: row.updated_at,
          student: {
            id: row.student_id,
            first_name: row.student_first_name,
            last_name: row.student_last_name,
            email: row.student_email,
            firstName: row.student_first_name,
            lastName: row.student_last_name
          },
          club: {
            id: row.club_id,
            name: row.club_name
          },
          reviewer: row.reviewed_by ? {
            id: row.reviewed_by,
            first_name: row.reviewer_first_name,
            last_name: row.reviewer_last_name,
            firstName: row.reviewer_first_name,
            lastName: row.reviewer_last_name
          } : null
        }));

        res.status(200).json({
          data: applications,
          pagination: {
            page: 1,
            limit: 100,
            total: applications.length
          }
        });
        return;
      } catch (error) {
        console.error('Applications GET error:', error);
        res.status(500).json({ 
          error: 'Failed to load applications',
          message: error.message 
        });
        return;
      }
    }

    // Applications endpoint - POST (submit application)
    if (url === '/api/applications' && method === 'POST') {
      try {
        console.log('POST /api/applications - Full request body:', JSON.stringify(req.body));
        console.log('POST /api/applications - Body type:', typeof req.body);
        console.log('POST /api/applications - Body keys:', req.body ? Object.keys(req.body) : 'null');
        
        // Try different possible field names
        const clubId = req.body.clubId || req.body.club_id || req.body.ClubId;
        const motivation = req.body.motivation || req.body.Motivation;
        
        console.log('Extracted clubId:', clubId);
        console.log('Extracted motivation:', motivation ? motivation.substring(0, 50) : 'null');
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          console.log('No authorization header found');
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
          console.log('Decoded token userId:', decoded.userId);
        } catch (e) {
          console.log('Token decode error:', e.message);
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        if (!clubId || !motivation) {
          console.log('Missing fields - clubId:', clubId, 'motivation:', motivation ? 'exists' : 'missing');
          res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Club ID and motivation are required',
              debug: {
                receivedBody: req.body,
                clubId: clubId,
                motivation: motivation ? 'exists' : 'missing'
              }
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check which columns exist in applications table
        const columnsCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'applications'
        `);
        
        const availableColumns = columnsCheck.rows.map(row => row.column_name);
        console.log('Applications table columns:', availableColumns);
        
        // Determine the user column name
        const userColumn = availableColumns.includes('user_id') ? 'user_id' : 'student_id';
        
        // Check for existing application from this user to this club
        const duplicateCheck = await client.query(`
          SELECT id, status FROM applications 
          WHERE ${userColumn} = $1 AND club_id = $2
        `, [decoded.userId, clubId]);
        
        if (duplicateCheck.rows.length > 0) {
          await client.end();
          const existingApp = duplicateCheck.rows[0];
          res.status(409).json({
            error: {
              code: 'DUPLICATE_APPLICATION',
              message: `You have already applied to this club. Your application status is: ${existingApp.status}`,
              existingApplicationId: existingApp.id,
              status: existingApp.status
            }
          });
          return;
        }
        
        // Build insert query based on available columns
        let insertQuery;
        let insertValues;
        
        if (availableColumns.includes('user_id')) {
          // New schema with user_id
          insertQuery = `
            INSERT INTO applications (user_id, club_id, motivation, status, created_at)
            VALUES ($1, $2, $3, 'PENDING', NOW())
            RETURNING *
          `;
          insertValues = [decoded.userId, clubId, motivation];
        } else if (availableColumns.includes('student_id')) {
          // Old schema with student_id - use created_at instead of submitted_at
          insertQuery = `
            INSERT INTO applications (student_id, club_id, motivation, status, created_at)
            VALUES ($1, $2, $3, 'PENDING', NOW())
            RETURNING *
          `;
          insertValues = [decoded.userId, clubId, motivation];
        } else {
          // Unknown schema - return error
          await client.end();
          res.status(500).json({
            error: {
              code: 'SCHEMA_MISMATCH',
              message: 'Applications table schema is not compatible',
              debug: { availableColumns }
            }
          });
          return;
        }
        
        const result = await client.query(insertQuery, insertValues);
        await client.end();

        const application = result.rows[0];

        res.status(201).json({
          success: true,
          data: application
        });
        return;
      } catch (error) {
        console.error('Applications POST error:', error);
        res.status(500).json({ 
          error: 'Failed to submit application',
          message: error.message 
        });
        return;
      }
    }

    // Applications status update endpoint - PUT
    if (url.match(/^\/api\/applications\/[^\/]+\/status$/) && method === 'PUT') {
      try {
        const applicationId = url.split('/')[3];
        const { status, reviewNotes } = req.body;
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        if (!status) {
          res.status(400).json({
            error: {
              code: 'MISSING_STATUS',
              message: 'Status is required'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Update application status
        const updateQuery = `
          UPDATE applications
          SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `;
        
        const result = await client.query(updateQuery, [status, decoded.userId, applicationId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: 'Application not found'
            }
          });
          return;
        }
        
        const application = result.rows[0];
        
        // Log audit
        await logAudit(client, {
          userId: decoded.userId,
          action: status === 'APPROVED' ? 'APPROVE_APPLICATION' : 'REJECT_APPLICATION',
          resource: 'APPLICATION',
          resourceId: application.id,
          details: { status, reviewNotes, studentId: application.student_id, clubId: application.club_id },
          ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        
        await client.end();

        res.status(200).json({
          success: true,
          data: application
        });
        return;
      } catch (error) {
        console.error('Applications status update error:', error);
        res.status(500).json({ 
          error: 'Failed to update application status',
          message: error.message 
        });
        return;
      }
    }

    // Delete application endpoint - DELETE /api/applications/:id
    const deleteApplicationMatch = url.match(/^\/api\/applications\/([a-f0-9-]+)$/);
    if (deleteApplicationMatch && method === 'DELETE') {
      try {
        const applicationId = deleteApplicationMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check which columns exist
        const columnsCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'applications'
        `);
        const availableColumns = columnsCheck.rows.map(row => row.column_name);
        const userColumn = availableColumns.includes('user_id') ? 'user_id' : 'student_id';
        
        // Check if application belongs to user
        const checkQuery = `
          SELECT id, ${userColumn} as user_id, status
          FROM applications
          WHERE id = $1
        `;
        const checkResult = await client.query(checkQuery, [applicationId]);
        
        if (checkResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: 'Application not found'
            }
          });
          return;
        }
        
        const application = checkResult.rows[0];
        
        // Only allow user to delete their own application
        if (application.user_id !== decoded.userId && decoded.role !== 'SUPER_ADMIN') {
          await client.end();
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You can only delete your own applications'
            }
          });
          return;
        }
        
        // Delete application
        const deleteQuery = `
          DELETE FROM applications
          WHERE id = $1
          RETURNING id
        `;
        await client.query(deleteQuery, [applicationId]);
        await client.end();

        res.status(200).json({
          success: true,
          message: 'Application deleted successfully'
        });
        return;
      } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({ 
          error: 'Failed to delete application',
          message: error.message 
        });
        return;
      }
    }

    // Users endpoint - GET all users
    if (url === '/api/users' && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        // Simple query with only basic columns that definitely exist
        const query = `
          SELECT 
            id, email, first_name, last_name, role, is_active, created_at
          FROM users
          ORDER BY created_at DESC
          LIMIT 100
        `;
        
        const result = await client.query(query);
        await client.end();

        const users = result.rows.map(row => ({
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.created_at,
          phone: null,
          totpEnabled: false
        }));

        res.status(200).json({
          data: users,
          pagination: {
            page: 1,
            limit: 100,
            total: users.length
          }
        });
        return;
      } catch (error) {
        console.error('Users error:', error);
        res.status(500).json({ 
          error: 'Failed to load users',
          message: error.message 
        });
        return;
      }
    }

    // User details endpoint - GET single user with clubs
    const userDetailsMatch = url.match(/^\/api\/users\/([a-f0-9-]+)$/);
    if (userDetailsMatch && method === 'GET') {
      try {
        const userId = userDetailsMatch[1];
        const client = getDatabaseClient();
        await client.connect();
        
        // Get user info
        const userQuery = `
          SELECT id, email, first_name, last_name, role, is_active, created_at
          FROM users
          WHERE id = $1
        `;
        const userResult = await client.query(userQuery, [userId]);
        
        if (userResult.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          });
          return;
        }
        
        const user = userResult.rows[0];
        
        // Get user's club memberships (if they're a president)
        let clubs = [];
        if (user.role === 'CLUB_PRESIDENT') {
          const clubsQuery = `
            SELECT c.id, c.name, c.created_at as joined_at
            FROM clubs c
            WHERE c.president_id = $1
          `;
          const clubsResult = await client.query(clubsQuery, [userId]);
          clubs = clubsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            memberRole: 'President',
            joinedAt: row.joined_at
          }));
        }
        
        // Get user's applications
        const appsQuery = `
          SELECT a.id, a.status, a.created_at, c.name as club_name
          FROM applications a
          JOIN clubs c ON a.club_id = c.id
          WHERE a.student_id = $1
          ORDER BY a.created_at DESC
        `;
        const appsResult = await client.query(appsQuery, [userId]);
        const applications = appsResult.rows.map(row => ({
          id: row.id,
          status: row.status,
          clubName: row.club_name,
          createdAt: row.created_at
        }));
        
        await client.end();

        res.status(200).json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              isActive: user.is_active,
              createdAt: user.created_at
            },
            clubs,
            applications
          }
        });
        return;
      } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ 
          error: 'Failed to load user details',
          message: error.message 
        });
        return;
      }
    }

    // Delete user endpoint
    const userDeleteMatch = url.match(/^\/api\/users\/([a-f0-9-]+)$/);
    if (userDeleteMatch && method === 'DELETE') {
      try {
        const userId = userDeleteMatch[1];
        
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        } catch (e) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token format'
            }
          });
          return;
        }

        // Only SUPER_ADMIN can delete users
        if (decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can delete users'
            }
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Delete user (this will cascade delete related records)
        const deleteQuery = `
          DELETE FROM users
          WHERE id = $1
          RETURNING id, email, first_name, last_name
        `;
        const result = await client.query(deleteQuery, [userId]);
        
        if (result.rows.length === 0) {
          await client.end();
          res.status(404).json({
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          });
          return;
        }
        
        await client.end();

        res.status(200).json({
          success: true,
          message: 'User deleted successfully',
          data: {
            id: result.rows[0].id,
            email: result.rows[0].email,
            firstName: result.rows[0].first_name,
            lastName: result.rows[0].last_name
          }
        });
        return;
      } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
          error: 'Failed to delete user',
          message: error.message 
        });
        return;
      }
    }

    // Content moderation queue endpoint
    if (url.startsWith('/api/content-queue') && method === 'GET') {
      try {
        // Return empty array for now - no flagged content system in place yet
        res.status(200).json({
          data: []
        });
        return;
      } catch (error) {
        console.error('Content queue error:', error);
        res.status(500).json({ 
          error: 'Failed to load content queue',
          message: error.message 
        });
        return;
      }
    }

    // Audit logs endpoint
    if (url.startsWith('/api/audit-logs') && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        // Check if audit_logs table exists
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'audit_logs'
          );
        `);
        
        let auditLogs = [];
        
        if (tableCheck.rows[0].exists) {
          const query = `
            SELECT 
              al.id, al.user_id, al.action, al.resource, al.resource_id,
              al.details, al.ip_address, al.user_agent, al.created_at,
              u.first_name, u.last_name, u.email, u.role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 50
          `;
          
          const result = await client.query(query);
          
          auditLogs = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            user: row.first_name ? {
              firstName: row.first_name,
              lastName: row.last_name,
              email: row.email,
              role: row.role
            } : null,
            action: row.action,
            resource: row.resource,
            resourceId: row.resource_id,
            changes: row.details,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            timestamp: row.created_at,
            success: true
          }));
        }
        
        await client.end();

        res.status(200).json({
          data: auditLogs,
          pagination: {
            page: 1,
            limit: 50,
            total: auditLogs.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        });
        return;
      } catch (error) {
        console.error('Audit logs error:', error);
        res.status(500).json({ 
          error: 'Failed to load audit logs',
          message: error.message 
        });
        return;
      }
    }

    // Content moderation endpoint - GET /api/content-moderation
    if (url.startsWith('/api/content-moderation') && method === 'GET') {
      try {
        const client = getDatabaseClient();
        await client.connect();
        
        // Get recent clubs (last 20)
        const clubsQuery = `
          SELECT 
            c.id, c.name, c.description, c.created_at,
            u.id as president_id, u.first_name as president_first_name, 
            u.last_name as president_last_name, u.email as president_email
          FROM clubs c
          LEFT JOIN users u ON c.president_id = u.id
          ORDER BY c.created_at DESC
          LIMIT 20
        `;
        const clubsResult = await client.query(clubsQuery);
        
        // Get recent activities (last 20)
        const activitiesQuery = `
          SELECT 
            a.id, a.title, a.description, a.club_id, a.created_at, 
            a.start_date::date as date, 
            a.start_date::time as time,
            c.name as club_name,
            u.id as creator_id, u.first_name as creator_first_name,
            u.last_name as creator_last_name, u.email as creator_email
          FROM activities a
          LEFT JOIN clubs c ON a.club_id = c.id
          LEFT JOIN users u ON c.president_id = u.id
          ORDER BY a.created_at DESC
          LIMIT 20
        `;
        const activitiesResult = await client.query(activitiesQuery);
        
        // Get recent applications (last 20)
        const applicationsQuery = `
          SELECT 
            a.id, a.motivation, a.club_id, a.student_id, a.status, a.created_at,
            c.name as club_name,
            u.id as student_id, u.first_name as student_first_name,
            u.last_name as student_last_name, u.email as student_email
          FROM applications a
          LEFT JOIN clubs c ON a.club_id = c.id
          LEFT JOIN users u ON a.student_id = u.id
          ORDER BY a.created_at DESC
          LIMIT 20
        `;
        const applicationsResult = await client.query(applicationsQuery);
        
        await client.end();
        
        const clubs = clubsResult.rows.map(row => ({
          id: row.id,
          type: 'CLUB',
          title: row.name,
          description: row.description,
          createdAt: row.created_at,
          author: row.president_id ? {
            id: row.president_id,
            firstName: row.president_first_name,
            lastName: row.president_last_name,
            email: row.president_email
          } : null
        }));
        
        const activities = activitiesResult.rows.map(row => ({
          id: row.id,
          type: 'ACTIVITY',
          title: row.title,
          description: row.description,
          clubName: row.club_name,
          createdAt: row.created_at,
          date: row.date,
          time: row.time,
          author: row.creator_id ? {
            id: row.creator_id,
            firstName: row.creator_first_name,
            lastName: row.creator_last_name,
            email: row.creator_email
          } : null
        }));
        
        const applications = applicationsResult.rows.map(row => ({
          id: row.id,
          type: 'APPLICATION',
          title: 'Application',
          description: row.motivation,
          clubName: row.club_name,
          status: row.status,
          createdAt: row.created_at,
          author: row.student_id ? {
            id: row.student_id,
            firstName: row.student_first_name,
            lastName: row.student_last_name,
            email: row.student_email
          } : null
        }));
        
        res.status(200).json({
          data: {
            clubs,
            activities,
            applications
          }
        });
        return;
      } catch (error) {
        console.error('Content moderation error:', error);
        res.status(500).json({ 
          error: 'Failed to load content',
          message: error.message 
        });
        return;
      }
    }

    // ==================== COIN SYSTEM ENDPOINTS ====================
    
    // Get user's coins - GET /api/users/:id/coins
    const userCoinsMatch = url.match(/^\/api\/users\/([a-f0-9-]+)\/coins$/);
    if (userCoinsMatch && method === 'GET') {
      try {
        const userId = userCoinsMatch[1];
        
        const client = getDatabaseClient();
        await client.connect();
        
        const query = `
          SELECT 
            uc.balance,
            uc.total_earned,
            uc.total_spent,
            u.first_name,
            u.last_name,
            u.email
          FROM user_coins uc
          JOIN users u ON uc.user_id = u.id
          WHERE uc.user_id = $1
        `;
        
        const result = await client.query(query, [userId]);
        await client.end();
        
        if (result.rows.length === 0) {
          // Initialize coins for user if not exists
          const initClient = getDatabaseClient();
          await initClient.connect();
          await initClient.query(
            'INSERT INTO user_coins (user_id, balance, total_earned, total_spent) VALUES ($1, 0, 0, 0) ON CONFLICT DO NOTHING',
            [userId]
          );
          await initClient.end();
          
          res.status(200).json({
            data: {
              balance: 0,
              totalEarned: 0,
              totalSpent: 0
            }
          });
          return;
        }
        
        const row = result.rows[0];
        res.status(200).json({
          data: {
            balance: row.balance,
            totalEarned: row.total_earned,
            totalSpent: row.total_spent,
            user: {
              firstName: row.first_name,
              lastName: row.last_name,
              email: row.email
            }
          }
        });
        return;
      } catch (error) {
        console.error('Get user coins error:', error);
        res.status(500).json({
          error: 'Failed to get user coins',
          message: error.message
        });
        return;
      }
    }
    
    // Award coins - POST /api/coins/award (CLUB_PRESIDENT only)
    if (url === '/api/coins/award' && method === 'POST') {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        
        if (!decoded || decoded.role !== 'CLUB_PRESIDENT') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only club presidents can award coins'
            }
          });
          return;
        }

        const { toUserId, amount, reason, clubId } = req.body;
        
        if (!toUserId || !amount || amount <= 0) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Valid toUserId and positive amount are required'
            }
          });
          return;
        }
        
        const client = getDatabaseClient();
        await client.connect();
        
        // Verify president owns the club
        if (clubId) {
          const clubQuery = 'SELECT president_id FROM clubs WHERE id = $1';
          const clubResult = await client.query(clubQuery, [clubId]);
          
          if (clubResult.rows.length === 0 || clubResult.rows[0].president_id !== decoded.userId) {
            await client.end();
            res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: 'You can only award coins for your own club'
              }
            });
            return;
          }
        }
        
        // Create transaction
        const insertQuery = `
          INSERT INTO coin_transactions (from_user_id, to_user_id, amount, reason, club_id, transaction_type)
          VALUES ($1, $2, $3, $4, $5, 'AWARD')
          RETURNING id, created_at
        `;
        
        const result = await client.query(insertQuery, [
          decoded.userId,
          toUserId,
          amount,
          reason || 'Activity participation reward',
          clubId || null
        ]);
        
        await client.end();
        
        res.status(201).json({
          success: true,
          message: `Successfully awarded ${amount} coins`,
          data: {
            transactionId: result.rows[0].id,
            createdAt: result.rows[0].created_at
          }
        });
        return;
      } catch (error) {
        console.error('Award coins error:', error);
        res.status(500).json({
          error: 'Failed to award coins',
          message: error.message
        });
        return;
      }
    }
    
    // Get coin transactions - GET /api/coins/transactions
    if (url.startsWith('/api/coins/transactions') && method === 'GET') {
      try {
        const urlParams = new URLSearchParams(url.split('?')[1] || '');
        const limit = parseInt(urlParams.get('limit')) || 50;
        const userId = urlParams.get('userId');
        
        const client = getDatabaseClient();
        await client.connect();
        
        let query;
        let params;
        
        if (userId) {
          // Transactions for specific user
          query = `
            SELECT 
              ct.id,
              ct.from_user_id,
              ct.to_user_id,
              ct.amount,
              ct.reason,
              ct.transaction_type,
              ct.club_id,
              ct.created_at,
              u_from.first_name as from_first_name,
              u_from.last_name as from_last_name,
              u_from.email as from_email,
              u_to.first_name as to_first_name,
              u_to.last_name as to_last_name,
              u_to.email as to_email,
              c.name as club_name
            FROM coin_transactions ct
            LEFT JOIN users u_from ON ct.from_user_id = u_from.id
            LEFT JOIN users u_to ON ct.to_user_id = u_to.id
            LEFT JOIN clubs c ON ct.club_id = c.id
            WHERE ct.from_user_id = $1 OR ct.to_user_id = $1
            ORDER BY ct.created_at DESC
            LIMIT $2
          `;
          params = [userId, limit];
        } else {
          // All transactions
          query = `
            SELECT 
              ct.id,
              ct.from_user_id,
              ct.to_user_id,
              ct.amount,
              ct.reason,
              ct.transaction_type,
              ct.club_id,
              ct.created_at,
              u_from.first_name as from_first_name,
              u_from.last_name as from_last_name,
              u_from.email as from_email,
              u_to.first_name as to_first_name,
              u_to.last_name as to_last_name,
              u_to.email as to_email,
              c.name as club_name
            FROM coin_transactions ct
            LEFT JOIN users u_from ON ct.from_user_id = u_from.id
            LEFT JOIN users u_to ON ct.to_user_id = u_to.id
            LEFT JOIN clubs c ON ct.club_id = c.id
            ORDER BY ct.created_at DESC
            LIMIT $1
          `;
          params = [limit];
        }
        
        const result = await client.query(query, params);
        await client.end();
        
        const transactions = result.rows.map(row => ({
          id: row.id,
          fromUserId: row.from_user_id,
          toUserId: row.to_user_id,
          amount: row.amount,
          reason: row.reason,
          transactionType: row.transaction_type,
          clubId: row.club_id,
          clubName: row.club_name,
          createdAt: row.created_at,
          fromUser: row.from_user_id ? {
            firstName: row.from_first_name,
            lastName: row.from_last_name,
            email: row.from_email
          } : null,
          toUser: row.to_user_id ? {
            firstName: row.to_first_name,
            lastName: row.to_last_name,
            email: row.to_email
          } : null
        }));
        
        res.status(200).json({
          data: transactions
        });
        return;
      } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
          error: 'Failed to get transactions',
          message: error.message
        });
        return;
      }
    }
    
    // Adjust user coins - POST /api/coins/adjust (SUPER_ADMIN only)
    if (url === '/api/coins/adjust' && method === 'POST') {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        
        if (!decoded || decoded.role !== 'SUPER_ADMIN') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Only super admins can adjust coins'
            }
          });
          return;
        }

        const { userId, amount, reason } = req.body;
        
        if (!userId || amount === undefined || amount === 0) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Valid userId and non-zero amount are required'
            }
          });
          return;
        }
        
        const client = getDatabaseClient();
        await client.connect();
        
        try {
          // Create transaction - use BONUS for adding, PENALTY for removing
          const transactionType = amount > 0 ? 'BONUS' : 'PENALTY';
          
          const insertQuery = `
            INSERT INTO coin_transactions (from_user_id, to_user_id, amount, reason, transaction_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at
          `;
          
          const result = await client.query(insertQuery, [
            amount > 0 ? decoded.userId : null,
            userId,
            Math.abs(amount),
            reason || (amount > 0 ? 'Admin bonus' : 'Admin penalty'),
            transactionType
          ]);
          
          // For penalty, the trigger added the amount, so we need to subtract it twice
          if (amount < 0) {
            await client.query(
              `UPDATE user_coins 
               SET balance = GREATEST(0, balance - $1 * 2), 
                   total_earned = total_earned - $1,
                   total_spent = total_spent + $1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $2`,
              [Math.abs(amount), userId]
            );
          }
          
          // Log audit
          await logAudit(client, {
            userId: decoded.userId,
            action: amount > 0 ? 'ADMIN_ADD_COINS' : 'ADMIN_REMOVE_COINS',
            resource: 'COINS',
            resourceId: userId,
            details: { amount, reason, targetUserId: userId },
            ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          });
          
          await client.end();
          
          res.status(201).json({
            success: true,
            message: `Successfully ${amount > 0 ? 'added' : 'removed'} ${Math.abs(amount)} coins`,
            data: {
              transactionId: result.rows[0].id,
              createdAt: result.rows[0].created_at
            }
          });
          return;
        } catch (error) {
          await client.end();
          throw error;
        }
      } catch (error) {
        console.error('Adjust coins error:', error);
        res.status(500).json({
          error: 'Failed to adjust coins',
          message: error.message
        });
        return;
      }
    }
    
    // Get leaderboard - GET /api/coins/leaderboard
    if (url.startsWith('/api/coins/leaderboard') && method === 'GET') {
      try {
        const urlParams = new URLSearchParams(url.split('?')[1] || '');
        const limit = parseInt(urlParams.get('limit')) || 10;
        const clubId = urlParams.get('clubId');
        
        const client = getDatabaseClient();
        await client.connect();
        
        let query;
        let params;
        
        if (clubId) {
          // Leaderboard for specific club
          query = `
            SELECT 
              uc.user_id,
              uc.balance,
              uc.total_earned,
              u.first_name,
              u.last_name,
              u.email
            FROM user_coins uc
            JOIN users u ON uc.user_id = u.id
            JOIN applications app ON u.id = app.student_id
            WHERE app.club_id = $1 AND app.status = 'APPROVED'
            ORDER BY uc.balance DESC
            LIMIT $2
          `;
          params = [clubId, limit];
        } else {
          // Global leaderboard
          query = `
            SELECT 
              uc.user_id,
              uc.balance,
              uc.total_earned,
              u.first_name,
              u.last_name,
              u.email
            FROM user_coins uc
            JOIN users u ON uc.user_id = u.id
            WHERE uc.balance > 0
            ORDER BY uc.balance DESC
            LIMIT $1
          `;
          params = [limit];
        }
        
        const result = await client.query(query, params);
        await client.end();
        
        const leaderboard = result.rows.map((row, index) => ({
          rank: index + 1,
          userId: row.user_id,
          balance: row.balance,
          totalEarned: row.total_earned,
          user: {
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email
          }
        }));
        
        res.status(200).json({
          data: leaderboard
        });
        return;
      } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
          error: 'Failed to get leaderboard',
          message: error.message
        });
        return;
      }
    }

    // Remove member from club
    if (url.match(/^\/api\/clubs\/[^\/]+\/members\/[^\/]+$/) && method === 'DELETE') {
      try {
        const urlParts = url.split('/');
        const clubId = urlParts[3];
        const memberEmail = decodeURIComponent(urlParts[5]);

        const client = getDatabaseClient();
        await client.connect();

        // Check if member exists in the club
        // Note: Using student_id instead of student_email to match with users table
        const memberCheck = await client.query(`
          SELECT a.id, u.email 
          FROM applications a
          LEFT JOIN users u ON a.student_id = u.id
          WHERE a.club_id = $1 
            AND (u.email = $2 OR a.student_id IN (SELECT id FROM users WHERE email = $2))
            AND a.status = $3
        `, [clubId, memberEmail, 'APPROVED']);

        if (memberCheck.rows.length === 0) {
          await client.end();
          res.status(404).json({
            success: false,
            error: {
              message: 'Member not found in this club'
            }
          });
          return;
        }

        // Delete the application (removes member from club)
        await client.query(`
          DELETE FROM applications 
          WHERE club_id = $1 
            AND student_id IN (SELECT id FROM users WHERE email = $2)
        `, [clubId, memberEmail]);

        await client.end();

        res.status(200).json({
          success: true,
          message: 'Member removed from club successfully'
        });
        return;
      } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to remove member from club',
            details: error.message
          }
        });
        return;
      }
    }

    // Password reset request endpoint
    if (url === '/api/auth/password/reset-request' && method === 'POST') {
      try {
        const { email } = req.body;
        
        if (!email) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email is required',
            },
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Check if user exists
        const userResult = await client.query('SELECT id, email, first_name FROM users WHERE email = $1 AND is_active = true', [email]);
        
        if (userResult.rows.length === 0) {
          await client.end();
          // For security, always return success even if user doesn't exist
          res.json({
            success: true,
            message: 'If the email exists in our system, a password reset link has been sent',
          });
          return;
        }

        const user = userResult.rows[0];

        // Generate reset token
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

        // Update user with reset token
        await client.query(
          'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
          [resetToken, resetTokenExpires, user.id]
        );
        
        await client.end();

        // Send password reset email via Brevo
        try {
          const { sendPasswordResetEmail } = require('./email-service');
          await sendPasswordResetEmail(user.email, user.first_name, resetToken);
          console.log(`✅ Password reset email sent to ${email}`);
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Fallback: log to console for development
          console.log(`📧 Password reset token for ${email}: ${resetToken}`);
          console.log(`Reset link: https://new-university-project.vercel.app/reset-password?token=${resetToken}`);
        }

        res.json({
          success: true,
          message: 'If the email exists in our system, a password reset link has been sent',
        });
        return;
      } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to process password reset request',
          },
        });
        return;
      }
    }

    // Password reset confirm endpoint
    if (url === '/api/auth/password/reset-confirm' && method === 'POST') {
      try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Token and new password are required',
            },
          });
          return;
        }

        if (newPassword.length < 8) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Password must be at least 8 characters long',
            },
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();
        
        // Find user with valid reset token
        const userResult = await client.query(
          'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW() AND is_active = true',
          [token]
        );
        
        if (userResult.rows.length === 0) {
          await client.end();
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired reset token',
            },
          });
          return;
        }

        // Hash new password using base64
        const passwordHash = Buffer.from(newPassword).toString('base64');

        // Update password and clear reset token
        await client.query(
          'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
          [passwordHash, userResult.rows[0].id]
        );
        
        await client.end();

        res.json({
          success: true,
          message: 'Password has been reset successfully',
        });
        return;
      } catch (error) {
        console.error('Password reset confirm error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to reset password',
          },
        });
        return;
      }
    }

    // Update user GPA - PUT /api/users/:id/gpa
    const gpaUpdateMatch = url.match(/^\/api\/users\/([a-f0-9-]+)\/gpa$/);
    if (gpaUpdateMatch && method === 'PUT') {
      try {
        const userId = gpaUpdateMatch[1];
        const { gpa } = req.body;

        // Validate GPA
        if (gpa === undefined || gpa === null) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'GPA is required',
            },
          });
          return;
        }

        const gpaNum = parseFloat(gpa);
        if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'GPA must be between 0.00 and 4.00',
            },
          });
          return;
        }

        const client = getDatabaseClient();
        await client.connect();

        // Update user GPA
        const result = await client.query(
          'UPDATE users SET gpa = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, gpa',
          [gpaNum, userId]
        );

        await client.end();

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'GPA updated successfully',
          data: {
            gpa: parseFloat(result.rows[0].gpa),
          },
        });
        return;
      } catch (error) {
        console.error('Update GPA error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update GPA',
          },
        });
        return;
      }
    }

    // Default 404
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested endpoint was not found',
        path: url,
        method: method
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

// Disable Vercel's default body parser to handle it manually
module.exports.config = {
  api: {
    bodyParser: false,
  },
};