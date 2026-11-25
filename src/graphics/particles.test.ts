import { expect, it } from 'vitest'
import { particlePositions } from './particles'
import { graphicsProfiles } from './profiles'

it('samples a reproducible Fibonacci volume across all profile prefixes', () => {
  const positions = particlePositions()
  expect(positions).toEqual(particlePositions())
  expect(positions).toHaveLength(graphicsProfiles.ultra.count * 3)

  for (const { count } of Object.values(graphicsProfiles)) {
    let interior = 0
    let outer = 0
    const balance: [number, number, number] = [0, 0, 0]
    for (let index = 0; index < count * 3; index += 3) {
      const x = positions[index]!
      const y = positions[index + 1]!
      const z = positions[index + 2]!
      const radius = Math.hypot(x, y, z)
      if (radius < 0.75) interior += 1
      if (radius > 0.91) outer += 1
      balance[0] += x
      balance[1] += y
      balance[2] += z
      if (radius > 1.000001) throw new Error('Point outside the unit sphere')
    }
    expect(interior / count).toBeCloseTo(0.13, 2)
    expect(outer / count).toBeGreaterThan(0.65)
    for (const coordinate of balance) expect(coordinate / count).toBeCloseTo(0, 2)
  }
})
