import { StrictMode, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultGraphics } from './graphics/profiles'
import { AuroraHome } from './ui/AuroraHome'
import { CoreDemo } from './ui/CoreDemo'
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

  return route === '#/nucleo'
    ? <CoreDemo settings={settings} onSettingsChange={setSettings} />
    : <AuroraHome settings={settings} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuroraApp />
  </StrictMode>,
)
