import { expect, it } from 'vitest'
import { FramePacer, frameLimit } from './pacing'

it('limits draws at a nondivisible refresh rate without drift', () => {
  const pacer = new FramePacer()
  let frames = 0
  for (let frame = 0; frame < 1440; frame += 1) {
    if (pacer.ready(frame * 1000 / 144, 60)) frames += 1
  }
  expect(frames).toBe(600)
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
