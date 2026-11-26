import { StrictMode, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import type { GraphicsSettings } from './graphics/profiles'
import { useLauncherSnapshot } from './desktop/useLauncherSnapshot'
import { useSettings } from './desktop/useSettings'
import { AuroraHome } from './ui/AuroraHome'
import { CoreDemo } from './ui/CoreDemo'
import { useFullscreen } from './ui/useFullscreen'
import './ui/home.css'

function subscribeToRoute(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getRoute() {
  return window.location.hash
}

function AuroraApp() {
  const route = useSyncExternalStore(subscribeToRoute, getRoute)
  const [demoGraphics, setDemoGraphics] = useState<GraphicsSettings>()
  const { snapshot, save } = useSettings()
  const fullscreen = useFullscreen()
  const launcher = useLauncherSnapshot()

  if (!snapshot) return <p className="fullscreen-notice" role="status">Carregando preferências…</p>

  return (
    <>
      {route === '#/nucleo'
        ? <CoreDemo settings={demoGraphics ?? snapshot.settings.graphics} reduced={snapshot.settings.motion === 'reduced'}
          onSettingsChange={setDemoGraphics} />
        : <AuroraHome snapshot={snapshot} demoGraphics={demoGraphics} fullscreen={fullscreen.fullscreen}
          onSaveSettings={async (settings, revision) => {
            const result = await save(settings, revision)
            setDemoGraphics(undefined)
            return result
          }} onToggleFullscreen={fullscreen.toggle} launcher={launcher} />}
      <p className="fullscreen-notice" role="status">{fullscreen.notice}</p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuroraApp />
  </StrictMode>,
)
