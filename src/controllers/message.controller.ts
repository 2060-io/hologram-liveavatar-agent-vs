import { Request, Response } from 'express'
import { MessageReceivedDto } from '../dto'
import { getAppConfig } from '../config'
import { liveAvatarService, vsAgentService, avatarWizardService, credentialService } from '../services'
import { avatarConfigRepository, presentationRepository } from '../database/repositories'

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

      // Handle credential reception acknowledgment
      if (messageType === 'credential-reception') {
        await this.handleCredentialReception(connectionId, message)
        res.status(200).end()
        return
      }

      // Handle identity proof submission
      if (messageType === 'identity-proof-submit') {
        await this.handleIdentityProofSubmit(connectionId, message)
        res.status(200).end()
        return
      }

      // Unknown message type - just acknowledge
      console.log(`Unhandled message type: ${messageType}`)
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
    console.log(`Text message from ${connectionId}: ${normalizedContent}`)

    const config = getAppConfig()
    const avatarLink = `${config.publicUrl}/avatar`

    // Check if user has active wizard session
    const hasWizardSession = await avatarWizardService.hasActiveSession(connectionId)

    // If in wizard session and not a command, process wizard input
    if (hasWizardSession && !normalizedContent.startsWith('/')) {
      await this.handleWizardInput(connectionId, content)
      return
    }

    // Handle commands
    if (normalizedContent === '/create' || normalizedContent === 'create') {
      await this.handleCreateCommand(connectionId)
      return
    }

    if (normalizedContent === '/cancel' || normalizedContent === 'cancel') {
      if (hasWizardSession) {
        const result = await avatarWizardService.cancelWizard(connectionId)
        await vsAgentService.sendMessage(connectionId, {
          type: 'text',
          connectionId,
          content: result.message,
        })
      } else {
        await vsAgentService.sendMessage(connectionId, {
          type: 'text',
          connectionId,
          content: 'No active creation session to cancel.',
        })
      }
      return
    }

    if (normalizedContent === '/my-avatars' || normalizedContent === 'my-avatars') {
      await this.handleMyAvatarsCommand(connectionId)
      return
    }

    if (normalizedContent.startsWith('/access ') || normalizedContent.startsWith('access ')) {
      const avatarName = content.replace(/^\/?access\s+/i, '').trim()
      await this.handleAccessCommand(connectionId, avatarName)
      return
    }

    if (
      normalizedContent === '/start' ||
      normalizedContent === '/avatar' ||
      normalizedContent === 'start'
    ) {
      await this.handleStartCommand(connectionId, avatarLink)
      return
    }

    if (normalizedContent === '/help' || normalizedContent === 'help') {
      await this.handleHelpCommand(connectionId)
      return
    }

    // Default response - if wizard session exists, process as wizard input
    if (hasWizardSession) {
      await this.handleWizardInput(connectionId, content)
    } else {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Hi! I'm the Live Avatar agent.\n\nCommands:\n/start - Start default avatar session\n/create - Create your own custom avatar\n/my-avatars - List your avatars\n/access <name> - Access your custom avatar\n/help - Show all commands`,
      })
    }
  }

  private async handleWizardInput(connectionId: string, input: string): Promise<void> {
    const result = await avatarWizardService.processInput(connectionId, input)

    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: result.message,
    })

    // If wizard is complete, trigger credential issuance
    if (result.isComplete && result.avatarConfig) {
      console.log(`Avatar created for ${connectionId}: ${result.avatarConfig.name}`)

      // Issue ownership credential if credential service is configured
      if (credentialService.isConfigured()) {
        try {
          await credentialService.issueAvatarCredential(result.avatarConfig)
          await vsAgentService.sendMessage(connectionId, {
            type: 'text',
            connectionId,
            content: `Issuing ownership credential for "${result.avatarConfig.name}"...\n\nYou will receive it shortly in your wallet.`,
          })
        } catch (error) {
          console.error('Failed to issue credential:', error)
          await vsAgentService.sendMessage(connectionId, {
            type: 'text',
            connectionId,
            content: `Your avatar "${result.avatarConfig.name}" has been created!\n\nNote: Credential issuance failed, but you can still access your avatar.\n\n/access ${result.avatarConfig.name}`,
          })
        }
      } else {
        await vsAgentService.sendMessage(connectionId, {
          type: 'text',
          connectionId,
          content: `Your avatar "${result.avatarConfig.name}" has been created!\n\nTo start a session with your avatar:\n/access ${result.avatarConfig.name}`,
        })
      }
    }
  }

  private async handleCredentialReception(
    connectionId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    const state = message.state as string
    console.log(`Credential reception for ${connectionId}: state=${state}`)

    if (state === 'done') {
      // Find the avatar that was just issued a credential
      const avatars = await avatarConfigRepository.findByConnectionId(connectionId)
      const pendingAvatar = avatars.find(
        (a) => a.credentialDefinitionId && !a.credentialIssuedAt
      )

      if (pendingAvatar) {
        await avatarConfigRepository.update(pendingAvatar.id, {
          credentialIssuedAt: new Date(),
        })

        await vsAgentService.sendMessage(connectionId, {
          type: 'text',
          connectionId,
          content: `Ownership credential issued for "${pendingAvatar.name}"!\n\nYou can now use:\n/access ${pendingAvatar.name}`,
        })
      }
    } else if (state === 'declined' || state === 'abandoned') {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Credential offer was ${state}. Your avatar is still available.\n\nUse /my-avatars to see your avatars.`,
      })
    }
  }

  private async handleIdentityProofSubmit(
    connectionId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    const submittedProofItems = message.submittedProofItems as Array<{
      verified: boolean
      claims?: Array<{ name: string; value: string }>
    }> | undefined

    console.log(`Identity proof submit from ${connectionId}`)

    if (!submittedProofItems || submittedProofItems.length === 0) {
      console.log('No proof items in submission')
      return
    }

    const proofItem = submittedProofItems[0]

    if (!proofItem.verified) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'Credential verification failed. Please try again with a valid credential.',
      })
      return
    }

    // Extract avatar config ID from claims
    const avatarConfigIdClaim = proofItem.claims?.find((c) => c.name === 'avatar_config_id')
    const ownerConnectionIdClaim = proofItem.claims?.find((c) => c.name === 'owner_connection_id')

    if (!avatarConfigIdClaim?.value) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'Invalid credential: missing avatar configuration.',
      })
      return
    }

    // Verify ownership
    if (ownerConnectionIdClaim?.value !== connectionId) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'This credential belongs to a different user.',
      })
      return
    }

    // Find the avatar config
    const avatarConfig = await avatarConfigRepository.findById(avatarConfigIdClaim.value)

    if (!avatarConfig) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'Avatar configuration not found.',
      })
      return
    }

    // Start the avatar session
    try {
      const { livekitUrl, livekitToken } = await liveAvatarService.createCustomSession({
        avatarId: avatarConfig.avatarId,
        voiceId: avatarConfig.voiceId,
        language: avatarConfig.language,
        systemPrompt: avatarConfig.systemPrompt,
      })

      const sessionUrl = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(livekitUrl)}&token=${encodeURIComponent(livekitToken)}`

      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Credential verified! Starting session with "${avatarConfig.name}"...`,
      })

      await vsAgentService.sendMessage(connectionId, {
        type: 'media',
        connectionId,
        items: [
          {
            mimeType: 'text/html',
            uri: sessionUrl,
            title: `Start ${avatarConfig.name}`,
            description: 'Your custom avatar session is ready',
            openingMode: 'fullScreen',
          },
        ],
      })
    } catch (error) {
      console.error('Failed to create custom session after verification:', error)
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Failed to start session: ${(error as Error).message}`,
      })
    }
  }

  private async handleCreateCommand(connectionId: string): Promise<void> {
    if (!liveAvatarService.hasApiKey()) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'Avatar creation requires HeyGen API credentials. Please configure them first.',
      })
      return
    }

    const result = await avatarWizardService.startWizard(connectionId)

    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: result.message,
    })
  }

  private async handleMyAvatarsCommand(connectionId: string): Promise<void> {
    const avatars = await avatarConfigRepository.findByConnectionId(connectionId)

    if (avatars.length === 0) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `You haven't created any avatars yet.\n\nUse /create to build your first custom avatar!`,
      })
      return
    }

    const avatarList = avatars
      .map((a, i) => `${i + 1}. ${a.name} (${a.language})`)
      .join('\n')

    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: `Your Custom Avatars:\n\n${avatarList}\n\nUse "/access <name>" to start a session with any avatar.`,
    })
  }

  private async handleAccessCommand(connectionId: string, avatarName: string): Promise<void> {
    if (!avatarName) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: 'Please specify an avatar name. Example: /access Business Helper',
      })
      return
    }

    const avatar = await avatarConfigRepository.findByConnectionIdAndName(connectionId, avatarName)

    if (!avatar) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Avatar "${avatarName}" not found.\n\nUse /my-avatars to see your available avatars.`,
      })
      return
    }

    // If credential is issued and credential service is configured, request verification
    if (credentialService.isConfigured() && avatar.credentialIssuedAt) {
      try {
        await vsAgentService.sendMessage(connectionId, {
          type: 'text',
          connectionId,
          content: `To access "${avatar.name}", please present your ownership credential.`,
        })

        await credentialService.requestIdentityProof(
          connectionId,
          avatar.id,
          `Present your ownership credential for "${avatar.name}"`
        )

        console.log(`Identity proof requested for avatar ${avatar.id} from ${connectionId}`)
        return
      } catch (error) {
        console.error('Failed to request identity proof:', error)
        // Fall back to direct access
      }
    }

    // Direct access (no credential verification)
    await this.startCustomAvatarSession(connectionId, avatar)
  }

  private async startCustomAvatarSession(
    connectionId: string,
    avatar: { id: string; name: string; avatarId: string; voiceId: string; language: string; systemPrompt: string | null }
  ): Promise<void> {
    try {
      const { livekitUrl, livekitToken } = await liveAvatarService.createCustomSession({
        avatarId: avatar.avatarId,
        voiceId: avatar.voiceId,
        language: avatar.language,
        systemPrompt: avatar.systemPrompt,
      })

      const sessionUrl = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(livekitUrl)}&token=${encodeURIComponent(livekitToken)}`

      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Starting session with "${avatar.name}"...`,
      })

      await vsAgentService.sendMessage(connectionId, {
        type: 'media',
        connectionId,
        items: [
          {
            mimeType: 'text/html',
            uri: sessionUrl,
            title: `Start ${avatar.name}`,
            description: 'Tap to begin your custom avatar session',
            openingMode: 'fullScreen',
          },
        ],
      })
    } catch (error) {
      console.error(`Error creating custom session:`, error)
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Failed to start session: ${(error as Error).message}`,
      })
    }
  }

  private async handleStartCommand(connectionId: string, avatarLink: string): Promise<void> {
    if (liveAvatarService.isConfigured()) {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `Great! Let's start your Live Avatar session.\n\nTap the link below to begin:`,
      })
      await vsAgentService.sendMessage(connectionId, {
        type: 'media',
        connectionId,
        items: [
          {
            mimeType: 'text/html',
            uri: avatarLink,
            title: 'Start Live Avatar',
            description: 'Tap to start a video conversation',
            openingMode: 'fullScreen',
          },
        ],
      })
    } else {
      await vsAgentService.sendMessage(connectionId, {
        type: 'text',
        connectionId,
        content: `The Live Avatar is not configured. Please set up your HeyGen API credentials in the .env file.`,
      })
    }
  }

  private async handleHelpCommand(connectionId: string): Promise<void> {
    await vsAgentService.sendMessage(connectionId, {
      type: 'text',
      connectionId,
      content: `**Live Avatar Agent Commands:**

/start - Start a session with the default avatar
/create - Create your own custom avatar
/my-avatars - List your custom avatars
/access <name> - Start a session with your custom avatar
/cancel - Cancel avatar creation wizard
/help - Show this help message

**Quick Tips:**
- Use /create to build a personalized avatar with your preferred appearance, voice, and personality
- Your custom avatars are saved and can be accessed anytime with /access`,
    })
  }
}
