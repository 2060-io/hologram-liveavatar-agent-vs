import dotenv from 'dotenv'
dotenv.config()

export interface AppConfig {
  port: number
  vsAgentUrl: string
  publicUrl: string
  liveavatar: {
    apiKey: string
    apiUrl: string
    avatarId: string
    voiceId: string
    contextId: string
    language: string
  }
}

export function getAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '4001', 10),
    vsAgentUrl: process.env.VS_AGENT_URL || 'http://localhost:3000',
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:4001',
    liveavatar: {
      apiKey: process.env.LIVEAVATAR_API_KEY || '',
      apiUrl: process.env.LIVEAVATAR_API_URL || 'https://api.liveavatar.com',
      avatarId: process.env.LIVEAVATAR_AVATAR_ID || '',
      voiceId: process.env.LIVEAVATAR_VOICE_ID || '',
      contextId: process.env.LIVEAVATAR_CONTEXT_ID || '',
      language: process.env.LIVEAVATAR_LANGUAGE || 'en',
    },
  }
}
