import { useEffect, useRef, useState } from 'react'
import { coreStates, type CoreState } from '../graphics/behavior'
import { ParticleCore } from '../graphics/ParticleCore'
import {
  dprLimits, fpsLimits, graphicsProfiles, profileSettings, type GraphicsProfile, type GraphicsSettings,
} from '../graphics/profiles'
import './core-demo.css'

const stateLabels: Record<CoreState, string> = {
  idle: 'Em repouso',
  listening: 'Escutando',
  thinking: 'Pensando',
  speaking: 'Falando',
  executing: 'Executando',
  success: 'Sucesso',
  error: 'Erro',
  sleep: 'Em suspensão',
}

const profileLabels: Record<GraphicsProfile, string> = {
  low: 'Baixo', medium: 'Médio', high: 'Alto', ultra: 'Ultra',
}
const profiles = Object.entries(graphicsProfiles) as [GraphicsProfile, (typeof graphicsProfiles)[GraphicsProfile]][]

interface CoreDemoProps {
  settings: GraphicsSettings
  onSettingsChange: (settings: GraphicsSettings) => void
}

export function CoreDemo({ settings, onSettingsChange }: CoreDemoProps) {
  const title = useRef<HTMLHeadingElement>(null)
  const [state, setState] = useState<CoreState>('idle')
  const [amplitude, setAmplitude] = useState(0)

  useEffect(() => title.current?.focus(), [])

  return (
    <main className="core-demo">
      <header className="demo-header">
        <a href="#/" className="core-link">Voltar à home</a>
        <h1 tabIndex={-1} ref={title}>Núcleo Aurora</h1>
      </header>

      <div className="demo-preview">
        <ParticleCore state={state} amplitude={amplitude} settings={settings} />
      </div>

      <section aria-label="Controles de demonstração" className="demo-controls">
        <label>
          Estado
          <select value={state} onChange={(event) => setState(event.target.value as CoreState)}>
            {coreStates.map((id) => <option key={id} value={id}>{stateLabels[id]}</option>)}
          </select>
        </label>
        <label>
          Perfil gráfico
          <select value={settings.profile} onChange={(event) => onSettingsChange(profileSettings(event.target.value as GraphicsProfile))}>
            {profiles.map(([id, profile]) => <option key={id} value={id}>{profileLabels[id]} · {profile.count.toLocaleString('pt-BR')} partículas</option>)}
          </select>
        </label>
        <label>
          Limite de FPS
          <select
            value={settings.fps}
            onChange={(event) => onSettingsChange({ ...settings, fps: Number(event.target.value) as GraphicsSettings['fps'] })}
          >
            {fpsLimits.map((fps) => <option key={fps} value={fps}>{fps}</option>)}
          </select>
        </label>
        <label>
          Limite de DPR
          <select
            value={settings.dpr}
            onChange={(event) => onSettingsChange({ ...settings, dpr: Number(event.target.value) as GraphicsSettings['dpr'] })}
          >
            {dprLimits.map((dpr) => <option key={dpr} value={dpr}>{dpr.toLocaleString('pt-BR')}×</option>)}
          </select>
        </label>
        <label className="demo-amplitude">
          Amplitude de teste
          <input
            type="range" min="0" max="1" step="0.01" value={amplitude}
            disabled={state !== 'speaking'}
            onChange={(event) => setAmplitude(event.target.valueAsNumber)}
          />
        </label>
      </section>
    </main>
  )
}
