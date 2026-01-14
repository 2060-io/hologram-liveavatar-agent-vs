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
   */
  async handleMessageReceived(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as MessageReceivedDto

      // Input validation
      if (!body?.message?.content || !body?.message?.connectionId) {
        console.error('❌ Invalid message payload:', JSON.stringify(body))
        res.status(400).json({ error: 'Invalid message payload' })
        return
      }

      const message = body.message
      const connectionId = message.connectionId
      const content = message.content.toLowerCase().trim()

      console.log(`📨 Message received from ${connectionId}: ${content}`)

      const config = getAppConfig()
      const avatarLink = `${config.publicUrl}/avatar`

      let responseContent: string
      let sendAvatarLink = false

      // Handle commands
      if (content === '/start' || content === '/avatar' || content === 'start') {
        if (liveAvatarService.isConfigured()) {
          responseContent = `🎭 Great! Let's start your Live Avatar session.\n\nTap the link below to begin:`
          sendAvatarLink = true
        } else {
          responseContent = `⚠️ The Live Avatar is not configured. Please set up your HeyGen API credentials in the .env file.`
        }
      } else if (content === '/help' || content === 'help') {
        responseContent = `🤖 **Live Avatar Agent Commands:**\n\n• \`/start\` - Start a video avatar session\n• \`/help\` - Show this help message\n\nOr just say "start" to begin!`
      } else {
        // Default response
        responseContent = `👋 Hi! I'm the Live Avatar agent.\n\nSay \`start\` or \`/start\` to begin a video conversation with the avatar!`
      }

      // Send text response using shared service
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

      res.status(200).end()
    } catch (error) {
      console.error('❌ Error processing message:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
