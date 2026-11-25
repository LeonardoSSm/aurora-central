import type { OpenModuleCommand } from './commands'
import type { ModuleOpenCancelled, ModuleOpenSettled } from './events'
import type { ModuleLauncher } from './launcher'
import type { ModuleId } from './registry'

export const orbitalTransitionMs = 540

export type ModuleSelection =
  | { phase: 'transitioning' | 'opening'; command: OpenModuleCommand }
  | { phase: 'settled'; event: ModuleOpenSettled }
  | { phase: 'cancelled'; event: ModuleOpenCancelled }
  | null

export function createModuleSelection(
  launch: ModuleLauncher,
  publish: (selection: ModuleSelection) => void,
  duration = orbitalTransitionMs,
) {
  let sequence = 0
  let pending: OpenModuleCommand | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTransition() {
    clearTimeout(timer)
    timer = undefined
  }

  function cancel(reason: ModuleOpenCancelled['reason']) {
    const command = pending
    pending = undefined
    if (timer === undefined || !command) return
    clearTransition()
    publish({
      phase: 'cancelled',
      event: { type: 'module.open.cancelled', moduleId: command.moduleId, requestId: command.requestId, reason },
    })
  }

  function settle(command: OpenModuleCommand, event: ModuleOpenSettled) {
    if (pending !== command) return
    pending = undefined
    publish({ phase: 'settled', event })
  }

  async function open(command: OpenModuleCommand) {
    clearTransition()
    publish({ phase: 'opening', command })
    try {
      settle(command, await launch(command))
    } catch {
      settle(command, {
        type: 'module.open.settled',
        moduleId: command.moduleId,
        requestId: command.requestId,
        result: { status: 'failed', reason: 'platform-error' },
      })
    }
  }

  return {
    select(moduleId: ModuleId, animate: boolean) {
      if (pending?.moduleId === moduleId) return
      cancel('superseded')
      const command: OpenModuleCommand = { type: 'module.open', moduleId, requestId: ++sequence }
      pending = command
      if (animate) {
        timer = setTimeout(() => void open(command), duration)
        publish({ phase: 'transitioning', command })
      } else {
        void open(command)
      }
    },
    finishTransition() {
      if (timer !== undefined && pending) void open(pending)
    },
    dismiss() {
      cancel('dismissed')
      publish(null)
    },
    dispose() {
      clearTransition()
      pending = undefined
    },
  }
}
