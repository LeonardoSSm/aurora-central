import { describe, expect, it } from 'vitest'
import { openModule } from './launcher'
import { modules } from './registry'
import { moduleNotice } from './state'

describe('registry and launcher', () => {
  it('assigns the four Aurora modules to unique anchors', () => {
    expect(modules.map(({ id }) => id)).toEqual(['board', 'control', 'nexus', 'lens'])
    expect(new Set(modules.map(({ angle }) => angle)).size).toBe(4)
  })

  it.each(modules)('reports the actual availability of $name', ({ id, availability }) => {
    const event = openModule({ type: 'module.open', moduleId: id, requestId: 1 })
    expect(event).toEqual({
      type: 'module.open.settled',
      moduleId: id,
      requestId: 1,
      result: { status: availability },
    })
    expect(moduleNotice(event)).toBe('Abertura indisponível nesta versão.')
  })
})
