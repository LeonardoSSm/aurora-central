import { useEffect, useRef } from 'react'
import { createParticleRenderer } from './renderer'

export function ParticleCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let renderer: ReturnType<typeof createParticleRenderer> = null
    let frame: number | undefined
    let lastFrame: number | undefined
    let elapsed = 0
    let ratio = 1

    function stop() {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      frame = undefined
      lastFrame = undefined
    }

    function draw(time: number) {
      if (!renderer || !canvas || document.hidden) return
      if (canvas.width === 0 || canvas.height === 0) return

      renderer.draw(time, canvas.width, canvas.height, ratio)
    }

    function resize() {
      if (!canvas) return
      ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.round(canvas.clientWidth * ratio)
      const height = Math.round(canvas.clientHeight * ratio)

      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      draw(motion.matches ? 0 : elapsed)
    }

    function tick(now: number) {
      elapsed += lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now
      draw(elapsed)
      frame = window.requestAnimationFrame(tick)
    }

    function sync() {
      stop()
      if (!renderer || document.hidden) return
      if (motion.matches) draw(0)
      else frame = window.requestAnimationFrame(tick)
    }

    function restore() {
      if (!canvas) return
      renderer = createParticleRenderer(canvas)
      canvas.dataset.rendering = renderer ? 'webgl' : 'fallback'
      resize()
      sync()
    }

    function lose(event: Event) {
      event.preventDefault()
      stop()
      renderer = null
      if (canvas) canvas.dataset.rendering = 'fallback'
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    canvas.addEventListener('webglcontextlost', lose)
    canvas.addEventListener('webglcontextrestored', restore)
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    restore()

    return () => {
      stop()
      observer.disconnect()
      window.removeEventListener('resize', resize)
      renderer?.dispose()
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      canvas.removeEventListener('webglcontextlost', lose)
      canvas.removeEventListener('webglcontextrestored', restore)
    }
  }, [])

  return (
    <div className="core" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
