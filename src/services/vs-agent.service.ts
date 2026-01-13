import { getAppConfig } from '../config'

/**
 * VS Agent Service - Handles communication with VS Agent Admin API
 * Shared service to avoid code duplication in controllers
 */
export class VsAgentService {
  /**
   * Send a message to a connection via VS Agent
   * @throws Error if the message fails to send
   */
  async sendMessage(connectionId: string, message: object): Promise<void> {
    const vsAgentUrl = getAppConfig().vsAgentUrl
    const response = await fetch(`${vsAgentUrl}/v1/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`VS Agent message failed: ${errorText}`)
    }
  }

  /**
   * Get invitation URL from VS Agent
   */
  async getInvitationUrl(): Promise<string | null> {
    const vsAgentUrl = getAppConfig().vsAgentUrl
    const response = await fetch(`${vsAgentUrl}/v1/invitation`)
    const data = (await response.json()) as { url?: string }
    return data.url || null
  }
}

// Singleton instance
export const vsAgentService = new VsAgentService()
