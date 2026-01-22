import { v4 as uuidv4 } from 'uuid'
import {
  AvatarCreationSession,
  WizardStep,
  AvatarConfig,
} from '../models/avatar-config.model'
import {
  creationSessionRepository,
  avatarConfigRepository,
} from '../database/repositories'
import { heygenCatalogService, HeyGenAvatar, HeyGenVoice } from './heygen-catalog.service'

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
]

export interface WizardResponse {
  message: string
  isComplete?: boolean
  avatarConfig?: AvatarConfig
  sessionEnded?: boolean
}

export class AvatarWizardService {
  private avatarsCache: HeyGenAvatar[] | null = null
  private voicesCache: HeyGenVoice[] | null = null

  async startWizard(connectionId: string): Promise<WizardResponse> {
    // Create or reset session
    await creationSessionRepository.create({
      connectionId,
      currentStep: 'avatar_selection',
    })

    // Fetch avatars for the first step
    try {
      this.avatarsCache = await heygenCatalogService.listAvatars()
    } catch (error) {
      return {
        message: `Failed to load avatars. Please try again later.\nError: ${(error as Error).message}`,
        sessionEnded: true,
      }
    }

    const avatarList = this.formatAvatarList(this.avatarsCache.slice(0, 20))

    return {
      message: `Welcome to Avatar Creation! Let's build your personalized AI avatar.\n\nStep 1/5: Choose Your Avatar Appearance\n\n${avatarList}\n\nReply with the number of your choice (e.g., "1")`,
    }
  }

  async processInput(connectionId: string, input: string): Promise<WizardResponse> {
    const session = await creationSessionRepository.findByConnectionId(connectionId)

    if (!session) {
      return {
        message: 'No active creation session. Use /create to start creating an avatar.',
        sessionEnded: true,
      }
    }

    const trimmedInput = input.trim().toLowerCase()

    // Handle cancel command
    if (trimmedInput === 'cancel' || trimmedInput === '/cancel') {
      await creationSessionRepository.delete(connectionId)
      return {
        message: 'Avatar creation cancelled.',
        sessionEnded: true,
      }
    }

    // Process based on current step
    switch (session.currentStep) {
      case 'avatar_selection':
        return this.handleAvatarSelection(connectionId, session, input)
      case 'avatar_manual_entry':
        return this.handleAvatarManualEntry(connectionId, session, input)
      case 'voice_selection':
        return this.handleVoiceSelection(connectionId, session, input)
      case 'voice_manual_entry':
        return this.handleVoiceManualEntry(connectionId, session, input)
      case 'language_selection':
        return this.handleLanguageSelection(connectionId, session, input)
      case 'name_input':
        return this.handleNameInput(connectionId, session, input)
      case 'prompt_input':
        return this.handlePromptInput(connectionId, session, input)
      case 'confirmation':
        return this.handleConfirmation(connectionId, session, input)
      default:
        return {
          message: 'Unknown step. Please use /cancel and start again.',
          sessionEnded: true,
        }
    }
  }

  async cancelWizard(connectionId: string): Promise<WizardResponse> {
    const session = await creationSessionRepository.findByConnectionId(connectionId)
    if (session) {
      await creationSessionRepository.delete(connectionId)
      return { message: 'Avatar creation cancelled.', sessionEnded: true }
    }
    return { message: 'No active creation session.', sessionEnded: true }
  }

  async hasActiveSession(connectionId: string): Promise<boolean> {
    const session = await creationSessionRepository.findByConnectionId(connectionId)
    return session !== null
  }

  private async handleAvatarSelection(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const selection = parseInt(input.trim(), 10)

    if (!this.avatarsCache) {
      this.avatarsCache = await heygenCatalogService.listAvatars()
    }

    const availableAvatars = this.avatarsCache.slice(0, 20)

    if (isNaN(selection) || selection < 1 || selection > availableAvatars.length) {
      return {
        message: `Please enter a valid number between 1 and ${availableAvatars.length}.`,
      }
    }

    const selectedAvatar = availableAvatars[selection - 1]

    // Check if manual entry was selected
    if (selectedAvatar.id === 'MANUAL_ENTRY') {
      await creationSessionRepository.update(connectionId, {
        currentStep: 'avatar_manual_entry',
      })
      return {
        message: `Step 1/5: Enter Avatar ID\n\nPlease enter your HeyGen avatar ID (e.g., "9650a758-1085-4d49-8bf3-f347565ec229"):`,
      }
    }

    await creationSessionRepository.update(connectionId, {
      selectedAvatarId: selectedAvatar.id,
      currentStep: 'voice_selection',
    })

    // Fetch voices for next step
    this.voicesCache = await heygenCatalogService.listVoices()
    const voiceList = this.formatVoiceList(this.voicesCache.slice(0, 20))

    return {
      message: `Avatar: ${selectedAvatar.name} selected.\n\nStep 2/5: Choose a Voice\n\n${voiceList}\n\nReply with the number of your choice.`,
    }
  }

  private async handleAvatarManualEntry(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const avatarId = input.trim()

    // Basic UUID validation
    if (!avatarId || avatarId.length < 8) {
      return {
        message: 'Please enter a valid avatar ID (should be a UUID like "9650a758-1085-4d49-8bf3-f347565ec229"):',
      }
    }

    await creationSessionRepository.update(connectionId, {
      selectedAvatarId: avatarId,
      currentStep: 'voice_selection',
    })

    this.voicesCache = await heygenCatalogService.listVoices()
    const voiceList = this.formatVoiceList(this.voicesCache.slice(0, 20))

    return {
      message: `Avatar ID: ${avatarId} set.\n\nStep 2/5: Choose a Voice\n\n${voiceList}\n\nReply with the number of your choice.`,
    }
  }

  private async handleVoiceSelection(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const selection = parseInt(input.trim(), 10)

    if (!this.voicesCache) {
      this.voicesCache = await heygenCatalogService.listVoices()
    }

    const availableVoices = this.voicesCache.slice(0, 20)

    if (isNaN(selection) || selection < 1 || selection > availableVoices.length) {
      return {
        message: `Please enter a valid number between 1 and ${availableVoices.length}.`,
      }
    }

    const selectedVoice = availableVoices[selection - 1]

    // Check if manual entry was selected
    if (selectedVoice.id === 'MANUAL_ENTRY') {
      await creationSessionRepository.update(connectionId, {
        currentStep: 'voice_manual_entry',
      })
      return {
        message: `Step 2/5: Enter Voice ID\n\nPlease enter your HeyGen voice ID (e.g., "b952f553-f7f3-4e52-8625-86b4c415384f"):`,
      }
    }

    await creationSessionRepository.update(connectionId, {
      selectedVoiceId: selectedVoice.id,
      currentStep: 'language_selection',
    })

    const languageList = SUPPORTED_LANGUAGES.map((lang, i) => `${i + 1}. ${lang.name}`).join('\n')

    return {
      message: `Voice: ${selectedVoice.name} (${selectedVoice.language}) selected.\n\nStep 3/5: Select Language\n\n${languageList}\n\nReply with the number of your choice.`,
    }
  }

  private async handleVoiceManualEntry(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const voiceId = input.trim()

    // Basic UUID validation
    if (!voiceId || voiceId.length < 8) {
      return {
        message: 'Please enter a valid voice ID (should be a UUID like "b952f553-f7f3-4e52-8625-86b4c415384f"):',
      }
    }

    await creationSessionRepository.update(connectionId, {
      selectedVoiceId: voiceId,
      currentStep: 'language_selection',
    })

    const languageList = SUPPORTED_LANGUAGES.map((lang, i) => `${i + 1}. ${lang.name}`).join('\n')

    return {
      message: `Voice ID: ${voiceId} set.\n\nStep 3/5: Select Language\n\n${languageList}\n\nReply with the number of your choice.`,
    }
  }

  private async handleLanguageSelection(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const selection = parseInt(input.trim(), 10)

    if (isNaN(selection) || selection < 1 || selection > SUPPORTED_LANGUAGES.length) {
      return {
        message: `Please enter a valid number between 1 and ${SUPPORTED_LANGUAGES.length}.`,
      }
    }

    const selectedLanguage = SUPPORTED_LANGUAGES[selection - 1]

    await creationSessionRepository.update(connectionId, {
      selectedLanguage: selectedLanguage.code,
      currentStep: 'name_input',
    })

    return {
      message: `Language: ${selectedLanguage.name} selected.\n\nStep 4/5: Name Your Avatar\n\nGive your avatar a memorable name (e.g., "Business Helper", "Travel Guide").`,
    }
  }

  private async handleNameInput(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const name = input.trim()

    if (!name || name.length < 2) {
      return {
        message: 'Please enter a name with at least 2 characters.',
      }
    }

    if (name.length > 100) {
      return {
        message: 'Name is too long. Please use 100 characters or less.',
      }
    }

    // Check if name already exists for this user
    const existing = await avatarConfigRepository.findByConnectionIdAndName(connectionId, name)
    if (existing) {
      return {
        message: `You already have an avatar named "${name}". Please choose a different name.`,
      }
    }

    await creationSessionRepository.update(connectionId, {
      customName: name,
      currentStep: 'prompt_input',
    })

    return {
      message: `Name: "${name}" set.\n\nStep 5/5: Personality Prompt (Optional)\n\nDescribe how your avatar should behave (e.g., "You are a friendly business consultant who helps with strategy.").\n\nOr type "skip" to use the default personality.`,
    }
  }

  private async handlePromptInput(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const prompt = input.trim()
    const isSkip = prompt.toLowerCase() === 'skip'

    await creationSessionRepository.update(connectionId, {
      systemPrompt: isSkip ? null : prompt,
      currentStep: 'confirmation',
    })

    // Get updated session for summary
    const updatedSession = await creationSessionRepository.findByConnectionId(connectionId)
    if (!updatedSession) {
      return { message: 'Session expired. Please start again with /create.', sessionEnded: true }
    }

    // Get avatar and voice names
    const avatar = await heygenCatalogService.getAvatarById(updatedSession.selectedAvatarId!)
    const voice = await heygenCatalogService.getVoiceById(updatedSession.selectedVoiceId!)
    const language = SUPPORTED_LANGUAGES.find((l) => l.code === updatedSession.selectedLanguage)

    const promptSummary = isSkip ? '(Default)' : `"${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`

    return {
      message: `Configuration Complete!\n\nName: ${updatedSession.customName}\nAppearance: ${avatar?.name || updatedSession.selectedAvatarId}\nVoice: ${voice?.name || updatedSession.selectedVoiceId}\nLanguage: ${language?.name || updatedSession.selectedLanguage}\nPersonality: ${promptSummary}\n\nReply "confirm" to create your avatar and receive your ownership credential.\nReply "cancel" to discard.`,
    }
  }

  private async handleConfirmation(
    connectionId: string,
    session: AvatarCreationSession,
    input: string
  ): Promise<WizardResponse> {
    const confirmation = input.trim().toLowerCase()

    if (confirmation !== 'confirm' && confirmation !== 'yes') {
      if (confirmation === 'cancel' || confirmation === 'no') {
        await creationSessionRepository.delete(connectionId)
        return { message: 'Avatar creation cancelled.', sessionEnded: true }
      }
      return {
        message: 'Please reply "confirm" to create the avatar or "cancel" to discard.',
      }
    }

    // Validate session has all required fields
    if (
      !session.selectedAvatarId ||
      !session.selectedVoiceId ||
      !session.selectedLanguage ||
      !session.customName
    ) {
      return {
        message: 'Session is incomplete. Please start again with /create.',
        sessionEnded: true,
      }
    }

    // Create the avatar configuration
    const avatarConfig = await avatarConfigRepository.create({
      connectionId,
      name: session.customName,
      avatarId: session.selectedAvatarId,
      voiceId: session.selectedVoiceId,
      language: session.selectedLanguage,
      systemPrompt: session.systemPrompt,
    })

    // Clean up session
    await creationSessionRepository.delete(connectionId)

    return {
      message: `Creating your avatar "${avatarConfig.name}"...`,
      isComplete: true,
      avatarConfig,
    }
  }

  private formatAvatarList(avatars: HeyGenAvatar[]): string {
    return avatars
      .map((avatar, i) => `${i + 1}. ${avatar.name} (${avatar.gender})`)
      .join('\n')
  }

  private formatVoiceList(voices: HeyGenVoice[]): string {
    return voices
      .map((voice, i) => `${i + 1}. ${voice.name} (${voice.language}, ${voice.gender})`)
      .join('\n')
  }
}

export const avatarWizardService = new AvatarWizardService()
