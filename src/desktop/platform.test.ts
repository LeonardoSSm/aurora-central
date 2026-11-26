import { invoke } from '@tauri-apps/api/core'
import { afterEach, expect, it, vi } from 'vitest'
import { openRegisteredModule } from './platform'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }))

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

it('sends only the registered module ID and stops observing launcher startup on cancellation', async () => {
  vi.useFakeTimers()
  const abort = new AbortController()
  vi.mocked(invoke).mockResolvedValue({ status: 'starting' })
  const operation = openRegisteredModule('nexus', abort.signal)
  const rejected = expect(operation).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(100)
  abort.abort()
  await rejected
  await vi.runAllTimersAsync()
  expect(invoke).toHaveBeenCalledExactlyOnceWith('launcher_open', { request: { id: 'nexus' } })
  expect(vi.getTimerCount()).toBe(0)
})
