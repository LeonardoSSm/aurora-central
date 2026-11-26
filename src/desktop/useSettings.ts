import { useEffect, useState } from 'react'
import { defaultSettings, readSettings, saveSettings, type Settings, type SettingsSnapshot } from './persistence'
import { desktopAvailable } from './platform'

const defaultSnapshot: SettingsSnapshot = { settings: defaultSettings, status: 'ready', revision: 0 }

export function useSettings() {
  const desktop = desktopAvailable()
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(() => desktop ? undefined : defaultSnapshot)

  useEffect(() => {
    if (!desktop) return
    let active = true
    void readSettings().then((next) => {
      if (active) setSnapshot(next)
    }).catch(() => {
      if (active) setSnapshot({ ...defaultSnapshot, status: 'unavailable' })
    })
    return () => { active = false }
  }, [desktop])

  async function save(settings: Settings, revision: number) {
    const next = desktop
      ? await saveSettings(settings, revision).catch(async (error: unknown) => {
        if (error === 'conflict') {
          const latest = await readSettings().catch(() => ({ ...defaultSnapshot, status: 'unavailable' } as const))
          setSnapshot(latest)
        }
        throw error
      })
      : { ...defaultSnapshot, settings, revision: revision + 1 }
    setSnapshot(next)
    return next
  }

  return { snapshot, save }
}
