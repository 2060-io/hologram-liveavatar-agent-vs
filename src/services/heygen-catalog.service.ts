import { getAppConfig } from '../config'

export interface HeyGenAvatar {
  id: string
  name: string
  previewUrl: string
  gender: string
  type: string
}

export interface HeyGenVoice {
  id: string
  name: string
  language: string
  gender: string
  previewUrl: string
}

interface CachedData<T> {
  data: T
  expiresAt: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

export class HeyGenCatalogService {
  private config = getAppConfig().liveavatar
  private avatarsCache: CachedData<HeyGenAvatar[]> | null = null
  private voicesCache: CachedData<HeyGenVoice[]> | null = null

  async listAvatars(): Promise<HeyGenAvatar[]> {
    // Check cache
    if (this.avatarsCache && Date.now() < this.avatarsCache.expiresAt) {
      return this.avatarsCache.data
    }

    // LiveAvatar API doesn't support listing - return configured default + manual entry option
    const avatars: HeyGenAvatar[] = []

    // Add the configured default avatar
    if (this.config.avatarId) {
      avatars.push({
        id: this.config.avatarId,
        name: 'Default Avatar (from config)',
        previewUrl: '',
        gender: 'unknown',
        type: 'configured',
      })
    }

    // Add a manual entry option marker
    avatars.push({
      id: 'MANUAL_ENTRY',
      name: 'Enter avatar ID manually',
      previewUrl: '',
      gender: 'unknown',
      type: 'manual',
    })

    // Update cache
    this.avatarsCache = {
      data: avatars,
      expiresAt: Date.now() + CACHE_TTL,
    }

    return avatars
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    // Check cache
    if (this.voicesCache && Date.now() < this.voicesCache.expiresAt) {
      return this.voicesCache.data
    }

    // LiveAvatar API doesn't support listing - return configured default + manual entry option
    const voices: HeyGenVoice[] = []

    // Add the configured default voice
    if (this.config.voiceId) {
      voices.push({
        id: this.config.voiceId,
        name: 'Default Voice (from config)',
        language: this.config.language || 'en',
        gender: 'unknown',
        previewUrl: '',
      })
    }

    // Add a manual entry option marker
    voices.push({
      id: 'MANUAL_ENTRY',
      name: 'Enter voice ID manually',
      language: 'any',
      gender: 'unknown',
      previewUrl: '',
    })

    // Update cache
    this.voicesCache = {
      data: voices,
      expiresAt: Date.now() + CACHE_TTL,
    }

    return voices
  }

  async getAvatarById(avatarId: string): Promise<HeyGenAvatar | null> {
    // Return a placeholder for any valid ID
    if (avatarId && avatarId !== 'MANUAL_ENTRY') {
      return {
        id: avatarId,
        name: avatarId === this.config.avatarId ? 'Default Avatar' : `Avatar ${avatarId.substring(0, 8)}...`,
        previewUrl: '',
        gender: 'unknown',
        type: 'custom',
      }
    }
    return null
  }

  async getVoiceById(voiceId: string): Promise<HeyGenVoice | null> {
    // Return a placeholder for any valid ID
    if (voiceId && voiceId !== 'MANUAL_ENTRY') {
      return {
        id: voiceId,
        name: voiceId === this.config.voiceId ? 'Default Voice' : `Voice ${voiceId.substring(0, 8)}...`,
        language: this.config.language || 'en',
        gender: 'unknown',
        previewUrl: '',
      }
    }
    return null
  }

  clearCache(): void {
    this.avatarsCache = null
    this.voicesCache = null
  }

  isConfigured(): boolean {
    return !!this.config.apiKey
  }
}

export const heygenCatalogService = new HeyGenCatalogService()
