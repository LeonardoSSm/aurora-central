import { abortableDelay } from '../domain/abort'
import { modules } from '../domain/registry'
import type { LocalAssistantProvider, SpeechToText } from './contracts'

export const simulatedAssistant: LocalAssistantProvider = {
  kind: 'simulation',
  name: 'Simulação local',
  async availability() { return 'available' },
  async *stream({ text }, { signal }) {
    const normalized = text.trim().toLocaleLowerCase('pt-BR').replace(/[?!.]+$/, '')
    const module = modules.find(({ id }) =>
      normalized === `abrir aurora ${id}` || normalized === `sobre aurora ${id}`)
    const opening = normalized.startsWith('abrir ')
    const chunks = module
      ? [opening ? 'Posso solicitar a abertura ' : 'Vou consultar a descrição ', `do Aurora ${module.name}.`]
      : ['Esta resposta é uma simulação local. ', 'Experimente “Sobre Aurora Nexus” ou “Abrir Aurora Board”.']
    for (const chunk of chunks) {
      await abortableDelay(260, signal)
      yield { type: 'text.delta', text: chunk }
    }
    if (module) {
      yield { type: 'command.proposed', command: {
        name: opening ? 'module.open' : 'module.describe',
        args: { moduleId: module.id },
      } }
    }
  },
}

export const simulatedSpeech: SpeechToText = {
  async transcribe({ signal, emit }) {
    await abortableDelay(240, signal)
    emit({ type: 'transcript.partial', text: 'Sobre Aurora…' })
    await abortableDelay(480, signal)
    return 'Sobre Aurora Nexus'
  },
}
