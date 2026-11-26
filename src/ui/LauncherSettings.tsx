import { useRef, useState } from 'react'
import { chooseExecutable, desktopAvailable, openRegisteredModule, operationFailure, removeExecutable, type DesktopMonitor, type LauncherSnapshot } from '../desktop/platform'
import type { ModuleSettings } from '../desktop/persistence'
import { modules, type ModuleId } from '../domain/registry'
import { moduleNotice } from '../domain/state'
import './launcher-settings.css'

interface Props {
  snapshot?: LauncherSnapshot
  failed: boolean
  onRefresh: () => Promise<void>
  category: 'applications' | 'monitors'
  id: ModuleId
  onSelect: (id: ModuleId) => void
  preferences: ModuleSettings
  onChange: (preferences: ModuleSettings) => void
}

const environmentNotice: Record<LauncherSnapshot['environment'], string> = {
  windows: '',
  x11: 'Sessão X11. A abertura de processos está disponível.',
  wayland: 'Sessão Wayland. O compositor determina foco e posição.',
  'linux-unknown': 'Sessão Linux sem ambiente gráfico identificado.',
  unsupported: 'O launcher está indisponível neste sistema.',
}

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent' })

function monitorLabel(monitor: DesktopMonitor) {
  const scale = percent.format(monitor.scale)
  const primary = monitor.primary ? ' · principal' : ''
  return `${monitor.name}${primary} · ${monitor.width} × ${monitor.height} · ${scale} · (${monitor.x}, ${monitor.y})`
}

export function LauncherSettings({ snapshot, failed, onRefresh, category, id, onSelect, preferences, onChange }: Props) {
  const operation = useRef(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const app = snapshot?.applications.find((app) => app.id === id)
  const monitors = snapshot?.monitors ?? []
  const preferred = preferences.preferredMonitor ?? ''
  const eligibleMonitors = monitors.filter((monitor) => monitor.id !== null)
  const disconnected = preferred && !eligibleMonitors.some((monitor) => monitor.id === preferred)
  const selfPositioned = app?.strategy === 'self-positioned'
  const enabled = !failed && !!app?.capabilities.externalLaunch
  const mayChoose = enabled && !(app.state.status === 'error' && app.state.reason === 'storage')

  async function run(action: () => Promise<string>) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setNotice('')
    try {
      setNotice(await action())
    } catch (error) {
      setNotice(moduleNotice(operationFailure(error)))
    } finally {
      await onRefresh()
      setBusy(false)
      operation.current = false
    }
  }

  if (!desktopAvailable()) return <p className="launcher-detail">A integração com aplicativos e monitores está disponível no Aurora Central desktop.</p>

  return (
    <>
      <label htmlFor="launcher-app">Módulo</label>
      <select id="launcher-app" value={id} disabled={busy} onChange={(event) => {
        const selected = modules.find((module) => module.id === event.currentTarget.value)
        if (selected) onSelect(selected.id)
        setNotice('')
      }}>
        {modules.map((module) => <option key={module.id} value={module.id}>Aurora {module.name}</option>)}
      </select>

      {category === 'applications' ? <>
      <div className="launcher-installation">
        <p className="launcher-availability">{failed ? 'Não foi possível consultar o launcher.' : app ? moduleNotice(app.state) : 'Consultando aplicativos…'}</p>
        {app?.executable && <p className="launcher-path">{app.executable}</p>}
      </div>
      <div className="launcher-actions">
        <button type="button" disabled={busy || !mayChoose} onClick={() => void run(async () =>
          await chooseExecutable(id) ? 'Executável autorizado.' : '')}>
          {app?.executable ? 'Trocar executável' : 'Selecionar executável'}
        </button>
        <button type="button" disabled={busy || !enabled || !app?.executable} onClick={() => void run(async () =>
          moduleNotice(await openRegisteredModule(id)))}>
          Testar abertura
        </button>
        {app?.executable && <button type="button" disabled={busy || !enabled} onClick={() => void run(async () => {
          await removeExecutable(id)
          return 'Configuração removida.'
        })}>Remover</button>}
      </div>

      <label htmlFor="launcher-opening">Ao acionar o módulo</label>
      <select id="launcher-opening" value={preferences.opening} disabled={!enabled} onChange={(event) => {
        onChange({ ...preferences, opening: event.currentTarget.value as ModuleSettings['opening'] })
      }}>
        <option value="launch-or-reuse">Iniciar ou reutilizar instância</option>
        <option value="running-only">Usar somente instância em execução</option>
      </select>
      <label className="settings-checkbox">
        <input type="checkbox" checked={preferences.focusExisting} disabled={!app?.capabilities.windowFocus || !enabled}
          onChange={(event) => onChange({ ...preferences, focusExisting: event.currentTarget.checked })} />
        Solicitar foco à janela existente
      </label>
      {app && !app.capabilities.windowFocus && <p className="launcher-detail">
        O foco de janelas é gerenciado pelo ambiente gráfico nesta sessão.
      </p>}
      <p className="launcher-detail">Autorizações entram em vigor após o diálogo nativo. O teste de abertura usa as preferências salvas.</p>
      <p className="launcher-message" role="status">{busy && !notice ? 'Aguardando operação…' : notice}</p>
      </> : <>
      <label htmlFor="launcher-monitor">Monitor preferido para novas janelas</label>
      <select id="launcher-monitor" value={preferred}
        disabled={busy || failed || !app?.capabilities.initialPlacement || (!eligibleMonitors.length && !preferred)}
        onChange={(event) => {
          onChange({ ...preferences, preferredMonitor: event.currentTarget.value || null })
        }}>
        <option value="">Padrão do aplicativo</option>
        {disconnected && <option value={preferred} disabled>Monitor salvo desconectado</option>}
        {eligibleMonitors.map((monitor) => <option key={monitor.id} value={monitor.id!}>{monitorLabel(monitor)}</option>)}
      </select>
      {selfPositioned && <p className="launcher-detail">Aurora Control gerencia a posição da própria barra.</p>}
      {!selfPositioned && snapshot && <p className="launcher-detail">
        {snapshot.environment === 'windows'
          ? 'A preferência se aplica a novas janelas iniciadas pelo Central. Se o monitor estiver desconectado, o Central tenta usar o principal.'
          : environmentNotice[snapshot.environment]}
      </p>}
      {failed && <p className="launcher-detail" role="status">Não foi possível consultar os monitores.</p>}
      {monitors.length > 0 && <details open>
        <summary>Monitores detectados ({monitors.length})</summary>
        <ul>{monitors.map((monitor) => <li key={monitor.id ?? monitorLabel(monitor)}>{monitorLabel(monitor)}</li>)}</ul>
      </details>}
      </>}
    </>
  )
}
