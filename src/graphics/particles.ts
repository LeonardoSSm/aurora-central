const goldenAngle = Math.PI * (3 - Math.sqrt(5))

export function particlePositions(count: number): Float32Array {
  const points = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / count
    const ringRadius = Math.sqrt(1 - y * y)
    const angle = index * goldenAngle
    const depth = index % 7 === 0 ? 0.58 + 0.42 * ((index % 103) / 103) : 1
    points[index * 3] = Math.cos(angle) * ringRadius * depth
    points[index * 3 + 1] = y * depth
    points[index * 3 + 2] = Math.sin(angle) * ringRadius * depth
  }
  return points
}
