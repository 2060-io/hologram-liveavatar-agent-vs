import { Pool, PoolClient } from 'pg'
import { getAppConfig } from '../config/app.config'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const config = getAppConfig()
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err)
    })
  }
  return pool
}

export async function initializeDatabase(): Promise<void> {
  const db = getPool()

  console.log('Initializing database schema...')

  await db.query(`
    -- Avatar Configurations
    CREATE TABLE IF NOT EXISTS avatar_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      avatar_id VARCHAR(255) NOT NULL,
      voice_id VARCHAR(255) NOT NULL,
      language VARCHAR(10) DEFAULT 'en',
      system_prompt TEXT,
      credential_definition_id VARCHAR(255),
      credential_issued_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Index for connection lookups
    CREATE INDEX IF NOT EXISTS idx_avatar_configs_connection
      ON avatar_configs(connection_id);

    -- Wizard State (tracks in-progress creation)
    CREATE TABLE IF NOT EXISTS avatar_creation_sessions (
      connection_id VARCHAR(255) PRIMARY KEY,
      current_step VARCHAR(50) NOT NULL,
      selected_avatar_id VARCHAR(255),
      selected_voice_id VARCHAR(255),
      selected_language VARCHAR(10),
      custom_name VARCHAR(255),
      system_prompt TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );

    -- Pending Credential Presentations
    CREATE TABLE IF NOT EXISTS pending_presentations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      proof_exchange_id VARCHAR(255) UNIQUE NOT NULL,
      connection_id VARCHAR(255),
      avatar_config_id UUID NOT NULL REFERENCES avatar_configs(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ
    );

    -- Index for status lookups
    CREATE INDEX IF NOT EXISTS idx_presentations_status
      ON pending_presentations(status);

    -- Index for proof exchange lookups
    CREATE INDEX IF NOT EXISTS idx_presentations_proof_exchange
      ON pending_presentations(proof_exchange_id);
  `)

  console.log('Database schema initialized successfully')
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database connection pool closed')
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export { Pool, PoolClient }
