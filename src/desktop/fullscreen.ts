import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export async function setWindowFullscreen(fullscreen: boolean): Promise<void> {
  if (isTauri()) return getCurrentWindow().setFullscreen(fullscreen)

  return fullscreen
    ? document.documentElement.requestFullscreen()
    : document.exitFullscreen()
}
