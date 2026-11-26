import { useEffect, useRef, useState } from 'react'
import { chooseExecutable, chooseMonitor, openRegisteredModule, operationFailure, removeExecutable, type DesktopMonitor, type LauncherSnapshot } from '../desktop/platform'
import { modules, type ModuleId } from '../domain/registry'
import { moduleNotice } from '../domain/state'
import './launcher-settings.css'

interface Props {
  snapshot?: LauncherSnapshot
  failed: boolean
  onRefresh: () => Promise<void>
  onDismiss: () => void
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

export function LauncherSettings({ snapshot, failed, onRefresh, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const operation = useRef(false)
  const [id, setId] = useState<ModuleId>(modules[0].id)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const app = snapshot?.applications.find((app) => app.id === id)
  const monitors = snapshot?.monitors ?? []
  const preferred = app?.preferredMonitor ?? ''
  const eligibleMonitors = monitors.filter((monitor) => monitor.id !== null)
  const disconnected = preferred && !eligibleMonitors.some((monitor) => monitor.id === preferred)
  const selfPositioned = app?.strategy === 'self-positioned'
  const enabled = !failed && !!app?.capabilities.externalLaunch
  const mayChoose = enabled && !(app.state.status === 'error' && app.state.reason === 'storage')

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  function close() {
    dialog.current?.close()
    onDismiss()
  }

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

  return (
    <dialog ref={dialog} className="launcher-settings" aria-labelledby="launcher-settings-title"
      onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'F11') event.stopPropagation() }}
      onCancel={(event) => { event.preventDefault(); close() }}
    >
      <header>
        <h2 id="launcher-settings-title">Aplicativos</h2>
        <button className="view-control" type="button" onClick={close}>Fechar</button>
      </header>

      <label htmlFor="launcher-app">Módulo</label>
      <select id="launcher-app" value={id} disabled={busy} onChange={(event) => {
        const selected = modules.find((module) => module.id === event.currentTarget.value)
        if (selected) setId(selected.id)
        setNotice('')
      }}>
        {modules.map((module) => <option key={module.id} value={module.id}>Aurora {module.name}</option>)}
      </select>

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

      <label htmlFor="launcher-monitor">Monitor preferido</label>
      <select id="launcher-monitor" value={preferred}
        disabled={busy || !mayChoose || !app?.executable || !app.capabilities.initialPlacement || (!eligibleMonitors.length && !preferred)}
        onChange={(event) => {
          const monitor = event.currentTarget.value || null
          void run(async () => {
            await chooseMonitor(id, monitor)
            return 'Preferência de monitor salva.'
          })
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
      {monitors.length > 0 && <details>
        <summary>Monitores detectados ({monitors.length})</summary>
        <ul>{monitors.map((monitor) => <li key={monitor.id ?? monitorLabel(monitor)}>{monitorLabel(monitor)}</li>)}</ul>
      </details>}
      <p className="launcher-message" role="status">{busy && !notice ? 'Aguardando operação…' : notice}</p>
    </dialog>
  )
}
