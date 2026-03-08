/**
 * PostgreSQL Database Connection
 * Simple connection pool for PostgreSQL operations
 */

import { Pool, PoolClient } from 'pg';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tau_kays',
  user: process.env.DB_USER || 'tau_kays_user',
  password: process.env.DB_PASSWORD || 'tau_kays_password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Database connection functions
export const db = {
  // Execute a query with parameters
  async query(text: string, params?: any[]): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  },

  // Get a client from the pool for transactions
  async getClient(): Promise<PoolClient> {
    return await pool.connect();
  },

  // Close all connections
  async end(): Promise<void> {
    await pool.end();
  },

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await db.end();
  process.exit(0);
});

export default db;