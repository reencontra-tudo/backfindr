import { Pool, PoolClient } from 'pg';

// Parse the DATABASE_URL to ensure correct port and SSL settings
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Force SSL and correct settings for Supabase Pooler (port 6543)
  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 1, // Serverless: limit connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
