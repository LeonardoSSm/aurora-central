export const inactivityDelay = 45_000

export function frameLimit(fps: number, hidden: boolean, focused: boolean, inactive: boolean, sleeping: boolean) {
  if (hidden) return 0
  if (!focused || sleeping) return Math.min(fps, 20)
  return inactive ? Math.min(fps, 30) : fps
}

export class FramePacer {
  private due: number | undefined
  private limit = 0

  reset() {
    this.due = undefined
  }

  ready(now: number, fps: number) {
    if (this.limit !== fps) {
      this.reset()
      this.limit = fps
    }
    const due = this.due ?? now
    if (now < due - 0.7) return false

    const interval = 1000 / fps
    this.due = now - due >= interval ? now + interval : due + interval
    return true
  }

  delay(now: number, fps: number) {
    // At lower rates, wait before requesting a refresh so the page can stay idle.
    if (fps > 30 || this.due === undefined) return 0
    return Math.max(0, this.due - now - 17)
  }
}
