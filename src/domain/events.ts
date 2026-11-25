import type { ModuleId } from './registry'

export type ModuleOpenResult =
  | { readonly status: 'unavailable' }
  | { readonly status: 'opened' }
  | { readonly status: 'failed'; readonly reason: 'platform-error' }

export interface ModuleOpenSettled {
  readonly type: 'module.open.settled'
  readonly moduleId: ModuleId
  readonly result: ModuleOpenResult
}
