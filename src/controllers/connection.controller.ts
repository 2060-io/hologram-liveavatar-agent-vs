import { Request, Response } from 'express'
import { ConnectionEstablishedDto } from '../dto'

/**
 * Connection controller - handles new user connections
 * Note: Welcome messages are sent via ProfileMessage handler in message.controller.ts
 */
export class ConnectionController {
  /**
   * POST /connection-established - Handle new connections from VS Agent
   * Just logs the connection - welcome flow is triggered by ProfileMessage
   */
  async handleConnectionEstablished(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as ConnectionEstablishedDto

      // Input validation
      if (!body?.connectionId) {
        console.error('❌ Invalid connection payload:', JSON.stringify(body))
        res.status(400).json({ error: 'Invalid connection payload' })
        return
      }

      const connectionId = body.connectionId
      console.log(`🤝 New connection established: ${connectionId}`)

      // Welcome message will be sent when ProfileMessage is received via /message-received
      res.status(200).json({ success: true })
    } catch (error) {
      console.error('❌ Error handling connection:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
