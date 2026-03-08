const { Client } = require('pg');

// Use the same connection string as the API
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.bzjekrzqnqyqphkaqses:Asdasadas123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if phone column exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'phone'
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log('Phone column does not exist, adding it...');
      await client.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
      console.log('Phone column added successfully!');
    } else {
      console.log('Phone column already exists');
    }
    
    await client.end();
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
