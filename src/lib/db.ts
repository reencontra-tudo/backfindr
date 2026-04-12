import { Pool, PoolClient } from 'pg';

// Parse DATABASE_URL manually to handle special characters in password
function parseConnectionString(connectionString: string) {
  try {
    // URL class handles percent-encoded characters properly
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6543', 10),
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  } catch {
    return null;
  }
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const parsed = parseConnectionString(connectionString);

  if (parsed) {
    // Use individual parameters to avoid URL parsing issues with special chars
    return new Pool({
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      password: parsed.password,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 1, // Serverless: limit connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }

  // Fallback: use connectionString directly
  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
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
