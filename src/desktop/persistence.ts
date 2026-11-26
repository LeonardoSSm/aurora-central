import { invoke } from '@tauri-apps/api/core'
import { modules, type ModuleId } from '../domain/registry'
import { defaultGraphics, type GraphicsSettings } from '../graphics/profiles'

export interface ModuleSettings {
  preferredMonitor: string | null
  opening: 'launch-or-reuse' | 'running-only'
  focusExisting: boolean
}

export interface Settings {
  version: 1
  graphics: GraphicsSettings
  initialView: 'central' | 'immersive' | 'ambiental'
  motion: 'system' | 'reduced'
  modules: Record<ModuleId, ModuleSettings>
}

export const defaultSettings: Settings = {
  version: 1,
  graphics: defaultGraphics,
  initialView: 'central',
  motion: 'system',
  modules: Object.fromEntries(modules.map(({ id }) => [id, {
    preferredMonitor: null, opening: 'launch-or-reuse', focusExisting: true,
  } satisfies ModuleSettings])) as Record<ModuleId, ModuleSettings>,
}

export interface SettingsSnapshot {
  settings: Settings
  status: 'ready' | 'recovered' | 'unavailable' | 'newer-version'
  revision: number
}

export function readSettings() {
  return invoke<SettingsSnapshot>('settings_snapshot')
}

export function saveSettings(settings: Settings, revision: number) {
  return invoke<SettingsSnapshot>('settings_save', { request: { settings, revision } })
}
