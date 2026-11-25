import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { openModule } from '../domain/launcher'
import type { ModuleId } from '../domain/registry'
import { createModuleSelection, orbitalTransitionMs, type ModuleSelection } from '../domain/selection'
import { moduleNotice } from '../domain/state'
import { ParticleCore } from '../graphics/ParticleCore'
import type { GraphicsSettings } from '../graphics/profiles'
import { OrbitalConnections } from './OrbitalConnections'
import { orbitLayout, type OrbitLayout } from './orbitLayout'
import { ViewControls, viewModes, type ViewMode } from './ViewControls'

const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

function subscribeToMotion(onChange: () => void) {
  motion.addEventListener('change', onChange)
  return () => motion.removeEventListener('change', onChange)
}

interface Props {
  settings: GraphicsSettings
  fullscreen: boolean
  onToggleFullscreen: () => void
}

export function AuroraHome({ settings, fullscreen, onToggleFullscreen }: Props) {
  const [mode, setMode] = useState<ViewMode>('central')
  const [hovered, setHovered] = useState<ModuleId>()
  const [focused, setFocused] = useState<ModuleId>()
  const [selection, setSelection] = useState<ModuleSelection>(null)
  const [controller] = useState(() => createModuleSelection(openModule, setSelection))
  const [layout, setLayout] = useState<OrbitLayout>()
  const scene = useRef<HTMLElement>(null)
  const modeControl = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const reduced = useSyncExternalStore(subscribeToMotion, () => motion.matches)
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
    if (reduced) controller.finishTransition()
  }, [controller, reduced])

  const changeMode = useCallback((next: ViewMode) => {
    if (next === mode) return
    restoreFocus.current = true
    controller.dismiss()
    setHovered(undefined)
    setFocused(undefined)
    setMode(next)
  }, [controller, mode])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key === 'Escape' && !event.altKey) {
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

  }, [controller, changeMode, mode])

  return (
    <main className="home" data-mode={mode} style={{ '--orbital-duration': `${orbitalTransitionMs}ms` } as CSSProperties}>
      <header className={mode === 'central' ? 'brand' : 'sr-only'}>
        <span className="brand-mark" aria-hidden="true" />
        <h1 className="brand-name" aria-label="Aurora Central">Aurora</h1>
        <p className="brand-detail">Ecosystem</p>
      </header>

      <section ref={scene} className="scene" aria-label="Ecossistema Aurora">
        <ParticleCore
          state={command && !reduced ? 'executing' : 'idle'}
          orbitEnergy={direction && { x: direction.x * strength, y: direction.y * strength }}
          settings={settings}
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
                    aria-describedby={module.availability === 'unavailable' ? 'module-availability' : undefined}
                    onPointerEnter={(event) => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') setHovered(module.id) }}
                    onPointerLeave={() => setHovered(undefined)}
                    onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setFocused(module.id) }}
                    onBlur={() => setFocused(undefined)}
                    onClick={() => controller.select(module.id, !motion.matches)}
                  >
                    <span className={`module-icon icon-${module.icon}`} aria-hidden="true">
                      <i /><i /><i /><i />
                    </span>
                    <span className="module-name"><small>Aurora</small>{module.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <footer className="home-footer">
        <p id="module-availability" className="sr-only">Abertura de aplicativos indisponível nesta versão.</p>
        <p className="status" role="status">
          {result && selectedModule && (
            <span key={result.requestId}><strong>Aurora {selectedModule.name}</strong> {moduleNotice(result)}</span>
          )}
        </p>
        {mode === 'central' && <a href="#/nucleo" className="core-link home-core-link">Demonstração do núcleo</a>}
        <ViewControls mode={mode} fullscreen={fullscreen} modeControl={modeControl} onChange={changeMode} onToggleFullscreen={onToggleFullscreen} />
      </footer>
    </main>
  )
}
