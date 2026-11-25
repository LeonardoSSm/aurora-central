import { useEffect, useState, type Ref } from 'react'

export const viewModes = [
  { id: 'central', label: 'Central', key: '1' },
  { id: 'immersive', label: 'Imersivo', key: '2' },
  { id: 'ambiental', label: 'Ambiental', key: '3' },
] as const

export type ViewMode = (typeof viewModes)[number]['id']

function AmbientExit({ onExit, buttonRef }: { onExit: () => void; buttonRef: Ref<HTMLButtonElement> }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function reveal() {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), 2100)
    }
    reveal()
    window.addEventListener('pointermove', reveal, { passive: true })
    window.addEventListener('pointerdown', reveal, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', reveal)
      window.removeEventListener('pointerdown', reveal)
    }
  }, [])

  return (
    <div className="ambient-exit" data-visible={visible}>
      <button ref={buttonRef} type="button" className="view-control" aria-keyshortcuts="Escape Alt+1" onClick={onExit}>
        Voltar à Central
      </button>
    </div>
  )
}

interface Props {
  mode: ViewMode
  fullscreen: boolean
  modeControl: Ref<HTMLButtonElement>
  onChange: (mode: ViewMode) => void
  onToggleFullscreen: () => void
}

export function ViewControls({ mode, fullscreen, modeControl, onChange, onToggleFullscreen }: Props) {
  if (mode === 'ambiental') return <AmbientExit onExit={() => onChange('central')} buttonRef={modeControl} />

  if (mode === 'immersive') return (
    <div className="view-controls">
      <button ref={modeControl} type="button" className="view-control" aria-keyshortcuts="Escape Alt+1" onClick={() => onChange('central')}>
        Voltar à Central
      </button>
    </div>
  )

  return (
    <div className="view-controls" role="group" aria-label="Visualização">
      {viewModes.map(({ id, label, key }) => (
        <button key={id} ref={id === 'central' ? modeControl : undefined} type="button" className="view-control"
          aria-pressed={mode === id} aria-keyshortcuts={`Alt+${key}`} title={`${label} (Alt+${key})`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
      <button type="button" className="view-control fullscreen-control" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        aria-keyshortcuts="F11" title={fullscreen ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'} onClick={onToggleFullscreen}
      >
        <span aria-hidden="true"><i /><i /><i /><i /></span>
      </button>
    </div>
  )
}
