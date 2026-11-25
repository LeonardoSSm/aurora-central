export type ModuleId = 'board' | 'control' | 'nexus' | 'lens'
export type OrbitAnchor = 'upper-left' | 'lower-left' | 'upper-right' | 'lower-right'

export interface AuroraModule {
  readonly id: ModuleId
  readonly name: string
  readonly anchor: OrbitAnchor
  readonly availability: 'unavailable' | 'available'
}

export const modules: readonly AuroraModule[] = [
  { id: 'board', name: 'Board', anchor: 'upper-left', availability: 'unavailable' },
  { id: 'control', name: 'Control', anchor: 'lower-left', availability: 'unavailable' },
  { id: 'nexus', name: 'Nexus', anchor: 'upper-right', availability: 'unavailable' },
  { id: 'lens', name: 'Lens', anchor: 'lower-right', availability: 'unavailable' },
]
