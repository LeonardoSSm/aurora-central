import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { maxInputLength, type Conversation } from '../intelligence/conversation'
import type { InputSource } from '../intelligence/contracts'
import type { CoreState } from '../graphics/behavior'
import './conversation.css'

const stateLabels: Record<CoreState, string> = {
  idle: '', listening: 'Aguardando voz…', thinking: 'Preparando resposta…',
  speaking: 'Falando…', executing: 'Executando…', success: 'Concluído.',
  error: 'Ocorreu uma falha.', sleep: 'Núcleo em repouso.',
}

interface Props {
  conversation: Conversation
  providerName: string
  onClose: () => void
}

export function ConversationPanel({ conversation, providerName, onClose }: Props) {
  const { state, busy, messages, notice, partial, approval } = useSyncExternalStore(
    conversation.subscribe, conversation.getSnapshot,
  )
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState<InputSource>('text')
  const [readAloud, setReadAloud] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const refusal = useRef<HTMLButtonElement>(null)
  const history = useRef<HTMLOListElement>(null)
  const follow = useRef(true)
  const hasMessages = messages.length > 0

  useEffect(() => { (approval ? refusal : input).current?.focus({ preventScroll: true }) }, [approval])
  useLayoutEffect(() => {
    const log = history.current
    if (follow.current && log) log.scrollTop = log.scrollHeight
  }, [messages])
  useEffect(() => {
    const log = history.current
    if (!hasMessages || !log) return
    const resize = new ResizeObserver(() => {
      if (follow.current) log.scrollTop = log.scrollHeight
    })
    resize.observe(log)
    return () => resize.disconnect()
  }, [hasMessages])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || conversation.getSnapshot().busy) return
    follow.current = true
    void conversation.send(draft, source, readAloud)
    setDraft('')
    setSource('text')
    input.current?.focus({ preventScroll: true })
  }

  async function listen(simulated: boolean) {
    const result = await conversation.listen(simulated)
    if (result === undefined) return
    setDraft(result)
    setSource(simulated ? 'voice-simulation' : 'voice')
    input.current?.focus()
  }

  return (
    <section id="conversation" className="conversation" aria-label="Conversa">
      <header className="conversation-header">
        <strong>{providerName}</strong>
        <div className="conversation-tools">
          <label><input type="checkbox" checked={readAloud} disabled={busy}
            onChange={(event) => setReadAloud(event.currentTarget.checked)} /> Ler em voz alta</label>
          <button type="button" disabled={busy} onClick={conversation.toggleSleep}>
            {state === 'sleep' ? 'Acordar' : 'Repousar'}
          </button>
          <button type="button" onClick={onClose}>Fechar</button>
        </div>
      </header>

      {hasMessages && <ol className="conversation-history" ref={history} role="log" aria-label="Mensagens"
        aria-busy={state === 'thinking'} tabIndex={0} onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
          follow.current = scrollHeight - scrollTop - clientHeight < 20
        }}>
        {messages.map(({ requestId, role, text }) => (
          <li key={`${requestId}-${role}`}>
            <strong>{role === 'user' ? 'Você' : 'Aurora'}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>}

      <p className="conversation-status" role="status">
        {approval ? `Autorizar a abertura de ${approval.label}?` : partial ?? notice ?? stateLabels[state]}
      </p>

      {approval ? (
        <div className="conversation-confirmation">
          <button ref={refusal} type="button" onClick={conversation.cancel}>Recusar</button>
          <button type="button" className="conversation-primary"
            onClick={(event) => {
              if (event.nativeEvent.isTrusted) void conversation.confirm(approval.requestId)
            }}>Autorizar abertura</button>
        </div>
      ) : (
        <form className="conversation-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="conversation-input">Mensagem</label>
          <input id="conversation-input" ref={input} value={draft} readOnly={busy}
            placeholder="Escreva uma mensagem" maxLength={maxInputLength}
            onChange={(event) => { setDraft(event.currentTarget.value); setSource('text') }} />
          <button type="submit" className="conversation-primary" disabled={busy || !draft.trim()}>Enviar</button>
          {busy
            ? <button type="button" onClick={conversation.cancel}>Cancelar</button>
            : <button type="button" onClick={() => void listen(false)}>Microfone</button>}
        </form>
      )}
      {!approval && <button type="button" className="conversation-sample" disabled={busy}
        onClick={() => void listen(true)}>Simular entrada por voz</button>}
    </section>
  )
}
