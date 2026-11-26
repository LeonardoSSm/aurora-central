import type { OpenModuleCommand } from './commands'
import type { ModuleOpenResult, ModuleOpenSettled } from './events'
import type { ModuleId } from './registry'

export type ModuleLauncher = (command: OpenModuleCommand) => ModuleOpenSettled | Promise<ModuleOpenSettled>

export function createModuleLauncher(
  open: (moduleId: ModuleId) => Promise<ModuleOpenResult>,
): ModuleLauncher {
  return async ({ moduleId, requestId }) => {
    const result = await open(moduleId)
    return { type: 'module.open.settled', moduleId, requestId, result }
  }
}
