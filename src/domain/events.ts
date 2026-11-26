import type { ModuleId } from './registry'

export type LauncherFault =
  | 'invalid-executable' | 'approval-changed' | 'already-registered' | 'invalid-monitor'
  | 'storage' | 'spawn' | 'exited-early' | 'process-discovery' | 'dialog-busy' | 'dialog' | 'platform'

export type Placement = 'not-requested' | 'requested' | 'confirmed' | 'fallback-requested' | 'fallback-confirmed' | 'unavailable'

export type ApplicationState =
  | { readonly status: 'not-configured' | 'not-installed' | 'available' | 'starting' | 'unavailable' }
  | { readonly status: 'running'; readonly window: 'detected' | 'not-detected' | 'unsupported'; readonly placement: Placement }
  | { readonly status: 'focus-requested'; readonly focus: 'confirmed' | 'requested' | 'denied' }
  | { readonly status: 'error'; readonly reason: LauncherFault }

export type ModuleOpenResult = ApplicationState
  | { readonly status: 'finished' | 'timeout' }
  | { readonly status: 'browser' }

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
