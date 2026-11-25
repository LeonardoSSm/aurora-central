import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

export async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  const calls = new Map()
  const handlers = new Map()
  let id = 0
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method) {
      handlers.get(message.method)?.(message.params)
      return
    }
    const call = calls.get(message.id)
    if (!call) return
    calls.delete(message.id)
    if (message.error) call.reject(new Error(message.error.message))
    else call.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const call of calls.values()) call.reject(new Error('WebView2 CDP connection closed'))
    calls.clear()
  })

  async function send(method, params = {}) {
    assert.equal(socket.readyState, WebSocket.OPEN, 'The WebView2 CDP connection is not open')
    const messageId = ++id
    return new Promise((resolve, reject) => {
      calls.set(messageId, { resolve, reject })
      socket.send(JSON.stringify({ id: messageId, method, params }))
    })
  }

  return {
    send,
    on(method, handler) { handlers.set(method, handler) },
    close() { socket.close() },
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    },
  }
}

export async function getTargets(port) {
  const base = 'http://127.0.0.1:' + port
  const read = async (path) => {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(5000) })
    assert.ok(response.ok, response.statusText)
    return response.json()
  }
  const [version, targets] = await Promise.all([read('/json/version'), read('/json/list')])
  const app = targets.find((target) => target.type === 'page' && URL.parse(target.url)?.origin === 'http://tauri.localhost')
  assert.ok(app, 'Open the Windows production binary with a dedicated WebView2 CDP port')
  return { browser: version.webSocketDebuggerUrl, version: version.Browser, page: app.webSocketDebuggerUrl }
}

export async function selectOption(page, label, value) {
  await page.evaluate(`(() => {
    const control = [...document.querySelectorAll('label')].find((item) => item.firstChild.textContent.trim() === ${JSON.stringify(label)})?.querySelector('select');
    if (!control) throw new Error('Missing select');
    control.value = ${JSON.stringify(value)};
    control.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
}

function installProbe() {
  const originalDraw = WebGL2RenderingContext.prototype.drawArrays
  let samples
  let queries = []
  let trackGpu = false
  WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
    if (!samples || mode !== this.POINTS) return originalDraw.call(this, mode, first, count)

    const ext = trackGpu && this.getExtension('EXT_disjoint_timer_query_webgl2')
    if (ext && queries.length) {
      const previous = queries[0]
      if (this.getQueryParameter(previous.query, this.QUERY_RESULT_AVAILABLE)) {
        if (!this.getParameter(ext.GPU_DISJOINT_EXT)) {
          previous.sample.gpu = this.getQueryParameter(previous.query, this.QUERY_RESULT) / 1e6
        }
        this.deleteQuery(previous.query)
        queries.shift()
      }
    }

    const query = ext && queries.length < 8 ? this.createQuery() : null
    if (query) this.beginQuery(ext.TIME_ELAPSED_EXT, query)
    const sample = { at: performance.now(), count }
    originalDraw.call(this, mode, first, count)
    if (query) {
      this.endQuery(ext.TIME_ELAPSED_EXT)
      queries.push({ gl: this, query, sample })
    }
    samples.push(sample)
  }

  globalThis.auroraProbe = {
    start(gpu = false) {
      samples = []
      trackGpu = gpu
    },
    stop() {
      const result = samples
      samples = undefined
      for (const { gl, query } of queries) gl.deleteQuery(query)
      queries = []
      return result
    },
  }
}

function percentile(sorted, quantile) {
  return sorted[Math.ceil(quantile * sorted.length) - 1]
}

function summarize(samples) {
  assert.ok(samples.length > 2, 'The Aurora canvas did not render during measurement')
  assert.equal(new Set(samples.map(({ count }) => count)).size, 1, 'Particle count changed during measurement')
  const intervals = samples.slice(1).map((sample, index) => sample.at - samples[index].at).sort((a, b) => a - b)
  const gpu = samples.map((sample) => sample.gpu).filter((duration) => duration !== undefined).sort((a, b) => a - b)
  return {
    count: samples[0].count,
    samples: samples.length,
    fps: Number((1000 * intervals.length / (samples.at(-1).at - samples[0].at)).toFixed(2)),
    frameP50Ms: Number(percentile(intervals, 0.5).toFixed(2)),
    frameP95Ms: Number(percentile(intervals, 0.95).toFixed(2)),
    gpuSamples: gpu.length,
    gpuP95Ms: gpu.length ? Number(percentile(gpu, 0.95).toFixed(2)) : null,
  }
}

async function measureCpu(browser, duration, measureFrames) {
  const cpu = async () => (await browser.send('SystemInfo.getProcessInfo')).processInfo
  const before = new Map((await cpu()).map((item) => [item.id, item.cpuTime]))
  const start = performance.now()
  const samples = await measureFrames(duration)
  const elapsed = performance.now() - start
  const after = await cpu()
  const milliseconds = after.reduce((total, item) => total + 1000 * (item.cpuTime - (before.get(item.id) ?? item.cpuTime)), 0)
  return { ...summarize(samples), cpuMsPerSecond: Math.round(1000 * milliseconds / elapsed) }
}

async function benchmark(port, duration, scale) {
  const targets = await getTargets(port)
  const [page, browser] = await Promise.all([connect(targets.page), connect(targets.browser)])
  try {
    await page.send('Page.enable')
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + installProbe.toString() + ')()' })
    if (scale) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: scale, mobile: false })
    }
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
    const loaded = new Promise((resolve) => page.on('Page.loadEventFired', resolve))
    await page.send('Page.reload')
    await Promise.race([loaded, wait(5000)])
    await page.evaluate("location.hash = '/nucleo'")
    await wait(1800)
    const context = await page.evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        cssViewport: [innerWidth, innerHeight],
        devicePixelRatio,
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        timer: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
      };
    })()`)
    assert.equal(context.reducedMotion, false, 'Disable reduced motion during the cadence benchmark')
    console.log(JSON.stringify({ webview: targets.version, ...context, duration }))
    for (const profile of ['low', 'medium', 'high', 'ultra']) {
      await selectOption(page, 'Perfil gráfico', profile)
      await page.evaluate("dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: innerWidth / 2, clientY: innerHeight / 2 }))")
      await wait(1200)
      const metrics = await measureCpu(browser, duration, async (ms) => {
        await page.evaluate('auroraProbe.start()')
        await wait(ms)
        return page.evaluate('auroraProbe.stop()')
      })
      if (context.timer) {
        await page.evaluate('auroraProbe.start(true)')
        await wait(1100)
        const gpu = summarize(await page.evaluate('auroraProbe.stop()'))
        metrics.gpuSamples = gpu.gpuSamples
        metrics.gpuP95Ms = gpu.gpuP95Ms
      }
      const display = await page.evaluate(`({
        cap: Number([...document.querySelectorAll('select')][2].value),
        buffer: [document.querySelector('canvas').width, document.querySelector('canvas').height]
      })`)
      console.log(JSON.stringify({ profile, ...display, ...metrics }))
    }
  } finally {
    await page.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {})
    page.close()
    browser.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 9228)
  const duration = Number(process.argv[3] ?? 7000)
  const scale = Number(process.argv[4] ?? 0)
  await benchmark(port, duration, scale)
}
