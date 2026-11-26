import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntelligenceError, type IntelligenceProvider, type SpeechOperation } from './contracts'
import { createConversation } from './conversation'
import { createCommandRegistry } from './registry'
import { simulatedAssistant, simulatedSpeech } from './simulation'

type Options = Parameters<typeof createConversation>[0]

function setup(overrides: Partial<Options> = {}) {
  const open = vi.fn().mockResolvedValue({ status: 'focus-requested', focus: 'confirmed' })
  const conversation = createConversation({
    assistant: simulatedAssistant,
    commands: createCommandRegistry(open),
    permissions: ['modules:read', 'modules:open'],
    desktop: true,
    voice: { async transcribe() { throw new IntelligenceError('voice-unavailable') } },
    voiceSimulation: simulatedSpeech,
    speech: {
      async speak(_text, { emit }) {
        emit({ type: 'speech.started' })
        emit({ type: 'audio.level', value: 1.8 })
      },
    },
    ...overrides,
  })
  return { conversation, open }
}

describe('conversation across provider, registry and voice contracts', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('connects all eight visual states to capture, streaming, commands, playback and rest', async () => {
    const { conversation, open } = setup()
    const states = ['idle']
    const levels: number[] = []
    conversation.subscribe(() => {
      const { state, amplitude } = conversation.getSnapshot()
      if (states.at(-1) !== state) states.push(state)
      if (amplitude !== undefined) levels.push(amplitude)
    })
    const draft = conversation.listen(true)
    expect(conversation.getSnapshot().state).toBe('listening')
    await vi.advanceTimersByTimeAsync(240)
    expect(conversation.getSnapshot().partial).toBe('Sobre Aurora…')
    expect(conversation.getSnapshot().messages).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(480)
    await expect(draft).resolves.toBe('Sobre Aurora Nexus')

    const response = conversation.send(await draft ?? '', 'voice-simulation', true)
    expect(conversation.getSnapshot().state).toBe('thinking')
    await vi.advanceTimersByTimeAsync(260)
    expect(conversation.getSnapshot().messages.at(-1)?.text).toBe('Vou consultar a descrição ')
    await vi.advanceTimersByTimeAsync(260)
    await response
    expect(conversation.getSnapshot().messages.at(-1)?.text).toContain('Memória, conhecimento e contexto.')
    expect(conversation.getSnapshot().amplitude).toBeUndefined()
    expect(levels).toEqual([1])
    expect(open).not.toHaveBeenCalled()
    conversation.toggleSleep()
    await conversation.listen(false)
    expect(states).toEqual([
      'idle', 'listening', 'idle', 'thinking', 'executing', 'speaking', 'success', 'sleep', 'listening', 'error',
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('requires a live, single-use confirmation and rejects a stale action after refusal', async () => {
    const { conversation, open } = setup()
    const send = () => conversation.send('Abrir Aurora Control', 'text', false)
    const first = send()
    await vi.advanceTimersByTimeAsync(520)
    await first
    const initial = conversation.getSnapshot().approval!
    expect(initial.label).toBe('Aurora Control')
    expect(open).not.toHaveBeenCalled()
    conversation.cancel()
    await conversation.confirm(initial.requestId)
    expect(open).not.toHaveBeenCalled()

    const second = send()
    await vi.advanceTimersByTimeAsync(520)
    await second
    await conversation.confirm(initial.requestId)
    expect(open).not.toHaveBeenCalled()
    const fresh = conversation.getSnapshot().approval!
    await Promise.all([conversation.confirm(fresh.requestId), conversation.confirm(fresh.requestId)])
    expect(open).toHaveBeenCalledExactlyOnceWith('control', expect.any(AbortSignal))
    expect(conversation.getSnapshot()).toMatchObject({ state: 'success', notice: 'Aurora Control · Foco confirmado.' })
  })

  it('reports a genuine launcher failure and releases pending confirmation on timeout', async () => {
    const { conversation, open } = setup()
    open.mockResolvedValue({ status: 'not-configured' })
    const send = () => conversation.send('Abrir Aurora Lens', 'text', false)
    const operation = send()
    await vi.advanceTimersByTimeAsync(520)
    await operation
    await conversation.confirm(conversation.getSnapshot().approval!.requestId)
    expect(conversation.getSnapshot()).toMatchObject({
      state: 'error', notice: 'Aurora Lens · Nenhum executável configurado.',
    })
    const pending = send()
    await vi.advanceTimersByTimeAsync(520)
    await pending
    const { requestId } = conversation.getSnapshot().approval!
    await vi.advanceTimersByTimeAsync(30_000)
    await conversation.confirm(requestId)
    expect(open).toHaveBeenCalledTimes(1)
    expect(conversation.getSnapshot()).toMatchObject({ state: 'error', approval: undefined, busy: false })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores concurrency, closes an interrupted stream and allows a fresh request', async () => {
    let finish!: (result: IteratorResult<never>) => void
    const pending = new Promise<IteratorResult<never>>((resolve) => { finish = resolve })
    const close = vi.fn().mockResolvedValue({ done: true })
    const stream = vi.fn<IntelligenceProvider['stream']>((request, operation) => request.text === 'first'
      ? { [Symbol.asyncIterator]: () => ({ next: () => pending, return: close }) }
      : simulatedAssistant.stream(request, operation))
    const { conversation } = setup({ assistant: { ...simulatedAssistant, stream } })
    const first = conversation.send('first', 'text', false)
    await vi.advanceTimersByTimeAsync(0)
    await conversation.send('ignored', 'text', false)
    expect(stream).toHaveBeenCalledTimes(1)
    conversation.cancel()
    await first
    expect(close).toHaveBeenCalledTimes(1)
    const second = conversation.send('second', 'text', false)
    finish({ done: true, value: undefined })
    await vi.advanceTimersByTimeAsync(520)
    await second
    expect(conversation.getSnapshot()).toMatchObject({ state: 'success', busy: false })
  })

  it('handles provider unavailability, malformed proposals and stream failure without executing commands', async () => {
    const unavailable = setup({ assistant: { ...simulatedAssistant, async availability() { return 'unavailable' } } })
    await unavailable.conversation.send('oi', 'text', false)
    expect(unavailable.conversation.getSnapshot().notice).toBe('O assistente está indisponível.')

    const broken: IntelligenceProvider = {
      ...simulatedAssistant, kind: 'external',
      async *stream({ text }) {
        if (text === 'bad') {
          yield { type: 'command.proposed', command: { name: 'shell.execute', args: { moduleId: 'lens' } } } as never
          return
        }
        yield { type: 'command.proposed', command: { name: 'module.open', args: { moduleId: 'lens' } } }
        throw new Error('network')
      },
    }
    const { conversation, open } = setup({ assistant: broken })
    await conversation.send('bad', 'text', false)
    expect(conversation.getSnapshot().notice).toBe('O assistente propôs um comando inválido.')
    await conversation.send('broken stream', 'text', false)
    expect(conversation.getSnapshot()).toMatchObject({ state: 'error', approval: undefined, busy: false })
    expect(open).not.toHaveBeenCalled()
  })

  it('aborts voice work on dismissal, ignores late transcription and preserves text after TTS failure', async () => {
    let finish!: (value: string) => void
    let capture!: SpeechOperation
    const { conversation } = setup({
      voice: {
        transcribe(operation) { capture = operation; return new Promise((resolve) => { finish = resolve }) },
      },
      speech: { async speak() { throw new IntelligenceError('playback-unavailable') } },
    })
    const listening = conversation.listen(false)
    conversation.cancelVoice()
    expect(capture.signal.aborted).toBe(true)
    finish('late')
    capture.emit({ type: 'transcript.partial', text: 'late' })
    await expect(listening).resolves.toBeUndefined()
    expect(conversation.getSnapshot().partial).toBeUndefined()
    const hidden = conversation.send('sem áudio em segundo plano', 'text', true)
    conversation.cancelVoice()
    await hidden
    expect(conversation.getSnapshot()).toMatchObject({ state: 'idle', busy: false })
    const response = conversation.send('olá', 'text', true)
    await vi.advanceTimersByTimeAsync(520)
    await response
    expect(conversation.getSnapshot()).toMatchObject({ state: 'error', busy: false })
    expect(conversation.getSnapshot().messages.at(-1)?.text).toContain('simulação local')
    conversation.reset()
    expect(conversation.getSnapshot()).toMatchObject({ state: 'idle', messages: [], notice: undefined })
    expect(vi.getTimerCount()).toBe(0)
  })
})
