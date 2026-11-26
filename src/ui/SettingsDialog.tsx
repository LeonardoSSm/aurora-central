import { useEffect, useRef, useState } from 'react'
import { defaultSettings, type Settings, type SettingsSnapshot } from '../desktop/persistence'
import { desktopAvailable } from '../desktop/platform'
import type { useLauncherSnapshot } from '../desktop/useLauncherSnapshot'
import { modules, type ModuleId } from '../domain/registry'
import { dprLimits, fpsLimits, graphicsProfiles, palettes, profileSettings, resolutions, type GraphicsSettings } from '../graphics/profiles'
import { LauncherSettings } from './LauncherSettings'
import { viewModes } from './ViewControls'
import './launcher-settings.css'

const categories = {
  general: 'Geral',
  appearance: 'Aparência',
  performance: 'Desempenho',
  applications: 'Aplicativos',
  monitors: 'Monitores',
  accessibility: 'Acessibilidade',
} as const
export type SettingsCategory = keyof typeof categories
const categoryIds = Object.keys(categories) as SettingsCategory[]

const profileLabels = { low: 'Baixo', medium: 'Médio', high: 'Alto', ultra: 'Ultra' }
const paletteLabels = { aurora: 'Aurora', nebula: 'Nebulosa', ember: 'Brasa', glacier: 'Glacial' }
const notices: Record<SettingsSnapshot['status'], string> = {
  ready: '',
  recovered: 'O arquivo estava corrompido. Os padrões foram restaurados.',
  unavailable: 'O armazenamento local está indisponível. Você pode experimentar a prévia.',
  'newer-version': 'As preferências foram criadas por uma versão mais recente. Você pode experimentar a prévia.',
}
const saveErrors: Record<string, string> = {
  invalid: 'Confira os valores antes de aplicar.',
  'invalid-monitor': 'O monitor selecionado deixou de estar disponível. Escolha outro e tente de novo.',
  conflict: 'As preferências mudaram enquanto este painel estava aberto. Reabra as configurações para editar a versão atual.',
}

function shallowEqual<T extends object>(left: T, right: T) {
  return (Object.keys(left) as (keyof T)[]).every((key) => left[key] === right[key])
}

interface Props {
  initialCategory: SettingsCategory
  snapshot: SettingsSnapshot
  launcher: ReturnType<typeof useLauncherSnapshot>
  onPreview: (settings: Settings) => void
  onSave: (settings: Settings, revision: number) => Promise<SettingsSnapshot>
  onDismiss: () => void
}

function Slider({ label, value, min, max, step = 5, unit = '%', onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  return <label className="settings-range">
    <span>{label}</span>
    <output aria-hidden="true">{value.toLocaleString('pt-BR')}{unit}</output>
    <input type="range" min={min} max={max} step={step} value={value}
      aria-valuetext={`${value.toLocaleString('pt-BR')}${unit}`}
      onChange={(event) => onChange(event.currentTarget.valueAsNumber)} />
  </label>
}

export function SettingsDialog({ initialCategory, snapshot, launcher, onPreview, onSave, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState(initialCategory)
  const [selectedModule, setSelectedModule] = useState<ModuleId>(modules[0].id)
  const [draft, setDraft] = useState(snapshot.settings)
  const [revision, setRevision] = useState(snapshot.revision)
  const [feedback, setFeedback] = useState('')
  const graphics = draft.graphics
  const current = snapshot.settings
  const changed = draft.initialView !== current.initialView || draft.motion !== current.motion
    || !shallowEqual(graphics, current.graphics)
    || modules.some(({ id }) => !shallowEqual(draft.modules[id], current.modules[id]))
  const writable = snapshot.status === 'ready' || snapshot.status === 'recovered'
  const stale = revision !== snapshot.revision

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  function close() {
    if (saving.current) return
    dialog.current?.close()
    onDismiss()
  }

  function edit(settings: Settings) {
    setFeedback('')
    setDraft(settings)
    onPreview(settings)
  }

  function editGraphics(patch: Partial<GraphicsSettings>) {
    edit({ ...draft, graphics: { ...graphics, ...patch } })
  }

  async function apply() {
    if (!changed || !writable || stale || saving.current) return
    saving.current = true
    setBusy(true)
    try {
      const result = await onSave(draft, revision)
      setRevision(result.revision)
      setDraft(result.settings)
      onPreview(result.settings)
      setFeedback(desktopAvailable() ? 'Preferências salvas.' : 'Preferências aplicadas nesta sessão.')
      void launcher.refresh()
    } catch (error) {
      const message = typeof error === 'string' && Object.hasOwn(saveErrors, error) ? saveErrors[error] : undefined
      setFeedback(message ?? 'Não foi possível salvar. As alterações continuam na prévia.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="launcher-settings" aria-labelledby="settings-title"
    onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'F11') event.stopPropagation() }}
    onCancel={(event) => { event.preventDefault(); close() }}>
    <header>
      <h2 id="settings-title">Configurações</h2>
      <button className="view-control" type="button" disabled={busy} onClick={close}>Fechar</button>
    </header>

    <nav className="settings-nav" aria-label="Categorias de configurações">
      {categoryIds.map((id) => <button type="button" key={id} aria-pressed={id === category}
        onClick={() => setCategory(id)}>{categories[id]}</button>)}
    </nav>

    <section className="settings-content" aria-labelledby="settings-category" key={category}>
      <h3 id="settings-category">{categories[category]}</h3>
      <fieldset disabled={busy}>
        {category === 'general' && <>
          <label htmlFor="settings-view">Visualização ao iniciar</label>
          <select id="settings-view" value={draft.initialView}
            onChange={(event) => edit({ ...draft, initialView: event.currentTarget.value as Settings['initialView'] })}>
            {viewModes.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <p className="launcher-detail">Use Esc ou Alt+1 para voltar à Central.</p>
        </>}

        {category === 'appearance' && <>
          <label htmlFor="settings-palette">Paleta do núcleo</label>
          <select id="settings-palette" value={graphics.palette}
            onChange={(event) => editGraphics({ palette: event.currentTarget.value as GraphicsSettings['palette'] })}>
            {palettes.map((id) => <option key={id} value={id}>{paletteLabels[id]}</option>)}
          </select>
          <Slider label="Brilho" value={graphics.brightness} min={25} max={150}
            onChange={(brightness) => editGraphics({ brightness })} />
          <Slider label="Velocidade das animações" value={graphics.speed} min={25} max={175}
            onChange={(speed) => editGraphics({ speed })} />
        </>}

        {category === 'performance' && <>
          <label htmlFor="settings-profile">Perfil de desempenho</label>
          <select id="settings-profile" value={graphics.profile}
            onChange={(event) => editGraphics(profileSettings(event.currentTarget.value as GraphicsSettings['profile'], graphics))}>
            {(Object.keys(graphicsProfiles) as GraphicsSettings['profile'][]).map((id) =>
              <option key={id} value={id}>{profileLabels[id]}</option>)}
          </select>
          <Slider label="Quantidade de partículas" value={graphics.particleCount ?? graphicsProfiles[graphics.profile].count}
            min={5000} max={100000} step={1000} unit="" onChange={(particleCount) => editGraphics({ particleCount })} />
          <div className="settings-grid">
            <label>Qualidade gráfica
              <select value={graphics.quality}
                onChange={(event) => editGraphics({ quality: event.currentTarget.value as GraphicsSettings['quality'] })}>
                <option value="standard">Padrão</option>
                <option value="economy">Econômica</option>
              </select>
            </label>
            <label>Limite de FPS
              <select value={graphics.fps} onChange={(event) => editGraphics({ fps: Number(event.currentTarget.value) as GraphicsSettings['fps'] })}>
                {fpsLimits.map((fps) => <option key={fps}>{fps}</option>)}
              </select>
            </label>
            <label>Limite de DPR
              <select value={graphics.dpr} onChange={(event) => editGraphics({ dpr: Number(event.currentTarget.value) as GraphicsSettings['dpr'] })}>
                {dprLimits.map((dpr) => <option key={dpr} value={dpr}>{dpr.toLocaleString('pt-BR')}×</option>)}
              </select>
            </label>
            <label>Resolução de renderização
              <select value={graphics.resolution} onChange={(event) => editGraphics({ resolution: Number(event.currentTarget.value) as GraphicsSettings['resolution'] })}>
                {resolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}%</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="settings-background">Com a janela visível sem foco</label>
          <select id="settings-background" value={graphics.background}
            onChange={(event) => editGraphics({ background: event.currentTarget.value as GraphicsSettings['background'] })}>
            <option value="adaptive">Reduzir para até 20 FPS</option>
            <option value="pause">Pausar animação</option>
            <option value="continue">Manter limite de FPS</option>
          </select>
        </>}

        {(category === 'applications' || category === 'monitors') && <LauncherSettings
          snapshot={launcher.snapshot} failed={launcher.failed} onRefresh={launcher.refresh} category={category}
          id={selectedModule} onSelect={setSelectedModule} preferences={draft.modules[selectedModule]}
          onChange={(preferences) => edit({ ...draft, modules: { ...draft.modules, [selectedModule]: preferences } })} />}

        {category === 'accessibility' && <>
          <label htmlFor="settings-motion">Movimento reduzido</label>
          <select id="settings-motion" value={draft.motion}
            onChange={(event) => edit({ ...draft, motion: event.currentTarget.value as Settings['motion'] })}>
            <option value="system">Seguir preferência do sistema</option>
            <option value="reduced">Reduzir sempre</option>
          </select>
          <p className="launcher-detail">Mantém o núcleo estático e desativa transições orbitais.</p>
        </>}
      </fieldset>
    </section>

    <footer className="settings-footer">
      <p className="settings-feedback" role="status">
        {feedback || notices[snapshot.status] || (changed ? 'Prévia ativa · alterações pendentes' : '')}
      </p>
      <div className="launcher-actions">
        <button type="button" disabled={busy} onClick={() => { edit(defaultSettings) }}>Restaurar padrões</button>
        <button type="button" className="settings-apply" disabled={!changed || !writable || stale || busy}
          onClick={() => void apply()}>{busy ? 'Aplicando…' : 'Aplicar'}</button>
      </div>
    </footer>
  </dialog>
}
