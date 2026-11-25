import { describe, expect, it } from 'vitest'
import { openModule } from './launcher'
import { modules } from './registry'
import { moduleNotice } from './state'

describe('registry and launcher', () => {
  it('assigns the four Aurora modules to unique anchors', () => {
    expect(modules.map(({ id }) => id)).toEqual(['board', 'control', 'nexus', 'lens'])
    expect(new Set(modules.map(({ anchor }) => anchor)).size).toBe(4)
  })

  it.each(modules)('reports the actual availability of $name', ({ id, availability }) => {
    const event = openModule({ type: 'module.open', moduleId: id })
    expect(event).toEqual({
      type: 'module.open.settled',
      moduleId: id,
      result: { status: availability },
    })
    expect(moduleNotice(event)).toBe('Abertura indisponível nesta versão.')
  })
})
