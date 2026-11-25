import type { ModuleId } from '../domain/registry'
import type { OrbitLayout } from './orbitLayout'

interface Props {
  layout: OrbitLayout
  front: boolean
  active: ModuleId | undefined
  pulse: { moduleId: ModuleId; requestId: number } | undefined
}

export function OrbitalConnections({ layout, front, active, pulse }: Props) {
  const layer = front ? 'front' : 'rear'
  const slots = layout.slots.filter((slot) => slot.front === front)
  return (
    <svg className={`orbit orbit-${layer}`} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`orbit-${layer}-light`}>
          <stop stopColor="#9774db" />
          <stop offset=".31" stopColor="#9160b4" stopOpacity=".5" />
          <stop offset=".5" stopColor="#b269a1" stopOpacity={front ? '.29' : '.08'} />
          <stop offset=".69" stopColor="#b45c9f" stopOpacity=".5" />
          <stop offset="1" stopColor="#b36bb4" />
        </linearGradient>
        {slots.map(({ module, origin, node }) => (
          <linearGradient key={module.id} id={`orbit-link-${module.id}`} gradientUnits="userSpaceOnUse"
            x1={origin.x} y1={origin.y} x2={node.x} y2={node.y}>
            <stop stopColor={module.accent} stopOpacity="0" />
            <stop offset=".35" stopColor={module.accent} stopOpacity=".36" />
            <stop offset="1" stopColor={module.accent} />
          </linearGradient>
        ))}
      </defs>
      <path className="orbit-shell" d={front ? layout.frontArc : layout.rearArc} stroke={`url(#orbit-${layer}-light)`} />
      {slots.map(({ module, node, connection }) => (
        <g key={module.id} color={module.accent} data-active={active === module.id}>
          <path className="orbit-link" d={connection} stroke={`url(#orbit-link-${module.id})`} />
          <path className="orbit-energy" d={connection} pathLength="100" />
          {pulse?.moduleId === module.id && (
            <path key={pulse.requestId} className="orbit-pulse" d={connection} pathLength="100" />
          )}
          <circle className="orbit-halo" cx={node.x} cy={node.y} r="4.5" />
          <circle className="orbit-pin" cx={node.x} cy={node.y} r="2.6" />
        </g>
      ))}
    </svg>
  )
}
