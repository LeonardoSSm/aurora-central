type ModuleIcon = 'quadrants' | 'sliders' | 'nodes' | 'aperture'

interface ModuleDefinition {
  readonly id: string
  readonly name: string
  readonly icon: ModuleIcon
  readonly accent: `#${string}`
  /** Angle in degrees on the projected orbit, clockwise from the right. */
  readonly angle: number
  readonly availability: 'unavailable' | 'available'
  readonly launchStrategy: 'unconfigured' | 'registered-module'
}

const registry = [
  { id: 'board', name: 'Board', icon: 'quadrants', accent: '#eb75b7', angle: -143, availability: 'unavailable', launchStrategy: 'unconfigured' },
  { id: 'control', name: 'Control', icon: 'sliders', accent: '#a1bcff', angle: 143, availability: 'unavailable', launchStrategy: 'unconfigured' },
  { id: 'nexus', name: 'Nexus', icon: 'nodes', accent: '#d090ff', angle: -37, availability: 'unavailable', launchStrategy: 'unconfigured' },
  { id: 'lens', name: 'Lens', icon: 'aperture', accent: '#ffa993', angle: 37, availability: 'unavailable', launchStrategy: 'unconfigured' },
] as const satisfies readonly ModuleDefinition[]

export type ModuleId = (typeof registry)[number]['id']
export type AuroraModule = ModuleDefinition & { readonly id: ModuleId }

export const modules: readonly AuroraModule[] = registry
