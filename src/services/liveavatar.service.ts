import { getAppConfig } from '../config'

export interface SessionToken {
  sessionId: string
  sessionToken: string
}

export interface SessionStartResponse {
  livekitUrl: string
  livekitToken: string
}

// HeyGen API Response Types
interface HeyGenSessionTokenResponse {
  data: {
    session_id: string
    session_token: string
  }
}

interface HeyGenSessionStartResponse {
  data: {
    livekit_url: string
    livekit_client_token: string
  }
}

interface HeyGenErrorResponse {
  message?: string
}

/**
 * LiveAvatar Service - Handles HeyGen LiveAvatar API interactions
 */
export class LiveAvatarService {
  private config = getAppConfig().liveavatar

  /**
   * Create a new LiveAvatar session token
   * This token is used to start a session from the frontend
   */
  async createSessionToken(): Promise<SessionToken> {
    const response = await fetch(`${this.config.apiUrl}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: this.config.avatarId,
        avatar_persona: {
          voice_id: this.config.voiceId,
          context_id: this.config.contextId,
          language: this.config.language,
        },
      }),
    })

    if (!response.ok) {
      const error = (await response.json()) as HeyGenErrorResponse
      throw new Error(`Failed to create session token: ${error.message || response.statusText}`)
    }

    const data = (await response.json()) as HeyGenSessionTokenResponse
    return {
      sessionId: data.data.session_id,
      sessionToken: data.data.session_token,
    }
  }

  /**
   * Start a session (called with session token)
   * Returns LiveKit room info for video streaming
   */
  async startSession(sessionToken: string): Promise<SessionStartResponse> {
    const response = await fetch(`${this.config.apiUrl}/v1/sessions/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const error = (await response.json()) as HeyGenErrorResponse
      throw new Error(`Failed to start session: ${error.message || response.statusText}`)
    }

    const data = (await response.json()) as HeyGenSessionStartResponse
    return {
      livekitUrl: data.data.livekit_url,
      livekitToken: data.data.livekit_client_token,
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.avatarId &&
      this.config.voiceId &&
      this.config.contextId
    )
  }
}

// Singleton instance
export const liveAvatarService = new LiveAvatarService()
