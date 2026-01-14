import { Request, Response } from 'express'

/**
 * Health check controller
 */
export class HealthController {
  static getHealth(req: Request, res: Response): void {
    res.json({
      status: 'ok',
      service: 'liveavatar-agent',
      timestamp: new Date().toISOString(),
    })
  }
}
