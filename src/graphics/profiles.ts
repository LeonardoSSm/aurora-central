export const graphicsProfiles = {
  low: { count: 5_000, fps: 60, dpr: 1, pointSize: 1.22, light: 1.22 },
  medium: { count: 20_000, fps: 60, dpr: 1.5, pointSize: 1, light: 1 },
  high: { count: 50_000, fps: 60, dpr: 1.5, pointSize: 0.86, light: 0.66 },
  ultra: { count: 100_000, fps: 60, dpr: 2, pointSize: 0.75, light: 0.48 },
} as const

export type GraphicsProfile = keyof typeof graphicsProfiles
export const fpsLimits = [30, 45, 60, 90, 120] as const
export const dprLimits = [1, 1.25, 1.5, 2] as const

export interface GraphicsSettings {
  profile: GraphicsProfile
  fps: (typeof fpsLimits)[number]
  dpr: (typeof dprLimits)[number]
}

export const defaultGraphics: GraphicsSettings = {
  profile: 'medium', fps: graphicsProfiles.medium.fps, dpr: graphicsProfiles.medium.dpr,
}

export function profileSettings(profile: GraphicsProfile): GraphicsSettings {
  const { fps, dpr } = graphicsProfiles[profile]
  return { profile, fps, dpr }
}
