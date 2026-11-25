import type { ModuleId } from './registry'

export interface OpenModuleCommand {
  readonly type: 'module.open'
  readonly moduleId: ModuleId
  readonly requestId: number
}
