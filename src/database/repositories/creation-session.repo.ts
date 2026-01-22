import { getPool } from '../index'
import {
  AvatarCreationSession,
  CreateSessionInput,
  UpdateSessionInput,
  WizardStep,
} from '../../models/avatar-config.model'

function mapRowToSession(row: Record<string, unknown>): AvatarCreationSession {
  return {
    connectionId: row.connection_id as string,
    currentStep: row.current_step as WizardStep,
    selectedAvatarId: row.selected_avatar_id as string | null,
    selectedVoiceId: row.selected_voice_id as string | null,
    selectedLanguage: row.selected_language as string | null,
    customName: row.custom_name as string | null,
    systemPrompt: row.system_prompt as string | null,
    startedAt: new Date(row.started_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
  }
}

export class CreationSessionRepository {
  async create(input: CreateSessionInput): Promise<AvatarCreationSession> {
    const pool = getPool()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now

    const result = await pool.query(
      `INSERT INTO avatar_creation_sessions (connection_id, current_step, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (connection_id)
       DO UPDATE SET
         current_step = $2,
         selected_avatar_id = NULL,
         selected_voice_id = NULL,
         selected_language = NULL,
         custom_name = NULL,
         system_prompt = NULL,
         started_at = NOW(),
         expires_at = $3
       RETURNING *`,
      [input.connectionId, input.currentStep, expiresAt]
    )
    return mapRowToSession(result.rows[0])
  }

  async findByConnectionId(connectionId: string): Promise<AvatarCreationSession | null> {
    const pool = getPool()
    const result = await pool.query(
      `SELECT * FROM avatar_creation_sessions
       WHERE connection_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [connectionId]
    )
    return result.rows.length > 0 ? mapRowToSession(result.rows[0]) : null
  }

  async update(
    connectionId: string,
    input: UpdateSessionInput
  ): Promise<AvatarCreationSession | null> {
    const pool = getPool()
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (input.currentStep !== undefined) {
      setClauses.push(`current_step = $${paramIndex++}`)
      values.push(input.currentStep)
    }
    if (input.selectedAvatarId !== undefined) {
      setClauses.push(`selected_avatar_id = $${paramIndex++}`)
      values.push(input.selectedAvatarId)
    }
    if (input.selectedVoiceId !== undefined) {
      setClauses.push(`selected_voice_id = $${paramIndex++}`)
      values.push(input.selectedVoiceId)
    }
    if (input.selectedLanguage !== undefined) {
      setClauses.push(`selected_language = $${paramIndex++}`)
      values.push(input.selectedLanguage)
    }
    if (input.customName !== undefined) {
      setClauses.push(`custom_name = $${paramIndex++}`)
      values.push(input.customName)
    }
    if (input.systemPrompt !== undefined) {
      setClauses.push(`system_prompt = $${paramIndex++}`)
      values.push(input.systemPrompt)
    }
    if (input.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`)
      values.push(input.expiresAt)
    }

    if (setClauses.length === 0) {
      return this.findByConnectionId(connectionId)
    }

    values.push(connectionId)

    const result = await pool.query(
      `UPDATE avatar_creation_sessions
       SET ${setClauses.join(', ')}
       WHERE connection_id = $${paramIndex}
       RETURNING *`,
      values
    )

    return result.rows.length > 0 ? mapRowToSession(result.rows[0]) : null
  }

  async delete(connectionId: string): Promise<boolean> {
    const pool = getPool()
    const result = await pool.query(
      'DELETE FROM avatar_creation_sessions WHERE connection_id = $1',
      [connectionId]
    )
    return (result.rowCount ?? 0) > 0
  }

  async deleteExpired(): Promise<number> {
    const pool = getPool()
    const result = await pool.query(
      'DELETE FROM avatar_creation_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()'
    )
    return result.rowCount ?? 0
  }
}

export const creationSessionRepository = new CreationSessionRepository()
