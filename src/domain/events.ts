import type { ModuleId } from './registry'

export type ModuleOpenResult =
  | { readonly status: 'unavailable' }
  | { readonly status: 'opened' }
  | { readonly status: 'failed'; readonly reason: 'platform-error' }

export interface ModuleOpenSettled {
  readonly type: 'module.open.settled'
  readonly moduleId: ModuleId
  readonly requestId: number
  readonly result: ModuleOpenResult
}

/** The visual transition was interrupted before the command reached the launcher. */
export interface ModuleOpenCancelled {
  readonly type: 'module.open.cancelled'
  readonly moduleId: ModuleId
  readonly requestId: number
  readonly reason: 'superseded' | 'dismissed'
}
