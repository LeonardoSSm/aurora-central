import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModuleOpenSettled } from './events'
import { openModule } from './launcher'
import { createModuleSelection, orbitalTransitionMs, type ModuleSelection } from './selection'

describe('orbital selection', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for the visual transition, then dispatches a repeated selection only once', async () => {
    const launch = vi.fn(openModule)
    const publish = vi.fn<(selection: ModuleSelection) => void>()
    const selection = createModuleSelection(launch, publish)

    selection.select('board', true)
    await vi.advanceTimersByTimeAsync(orbitalTransitionMs - 1)
    selection.select('board', true)
    expect(launch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    const command = { type: 'module.open', moduleId: 'board', requestId: 1 } as const
    expect(launch).toHaveBeenCalledExactlyOnceWith(command)
    expect(publish).toHaveBeenLastCalledWith({ phase: 'settled', event: openModule(command) })
  })

  it('cancels superseded and dismissed requests before invoking the launcher', async () => {
    const launch = vi.fn(openModule)
    const publish = vi.fn<(selection: ModuleSelection) => void>()
    const selection = createModuleSelection(launch, publish)

    selection.select('control', true)
    selection.select('nexus', true)
    selection.dismiss()
    await vi.runAllTimersAsync()

    expect(launch).not.toHaveBeenCalled()
    expect(publish).toHaveBeenCalledWith({
      phase: 'cancelled',
      event: { type: 'module.open.cancelled', moduleId: 'control', requestId: 1, reason: 'superseded' },
    })
    expect(publish).toHaveBeenCalledWith({
      phase: 'cancelled',
      event: { type: 'module.open.cancelled', moduleId: 'nexus', requestId: 2, reason: 'dismissed' },
    })
    expect(publish).toHaveBeenLastCalledWith(null)
  })

  it('ignores a late settlement after a newer selection', async () => {
    let resolveFirst!: (event: ModuleOpenSettled) => void
    const first = new Promise<ModuleOpenSettled>((resolve) => { resolveFirst = resolve })
    const publish = vi.fn<(selection: ModuleSelection) => void>()
    const selection = createModuleSelection((command) => (
      command.moduleId === 'board' ? first : openModule(command)
    ), publish)

    selection.select('board', false)
    selection.select('lens', false)
    resolveFirst(openModule({ type: 'module.open', moduleId: 'board', requestId: 1 }))
    await vi.runAllTimersAsync()

    expect(publish).toHaveBeenLastCalledWith({
      phase: 'settled',
      event: openModule({ type: 'module.open', moduleId: 'lens', requestId: 2 }),
    })
  })

  it('can finish immediately on reduced motion and reports adapter errors', async () => {
    const launch = vi.fn().mockRejectedValue(new Error('adapter unavailable'))
    const publish = vi.fn<(selection: ModuleSelection) => void>()
    const selection = createModuleSelection(launch, publish)

    selection.select('lens', true)
    selection.finishTransition()
    await vi.runAllTimersAsync()

    expect(launch).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenLastCalledWith({
      phase: 'settled',
      event: {
        type: 'module.open.settled',
        moduleId: 'lens',
        requestId: 1,
        result: { status: 'failed', reason: 'platform-error' },
      },
    })
  })
})
