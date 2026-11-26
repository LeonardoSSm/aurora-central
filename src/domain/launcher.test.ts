import { describe, expect, it } from 'vitest'
import { createModuleLauncher } from './launcher'
import { modules } from './registry'
import { moduleNotice } from './state'

describe('registry and launcher', () => {
  it('assigns the four Aurora modules to unique anchors', () => {
    expect(modules.map(({ id }) => id)).toEqual(['board', 'control', 'nexus', 'lens'])
    expect(new Set(modules.map(({ angle }) => angle)).size).toBe(4)
  })

  it.each(modules)('correlates the adapter result for $name', async ({ id }) => {
    const openModule = createModuleLauncher(async (selected) => {
      expect(selected).toBe(id)
      return { status: 'not-configured' }
    })
    const event = await openModule({ type: 'module.open', moduleId: id, requestId: 1 })
    expect(event).toEqual({
      type: 'module.open.settled',
      moduleId: id,
      requestId: 1,
      result: { status: 'not-configured' },
    })
    expect(moduleNotice(event.result)).toBe('Nenhum executável configurado.')
  })

  it('distinguishes observed foreground from a pending request', () => {
    expect(moduleNotice({ status: 'focus-requested', focus: 'confirmed' })).toBe('Foco confirmado.')
    expect(moduleNotice({ status: 'focus-requested', focus: 'requested' })).toContain('Foco solicitado.')
    expect(moduleNotice({ status: 'focus-requested', focus: 'denied' })).toContain('recusou')
  })
})
