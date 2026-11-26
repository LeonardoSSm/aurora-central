import { untilAborted } from '../domain/abort'
import type { CoreState } from '../graphics/behavior'
import {
  IntelligenceError, type InputSource, type IntelligenceFault, type IntelligenceProvider,
  type SpeechEvent, type SpeechToText, type TextToSpeech,
} from './contracts'
import { hasFields, type CommandPermission, type CommandRegistry, type PreparedCommand } from './registry'

export const maxInputLength = 2_000
const maxReplyLength = 8_000
const locale = 'pt-BR'

const notices: Record<IntelligenceFault, string> = {
  'invalid-input': 'Escreva uma mensagem de até 2.000 caracteres.',
  'assistant-unavailable': 'O assistente está indisponível.',
  'invalid-response': 'A resposta do assistente está incompleta ou inválida.',
  'voice-unavailable': 'O reconhecimento local em português está indisponível neste dispositivo.',
  microphone: 'Não foi possível acessar o microfone.',
  'no-speech': 'Nenhuma fala foi reconhecida. Tente novamente ou escreva.',
  'playback-unavailable': 'A reprodução com voz local em português está indisponível.',
  timeout: 'Tempo de espera esgotado.',
  'operation-failed': 'Não foi possível concluir a operação.',
  'command-invalid': 'O assistente propôs um comando inválido.',
  'command-forbidden': 'O assistente propôs um comando sem permissão.',
  'command-failed': 'Não foi possível executar o comando.',
}

interface Message {
  readonly requestId: number
  readonly role: 'user' | 'assistant'
  readonly text: string
}

interface ConversationSnapshot {
  readonly state: CoreState
  readonly busy: boolean
  readonly messages: readonly Message[]
  readonly notice?: string
  readonly partial?: string
  readonly amplitude?: number
  readonly approval?: { readonly requestId: number; readonly label: string }
}

interface Turn {
  readonly requestId: number
  readonly controller: AbortController
  readonly usesVoice: boolean
  timer?: ReturnType<typeof setTimeout>
  command?: PreparedCommand
}

interface Options {
  assistant: IntelligenceProvider
  permissions: readonly CommandPermission[]
  commands: CommandRegistry
  voice: SpeechToText
  voiceSimulation: SpeechToText
  speech: TextToSpeech
  desktop: boolean
}

const initial: ConversationSnapshot = {
  state: 'idle', busy: false, messages: [], notice: undefined,
  partial: undefined, approval: undefined, amplitude: undefined,
}

export function createConversation(options: Options) {
  let snapshot = initial
  let active: Turn | undefined
  let nextId = 0
  const subscribers = new Set<() => void>()

  function publish(patch: Partial<ConversationSnapshot>) {
    snapshot = { ...snapshot, ...patch }
    for (const listener of subscribers) listener()
  }

  function clear(turn: Turn) {
    active = undefined
    clearTimeout(turn.timer)
  }

  function fault(turn: Turn, error: unknown) {
    if (active !== turn) return
    clear(turn)
    turn.controller.abort()
    const code = error instanceof IntelligenceError ? error.code : 'operation-failed'
    const notice = error instanceof IntelligenceError && code === 'command-failed'
      ? error.message : notices[code]
    publish({ state: 'error', busy: false, partial: undefined, approval: undefined, amplitude: undefined, notice })
  }

  function deadline(turn: Turn, milliseconds: number) {
    clearTimeout(turn.timer)
    turn.timer = setTimeout(() => fault(turn, new IntelligenceError('timeout')), milliseconds)
  }

  function start(state: CoreState, milliseconds: number, usesVoice: boolean) {
    if (active) return
    const turn: Turn = { requestId: ++nextId, controller: new AbortController(), usesVoice }
    active = turn
    deadline(turn, milliseconds)
    publish({ state, busy: true, notice: undefined, partial: undefined, amplitude: undefined })
    return turn
  }

  function complete(turn: Turn, state: 'idle' | 'success', notice?: string) {
    if (active !== turn) return
    clear(turn)
    publish({ state, busy: false, partial: undefined, approval: undefined, amplitude: undefined, notice })
  }

  function reply(turn: Turn, value: string) {
    const message = { requestId: turn.requestId, role: 'assistant' as const, text: value }
    const messages = snapshot.messages.at(-1)?.role === 'assistant'
      ? [...snapshot.messages.slice(0, -1), message] : [...snapshot.messages, message]
    publish({ messages })
  }

  function speechEvent(turn: Turn, stage: 'capture' | 'playback', event: SpeechEvent) {
    if (active !== turn) return
    switch (event.type) {
      case 'transcript.partial':
        if (stage === 'capture') publish({ partial: event.text.slice(0, maxInputLength) })
        break
      case 'speech.started':
        if (stage === 'playback') publish({ state: 'speaking', notice: undefined })
        break
      case 'audio.level':
        if (Number.isFinite(event.value)) publish({ amplitude: Math.min(1, Math.max(0, event.value)) })
        break
    }
  }

  async function play(turn: Turn, text: string) {
    deadline(turn, 30_000)
    const { requestId, controller: { signal } } = turn
    publish({ amplitude: undefined, notice: 'Preparando voz local…' })
    await untilAborted(options.speech.speak(text, {
      requestId, signal, locale, emit: (event) => speechEvent(turn, 'playback', event),
    }), signal)
  }

  async function execute(turn: Turn, command: PreparedCommand) {
    deadline(turn, 15_000)
    publish({ state: 'executing', approval: undefined })
    const { signal } = turn.controller
    signal.throwIfAborted()
    return untilAborted(options.commands.execute(command, signal), signal)
  }

  function stop(reset: boolean) {
    const turn = active
    if (turn) {
      clear(turn)
      turn.controller.abort()
    }
    if (reset) publish(initial)
    else if (turn) {
      const notice = snapshot.approval ? 'Abertura recusada.'
        : snapshot.state === 'executing' && turn.command?.confirmationRequired
          ? 'Acompanhamento cancelado. A abertura já solicitada pode continuar.' : 'Operação cancelada.'
      publish({ state: 'idle', busy: false, partial: undefined, approval: undefined, amplitude: undefined, notice })
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      subscribers.add(listener)
      return () => { subscribers.delete(listener) }
    },

    async listen(simulation: boolean) {
      const turn = start('listening', 25_000, true)
      if (!turn) return
      const adapter = simulation ? options.voiceSimulation : options.voice
      const { requestId, controller: { signal } } = turn
      try {
        const transcript = (await untilAborted(adapter.transcribe({
          requestId, signal, locale, emit: (event) => speechEvent(turn, 'capture', event),
        }), signal)).trim()
        signal.throwIfAborted()
        if (!transcript) throw new IntelligenceError('no-speech')
        if (transcript.length > maxInputLength) throw new IntelligenceError('invalid-input')
        complete(turn, 'idle', simulation
          ? 'Revise a transcrição simulada antes de enviar.' : 'Revise a transcrição antes de enviar.')
        return transcript
      } catch (error) {
        fault(turn, error)
      }
    },

    async send(text: string, source: InputSource, readAloud: boolean) {
      if (active) return
      text = text.trim()
      if (!text || text.length > maxInputLength) {
        publish({ state: 'error', notice: notices['invalid-input'] })
        return
      }
      const turn = start('thinking', 30_000, readAloud)!
      const { requestId, controller: { signal } } = turn
      publish({ messages: [...snapshot.messages.slice(-10), { requestId, role: 'user', text }] })
      let iterator: AsyncIterator<unknown> | undefined
      try {
        if (await untilAborted(options.assistant.availability({ requestId, signal }), signal) !== 'available') {
          throw new IntelligenceError('assistant-unavailable')
        }
        signal.throwIfAborted()
        iterator = options.assistant.stream({ text, source, locale }, { requestId, signal })[Symbol.asyncIterator]()
        let response = ''
        let proposal: PreparedCommand | undefined
        for (let count = 0; ; count++) {
          const next = await untilAborted(Promise.resolve(iterator.next()), signal)
          signal.throwIfAborted()
          if (next.done) {
            iterator = undefined
            break
          }
          if (count >= 512) throw new IntelligenceError('invalid-response')
          const event = next.value
          if (hasFields(event, 'type', 'text') && event.type === 'text.delta' &&
            typeof event.text === 'string' && response.length + event.text.length <= maxReplyLength) {
            response += event.text
            reply(turn, response)
          } else if (hasFields(event, 'type', 'command') && event.type === 'command.proposed' && !proposal) {
            proposal = options.commands.prepare(event.command, options.permissions)
          } else {
            throw new IntelligenceError('invalid-response')
          }
        }

        if (proposal?.confirmationRequired) {
          if (!options.desktop) throw new IntelligenceError('command-failed', 'A abertura requer o Aurora Central desktop.')
          turn.command = proposal
          deadline(turn, 30_000)
          publish({ state: 'idle', approval: { requestId, label: proposal.label } })
          return
        }
        if (proposal) {
          const result = await execute(turn, proposal)
          signal.throwIfAborted()
          response = response ? `${response}\n${result}` : result
          reply(turn, response)
        }
        if (!response.trim()) throw new IntelligenceError('invalid-response')
        if (readAloud) await play(turn, response)
        complete(turn, 'success')
      } catch (error) {
        fault(turn, error)
      } finally {
        if (iterator?.return) void Promise.resolve().then(() => iterator?.return?.()).catch(() => {})
      }
    },

    async confirm(requestId: number) {
      const turn = active
      if (!turn?.command || snapshot.approval?.requestId !== requestId) return
      try {
        options.commands.authorize(turn.command)
        const result = await execute(turn, turn.command)
        complete(turn, 'success', result)
      } catch (error) {
        fault(turn, error)
      }
    },

    cancel: () => stop(false),
    cancelVoice() {
      if (active?.usesVoice) stop(false)
    },
    reset: () => stop(true),
    toggleSleep() {
      if (!active) publish({ state: snapshot.state === 'sleep' ? 'idle' : 'sleep', notice: undefined })
    },
  }
}

export type Conversation = ReturnType<typeof createConversation>
