import { getPool } from '../index'
import {
  PendingPresentation,
  CreatePresentationInput,
  UpdatePresentationInput,
  PresentationStatus,
} from '../../models/avatar-config.model'

function mapRowToPresentation(row: Record<string, unknown>): PendingPresentation {
  return {
    id: row.id as string,
    proofExchangeId: row.proof_exchange_id as string,
    connectionId: row.connection_id as string | null,
    avatarConfigId: row.avatar_config_id as string,
    status: row.status as PresentationStatus,
    createdAt: new Date(row.created_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string) : null,
  }
}

export class PresentationRepository {
  async create(input: CreatePresentationInput): Promise<PendingPresentation> {
    const pool = getPool()
    const expiresAt = input.expiresAt || new Date(Date.now() + 10 * 60 * 1000) // 10 minutes default

    const result = await pool.query(
      `INSERT INTO pending_presentations (proof_exchange_id, connection_id, avatar_config_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.proofExchangeId, input.connectionId || null, input.avatarConfigId, expiresAt]
    )
    return mapRowToPresentation(result.rows[0])
  }

  async findById(id: string): Promise<PendingPresentation | null> {
    const pool = getPool()
    const result = await pool.query(
      'SELECT * FROM pending_presentations WHERE id = $1',
      [id]
    )
    return result.rows.length > 0 ? mapRowToPresentation(result.rows[0]) : null
  }

  async findByProofExchangeId(proofExchangeId: string): Promise<PendingPresentation | null> {
    const pool = getPool()
    const result = await pool.query(
      'SELECT * FROM pending_presentations WHERE proof_exchange_id = $1',
      [proofExchangeId]
    )
    return result.rows.length > 0 ? mapRowToPresentation(result.rows[0]) : null
  }

  async findPendingByConnectionId(connectionId: string): Promise<PendingPresentation[]> {
    const pool = getPool()
    const result = await pool.query(
      `SELECT * FROM pending_presentations
       WHERE connection_id = $1
         AND status = 'pending'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [connectionId]
    )
    return result.rows.map(mapRowToPresentation)
  }

  async update(
    id: string,
    input: UpdatePresentationInput
  ): Promise<PendingPresentation | null> {
    const pool = getPool()
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (input.connectionId !== undefined) {
      setClauses.push(`connection_id = $${paramIndex++}`)
      values.push(input.connectionId)
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(input.status)
    }
    if (input.verifiedAt !== undefined) {
      setClauses.push(`verified_at = $${paramIndex++}`)
      values.push(input.verifiedAt)
    }

    if (setClauses.length === 0) {
      return this.findById(id)
    }

    values.push(id)

    const result = await pool.query(
      `UPDATE pending_presentations
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )

    return result.rows.length > 0 ? mapRowToPresentation(result.rows[0]) : null
  }

  async updateByProofExchangeId(
    proofExchangeId: string,
    input: UpdatePresentationInput
  ): Promise<PendingPresentation | null> {
    const pool = getPool()
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (input.connectionId !== undefined) {
      setClauses.push(`connection_id = $${paramIndex++}`)
      values.push(input.connectionId)
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(input.status)
    }
    if (input.verifiedAt !== undefined) {
      setClauses.push(`verified_at = $${paramIndex++}`)
      values.push(input.verifiedAt)
    }

    if (setClauses.length === 0) {
      return this.findByProofExchangeId(proofExchangeId)
    }

    values.push(proofExchangeId)

    const result = await pool.query(
      `UPDATE pending_presentations
       SET ${setClauses.join(', ')}
       WHERE proof_exchange_id = $${paramIndex}
       RETURNING *`,
      values
    )

    return result.rows.length > 0 ? mapRowToPresentation(result.rows[0]) : null
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool()
    const result = await pool.query(
      'DELETE FROM pending_presentations WHERE id = $1',
      [id]
    )
    return (result.rowCount ?? 0) > 0
  }

  async deleteExpired(): Promise<number> {
    const pool = getPool()
    const result = await pool.query(
      `DELETE FROM pending_presentations
       WHERE status = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()`
    )
    return result.rowCount ?? 0
  }

  async expirePending(): Promise<number> {
    const pool = getPool()
    const result = await pool.query(
      `UPDATE pending_presentations
       SET status = 'expired'
       WHERE status = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()`
    )
    return result.rowCount ?? 0
  }
}

export const presentationRepository = new PresentationRepository()
