import { graphicsProfiles } from './profiles'

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const layers = Object.values(graphicsProfiles).map(({ count }, index, profiles) => count - (profiles[index - 1]?.count ?? 0))

function fraction(value: number) {
  return value - Math.floor(value)
}

export function particlePositions(): Float32Array {
  const points = new Float32Array(graphicsProfiles.ultra.count * 3)
  let offset = 0

  layers.forEach((count, layer) => {
    for (let index = 0; index < count; index += 1) {
      const y = 1 - 2 * (index + 0.5) / count
      const angle = (index + layer * 0.69) * goldenAngle
      const volume = fraction(index * Math.SQRT2 + layer * 0.37)
      // The denser outer volume defines the folds. The inner samples fill volume uniformly.
      const width = layer === 0 ? 0.023 : 0.09
      const radius = volume < 0.24
        ? 0.91 * Math.cbrt(volume / 0.24)
        : 1 - width * ((1 - volume) / 0.76) ** 0.71
      const ring = Math.sqrt(1 - y * y) * radius
      points[offset++] = Math.cos(angle) * ring
      points[offset++] = y * radius
      points[offset++] = Math.sin(angle) * ring
    }
  })

  return points
}
