import type { CommandProposal } from './registry'

export type Availability = 'available' | 'unavailable'
export type InputSource = 'text' | 'voice' | 'voice-simulation'

export interface Operation {
  readonly requestId: number
  readonly signal: AbortSignal
}

export interface ContextReference {
  readonly id: string
  readonly label: string
}

export interface NexusContextProvider {
  availability(operation: Operation): Promise<Availability>
  resolve(request: { readonly query: string; readonly locale: string }, operation: Operation):
    Promise<readonly ContextReference[]>
}

export interface AssistantRequest {
  readonly text: string
  readonly source: InputSource
  readonly locale: string
  readonly context?: readonly ContextReference[]
}

export type AssistantEvent =
  | { readonly type: 'text.delta'; readonly text: string }
  | { readonly type: 'command.proposed'; readonly command: CommandProposal }

interface AssistantProvider {
  readonly name: string
  availability(operation: Operation): Promise<Availability>
  stream(request: AssistantRequest, operation: Operation): AsyncIterable<AssistantEvent>
}

export interface LocalAssistantProvider extends AssistantProvider {
  readonly kind: 'simulation' | 'local'
}

export interface ExternalAssistantProvider extends AssistantProvider {
  readonly kind: 'external'
}

export type IntelligenceProvider = LocalAssistantProvider | ExternalAssistantProvider

export type SpeechEvent =
  /** Volume normalizado entre 0 e 1, quando o adaptador tem acesso às amostras. */
  | { readonly type: 'audio.level'; readonly value: number }
  | { readonly type: 'transcript.partial'; readonly text: string }
  | { readonly type: 'speech.started' }

export interface SpeechOperation extends Operation {
  readonly locale: string
  emit(event: SpeechEvent): void
}

export interface SpeechToText {
  transcribe(operation: SpeechOperation): Promise<string>
}

export interface TextToSpeech {
  speak(text: string, operation: SpeechOperation): Promise<void>
}

export type IntelligenceFault =
  | 'invalid-input' | 'assistant-unavailable' | 'invalid-response' | 'voice-unavailable'
  | 'microphone' | 'no-speech' | 'playback-unavailable' | 'timeout' | 'operation-failed'
  | 'command-invalid' | 'command-forbidden' | 'command-failed'

export class IntelligenceError extends Error {
  constructor(readonly code: IntelligenceFault, message?: string) {
    super(message ?? code)
  }
}
