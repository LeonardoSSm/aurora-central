type ModuleIcon = 'quadrants' | 'sliders' | 'nodes' | 'aperture'

interface ModuleDefinition {
  readonly id: string
  readonly name: string
  readonly icon: ModuleIcon
  readonly accent: `#${string}`
  /** Angle in degrees on the projected orbit, clockwise from the right. */
  readonly angle: number
}

const registry = [
  { id: 'board', name: 'Board', icon: 'quadrants', accent: '#eb75b7', angle: -143 },
  { id: 'control', name: 'Control', icon: 'sliders', accent: '#a1bcff', angle: 143 },
  { id: 'nexus', name: 'Nexus', icon: 'nodes', accent: '#d090ff', angle: -37 },
  { id: 'lens', name: 'Lens', icon: 'aperture', accent: '#ffa993', angle: 37 },
] as const satisfies readonly ModuleDefinition[]

export type ModuleId = (typeof registry)[number]['id']
export const modules = registry
