import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { connect, getTargets, selectOption } from './benchmark-core.mjs'

const [port = '9236', phase = 'exercise', directory = 'docs/evidence/cycle-06'] = process.argv.slice(2)
const targets = await getTargets(Number(port))
const page = await connect(targets.page)
const errors = []
const ready = "document.querySelector('canvas')?.dataset.rendering === 'webgl'"

async function eventually(expression) {
  const deadline = Date.now() + 5000
  do {
    if (await page.evaluate(expression)) return
    await wait(25)
  } while (Date.now() < deadline)
  assert.fail(expression)
}

async function click(label, scope = 'body') {
  await page.evaluate(`(() => {
    const control = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})]
      .find((button) => button.textContent.trim() === ${JSON.stringify(label)});
    if (!control || control.matches(':disabled')) throw new Error('Unavailable button');
    control.focus();
    control.click();
  })()`)
}

async function select(id, value) {
  await page.evaluate(`(() => {
    const control = document.getElementById(${JSON.stringify(id)});
    if (!control || control.matches(':disabled')) throw new Error('Unavailable select');
    control.value = ${JSON.stringify(value)};
    if (!control.value && ${Boolean(value)}) throw new Error('Unavailable option');
    control.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
}

async function escape() {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  }
}

async function screenshot(name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 })
  await writeFile(join(directory, name + '.jpg'), Buffer.from(data, 'base64'))
}

function observeGl() {
  const proto = WebGL2RenderingContext.prototype
  const kinds = ['Buffer', 'Framebuffer', 'Program', 'Renderbuffer', 'Shader', 'Texture', 'VertexArray']
  const resources = Object.fromEntries(kinds.map((kind) => [kind, { created: 0, deleted: 0 }]))
  const contexts = new WeakSet()
  let dimensions
  let contextChanges = 0
  let draws = 0
  let count = 0
  let losses = 0
  document.addEventListener('webglcontextlost', () => { losses += 1 }, true)
  for (const kind of kinds) {
    const create = proto['create' + kind]
    const remove = proto['delete' + kind]
    proto['create' + kind] = function (...args) {
      const resource = create.apply(this, args)
      if (resource) resources[kind].created += 1
      return resource
    }
    proto['delete' + kind] = function (resource) {
      if (resource) resources[kind].deleted += 1
      return remove.call(this, resource)
    }
  }
  const draw = proto.drawArrays
  proto.drawArrays = function (mode, first, quantity) {
    if (mode === this.POINTS) {
      if (!contexts.has(this)) {
        contexts.add(this)
        contextChanges += 1
      }
      dimensions = {
        width: this.drawingBufferWidth, height: this.drawingBufferHeight, cssWidth: this.canvas.clientWidth,
      }
      draws += 1
      count = quantity
    }
    return draw.call(this, mode, first, quantity)
  }
  globalThis.auroraSettingsProbe = () => ({ resources, draws, count, contextChanges, losses, ...dimensions })
}

const probe = 'globalThis.auroraSettingsProbe?.()'
const feedback = "document.querySelector('.settings-feedback').textContent.trim()"

async function sample() {
  await page.send('HeapProfiler.collectGarbage')
  return { gl: await page.evaluate(probe), heap: await page.send('Runtime.getHeapUsage') }
}

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.text))
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false })
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await mkdir(directory, { recursive: true })
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${observeGl.toString()})()` })
  await page.send('Page.reload')
  await eventually(`${ready} && ${probe}?.draws > 0`)

  let results
  if (phase === 'exercise') {
    assert.equal(await page.evaluate("document.querySelectorAll('.module').length"), 4)
    assert.equal((await page.evaluate(probe)).count, 20000)
    await screenshot('home-windows')
    await click('Configurações', '.home-links')
    assert.equal(await page.evaluate('document.querySelectorAll(".settings-nav button").length'), 6)
    await click('Aparência', '.settings-nav')
    await select('settings-palette', 'glacier')
    await eventually(`${feedback}.startsWith('Prévia ativa')`)
    await wait(250)
    await screenshot('aparencia-windows')
    await escape()
    await eventually("!document.querySelector('dialog') && document.activeElement.textContent.trim() === 'Configurações'")
    await click('Configurações', '.home-links')
    await click('Aparência', '.settings-nav')
    assert.equal(await page.evaluate("document.getElementById('settings-palette').value"), 'aurora')

    await click('Desempenho', '.settings-nav')
    const before = await sample()
    const sequence = ['low', 'ultra', 'high', 'medium']
    const counts = { low: 5000, ultra: 100000, high: 50000, medium: 20000 }
    for (let change = 0; change < 32; change += 1) {
      const profile = sequence[change % sequence.length]
      await select('settings-profile', profile)
      await eventually(`${probe}.count === ${counts[profile]}`)
    }
    const after = await sample()
    assert.deepEqual(after.gl.resources, before.gl.resources)
    assert.equal(after.gl.contextChanges, 1)
    assert.equal(after.gl.losses, 0)
    await select('settings-profile', 'high')
    await page.evaluate(`(() => {
      const input = document.querySelector('input[type="range"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '37000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`)
    await eventually(`${probe}.count === 37000`)
    await selectOption(page, 'Resolução de renderização', '50')
    await eventually(`Math.abs(${probe}.width - ${probe}.cssWidth * 0.75) <= 1`)
    await selectOption(page, 'Limite de DPR', '2')
    await eventually(`${probe}.width === ${probe}.cssWidth`)
    const customRendering = await page.evaluate(probe)
    await click('Acessibilidade', '.settings-nav')
    await select('settings-motion', 'reduced')
    await eventually("document.querySelector('.home').dataset.reduced === 'true'")
    await wait(150)
    const staticDraws = (await page.evaluate(probe)).draws
    await wait(300)
    assert.equal((await page.evaluate(probe)).draws, staticDraws)
    await click('Geral', '.settings-nav')
    await select('settings-view', 'immersive')
    await click('Aparência', '.settings-nav')
    await select('settings-palette', 'glacier')
    await click('Aplicativos', '.settings-nav')
    await eventually("document.getElementById('launcher-opening')?.disabled === false")
    await select('launcher-opening', 'running-only')
    await screenshot('aplicativos-windows')
    await click('Monitores', '.settings-nav')
    await eventually("document.querySelector('#launcher-monitor option[value]:not([value=\"\"])') !== null")
    const monitor = await page.evaluate("document.querySelector('#launcher-monitor').options[1].value")
    await select('launcher-monitor', monitor)
    await click('Aplicar', 'dialog')
    await eventually(`${feedback} === 'Preferências salvas.'`)
    await screenshot('monitores-windows')
    await page.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 560, deviceScaleFactor: 1, mobile: false })
    await click('Desempenho', '.settings-nav')
    await eventually('innerWidth === 480')
    await screenshot('desempenho-480-windows')
    results = { profileChanges: 32, before, after, customRendering, reducedMotionStaticDraws: staticDraws }
  } else if (phase === 'restart') {
    assert.equal(await page.evaluate("document.querySelector('.home').dataset.mode"), 'immersive')
    assert.equal(await page.evaluate("document.querySelector('.home').dataset.reduced"), 'true')
    assert.equal((await page.evaluate(probe)).count, 37000)
    await screenshot('imersivo-reinicio-windows')
    await click('Voltar à Central')
    await click('Configurações', '.home-links')
    await click('Aparência', '.settings-nav')
    assert.equal(await page.evaluate("document.getElementById('settings-palette').value"), 'glacier')
    await click('Aplicativos', '.settings-nav')
    assert.equal(await page.evaluate("document.getElementById('launcher-opening').value"), 'running-only')
    await click('Monitores', '.settings-nav')
    assert.notEqual(await page.evaluate("document.getElementById('launcher-monitor').value"), '')
    await click('Restaurar padrões', 'dialog')
    await click('Aplicar', 'dialog')
    await eventually(`${feedback} === 'Preferências salvas.'`)
    assert.equal((await page.evaluate(probe)).count, 20000)
    results = { remembered: ['immersive', 'reduced', 'glacier', 37000, 'running-only', 'preferred-monitor'], reset: true }
  } else {
    assert.equal(phase, 'recover')
    assert.equal(await page.evaluate("document.querySelector('.home').dataset.mode"), 'central')
    assert.equal((await page.evaluate(probe)).count, 20000)
    await click('Configurações', '.home-links')
    await eventually(`${feedback}.includes('arquivo estava corrompido')`)
    await screenshot('recuperacao-windows')
    results = { recovered: true, defaults: await page.evaluate(probe) }
  }
  assert.deepEqual(errors, [])
  await writeFile(join(directory, `webview2-${phase}.json`), JSON.stringify({
    webview: targets.version, phase, ...results, errors,
  }, null, 2) + '\n')
  console.log(`WebView2 settings smoke test passed: ${phase}`)
} finally {
  page.close()
}
