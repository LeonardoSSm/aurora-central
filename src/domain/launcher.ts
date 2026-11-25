import type { OpenModuleCommand } from './commands'
import type { ModuleOpenSettled } from './events'

export type ModuleLauncher = (command: OpenModuleCommand) => ModuleOpenSettled | Promise<ModuleOpenSettled>

export function openModule(command: OpenModuleCommand): ModuleOpenSettled {
  return {
    type: 'module.open.settled',
    moduleId: command.moduleId,
    requestId: command.requestId,
    result: { status: 'unavailable' },
  }
}
