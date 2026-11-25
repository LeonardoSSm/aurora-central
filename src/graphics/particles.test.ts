import { expect, it } from 'vitest'
import { particlePositions } from './particles'

it('samples a reproducible 3D shell with points inside the volume', () => {
  const positions = particlePositions(105)
  expect(positions).toEqual(particlePositions(105))
  expect(positions).toHaveLength(315)
  const radii = Array.from({ length: 105 }, (_, index) =>
    Math.hypot(...positions.slice(index * 3, index * 3 + 3)),
  )
  expect(Math.min(...radii)).toBeCloseTo(0.58)
  expect(Math.max(...radii)).toBeCloseTo(1)
  expect(radii.filter((radius) => radius < 0.999)).toHaveLength(15)
})
