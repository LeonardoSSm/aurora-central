import { expect, it } from 'vitest'
import { CoreMotion, coreStates } from './behavior'

it('gives the eight states distinct poses and updates them continuously', () => {
  const motion = new CoreMotion()
  const still = coreStates.map((state) => {
    motion.setInput({ state })
    motion.advance(0, true)
    return JSON.stringify(motion.pose)
  })
  expect(new Set(still).size).toBe(coreStates.length)
  expect(motion.time).toBe(0)

  motion.setInput({ state: 'speaking' })
  motion.advance(1 / 60, false)
  expect(motion.pose.speaking).toBeGreaterThan(0)
  expect(motion.pose.speaking).toBeLessThan(0.1)
  expect(motion.pose.scale).toBeGreaterThan(0.78)
  expect(motion.pose.scale).toBeLessThan(1)
  motion.advance(1, false)
  expect(motion.pose.speaking).toBeGreaterThan(0.98)
})

it('smooths and bounds audio amplitude, with slower release than attack', () => {
  const motion = new CoreMotion()
  motion.setInput({ state: 'speaking', amplitude: 4 })
  motion.advance(0.1, false)
  expect(motion.amplitude).toBeGreaterThan(0.7)
  expect(motion.amplitude).toBeLessThan(1)
  const peak = motion.amplitude
  motion.setInput({ state: 'idle', amplitude: NaN })
  motion.advance(0.1, false)
  expect(motion.amplitude).toBeGreaterThan(peak / 2)
  expect(motion.amplitude).toBeLessThan(peak)
})

it('keeps a departing success wave running during the blend', () => {
  const motion = new CoreMotion()
  motion.setInput({ state: 'success' })
  motion.advance(0.6, false)
  motion.setInput({ state: 'idle' })
  motion.advance(0.1, false)
  expect(motion.pose.success).toBeGreaterThan(0.5)
  expect(motion.successAge).toBeCloseTo(0.7)
  motion.setInput({ state: 'success' })
  expect(motion.successAge).toBe(0)
})
