import type { OpenModuleCommand } from './commands'
import type { ModuleOpenSettled } from './events'

export function openModule(command: OpenModuleCommand): ModuleOpenSettled {
  return {
    type: 'module.open.settled',
    moduleId: command.moduleId,
    result: { status: 'unavailable' },
  }
}
