export const coreStates = ['idle', 'listening', 'thinking', 'speaking', 'executing', 'success', 'error', 'sleep'] as const

export type CoreState = (typeof coreStates)[number]

export interface CoreInput {
  state: CoreState
  /** An optional level in [0, 1], independent of the source of the audio. */
  amplitude?: number
  /** Direction and strength of orbital attention, in screen coordinates with Y up. */
  orbitEnergy?: { x: number; y: number }
}

const idle = {
  scale: 1, light: 1, warmth: 0, folds: 1, flow: 1, turn: 1, breath: 1,
  listening: 0, thinking: 0, speaking: 0, executing: 0, success: 0, error: 0,
}

const behaviors = {
  idle,
  listening: { ...idle, listening: 1, scale: 1.035, warmth: -0.36, flow: 0.82, turn: 0.55, breath: 0.64 },
  thinking: { ...idle, thinking: 1, scale: 0.97, warmth: -0.17, folds: 1.1, flow: 1.65, turn: 1.65 },
  speaking: { ...idle, speaking: 1, warmth: 0.25, light: 1.13, breath: 1.4, turn: 0.78 },
  executing: { ...idle, executing: 1, warmth: 0.08, light: 1.1, folds: 0.86, flow: 1.75, turn: 1.18 },
  success: { ...idle, success: 1, warmth: 0.36, light: 1.22, scale: 1.07, folds: 0.8, flow: 0.85 },
  error: { ...idle, error: 1, warmth: 0.52, light: 0.97, scale: 0.9, folds: 1.17, flow: 0.72, turn: 0.55 },
  sleep: { ...idle, scale: 0.78, warmth: -0.41, light: 0.46, folds: 0.58, flow: 0.28, turn: 0.24, breath: 0.47 },
} satisfies Record<CoreState, typeof idle>

const keys = Object.keys(idle) as (keyof typeof idle)[]

export function smooth(current: number, next: number, seconds: number, response: number) {
  return next + (current - next) * Math.exp(-seconds / response)
}

export class CoreMotion {
  readonly pose = { ...idle }
  flowTime = 0
  turnAngle = 0.22
  time = 0
  successAge = 2
  amplitude = 0

  private input: CoreInput = { state: 'idle' }

  setInput(input: CoreInput) {
    if (input.state === 'success' && this.input.state !== 'success') this.successAge = 0
    this.input = input
  }

  advance(seconds: number, reduced: boolean) {
    const target = behaviors[this.input.state]
    for (const key of keys) {
      this.pose[key] = reduced ? target[key] : smooth(this.pose[key], target[key], seconds, 0.25)
    }
    if (reduced) return

    const value = this.input.amplitude
    const amplitude = value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
    this.amplitude = smooth(this.amplitude, amplitude, seconds, amplitude > this.amplitude ? 0.065 : 0.19)
    this.time += seconds
    this.flowTime += seconds * this.pose.flow
    this.turnAngle = (this.turnAngle + seconds * this.pose.turn * 0.125) % (2 * Math.PI)
    this.successAge = Math.min(2, this.successAge + seconds)
  }
}
