import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { desktopAvailable, openRegisteredModule } from '../desktop/platform'
import type { Settings, SettingsSnapshot } from '../desktop/persistence'
import type { useLauncherSnapshot } from '../desktop/useLauncherSnapshot'
import { createModuleLauncher } from '../domain/launcher'
import type { ModuleId } from '../domain/registry'
import { createModuleSelection, orbitalTransitionMs, type ModuleSelection } from '../domain/selection'
import { moduleNotice } from '../domain/state'
import { ParticleCore } from '../graphics/ParticleCore'
import type { CoreInput } from '../graphics/behavior'
import type { GraphicsSettings } from '../graphics/profiles'
import { createConversation, type Conversation } from '../intelligence/conversation'
import { deviceRecognition, deviceSpeech } from '../intelligence/deviceSpeech'
import { createCommandRegistry } from '../intelligence/registry'
import { simulatedAssistant, simulatedSpeech } from '../intelligence/simulation'
import { ConversationPanel } from './ConversationPanel'
import { OrbitalConnections } from './OrbitalConnections'
import { SettingsDialog, type SettingsCategory } from './SettingsDialog'
import { orbitLayout, type OrbitLayout } from './orbitLayout'
import { ViewControls, viewModes, type ViewMode } from './ViewControls'

const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
const openModule = createModuleLauncher(openRegisteredModule)

function subscribeToMotion(onChange: () => void) {
  motion.addEventListener('change', onChange)
  return () => motion.removeEventListener('change', onChange)
}

function HomeCore({ conversation, orbitalExecution, orbitEnergy, settings, reduced }: {
  conversation: Conversation
  orbitalExecution: boolean
  orbitEnergy: CoreInput['orbitEnergy']
  settings: GraphicsSettings
  reduced: boolean
}) {
  const { state, amplitude } = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot)
  return <ParticleCore state={orbitalExecution ? 'executing' : state}
    amplitude={amplitude} orbitEnergy={orbitEnergy} settings={settings} reduced={reduced} />
}

interface Props {
  snapshot: SettingsSnapshot
  demoGraphics?: GraphicsSettings
  onSaveSettings: (settings: Settings, revision: number) => Promise<SettingsSnapshot>
  fullscreen: boolean
  onToggleFullscreen: () => void
  launcher: ReturnType<typeof useLauncherSnapshot>
}

export function AuroraHome({ snapshot, demoGraphics, onSaveSettings, fullscreen, onToggleFullscreen, launcher }: Props) {
  const [mode, setMode] = useState<ViewMode>(snapshot.settings.initialView)
  const [hovered, setHovered] = useState<ModuleId>()
  const [focused, setFocused] = useState<ModuleId>()
  const [selection, setSelection] = useState<ModuleSelection>(null)
  const [controller] = useState(() => createModuleSelection(openModule, setSelection))
  const [layout, setLayout] = useState<OrbitLayout>()
  const [configuring, setConfiguring] = useState<SettingsCategory>()
  const [preview, setPreview] = useState<Settings>()
  const [conversing, setConversing] = useState(false)
  const [conversation] = useState(() => createConversation({
    assistant: simulatedAssistant,
    permissions: ['modules:read', 'modules:open'],
    commands: createCommandRegistry(openRegisteredModule),
    voice: deviceRecognition, voiceSimulation: simulatedSpeech, speech: deviceSpeech,
    desktop: desktopAvailable(),
  }))
  const scene = useRef<HTMLElement>(null)
  const modeControl = useRef<HTMLButtonElement>(null)
  const conversationToggle = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const systemReduced = useSyncExternalStore(subscribeToMotion, () => motion.matches)
  const forceReduced = (preview ?? snapshot.settings).motion === 'reduced'
  const reduced = forceReduced || systemReduced
  const settings = preview?.graphics ?? demoGraphics ?? snapshot.settings.graphics

  function openSettings(category: SettingsCategory) {
    controller.dismiss()
    if (conversing) closeConversation()
    setPreview(snapshot.settings)
    setConfiguring(category)
  }
  const command = selection && 'command' in selection ? selection.command : undefined
  const pulse = selection?.phase === 'transitioning' ? selection.command : undefined
  const result = selection?.phase === 'settled' ? selection.event : undefined
  const active = command?.moduleId ?? hovered ?? focused
  const selectedModule = layout?.slots.find(({ module }) => module.id === result?.moduleId)?.module
  const direction = layout?.slots.find(({ module }) => module.id === active)?.direction
  const strength = command ? 1 : 0.72

  useLayoutEffect(() => {
    const element = scene.current!
    const update = () => {
      const { clientWidth: width, clientHeight: height } = element
      setLayout((previous) => (
        previous?.width === width && previous.height === height ? previous : orbitLayout(width, height)
      ))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (restoreFocus.current) modeControl.current?.focus({ preventScroll: true })
    restoreFocus.current = false
  }, [mode])

  useEffect(() => () => controller.dispose(), [controller])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') conversation.cancelVoice()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      conversation.reset()
    }
  }, [conversation])

  useEffect(() => {
    if (reduced) controller.finishTransition()
  }, [controller, reduced])

  const closeConversation = useCallback(() => {
    conversation.reset()
    setConversing(false)
  }, [conversation])

  const dismissConversation = useCallback(() => {
    closeConversation()
    conversationToggle.current?.focus({ preventScroll: true })
  }, [closeConversation])

  const changeMode = useCallback((next: ViewMode) => {
    if (next === mode) return
    restoreFocus.current = true
    controller.dismiss()
    closeConversation()
    setHovered(undefined)
    setFocused(undefined)
    setMode(next)
  }, [controller, mode, closeConversation])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (configuring || event.repeat || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key === 'Escape' && !event.altKey) {
        if (conversing) dismissConversation()
        if (mode === 'central') controller.dismiss()
        else changeMode('central')
      }
      if (!event.altKey) return
      const requested = viewModes.find((view) => event.code === `Digit${view.key}`)
      if (requested) {
        event.preventDefault()
        changeMode(requested.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)

  }, [controller, changeMode, configuring, conversing, dismissConversation, mode])

  return (
    <main className="home" data-mode={mode} data-conversing={conversing} data-reduced={reduced}
      style={{ '--orbital-duration': `${orbitalTransitionMs}ms` } as CSSProperties}>
      <header className={mode === 'central' ? 'brand' : 'sr-only'}>
        <span className="brand-mark" aria-hidden="true" />
        <h1 className="brand-name" aria-label="Aurora Central">Aurora</h1>
        <p className="brand-detail">Ecosystem</p>
      </header>

      <section ref={scene} className="scene" aria-label="Ecossistema Aurora">
        <HomeCore
          conversation={conversation}
          orbitalExecution={Boolean(command && !reduced)}
          orbitEnergy={direction && { x: direction.x * strength, y: direction.y * strength }}
          settings={settings}
          reduced={forceReduced}
        />
        {mode !== 'ambiental' && layout && (
          <>
            <OrbitalConnections layout={layout} front={false} active={active} pulse={pulse} />
            <OrbitalConnections layout={layout} front active={active} pulse={pulse} />
            <ul className="module-list" aria-label="Módulos Aurora">
              {layout.slots.map(({ module, left, top }) => (
                <li key={module.id} className="module-slot" data-active={active === module.id}
                  data-launching={command?.moduleId === module.id}
                  style={{ left, top, width: layout.buttonWidth, height: layout.buttonHeight, '--module-accent': module.accent } as CSSProperties}
                >
                  <button
                    className="module"
                    type="button"
                    aria-label={`Aurora ${module.name}`}
                    aria-describedby={`availability-${module.id}`}
                    onPointerEnter={(event) => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') setHovered(module.id) }}
                    onPointerLeave={() => setHovered(undefined)}
                    onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setFocused(module.id) }}
                    onBlur={() => setFocused(undefined)}
                    onClick={() => {
                      if (conversing) closeConversation()
                      controller.select(module.id, !reduced)
                    }}
                  >
                    <span className={`module-icon icon-${module.icon}`} aria-hidden="true">
                      <i /><i /><i /><i />
                    </span>
                    <span className="module-name"><small>Aurora</small>{module.name}</span>
                  </button>
                  <span id={`availability-${module.id}`} className="sr-only">
                    {moduleNotice(launcher.snapshot?.applications.find((app) => app.id === module.id)?.state
                      ?? { status: desktopAvailable() ? 'unavailable' : 'browser' })}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {conversing && <ConversationPanel conversation={conversation}
        providerName={simulatedAssistant.name} onClose={dismissConversation} />}

      <footer className="home-footer">
        <p className="status" role="status">
          {selection?.phase === 'opening' && <span>Verificando abertura…</span>}
          {result && selectedModule && (
            <span key={result.requestId}><strong>Aurora {selectedModule.name}</strong> {moduleNotice(result.result)}</span>
          )}
        </p>
        {mode === 'central' && <div className="home-links">
          <button ref={conversationToggle} className="core-link settings-link" type="button"
            aria-expanded={conversing} aria-controls={conversing ? 'conversation' : undefined}
            onClick={() => {
              if (conversing) dismissConversation()
              else {
                controller.dismiss()
                setConversing(true)
              }
            }}>Conversa</button>
          <a href="#/nucleo" className="core-link">Demonstração do núcleo</a>
          {desktopAvailable() && <button className="core-link settings-link" type="button" aria-haspopup="dialog"
            onClick={() => openSettings('applications')}>Aplicativos</button>}
          <button className="core-link settings-link" type="button" aria-haspopup="dialog"
            onClick={() => openSettings('general')}>Configurações</button>
        </div>}
        <ViewControls mode={mode} fullscreen={fullscreen} modeControl={modeControl} onChange={changeMode} onToggleFullscreen={onToggleFullscreen} />
      </footer>
      {configuring && <SettingsDialog initialCategory={configuring} snapshot={snapshot} launcher={launcher}
        onPreview={setPreview} onSave={onSaveSettings} onDismiss={() => {
          setPreview(undefined)
          setConfiguring(undefined)
        }} />}
    </main>
  )
}
