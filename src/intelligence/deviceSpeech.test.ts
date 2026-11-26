import { afterEach, expect, it, vi } from 'vitest'
import { deviceRecognition, deviceSpeech } from './deviceSpeech'

afterEach(() => { vi.unstubAllGlobals() })

it('does not access the microphone when processing locally is unavailable', async () => {
  const getUserMedia = vi.fn()
  class Recognition {
    processLocally = false
    static available = vi.fn().mockResolvedValue('downloadable')
  }
  vi.stubGlobal('window', { SpeechRecognition: Recognition })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const operation = { requestId: 1, signal: new AbortController().signal, locale: 'pt-BR', emit: vi.fn() }
  await expect(deviceRecognition.transcribe(operation)).rejects.toMatchObject({ code: 'voice-unavailable' })
  expect(Recognition.available).toHaveBeenCalledExactlyOnceWith({ langs: ['pt-BR'], processLocally: true })
  expect(getUserMedia).not.toHaveBeenCalled()
})

it('stops a microphone track that arrives after cancelling the permission request', async () => {
  const track = { stop: vi.fn() }
  let grant!: (stream: { getTracks: () => typeof track[] }) => void
  const getUserMedia = vi.fn(() => new Promise((resolve) => { grant = resolve }))
  class Recognition {
    processLocally = false
    static available = async () => 'available'
  }
  vi.stubGlobal('window', { SpeechRecognition: Recognition })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const controller = new AbortController()
  const pending = deviceRecognition.transcribe({
    requestId: 1, signal: controller.signal, locale: 'pt-BR', emit: vi.fn(),
  })
  await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  grant({ getTracks: () => [track] })
  await Promise.resolve()
  expect(track.stop).toHaveBeenCalledOnce()
})

it('transcribes the selected track locally and releases the recognizer and microphone', async () => {
  const track = { stop: vi.fn() }
  const abort = vi.fn()
  class Recognition {
    processLocally = false
    onresult: ((event: unknown) => void) | null = null
    static available = async () => 'available'
    static current: Recognition
    start = vi.fn()
    abort = abort
    constructor() { Recognition.current = this }
  }
  vi.stubGlobal('window', { SpeechRecognition: Recognition })
  vi.stubGlobal('navigator', { mediaDevices: {
    getUserMedia: async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }),
  } })
  const emit = vi.fn()
  const pending = deviceRecognition.transcribe({ requestId: 7, signal: new AbortController().signal, locale: 'pt-BR', emit })
  await vi.waitFor(() => expect(Recognition.current?.start).toHaveBeenCalledExactlyOnceWith(track))
  const recognition = Recognition.current
  expect(recognition.processLocally).toBe(true)
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Olá' } }] })
  expect(emit).toHaveBeenCalledExactlyOnceWith({ type: 'transcript.partial', text: 'Olá' })
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Olá Aurora' } }] })
  await expect(pending).resolves.toBe('Olá Aurora')
  expect(abort).toHaveBeenCalledOnce()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(recognition).toMatchObject({ onresult: null, onerror: null, onend: null })
})

it('selects only a local Portuguese voice and cancels playback with all callbacks released', async () => {
  const cloud = { lang: 'pt-BR', localService: false }
  const local = { lang: 'pt-PT', localService: true }
  const synthesis = { getVoices: () => [cloud, local], speak: vi.fn(), cancel: vi.fn() }
  class Utterance {}
  vi.stubGlobal('window', { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance })
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  const controller = new AbortController()
  const emit = vi.fn()
  const pending = deviceSpeech.speak('Olá', { requestId: 1, signal: controller.signal, locale: 'pt-BR', emit })
  const utterance = synthesis.speak.mock.calls[0]?.[0]
  expect(utterance.voice).toBe(local)
  utterance.onstart()
  expect(emit).toHaveBeenCalledExactlyOnceWith({ type: 'speech.started' })
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(synthesis.cancel).toHaveBeenCalledOnce()
  expect(utterance).toMatchObject({ onstart: null, onend: null, onerror: null })
})
