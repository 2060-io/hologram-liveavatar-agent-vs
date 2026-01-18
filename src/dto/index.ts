/**
 * DTO definitions for VS Agent webhook payloads
 */

export interface MessageReceivedDto {
  message: {
    connectionId: string
    type: string
    content?: string
    threadId?: string
    // Profile message fields
    displayName?: string
    displayImageUrl?: string
    displayIconUrl?: string
    preferredLanguage?: string
  }
}

export interface ConnectionEstablishedDto {
  connectionId: string
  language?: string
}
