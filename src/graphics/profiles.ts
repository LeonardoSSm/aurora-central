export const graphicsProfiles = {
  low: { count: 5_000, fps: 60, dpr: 1, pointSize: 1.22, light: 1.22 },
  medium: { count: 20_000, fps: 60, dpr: 1.5, pointSize: 1, light: 1 },
  high: { count: 50_000, fps: 60, dpr: 1.5, pointSize: 0.86, light: 0.66 },
  ultra: { count: 100_000, fps: 60, dpr: 2, pointSize: 0.75, light: 0.48 },
} as const

export type GraphicsProfile = keyof typeof graphicsProfiles
export const fpsLimits = [30, 45, 60, 90, 120] as const
export const dprLimits = [1, 1.25, 1.5, 2] as const
export const resolutions = [50, 75, 100] as const
export const palettes = ['aurora', 'nebula', 'ember', 'glacier'] as const
export type BackgroundMode = 'adaptive' | 'pause' | 'continue'

export interface GraphicsSettings {
  profile: GraphicsProfile
  quality: 'standard' | 'economy'
  fps: (typeof fpsLimits)[number]
  dpr: (typeof dprLimits)[number]
  palette: (typeof palettes)[number]
  particleCount: number | null
  brightness: number
  speed: number
  resolution: (typeof resolutions)[number]
  background: BackgroundMode
}

export const defaultGraphics: GraphicsSettings = {
  profile: 'medium', fps: graphicsProfiles.medium.fps, dpr: graphicsProfiles.medium.dpr,
  quality: 'standard', palette: 'aurora', particleCount: null, brightness: 100, speed: 100, resolution: 100, background: 'adaptive',
}

export function profileSettings(profile: GraphicsProfile, settings = defaultGraphics): GraphicsSettings {
  const { fps, dpr } = graphicsProfiles[profile]
  return { ...settings, profile, fps, dpr, particleCount: null, resolution: 100, quality: profile === 'low' ? 'economy' : 'standard' }
}

export function renderScale(width: number, height: number, deviceRatio: number, settings: GraphicsSettings) {
  return Math.min(
    Math.min(deviceRatio, settings.dpr) * settings.resolution / 100,
    4096 / Math.max(width, height),
    Math.sqrt(8_388_608 / (width * height)),
  )
}
