import { modules } from '../domain/registry'

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function orbitLayout(width: number, height: number) {
  const buttonWidth = clamp(width * 0.137, 118, 202)
  const buttonHeight = clamp(width * 0.055, 50, 72)
  const radiusX = width * 0.362
  const radiusY = height * 0.352
  const centerX = width / 2
  const centerY = height / 2

  function project(angle: number) {
    const depth = Math.sin(angle)
    const perspective = 1 / (1 - 0.09 * depth)
    return {
      x: centerX + radiusX * Math.cos(angle) * perspective,
      y: centerY + radiusY * depth * perspective,
    }
  }

  function arc(from: number, to: number) {
    const segments = Math.max(1, Math.ceil(Math.abs(to - from) * 18))
    return Array.from({ length: segments + 1 }, (_, i) => {
      const point = project(from + (to - from) * i / segments)
      return `${i === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
    }).join(' ')
  }

  const slots = modules.map((module) => {
    const angle = module.angle * Math.PI / 180
    const front = Math.sin(angle) >= 0
    const side = Math.sign(Math.cos(angle))
    const origin = front ? Math.PI / 2 : -Math.PI / 2
    const node = project(angle)
    const dx = node.x - centerX
    const dy = centerY - node.y
    const length = Math.hypot(dx, dy) || 1
    return {
      module, front, node,
      origin: project(origin),
      connection: arc(origin, angle),
      left: clamp(node.x + side * (buttonWidth / 2 + 10) - buttonWidth / 2, 7, width - buttonWidth - 7),
      top: clamp(node.y + (front ? 8 : -buttonHeight - 8), 7, height - buttonHeight - 7),
      direction: { x: dx / length, y: dy / length },
    }
  })

  return {
    width, height, slots, buttonWidth, buttonHeight,
    rearArc: arc(-Math.PI, 0),
    frontArc: arc(0, Math.PI),
  }
}

export type OrbitLayout = ReturnType<typeof orbitLayout>
