import { expect, it } from 'vitest'
import { FramePacer, frameLimit } from './pacing'
import { defaultGraphics, renderScale } from './profiles'

it('limits draws at a nondivisible refresh rate without drift', () => {
  const pacer = new FramePacer()
  let frames = 0
  for (let frame = 0; frame < 1440; frame += 1) {
    if (pacer.ready(frame * 1000 / 144, 60)) frames += 1
  }
  expect(frames).toBe(600)
})

it('supports opt-in policies for an unfocused window while always stopping hidden draws', () => {
  expect(frameLimit(60, false, false, false, false, 'pause')).toBe(0)
  expect(frameLimit(60, false, false, true, false, 'continue')).toBe(60)
  expect(frameLimit(60, true, false, false, false, 'continue')).toBe(0)
  expect(frameLimit(60, false, false, false, true, 'continue')).toBe(20)
})

it('combines render resolution and DPR and caps large drawing buffers', () => {
  expect(renderScale(500, 500, 2, defaultGraphics)).toBe(1.5)
  expect(renderScale(500, 500, 1, { ...defaultGraphics, resolution: 50 })).toBe(0.5)
  const side = 8192 * renderScale(8192, 8192, 2, defaultGraphics)
  expect(side).toBeLessThan(4096)
  expect(Math.floor(side) ** 2).toBeLessThanOrEqual(8_388_608)
  expect(16_384 * renderScale(16_384, 400, 2, defaultGraphics)).toBe(4096)
})

it('drops missed deadlines and resets when the frame limit changes', () => {
  const pacer = new FramePacer()
  expect(pacer.ready(0, 60)).toBe(true)
  expect(pacer.ready(9999, 60)).toBe(true)
  expect(pacer.ready(10000, 60)).toBe(false)
  expect(pacer.ready(10000, 30)).toBe(true)
  expect(pacer.delay(10000, 30)).toBeGreaterThan(0)
})

it('pauses when hidden and caps background, idle and sleep activity', () => {
  expect(frameLimit(120, true, false, true, true)).toBe(0)
  expect(frameLimit(120, false, false, false, false)).toBe(20)
  expect(frameLimit(120, false, true, false, true)).toBe(20)
  expect(frameLimit(120, false, true, true, false)).toBe(30)
  expect(frameLimit(120, false, true, false, false)).toBe(120)
})
