import { untilAborted } from '../domain/abort'
import { IntelligenceError, type SpeechOperation, type SpeechToText, type TextToSpeech } from './contracts'

interface RecognitionResult extends ArrayLike<{ transcript: string }> {
  readonly isFinal: boolean
}

interface LocalRecognition {
  processLocally: boolean
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(audio: MediaStreamTrack): void
  abort(): void
}

interface RecognitionConstructor {
  new (): LocalRecognition
  available?(options: { langs: string[]; processLocally: true }): Promise<string>
}

function recognitionConstructor() {
  const device = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return device.SpeechRecognition ?? device.webkitSpeechRecognition
}

function observeMicrophone(stream: MediaStream, emit: SpeechOperation['emit']) {
  let context: AudioContext | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  try {
    context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    context.createMediaStreamSource(stream).connect(analyser)
    void context.resume().catch(() => {})
    const samples = new Float32Array(analyser.fftSize)
    let previous = -1
    timer = setInterval(() => {
      if (context?.state !== 'running') return
      analyser.getFloatTimeDomainData(samples)
      let energy = 0
      for (const sample of samples) energy += sample * sample
      const value = Math.min(1, Math.round(Math.sqrt(energy / samples.length) * 100) / 20)
      if (value !== previous) {
        previous = value
        emit({ type: 'audio.level', value })
      }
    }, 70)
  } catch {
    // Measuring the signal is optional on devices that can transcribe it.
  }
  return () => {
    clearInterval(timer)
    void context?.close().catch(() => {})
  }
}

function recognize(recognition: LocalRecognition, track: MediaStreamTrack, { signal, emit }: SpeechOperation) {
  return new Promise<string>((resolve, reject) => {
    function cleanup() {
      signal.removeEventListener('abort', abort)
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try { recognition.abort() } catch { /* The device may already have stopped. */ }
    }

    function fail(reason: unknown) {
      cleanup()
      reject(reason)
    }

    function abort() {
      fail(signal.reason)
    }

    recognition.onresult = ({ results }) => {
      const result = results[results.length - 1]
      const transcript = result?.[0]?.transcript
      if (!transcript) return
      if (result.isFinal) {
        cleanup()
        resolve(transcript)
      } else {
        emit({ type: 'transcript.partial', text: transcript })
      }
    }
    recognition.onend = () => fail(new IntelligenceError('no-speech'))
    recognition.onerror = ({ error }) => {
      const code = error === 'no-speech' ? 'no-speech'
        : error === 'not-allowed' || error === 'audio-capture' ? 'microphone' : 'voice-unavailable'
      fail(new IntelligenceError(code))
    }
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    try { recognition.start(track) } catch { fail(new IntelligenceError('voice-unavailable')) }
  })
}

export const deviceRecognition: SpeechToText = {
  async transcribe(operation) {
    const { locale, signal, emit } = operation
    const Recognition = recognitionConstructor()
    if (!Recognition?.available || !navigator.mediaDevices?.getUserMedia) {
      throw new IntelligenceError('voice-unavailable')
    }
    const recognition = new Recognition()
    if (!('processLocally' in recognition)) throw new IntelligenceError('voice-unavailable')
    recognition.processLocally = true
    recognition.lang = locale
    recognition.interimResults = true
    const status = await Recognition.available({ langs: [locale], processLocally: true })
      .catch(() => 'unavailable')
    signal.throwIfAborted()
    if (status !== 'available') throw new IntelligenceError('voice-unavailable')

    let capture: MediaStream | undefined
    let stopMeasuring: (() => void) | undefined
    function release() {
      const acquired = capture
      capture = undefined
      acquired?.getTracks().forEach((track) => track.stop())
    }

    try {
      const pending = navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        capture = stream
        if (signal.aborted) release()
        return stream
      }, () => { throw new IntelligenceError('microphone') })
      const stream = await untilAborted(pending, signal)
      signal.throwIfAborted()
      const track = stream.getAudioTracks()[0]
      if (!track) throw new IntelligenceError('microphone')
      stopMeasuring = observeMicrophone(stream, emit)
      return await recognize(recognition, track, operation)
    } finally {
      stopMeasuring?.()
      release()
    }
  },
}

function waitForVoices(synthesis: SpeechSynthesis, signal: AbortSignal): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(finish, 1200)
    function cleanup() {
      clearTimeout(timer)
      synthesis.removeEventListener('voiceschanged', onVoices)
      signal.removeEventListener('abort', abort)
    }
    function finish() {
      cleanup()
      resolve(synthesis.getVoices())
    }
    function abort() {
      cleanup()
      reject(signal.reason)
    }
    function onVoices() {
      if (synthesis.getVoices().length > 0) finish()
    }
    synthesis.addEventListener('voiceschanged', onVoices)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const deviceSpeech: TextToSpeech = {
  async speak(text, { signal, locale, emit }) {
    const synthesis = window.speechSynthesis
    if (!synthesis || !window.SpeechSynthesisUtterance) throw new IntelligenceError('playback-unavailable')
    const known = synthesis.getVoices()
    const available = known.length ? known : await waitForVoices(synthesis, signal)
    const voices = available.filter((voice) => voice.localService && /^pt(?:-|$)/i.test(voice.lang))
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === locale.toLowerCase()) ?? voices[0]
    if (!voice) throw new IntelligenceError('playback-unavailable')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice.lang
    utterance.voice = voice

    await new Promise<void>((resolve, reject) => {
      function cleanup() {
        signal.removeEventListener('abort', abort)
        utterance.onstart = null
        utterance.onend = null
        utterance.onerror = null
      }

      function abort() {
        cleanup()
        synthesis.cancel()
        reject(signal.reason)
      }

      function fail() {
        cleanup()
        reject(new IntelligenceError('playback-unavailable'))
      }

      utterance.onstart = () => emit({ type: 'speech.started' })
      utterance.onend = () => { cleanup(); resolve() }
      utterance.onerror = fail
      if (signal.aborted) { cleanup(); return reject(signal.reason) }
      signal.addEventListener('abort', abort, { once: true })
      try { synthesis.speak(utterance) } catch { fail() }
    })
  },
}
