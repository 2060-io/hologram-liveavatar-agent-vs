export interface AvatarConfig {
  id: string
  connectionId: string
  name: string
  avatarId: string
  voiceId: string
  language: string
  systemPrompt: string | null
  credentialDefinitionId: string | null
  credentialIssuedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAvatarConfigInput {
  connectionId: string
  name: string
  avatarId: string
  voiceId: string
  language: string
  systemPrompt?: string | null
}

export interface UpdateAvatarConfigInput {
  name?: string
  avatarId?: string
  voiceId?: string
  language?: string
  systemPrompt?: string | null
  credentialDefinitionId?: string | null
  credentialIssuedAt?: Date | null
}

export type WizardStep =
  | 'avatar_selection'
  | 'avatar_manual_entry'
  | 'voice_selection'
  | 'voice_manual_entry'
  | 'language_selection'
  | 'name_input'
  | 'prompt_input'
  | 'confirmation'

export interface AvatarCreationSession {
  connectionId: string
  currentStep: WizardStep
  selectedAvatarId: string | null
  selectedVoiceId: string | null
  selectedLanguage: string | null
  customName: string | null
  systemPrompt: string | null
  startedAt: Date
  expiresAt: Date | null
}

export interface CreateSessionInput {
  connectionId: string
  currentStep: WizardStep
}

export interface UpdateSessionInput {
  currentStep?: WizardStep
  selectedAvatarId?: string | null
  selectedVoiceId?: string | null
  selectedLanguage?: string | null
  customName?: string | null
  systemPrompt?: string | null
  expiresAt?: Date | null
}

export type PresentationStatus = 'pending' | 'verified' | 'rejected' | 'expired'

export interface PendingPresentation {
  id: string
  proofExchangeId: string
  connectionId: string | null
  avatarConfigId: string
  status: PresentationStatus
  createdAt: Date
  expiresAt: Date | null
  verifiedAt: Date | null
}

export interface CreatePresentationInput {
  proofExchangeId: string
  connectionId?: string | null
  avatarConfigId: string
  expiresAt?: Date | null
}

export interface UpdatePresentationInput {
  connectionId?: string | null
  status?: PresentationStatus
  verifiedAt?: Date | null
}
