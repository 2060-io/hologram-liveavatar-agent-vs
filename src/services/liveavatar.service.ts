import { getAppConfig } from '../config'

export interface SessionToken {
  sessionId: string
  sessionToken: string
}

export interface SessionStartResponse {
  livekitUrl: string
  livekitToken: string
}

export interface CustomAvatarParams {
  avatarId: string
  voiceId: string
  language?: string
  systemPrompt?: string | null
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
   * Create a session with custom avatar parameters
   * Used for user-created custom avatars
   */
  async createCustomSessionToken(params: CustomAvatarParams): Promise<SessionToken> {
    const response = await fetch(`${this.config.apiUrl}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: params.avatarId,
        avatar_persona: {
          voice_id: params.voiceId,
          context_id: this.config.contextId, // Use default context
          language: params.language || this.config.language,
          ...(params.systemPrompt ? { system_prompt: params.systemPrompt } : {}),
        },
      }),
    })

    if (!response.ok) {
      const error = (await response.json()) as HeyGenErrorResponse
      throw new Error(`Failed to create custom session token: ${error.message || response.statusText}`)
    }

    const data = (await response.json()) as HeyGenSessionTokenResponse
    return {
      sessionId: data.data.session_id,
      sessionToken: data.data.session_token,
    }
  }

  /**
   * Create a full session with custom parameters and return LiveKit credentials
   */
  async createCustomSession(params: CustomAvatarParams): Promise<SessionStartResponse & { sessionId: string }> {
    const { sessionId, sessionToken } = await this.createCustomSessionToken(params)
    const { livekitUrl, livekitToken } = await this.startSession(sessionToken)
    return { sessionId, livekitUrl, livekitToken }
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

  /**
   * Check if the API key is configured (for catalog operations)
   */
  hasApiKey(): boolean {
    return !!this.config.apiKey
  }
}

// Singleton instance
export const liveAvatarService = new LiveAvatarService()
