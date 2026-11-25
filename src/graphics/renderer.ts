import {
  BufferAttribute, BufferGeometry, CustomBlending, GLSL3, OneFactor, OneMinusSrcAlphaFactor,
  PerspectiveCamera, Points, RawShaderMaterial, Scene, Vector2, Vector4, WebGLRenderer,
} from 'three'
import type { CoreMotion } from './behavior'
import fragmentShader from './particle.frag?raw'
import vertexShader from './particle.vert?raw'
import { particlePositions } from './particles'
import { graphicsProfiles, type GraphicsProfile } from './profiles'

export function createParticleRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false })
  if (!context || context.isContextLost()) return null

  const renderer = new WebGLRenderer({ canvas, context })
  renderer.setClearColor(0x000000, 0)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(particlePositions(), 3))
  const uniforms = {
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uTurn: { value: 0 },
    uSuccessAge: { value: 0 },
    uAmplitude: { value: 0 },
    uStill: { value: 0 },
    uPixels: { value: 1 },
    uProfileLight: { value: 1 },
    uPrimaryCount: { value: graphicsProfiles.low.count },
    uPointer: { value: new Vector2() },
    uPose: { value: new Vector4() },
    uSignals: { value: new Vector4() },
    uOutcomes: { value: new Vector2() },
    uBreath: { value: 1 },
  }
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false
  const scene = new Scene()
  scene.add(points)
  const camera = new PerspectiveCamera(35, 1, 0.1, 20)
  camera.position.z = 4.18
  let profile = graphicsProfiles.medium as (typeof graphicsProfiles)[GraphicsProfile]
  let shaderFailed = false

  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    shaderFailed = true
    console.error('Aurora GLSL', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment))
  }

  return {
    setProfile(id: GraphicsProfile) {
      profile = graphicsProfiles[id]
      geometry.setDrawRange(0, profile.count)
      uniforms.uProfileLight.value = profile.light
    },
    resize(width: number, height: number, dpr: number) {
      renderer.setDrawingBufferSize(width, height, dpr)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      uniforms.uPixels.value = dpr * profile.pointSize * Math.min(1.16, Math.max(0.68, height / 600))
    },
    draw(motion: CoreMotion, pointer: Vector2, reduced: boolean) {
      const { pose } = motion
      uniforms.uTime.value = reduced ? 0 : motion.time
      uniforms.uFlow.value = reduced ? 0 : motion.flowTime
      uniforms.uTurn.value = reduced ? 0.22 : motion.turnAngle
      uniforms.uSuccessAge.value = motion.successAge
      uniforms.uAmplitude.value = reduced ? 0 : motion.amplitude
      uniforms.uStill.value = Number(reduced)
      uniforms.uPointer.value.copy(pointer).multiplyScalar(reduced ? 0 : 1)
      uniforms.uPose.value.set(pose.scale, pose.light, pose.warmth, pose.folds)
      uniforms.uSignals.value.set(pose.listening, pose.thinking, pose.speaking, pose.executing)
      uniforms.uOutcomes.value.set(pose.success, pose.error)
      uniforms.uBreath.value = pose.breath
      renderer.render(scene, camera)
      return !shaderFailed
    },
    restored() {
      shaderFailed = false
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
