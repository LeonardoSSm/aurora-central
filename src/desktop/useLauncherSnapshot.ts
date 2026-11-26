import { useCallback, useEffect, useRef, useState } from 'react'
import { desktopAvailable, launcherSnapshot, type LauncherSnapshot } from './platform'

export function useLauncherSnapshot() {
  const [snapshot, setSnapshot] = useState<LauncherSnapshot>()
  const [failed, setFailed] = useState(false)
  const applied = useRef(0)
  const sequence = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try {
      const next = await launcherSnapshot()
      if (request <= applied.current) return
      applied.current = request
      setSnapshot((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
      setFailed(false)
    } catch {
      if (request <= applied.current) return
      applied.current = request
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    if (!desktopAvailable()) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      await refresh()
      if (active) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [refresh])

  return { snapshot, failed, refresh }
}
