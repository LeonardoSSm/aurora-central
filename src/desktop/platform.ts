import type { OpenModuleCommand } from '../domain/commands'
import type { ModuleOpenResult } from '../domain/events'

/** Boundary for a future native adapter with validated, registered applications. */
export interface DesktopPlatform {
  openRegisteredModule(command: OpenModuleCommand): Promise<ModuleOpenResult>
}
