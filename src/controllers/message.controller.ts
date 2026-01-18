import { Request, Response } from 'express'
import { MessageReceivedDto } from '../dto'
import { getAppConfig } from '../config'
import { liveAvatarService, vsAgentService } from '../services'

/**
 * Message controller - handles incoming messages from users
 */
export class MessageController {
  /**
   * POST /message-received - Webhook endpoint for VS Agent
   * Handles different message types including profile and text messages
   */
  async handleMessageReceived(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as MessageReceivedDto

      // Input validation
      if (!body?.message?.connectionId) {
        console.error('❌ Invalid message payload:', JSON.stringify(body))
        res.status(400).json({ error: 'Invalid message payload' })
        return
      }

      const message = body.message
      const connectionId = message.connectionId
      const messageType = message.type

      console.log(`📨 Message received from ${connectionId}, type: ${messageType}`)

      // Handle profile message - send welcome with direct session
      if (messageType === 'profile') {
        await this.handleProfileMessage(connectionId, message.displayName)
        res.status(200).end()
        return
      }

      // Handle text messages
      if (messageType === 'text' && message.content) {
        await this.handleTextMessage(connectionId, message.content)
        res.status(200).end()
        return
      }

      // Unknown message type - just acknowledge
      console.log(`ℹ️ Unhandled message type: ${messageType}`)
      res.status(200).end()
    } catch (error) {
      console.error('❌ Error processing message:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Handle profile message - create session and send welcome
   */
  private async handleProfileMessage(connectionId: string, displayName?: string): Promise<void> {
    console.log(`👤 Profile message from ${connectionId}${displayName ? ` (${displayName})` : ''}`)

    const isConfigured = liveAvatarService.isConfigured()

    if (!isConfigured) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `👋 Welcome! The Live Avatar demo is not fully configured yet. Please set up your HeyGen API credentials.`,
      })
      return
    }

    // Try to create session immediately
    let directSessionUrl: string | null = null
    let creditsExhausted = false

    try {
      console.log(`🎬 Creating LiveKit session for ${connectionId}...`)
      const { sessionToken } = await liveAvatarService.createSessionToken()
      const { livekitUrl, livekitToken } = await liveAvatarService.startSession(sessionToken)

      // Build direct LiveKit Meet URL
      directSessionUrl = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(livekitUrl)}&token=${encodeURIComponent(livekitToken)}`
      console.log(`✅ Session created for ${connectionId}`)
    } catch (sessionError) {
      const errorMessage = (sessionError as Error).message
      console.error(`⚠️ Failed to create session for ${connectionId}:`, sessionError)

      // Check if credits are exhausted
      if (errorMessage.includes('Insufficient credits')) {
        creditsExhausted = true
        console.log(`💳 Credits exhausted for ${connectionId}`)
      }
    }

    // Handle credits exhausted case
    if (creditsExhausted) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `👋 Hi! I'm the Live Avatar agent.\n\n⚠️ Unfortunately, the LiveAvatar API credits have been exhausted. Please contact the administrator to restore the service.\n\nWe apologize for the inconvenience!`,
      })
      console.log(`✅ Credits exhausted message sent to ${connectionId}`)
      return
    }

    // Send welcome message
    const welcomeMessage = directSessionUrl
      ? `👋 Hi, I'm the live avatar agent. Let's start your live avatar session and click open to start.`
      : `👋 Welcome! I'm your Live Avatar assistant.\n\nTap the link below to start a video conversation with me!`

    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: welcomeMessage,
    })

    // Send session link (direct or fallback to /avatar)
    const config = getAppConfig()
    const sessionUrl = directSessionUrl ?? `${config.publicUrl}/avatar`

    await vsAgentService.sendMessage(connectionId, {
      type: 'media',
      connectionId,
      items: [
        {
          mimeType: 'text/html',
          uri: sessionUrl,
          title: '🎭 Open Live Avatar',
          description: 'Tap to start your video conversation',
          openingMode: 'fullScreen',
        },
      ],
    })

    console.log(
      `✅ Welcome sent to ${connectionId}${directSessionUrl ? ' (direct session)' : ' (fallback)'}`
    )
  }

  /**
   * Handle text message - process commands
   */
  private async handleTextMessage(connectionId: string, content: string): Promise<void> {
    const normalizedContent = content.toLowerCase().trim()
    console.log(`💬 Text message from ${connectionId}: ${normalizedContent}`)

    const config = getAppConfig()
    const avatarLink = `${config.publicUrl}/avatar`

    let responseContent: string
    let sendAvatarLink = false

    // Handle commands
    if (
      normalizedContent === '/start' ||
      normalizedContent === '/avatar' ||
      normalizedContent === 'start'
    ) {
      if (liveAvatarService.isConfigured()) {
        responseContent = `🎭 Great! Let's start your Live Avatar session.\n\nTap the link below to begin:`
        sendAvatarLink = true
      } else {
        responseContent = `⚠️ The Live Avatar is not configured. Please set up your HeyGen API credentials in the .env file.`
      }
    } else if (normalizedContent === '/help' || normalizedContent === 'help') {
      responseContent = `🤖 **Live Avatar Agent Commands:**\n\n• \`/start\` - Start a video avatar session\n• \`/help\` - Show this help message\n\nOr just say "start" to begin!`
    } else {
      // Default response
      responseContent = `👋 Hi! I'm the Live Avatar agent.\n\nSay \`start\` or \`/start\` to begin a video conversation with the avatar!`
    }

    // Send text response
    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: responseContent,
    })

    // Send avatar link if needed
    if (sendAvatarLink) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'media',
        connectionId,
        items: [
          {
            mimeType: 'text/html',
            uri: avatarLink,
            title: '🎭 Start Live Avatar',
            description: 'Tap to start a video conversation',
            openingMode: 'fullScreen',
          },
        ],
      })
    }
  }
}
