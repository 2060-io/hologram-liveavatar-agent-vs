/**
 * DTO definitions for VS Agent webhook payloads
 */

export interface MessageReceivedDto {
  message: {
    connectionId: string
    type: string
    content: string
    threadId?: string
  }
}

export interface ConnectionEstablishedDto {
  connectionId: string
  language?: string
}

export interface WelcomeResponseDto {
  message: string
  avatarLink: string
}
