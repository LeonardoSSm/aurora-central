import { useEffect, useRef, useState } from 'react'
import type { CoreInput } from './behavior'
import type { GraphicsSettings } from './profiles'
import { runCore } from './runCore'

interface ParticleCoreProps extends CoreInput {
  settings: GraphicsSettings
  reduced?: boolean
}

export function ParticleCore({ state, amplitude, orbitEnergy, settings, reduced = false }: ParticleCoreProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const runtime = useRef<ReturnType<typeof runCore>>(null)
  const [initial] = useState(() => ({ input: { state, amplitude, orbitEnergy }, settings, reduced }))

  useEffect(() => {
    if (!canvas.current) return
    const core = runCore(canvas.current, initial.input, initial.settings, initial.reduced)
    runtime.current = core
    return () => {
      runtime.current = null
      core.dispose()
    }
  }, [initial])

  useEffect(() => {
    runtime.current?.update({ state, amplitude, orbitEnergy }, settings, reduced)
  }, [state, amplitude, orbitEnergy, settings, reduced])

  return (
    <div className="core" data-state={state}>
      <canvas ref={canvas} aria-hidden="true" />
      <p className="core-fallback" role="status">Núcleo Aurora indisponível. Aguardando WebGL 2.</p>
    </div>
  )
}
