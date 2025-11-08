/**
 * SQL Server Database Connection (xERP & SPISA)
 * Connects to external SQL Server databases for BI metrics
 */

import sql from 'mssql';

// xERP Connection configuration
const xerpConfig: sql.config = {
  server: process.env.XERP_DB_SERVER || 'dialfa.database.windows.net',
  database: process.env.XERP_DB_NAME || 'xERP',
  user: process.env.XERP_DB_USER || '',
  password: process.env.XERP_DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Connection pool
let xerpPool: sql.ConnectionPool | null = null;

/**
 * Get or create connection pool to xERP database
 */
export async function getXerpConnection(): Promise<sql.ConnectionPool> {
  if (!xerpPool) {
    try {
      xerpPool = await new sql.ConnectionPool(xerpConfig).connect();
      console.log('✅ Connected to xERP SQL Server');
    } catch (error) {
      console.error('❌ Failed to connect to xERP:', error);
      throw new Error('xERP database connection failed');
    }
  }
  return xerpPool;
}

/**
 * Execute query against xERP database
 */
export async function executeXerpQuery<T = unknown>(query: string): Promise<T[]> {
  try {
    const connection = await getXerpConnection();
    const result = await connection.request().query(query);
    return result.recordset as T[];
  } catch (error) {
    console.error('xERP query error:', error);
    throw error;
  }
}

/**
 * Execute query and return single value (scalar) from xERP
 */
export async function executeXerpScalar<T = unknown>(query: string): Promise<T | null> {
  try {
    const connection = await getXerpConnection();
    const result = await connection.request().query(query);
    if (result.recordset && result.recordset.length > 0) {
      const firstRow = result.recordset[0];
      const firstValue = Object.values(firstRow)[0];
      return firstValue as T;
    }
    return null;
  } catch (error) {
    console.error('xERP scalar query error:', error);
    throw error;
  }
}

/**
 * Test xERP connection
 */
export async function testXerpConnection(): Promise<boolean> {
  try {
    const connection = await getXerpConnection();
    const result = await connection.request().query('SELECT 1 AS test');
    return result.recordset.length > 0;
  } catch (error) {
    console.error('xERP connection test failed:', error);
    return false;
  }
}

/**
 * Close xERP connection pool (for graceful shutdown)
 */
export async function closeXerpConnection(): Promise<void> {
  if (xerpPool) {
    await xerpPool.close();
    xerpPool = null;
    console.log('xERP connection pool closed');
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closeXerpConnection();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeXerpConnection();
    process.exit(0);
  });
}
