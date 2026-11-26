import { StrictMode, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultGraphics } from './graphics/profiles'
import { useLauncherSnapshot } from './desktop/useLauncherSnapshot'
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
  const [settings, setSettings] = useState(defaultGraphics)
  const fullscreen = useFullscreen()
  const launcher = useLauncherSnapshot()

  return (
    <>
      {route === '#/nucleo'
        ? <CoreDemo settings={settings} onSettingsChange={setSettings} />
        : <AuroraHome settings={settings} fullscreen={fullscreen.fullscreen} onToggleFullscreen={fullscreen.toggle} launcher={launcher} />}
      <p className="fullscreen-notice" role="status">{fullscreen.notice}</p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuroraApp />
  </StrictMode>,
)
