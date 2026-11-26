import { invoke, isTauri } from '@tauri-apps/api/core'
import { abortableDelay, untilAborted } from '../domain/abort'
import type { ApplicationState, LauncherFault, ModuleOpenResult } from '../domain/events'
import type { ModuleId } from '../domain/registry'

export interface RegisteredApplication {
  readonly id: ModuleId
  readonly executable: string | null
  readonly preferredMonitor: string | null
  readonly strategy: 'external-window' | 'self-positioned'
  readonly capabilities: {
    readonly externalLaunch: boolean
    readonly windowFocus: boolean
    readonly initialPlacement: boolean
  }
  readonly state: ApplicationState
}

export interface DesktopMonitor {
  readonly id: string | null
  readonly name: string
  readonly primary: boolean
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly scale: number
}

export interface LauncherSnapshot {
  readonly applications: readonly RegisteredApplication[]
  readonly monitors: readonly DesktopMonitor[]
  readonly environment: 'windows' | 'x11' | 'wayland' | 'linux-unknown' | 'unsupported'
}

export const desktopAvailable = isTauri
const deadlineMs = 12_000
const timedOut = Symbol('launcher-timeout')

async function withDeadline<T>(promise: Promise<T>, deadline: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const pending = Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timedOut), Math.max(0, deadline - performance.now()))
      }),
    ])
    return await (signal ? untilAborted(pending, signal) : pending)
  } finally {
    clearTimeout(timer)
  }
}

export function launcherSnapshot(deadline = performance.now() + deadlineMs, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return withDeadline(invoke<LauncherSnapshot>('launcher_snapshot'), deadline, signal)
}

export function chooseExecutable(id: ModuleId) {
  return invoke<boolean>('launcher_choose_executable', { request: { id } })
}

export function removeExecutable(id: ModuleId) {
  return withDeadline(invoke<void>('launcher_remove_executable', { request: { id } }), performance.now() + deadlineMs)
}

export function chooseMonitor(id: ModuleId, monitor: string | null) {
  return withDeadline(invoke<void>('launcher_choose_monitor', { request: { id, monitor } }), performance.now() + deadlineMs)
}

const faults: readonly LauncherFault[] = [
  'invalid-executable', 'approval-changed', 'already-registered', 'invalid-monitor',
  'storage', 'spawn', 'exited-early', 'process-discovery', 'dialog-busy', 'dialog', 'platform',
]

export function operationFailure(reason: unknown): ModuleOpenResult {
  if (reason === timedOut) return { status: 'timeout' }
  const fault = faults.find((fault) => fault === reason)
  return { status: 'error', reason: fault ?? 'platform' }
}

export async function openRegisteredModule(id: ModuleId, signal = new AbortController().signal): Promise<ModuleOpenResult> {
  signal.throwIfAborted()
  if (!desktopAvailable()) return { status: 'browser' }
  const deadline = performance.now() + deadlineMs
  try {
    let state = await withDeadline(invoke<ApplicationState>('launcher_open', { request: { id } }), deadline, signal)
    if (state.status !== 'starting') return state

    while (state.status === 'starting' && performance.now() < deadline) {
      await abortableDelay(350, signal)
      if (performance.now() >= deadline) break
      const snapshot = await launcherSnapshot(deadline, signal)
      state = snapshot.applications.find((app) => app.id === id)?.state ?? { status: 'unavailable' }
    }
    if (state.status === 'available') return { status: 'finished' }
    return state.status === 'starting' ? { status: 'timeout' } : state
  } catch (error) {
    signal.throwIfAborted()
    return operationFailure(error)
  }
}
