import fragmentSource from './particle.frag?raw'
import vertexSource from './particle.vert?raw'
import { particlePositions } from './particles'

const particleCount = 7_000

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader

  gl.deleteShader(shader)
  return null
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram()
  if (!program) return null

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (vertex && fragment) {
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
  }
  if (vertex) gl.deleteShader(vertex)
  if (fragment) gl.deleteShader(fragment)
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program

  gl.deleteProgram(program)
  return null
}

export function createParticleRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false })
  if (!gl) return null

  const program = createProgram(gl)
  if (!program) return null

  const buffer = gl.createBuffer()
  if (!buffer) {
    gl.deleteProgram(program)
    return null
  }

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, particlePositions(particleCount), gl.STATIC_DRAW)

  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)

  const time = gl.getUniformLocation(program, 'uTime')
  const pixels = gl.getUniformLocation(program, 'uPixels')
  const aspect = gl.getUniformLocation(program, 'uAspect')

  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  return {
    draw(seconds: number, width: number, height: number, pixelRatio: number) {
      gl.viewport(0, 0, width, height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(time, seconds)
      gl.uniform1f(pixels, pixelRatio * Math.min(1.28, Math.max(0.76, height / pixelRatio / 540)))
      const shortestSide = Math.min(width, height)
      gl.uniform2f(aspect, shortestSide / width, shortestSide / height)
      gl.drawArrays(gl.POINTS, 0, particleCount)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}
