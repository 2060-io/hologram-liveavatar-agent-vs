import { v4 as uuidv4 } from 'uuid'
import { getAppConfig } from '../config'
import { AvatarConfig } from '../models/avatar-config.model'
import { avatarConfigRepository } from '../database/repositories'

const CREDENTIAL_SCHEMA_NAME = 'HologramAvatarOwnership'
const CREDENTIAL_VERSION = '1.0.0'
const CREDENTIAL_ATTRIBUTES = [
  'avatar_config_id',
  'avatar_name',
  'owner_connection_id',
  'heygen_avatar_id',
  'heygen_voice_id',
  'language',
  'created_at',
  'issuer_did',
]

interface CredentialTypeResponse {
  id: string
}

interface PresentationRequestResponse {
  proofExchangeId: string
  shortUrl?: string
}

export class CredentialService {
  private credentialDefinitionId: string | null = null

  constructor() {
    const config = getAppConfig()
    // Use stored credential definition ID if available
    if (config.credentials.avatarCredentialDefinitionId) {
      this.credentialDefinitionId = config.credentials.avatarCredentialDefinitionId
    }
  }

  getCredentialDefinitionId(): string | null {
    return this.credentialDefinitionId
  }

  async registerCredentialType(): Promise<string> {
    const config = getAppConfig()

    // If already have a credential definition ID, use it
    if (config.credentials.avatarCredentialDefinitionId) {
      this.credentialDefinitionId = config.credentials.avatarCredentialDefinitionId
      console.log(`Using existing credential definition: ${this.credentialDefinitionId}`)
      return this.credentialDefinitionId
    }

    console.log('Registering avatar ownership credential type with VS Agent...')

    try {
      const response = await fetch(`${config.vsAgentUrl}/credential-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: CREDENTIAL_SCHEMA_NAME,
          version: CREDENTIAL_VERSION,
          attributes: CREDENTIAL_ATTRIBUTES,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to register credential type: ${errorText}`)
      }

      const data = (await response.json()) as CredentialTypeResponse
      this.credentialDefinitionId = data.id

      console.log(`Credential type registered: ${this.credentialDefinitionId}`)
      console.log(`IMPORTANT: Add this to your .env file:`)
      console.log(`AVATAR_CREDENTIAL_DEFINITION_ID=${this.credentialDefinitionId}`)

      return this.credentialDefinitionId
    } catch (error) {
      console.error('Failed to register credential type:', error)
      throw error
    }
  }

  async issueAvatarCredential(avatarConfig: AvatarConfig): Promise<void> {
    if (!this.credentialDefinitionId) {
      throw new Error('Credential definition not registered. Call registerCredentialType first.')
    }

    const config = getAppConfig()
    const issuerDid = config.credentials.issuerDid || 'unknown'

    console.log(`Issuing credential for avatar ${avatarConfig.id} to ${avatarConfig.connectionId}...`)

    const claims = [
      { name: 'avatar_config_id', mimeType: 'text/plain', value: avatarConfig.id },
      { name: 'avatar_name', mimeType: 'text/plain', value: avatarConfig.name },
      { name: 'owner_connection_id', mimeType: 'text/plain', value: avatarConfig.connectionId },
      { name: 'heygen_avatar_id', mimeType: 'text/plain', value: avatarConfig.avatarId },
      { name: 'heygen_voice_id', mimeType: 'text/plain', value: avatarConfig.voiceId },
      { name: 'language', mimeType: 'text/plain', value: avatarConfig.language },
      { name: 'created_at', mimeType: 'text/plain', value: avatarConfig.createdAt.toISOString() },
      { name: 'issuer_did', mimeType: 'text/plain', value: issuerDid },
    ]

    const response = await fetch(`${config.vsAgentUrl}/v1/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId: avatarConfig.connectionId,
        type: 'credential-issuance',
        credentialDefinitionId: this.credentialDefinitionId,
        claims,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to issue credential: ${errorText}`)
    }

    // Update avatar config with credential definition ID
    await avatarConfigRepository.update(avatarConfig.id, {
      credentialDefinitionId: this.credentialDefinitionId,
    })

    console.log(`Credential issuance initiated for avatar ${avatarConfig.id}`)
  }

  async requestIdentityProof(
    connectionId: string,
    avatarConfigId: string,
    description: string = 'Present your avatar ownership credential'
  ): Promise<void> {
    if (!this.credentialDefinitionId) {
      throw new Error('Credential definition not registered. Call registerCredentialType first.')
    }

    const config = getAppConfig()

    const proofItem = {
      id: uuidv4(),
      type: 'verifiable-credential',
      description,
      credentialDefinitionId: this.credentialDefinitionId,
      attributes: ['avatar_config_id', 'avatar_name', 'owner_connection_id'],
    }

    const response = await fetch(`${config.vsAgentUrl}/v1/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId,
        type: 'identity-proof-request',
        requestedProofItems: [proofItem],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to request identity proof: ${errorText}`)
    }

    console.log(`Identity proof request sent to ${connectionId} for avatar ${avatarConfigId}`)
  }

  async createPresentationRequest(
    avatarConfigId: string
  ): Promise<PresentationRequestResponse> {
    if (!this.credentialDefinitionId) {
      throw new Error('Credential definition not registered.')
    }

    const config = getAppConfig()

    const response = await fetch(`${config.vsAgentUrl}/invitation/presentation-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callbackUrl: `${config.publicUrl}/api/presentation/callback`,
        ref: avatarConfigId,
        requestedCredentials: [
          {
            credentialDefinitionId: this.credentialDefinitionId,
            attributes: ['avatar_config_id', 'owner_connection_id'],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create presentation request: ${errorText}`)
    }

    const data = (await response.json()) as PresentationRequestResponse
    return data
  }

  isConfigured(): boolean {
    return !!this.credentialDefinitionId
  }
}

export const credentialService = new CredentialService()
