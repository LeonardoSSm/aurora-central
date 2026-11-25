import { useCallback, useEffect, useRef, useState } from 'react'
import { setWindowFullscreen } from '../desktop/fullscreen'

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const active = useRef(false)
  const pending = useRef<Promise<void> | null>(null)

  const apply = useCallback(function apply(next: boolean) {
    if (pending.current) {
      if (!next) void pending.current.then(() => apply(false))
      return
    }
    if (active.current === next) return

    setNotice('')
    pending.current = setWindowFullscreen(next).then(() => {
      active.current = next
      setFullscreen(next)
    }).catch(() => {
      setNotice(next ? 'Não foi possível ativar a tela cheia.' : 'Não foi possível sair da tela cheia.')
    }).finally(() => { pending.current = null })
  }, [])

  const toggle = useCallback(() => apply(!active.current), [apply])

  useEffect(() => {
    function syncBrowserFullscreen() {
      active.current = Boolean(document.fullscreenElement)
      setFullscreen(active.current)
    }

    function shortcuts(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key === 'F11') {
        event.preventDefault()
        toggle()
      }
      if (event.key === 'Escape' && (active.current || pending.current)) apply(false)
    }

    document.addEventListener('fullscreenchange', syncBrowserFullscreen)
    window.addEventListener('keydown', shortcuts)
    return () => {
      document.removeEventListener('fullscreenchange', syncBrowserFullscreen)
      window.removeEventListener('keydown', shortcuts)
    }
  }, [apply, toggle])

  return { fullscreen, toggle, notice }
}
