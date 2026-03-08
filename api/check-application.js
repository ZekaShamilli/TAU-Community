const { Pool } = require('pg');

// Database connection helper
function getDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { clubId, email } = req.query;

    if (!clubId || !email) {
      res.status(400).json({ error: 'Missing clubId or email parameter' });
      return;
    }

    const pool = getDatabaseClient();
    
    // Check which columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'applications'
    `);
    const availableColumns = columnsCheck.rows.map(row => row.column_name);
    const userColumn = availableColumns.includes('user_id') ? 'user_id' : 'student_id';
    
    // Find user by email
    const userQuery = `SELECT id FROM users WHERE email = $1`;
    const userResult = await pool.query(userQuery, [email]);
    
    if (userResult.rows.length === 0) {
      await pool.end();
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
    const appResult = await pool.query(appQuery, [clubId, userId]);
    
    await pool.end();
    
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
  } catch (error) {
    console.error('Check application error:', error);
    res.status(500).json({ 
      error: 'Failed to check application',
      message: error.message 
    });
  }
};
