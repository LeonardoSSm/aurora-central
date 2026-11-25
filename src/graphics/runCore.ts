import { Vector2 } from 'three'
import { CoreMotion, smooth, type CoreInput } from './behavior'
import { FramePacer, frameLimit, inactivityDelay } from './pacing'
import { type GraphicsSettings } from './profiles'
import { createParticleRenderer } from './renderer'

export function runCore(canvas: HTMLCanvasElement, input: CoreInput, settings: GraphicsSettings) {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const motion = new CoreMotion()
  const pointer = new Vector2()
  const destination = new Vector2()
  const orbitEnergy = new Vector2()
  const pacer = new FramePacer()
  let renderer: ReturnType<typeof createParticleRenderer> = null
  let raf: number | undefined
  let timer: number | undefined
  let recovery: number | undefined
  let lastDraw: number | undefined
  let lastInput = performance.now()
  let dimensions = { width: 0, height: 0, dpr: 0 }
  let reduced = motionPreference.matches
  let contextLost = false
  let renderFailed = false

  motion.setInput(input)

  function limit(now: number) {
    return frameLimit(
      settings.fps, document.hidden, document.hasFocus(), now - lastInput >= inactivityDelay, input.state === 'sleep',
    )
  }

  function stop() {
    if (raf !== undefined) window.cancelAnimationFrame(raf)
    if (timer !== undefined) window.clearTimeout(timer)
    raf = timer = lastDraw = undefined
    pacer.reset()
  }

  function draw(seconds: number) {
    if (!renderer || contextLost || renderFailed || document.hidden || !dimensions.width || !dimensions.height) return
    motion.advance(seconds, reduced)
    pointer.set(smooth(pointer.x, destination.x, seconds, 0.28), smooth(pointer.y, destination.y, seconds, 0.28))
    orbitEnergy.set(
      reduced ? 0 : smooth(orbitEnergy.x, input.orbitEnergy?.x ?? 0, seconds, 0.21),
      reduced ? 0 : smooth(orbitEnergy.y, input.orbitEnergy?.y ?? 0, seconds, 0.21),
    )
    renderFailed = !renderer.draw(motion, pointer, orbitEnergy, reduced)
    canvas.dataset.rendering = renderFailed ? 'fallback' : 'webgl'
  }

  function resize(force = false) {
    if (!renderer || contextLost) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, settings.dpr)
    if (!width || !height) {
      dimensions = { width, height, dpr }
      return
    }
    if (!force && dimensions.width === width && dimensions.height === height && dimensions.dpr === dpr) return
    dimensions = { width, height, dpr }
    renderer.resize(width, height, dpr)
    draw(0)
  }

  function tick(now: number) {
    raf = undefined
    const fps = limit(now)
    if (!fps || !renderer || contextLost || renderFailed || reduced) return

    if (pacer.ready(now, fps)) {
      draw(lastDraw === undefined ? 0 : Math.min((now - lastDraw) / 1000, 0.1))
      lastDraw = now
    }
    if (renderFailed) return
    const delay = pacer.delay(performance.now(), fps)
    if (delay > 0) {
      timer = window.setTimeout(() => {
        timer = undefined
        raf = window.requestAnimationFrame(tick)
      }, delay)
    } else {
      raf = window.requestAnimationFrame(tick)
    }
  }

  function sync() {
    stop()
    if (!renderer || contextLost || renderFailed || document.hidden) return
    if (reduced) draw(0)
    else raf = window.requestAnimationFrame(tick)
  }

  function changeMotionPreference(event: MediaQueryListEvent) {
    reduced = event.matches
    sync()
  }

  function wake() {
    const now = performance.now()
    const inactive = now - lastInput >= inactivityDelay
    lastInput = now
    if (inactive) sync()
  }

  function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    destination.set(2 * event.clientX / window.innerWidth - 1, 1 - 2 * event.clientY / window.innerHeight)
    wake()
  }

  function resetPointer() {
    destination.set(0, 0)
  }

  function blur() {
    resetPointer()
    sync()
  }

  function focus() {
    lastInput = performance.now()
    sync()
  }

  function lose(event: Event) {
    event.preventDefault()
    if (recovery !== undefined) window.clearTimeout(recovery)
    recovery = undefined
    contextLost = true
    stop()
    canvas.dataset.rendering = 'fallback'
  }

  function restore() {
    contextLost = false
    renderFailed = false
    try {
      renderer ??= createParticleRenderer(canvas)
      renderer?.restored()
      renderer?.setProfile(settings.profile)
      resize(true)
      sync()
    } catch (error) {
      console.error('Aurora WebGL', error)
      renderer?.dispose()
      renderer = null
    }
    if (!renderer) canvas.dataset.rendering = 'fallback'
  }

  function queueRestore() {
    // Let Three.js rebuild its GL state before submitting the static reduced-motion frame.
    recovery = window.setTimeout(() => {
      recovery = undefined
      restore()
    }, 0)
  }

  const onResize = () => resize()
  const observer = new ResizeObserver(onResize)
  observer.observe(canvas)
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake)
  document.documentElement.addEventListener('pointerleave', resetPointer)
  window.addEventListener('focus', focus)
  window.addEventListener('blur', blur)
  canvas.addEventListener('webglcontextlost', lose)
  canvas.addEventListener('webglcontextrestored', queueRestore)
  motionPreference.addEventListener('change', changeMotionPreference)
  document.addEventListener('visibilitychange', sync)
  restore()

  return {
    update(nextInput: CoreInput, nextSettings: GraphicsSettings) {
      const profileChanged = settings.profile !== nextSettings.profile
      const sizeChanged = profileChanged || settings.dpr !== nextSettings.dpr
      const pacingChanged = settings.fps !== nextSettings.fps
        || (input.state === 'sleep') !== (nextInput.state === 'sleep')
      const stateChanged = input.state !== nextInput.state
      settings = nextSettings
      input = nextInput
      motion.setInput(input)
      if (profileChanged) renderer?.setProfile(settings.profile)
      if (sizeChanged) resize(true)
      if (pacingChanged || (stateChanged && reduced && !sizeChanged)) sync()
    },
    dispose() {
      stop()
      if (recovery !== undefined) window.clearTimeout(recovery)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      document.documentElement.removeEventListener('pointerleave', resetPointer)
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      canvas.removeEventListener('webglcontextlost', lose)
      canvas.removeEventListener('webglcontextrestored', queueRestore)
      motionPreference.removeEventListener('change', changeMotionPreference)
      document.removeEventListener('visibilitychange', sync)
      renderer?.dispose()
    },
  }
}
