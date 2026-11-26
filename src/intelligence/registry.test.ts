import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry } from './registry'

const signal = new AbortController().signal
const openBoard = { name: 'module.open', args: { moduleId: 'board' } }

describe('Command Registry', () => {
  it.each([
    'open.exe', { name: 'shell.execute', args: { moduleId: 'board' } },
    { name: 'module.open', args: { moduleId: 'board && calc' } },
    { name: 'module.open', args: { moduleId: 'board', path: 'other.exe' } },
    { name: 'module.open', args: { moduleId: 'board' }, approved: true },
    { name: 'module.open', args: Object.create({ moduleId: 'board' }) },
  ])('rejects an untrusted proposal %j', (proposal) => {
    const open = vi.fn()
    const registry = createCommandRegistry(open)
    expect(() => registry.prepare(proposal, ['modules:open'])).toThrow('command-invalid')
    expect(open).not.toHaveBeenCalled()
  })

  it('enforces provider scope and consumes a confirmation for exactly one prepared command', async () => {
    const open = vi.fn().mockResolvedValue({ status: 'focus-requested', focus: 'confirmed' })
    const registry = createCommandRegistry(open)
    expect(() => registry.prepare(openBoard, ['modules:read'])).toThrow('command-forbidden')
    const approved = registry.prepare(openBoard, ['modules:open'])
    const other = registry.prepare({ name: 'module.open', args: { moduleId: 'lens' } }, ['modules:open'])
    registry.authorize(approved)
    await expect(registry.execute(other, signal)).rejects.toThrow('command-forbidden')
    await expect(registry.execute({ ...approved }, signal)).rejects.toThrow('command-forbidden')
    await expect(registry.execute(approved, signal)).resolves.toContain('Aurora Board')
    await expect(registry.execute(approved, signal)).rejects.toThrow('command-forbidden')
    expect(open).toHaveBeenCalledExactlyOnceWith('board', signal)
  })

  it('does not dispatch an approved operation after abort', async () => {
    const open = vi.fn()
    const registry = createCommandRegistry(open)
    const approved = registry.prepare(openBoard, ['modules:open'])
    registry.authorize(approved)
    await expect(registry.execute(approved, AbortSignal.abort(new Error('cancelled')))).rejects.toThrow('cancelled')
    await expect(registry.execute(approved, signal)).rejects.toThrow('command-forbidden')
    expect(open).not.toHaveBeenCalled()
  })
})
