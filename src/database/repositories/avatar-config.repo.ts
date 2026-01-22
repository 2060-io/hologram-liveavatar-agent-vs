import { getPool } from '../index'
import {
  AvatarConfig,
  CreateAvatarConfigInput,
  UpdateAvatarConfigInput,
} from '../../models/avatar-config.model'

function mapRowToAvatarConfig(row: Record<string, unknown>): AvatarConfig {
  return {
    id: row.id as string,
    connectionId: row.connection_id as string,
    name: row.name as string,
    avatarId: row.avatar_id as string,
    voiceId: row.voice_id as string,
    language: row.language as string,
    systemPrompt: row.system_prompt as string | null,
    credentialDefinitionId: row.credential_definition_id as string | null,
    credentialIssuedAt: row.credential_issued_at ? new Date(row.credential_issued_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class AvatarConfigRepository {
  async create(input: CreateAvatarConfigInput): Promise<AvatarConfig> {
    const pool = getPool()
    const result = await pool.query(
      `INSERT INTO avatar_configs (connection_id, name, avatar_id, voice_id, language, system_prompt)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.connectionId,
        input.name,
        input.avatarId,
        input.voiceId,
        input.language,
        input.systemPrompt || null,
      ]
    )
    return mapRowToAvatarConfig(result.rows[0])
  }

  async findById(id: string): Promise<AvatarConfig | null> {
    const pool = getPool()
    const result = await pool.query(
      'SELECT * FROM avatar_configs WHERE id = $1',
      [id]
    )
    return result.rows.length > 0 ? mapRowToAvatarConfig(result.rows[0]) : null
  }

  async findByConnectionId(connectionId: string): Promise<AvatarConfig[]> {
    const pool = getPool()
    const result = await pool.query(
      'SELECT * FROM avatar_configs WHERE connection_id = $1 ORDER BY created_at DESC',
      [connectionId]
    )
    return result.rows.map(mapRowToAvatarConfig)
  }

  async findByConnectionIdAndName(
    connectionId: string,
    name: string
  ): Promise<AvatarConfig | null> {
    const pool = getPool()
    const result = await pool.query(
      'SELECT * FROM avatar_configs WHERE connection_id = $1 AND LOWER(name) = LOWER($2)',
      [connectionId, name]
    )
    return result.rows.length > 0 ? mapRowToAvatarConfig(result.rows[0]) : null
  }

  async update(id: string, input: UpdateAvatarConfigInput): Promise<AvatarConfig | null> {
    const pool = getPool()
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(input.name)
    }
    if (input.avatarId !== undefined) {
      setClauses.push(`avatar_id = $${paramIndex++}`)
      values.push(input.avatarId)
    }
    if (input.voiceId !== undefined) {
      setClauses.push(`voice_id = $${paramIndex++}`)
      values.push(input.voiceId)
    }
    if (input.language !== undefined) {
      setClauses.push(`language = $${paramIndex++}`)
      values.push(input.language)
    }
    if (input.systemPrompt !== undefined) {
      setClauses.push(`system_prompt = $${paramIndex++}`)
      values.push(input.systemPrompt)
    }
    if (input.credentialDefinitionId !== undefined) {
      setClauses.push(`credential_definition_id = $${paramIndex++}`)
      values.push(input.credentialDefinitionId)
    }
    if (input.credentialIssuedAt !== undefined) {
      setClauses.push(`credential_issued_at = $${paramIndex++}`)
      values.push(input.credentialIssuedAt)
    }

    if (setClauses.length === 0) {
      return this.findById(id)
    }

    setClauses.push(`updated_at = NOW()`)
    values.push(id)

    const result = await pool.query(
      `UPDATE avatar_configs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    return result.rows.length > 0 ? mapRowToAvatarConfig(result.rows[0]) : null
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool()
    const result = await pool.query(
      'DELETE FROM avatar_configs WHERE id = $1',
      [id]
    )
    return (result.rowCount ?? 0) > 0
  }
}

export const avatarConfigRepository = new AvatarConfigRepository()
