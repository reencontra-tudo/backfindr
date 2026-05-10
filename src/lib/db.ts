import { Pool, PoolClient } from 'pg';

function parseConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
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
  if (!connectionString) throw new Error('DATABASE_URL not set');
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const parsed = parseConnectionString(connectionString);
  const sslConfig = isLocal ? {} : { ssl: { rejectUnauthorized: false } };
  if (parsed) {
    return new Pool({ host: parsed.host, port: parsed.port, database: parsed.database, user: parsed.user, password: parsed.password, ...sslConfig, max: 1, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
  }
  return new Pool({ connectionString, ...sslConfig, max: 1, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
}

let pool: Pool | null = null;
function getPool(): Pool { if (!pool) pool = createPool(); return pool; }
export async function getClient(): Promise<PoolClient> { return getPool().connect(); }
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    console.log('query', { text: text.substring(0, 50), duration: Date.now() - start, rows: result.rowCount });
    return result;
  } catch (error) { console.error('Database error:', error); throw error; }
}
export async function closePool() { if (pool) { await pool.end(); pool = null; } }
