import express from 'express'
import http from 'http'
import path from 'path'
import { Socket } from 'net'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { HealthController, MessageController, ConnectionController } from './controllers'
import { liveAvatarService, heygenCatalogService, credentialService } from './services'
import { getAppConfig } from './config'
import { avatarConfigRepository, presentationRepository } from './database/repositories'
import { initializeDatabase, closeDatabase } from './database'

const app = express()
const config = getAppConfig()
const port = config.port

// VS Agent endpoints
const vsAgentPublicUrl = config.vsAgentUrl.replace(/:3000(?:\/|$)/, ':3001')
const vsAgentWsUrl = vsAgentPublicUrl.replace(/^http/, 'ws')

// Initialize controllers
const messageController = new MessageController()
const connectionController = new ConnectionController()

// ============================================
// VS Agent Proxy (WebSocket only)
// ============================================

// WebSocket proxy for DIDComm - only handles upgrade requests
const wsProxy = createProxyMiddleware({
  target: vsAgentWsUrl,
  ws: true,
  changeOrigin: true,
  logger: console,
})

// Middleware
app.use(express.json({ limit: '5mb' }))
app.use(express.static(path.join(__dirname, '../public')))

// Proxy DID document
app.get('/.well-known/did.json', async (_req, res) => {
  try {
    const response = await fetch(`${vsAgentPublicUrl}/.well-known/did.json`)
    res.status(response.status)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('❌ Error proxying DID document:', error)
    res.status(500).json({ error: 'Failed to fetch DID document' })
  }
})

// Proxy verification templates
app.get('/vt/:file', async (req, res) => {
  try {
    const response = await fetch(`${vsAgentPublicUrl}/vt/${req.params.file}`)
    res.status(response.status)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('❌ Error proxying VT:', error)
    res.status(500).json({ error: 'Failed to fetch verification template' })
  }
})

// Proxy anoncreds
app.use('/anoncreds', async (req, res) => {
  try {
    const options: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body)
    }

    const response = await fetch(`${vsAgentPublicUrl}/anoncreds${req.url}`, options)
    res.status(response.status)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('❌ Error proxying anoncreds:', error)
    res.status(500).json({ error: 'Failed to proxy anoncreds' })
  }
})

// API Routes
app.get('/health', HealthController.getHealth)
app.post('/message-received', (req, res) => messageController.handleMessageReceived(req, res))
app.post('/connection-established', (req, res) =>
  connectionController.handleConnectionEstablished(req, res)
)

// API endpoint for session token (used by avatar frontend)
app.post('/api/session', async (req, res) => {
  try {
    if (!liveAvatarService.isConfigured()) {
      res.status(500).json({ error: 'LiveAvatar not configured. Please set API credentials.' })
      return
    }
    const session = await liveAvatarService.createSessionToken()
    res.json(session)
  } catch (error) {
    console.error('❌ Error creating session:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// API endpoint to start session (get LiveKit credentials)
app.post('/api/session/start', async (req, res) => {
  try {
    const { sessionToken } = req.body
    if (!sessionToken) {
      res.status(400).json({ error: 'sessionToken is required' })
      return
    }
    const sessionInfo = await liveAvatarService.startSession(sessionToken)
    res.json(sessionInfo)
  } catch (error) {
    console.error('❌ Error starting session:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Avatar page - create session and redirect directly to LiveKit Meet
app.get('/avatar', async (req, res) => {
  try {
    if (!liveAvatarService.isConfigured()) {
      res
        .status(500)
        .send(
          renderErrorPage(
            'Configuration Error',
            'LiveAvatar not configured. Please set API credentials.'
          )
        )
      return
    }

    // Create session token
    const { sessionToken } = await liveAvatarService.createSessionToken()

    // Start session to get LiveKit credentials
    const { livekitUrl, livekitToken } = await liveAvatarService.startSession(sessionToken)

    // Redirect directly to LiveKit Meet
    const livekitMeetUrl = `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(livekitUrl)}&token=${encodeURIComponent(livekitToken)}`
    res.redirect(livekitMeetUrl)
  } catch (error) {
    const errorMessage = (error as Error).message
    console.error('❌ Error creating avatar session:', error)

    // Check for specific error types
    if (errorMessage.includes('Insufficient credits')) {
      res
        .status(503)
        .send(
          renderErrorPage(
            'Credits Exhausted',
            'The LiveAvatar API has run out of credits. Please contact the administrator to add more credits to continue using this service.'
          )
        )
      return
    }

    res
      .status(500)
      .send(renderErrorPage('Session Error', `Unable to start avatar session: ${errorMessage}`))
  }
})

// Helper function to render a user-friendly error page
function renderErrorPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LiveAvatar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #fff; margin-bottom: 16px; font-size: 24px; }
    p { color: rgba(255, 255, 255, 0.8); line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      background: #6366f1;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      transition: background 0.2s;
    }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="javascript:window.close()" class="btn">Close</a>
  </div>
</body>
</html>
  `.trim()
}

// API endpoint to list available HeyGen avatars
app.get('/api/avatars', async (req, res) => {
  try {
    if (!heygenCatalogService.isConfigured()) {
      res.status(500).json({ error: 'HeyGen API not configured' })
      return
    }
    const avatars = await heygenCatalogService.listAvatars()
    res.json({ avatars })
  } catch (error) {
    console.error('Error listing avatars:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// API endpoint to list available HeyGen voices
app.get('/api/voices', async (req, res) => {
  try {
    if (!heygenCatalogService.isConfigured()) {
      res.status(500).json({ error: 'HeyGen API not configured' })
      return
    }
    const voices = await heygenCatalogService.listVoices()
    res.json({ voices })
  } catch (error) {
    console.error('Error listing voices:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// API endpoint to list user's avatar configurations
app.get('/api/my-avatars/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params
    const avatars = await avatarConfigRepository.findByConnectionId(connectionId)
    res.json({ avatars })
  } catch (error) {
    console.error('Error listing user avatars:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Credential presentation callback endpoint
app.post('/api/presentation/callback', async (req, res) => {
  try {
    const { proofExchangeId, verified, ref, claims } = req.body as {
      proofExchangeId: string
      verified: boolean
      ref?: string
      claims?: Array<{ name: string; value: string }>
    }

    console.log(`Presentation callback: proofExchangeId=${proofExchangeId}, verified=${verified}, ref=${ref}`)

    if (!verified) {
      // Update presentation status
      await presentationRepository.updateByProofExchangeId(proofExchangeId, {
        status: 'rejected',
      })
      res.status(200).json({ success: false, message: 'Verification failed' })
      return
    }

    // Find the pending presentation
    const presentation = await presentationRepository.findByProofExchangeId(proofExchangeId)

    if (!presentation) {
      console.log(`No pending presentation found for ${proofExchangeId}`)
      res.status(404).json({ error: 'Presentation not found' })
      return
    }

    // Update presentation status
    await presentationRepository.updateByProofExchangeId(proofExchangeId, {
      status: 'verified',
      verifiedAt: new Date(),
    })

    // Get avatar config from ref or presentation
    const avatarConfigId = ref || presentation.avatarConfigId
    const avatarConfig = await avatarConfigRepository.findById(avatarConfigId)

    if (!avatarConfig) {
      res.status(404).json({ error: 'Avatar config not found' })
      return
    }

    // Verify ownership via claims if available
    const ownerClaim = claims?.find((c) => c.name === 'owner_connection_id')
    if (ownerClaim && presentation.connectionId && ownerClaim.value !== presentation.connectionId) {
      res.status(403).json({ error: 'Credential does not belong to this user' })
      return
    }

    res.status(200).json({
      success: true,
      avatarConfigId: avatarConfig.id,
      avatarName: avatarConfig.name,
    })
  } catch (error) {
    console.error('Error in presentation callback:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Invitation page - redirect to Hologram's official invitation page
app.get('/invitation', async (req, res) => {
  try {
    // Fetch the invitation URL from VS Agent
    const response = await fetch(`${config.vsAgentUrl}/v1/invitation`)
    const data = (await response.json()) as { url?: string }

    if (data.url) {
      // Redirect to the official Hologram invitation page
      res.redirect(data.url)
    } else {
      res.status(500).send('Failed to get invitation URL')
    }
  } catch (error) {
    console.error('❌ Error fetching invitation:', error)
    res.status(500).send(`Error fetching invitation: ${(error as Error).message}`)
  }
})

// API endpoint to get invitation URL as JSON
app.get('/api/invitation', async (req, res) => {
  try {
    const response = await fetch(`${config.vsAgentUrl}/v1/invitation`)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('❌ Error fetching invitation:', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// Create HTTP server and attach WebSocket proxy
const server = http.createServer(app)

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade(req, socket as Socket, head)
})

// Bootstrap function to initialize database and start server
async function bootstrap() {
  try {
    // Initialize database
    await initializeDatabase()
    console.log('Database initialized')

    // Try to register credential type with VS Agent
    let credentialStatus = 'Not configured'
    try {
      await credentialService.registerCredentialType()
      credentialStatus = `Registered (${credentialService.getCredentialDefinitionId()?.substring(0, 20)}...)`
    } catch (credError) {
      console.log('Credential type registration skipped:', (credError as Error).message)
      if (config.credentials.avatarCredentialDefinitionId) {
        credentialStatus = `Using existing (${config.credentials.avatarCredentialDefinitionId.substring(0, 20)}...)`
      }
    }

    // Start server
    server.listen(port, () => {
      console.log(`
═══════════════════════════════════════════════════════════
   LiveAvatar Agent for Hologram - Custom Avatar Creation
═══════════════════════════════════════════════════════════

Server:     http://localhost:${port}
VS Agent:   ${config.vsAgentUrl}
Public:     ${config.publicUrl}
Database:   ${config.databaseUrl.split('@')[1] || 'configured'}

Configuration:
   LiveAvatar API: ${liveAvatarService.isConfigured() ? 'Configured' : 'Not configured'}
   WebSocket Proxy: Enabled (-> ${vsAgentWsUrl})
   PostgreSQL: Connected
   Credentials: ${credentialStatus}

Commands:
   /create      - Create custom avatar
   /my-avatars  - List your avatars
   /access      - Access custom avatar
   /start       - Start default avatar
   /help        - Show all commands

API Endpoints:
   GET  /health                - Health check
   GET  /avatar                - Default avatar session
   GET  /invitation            - Connection QR code
   GET  /api/avatars           - List HeyGen avatars
   GET  /api/voices            - List HeyGen voices
   GET  /api/my-avatars/:id    - User's custom avatars
   POST /api/presentation/callback - Credential verification

To connect: Open ${config.publicUrl}/invitation in browser
═══════════════════════════════════════════════════════════
      `)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle cleanup on exit
async function shutdown() {
  console.log('\n🛑 Shutting down...')
  await closeDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Start the application
bootstrap()
