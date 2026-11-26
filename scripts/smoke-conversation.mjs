import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { connect, getTargets } from './benchmark-core.mjs'

const port = Number(process.argv[2] ?? 9235)
const directory = process.argv[3] ?? 'docs/evidence/cycle-05'
const targets = await getTargets(port)
const page = await connect(targets.page)
const coreState = "document.querySelector('.core').dataset.state"
const status = "document.querySelector('.conversation-status').textContent.trim()"
const draft = "document.querySelector('#conversation-input').value"
const browserErrors = []

async function expectEventually(expression, milliseconds = 4_000) {
  const deadline = Date.now() + milliseconds
  do {
    if (await page.evaluate(expression)) return
    await wait(30)
  } while (Date.now() < deadline)
  assert.fail(expression)
}

async function click(label) {
  const point = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) =>
      (item.getAttribute('aria-label') || item.textContent.trim()) === ${JSON.stringify(label)})
    if (!button || button.disabled) return null
    const {x, y, width, height} = button.getBoundingClientRect()
    return {x: x + width / 2, y: y + height / 2}
  })()`)
  assert.ok(point, label)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 })
  }
}

async function send(text) {
  await page.evaluate("document.querySelector('#conversation-input').focus()")
  await page.send('Input.insertText', { text })
  await click('Enviar')
}

async function screenshot(name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 })
  await writeFile(join(directory, name + '.jpg'), Buffer.from(data, 'base64'))
}

try {
  page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => browserErrors.push(exceptionDetails.text))
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await mkdir(directory, { recursive: true })
  await expectEventually("document.querySelector('canvas')?.dataset.rendering === 'webgl'")
  assert.equal(await page.evaluate("document.querySelectorAll('.module').length"), 4)
  assert.equal(await page.evaluate("document.querySelector('.conversation')"), null)
  await screenshot('home-windows')

  await click('Conversa')
  await expectEventually("document.activeElement.id === 'conversation-input'")
  await click('Simular entrada por voz')
  await expectEventually(`${coreState} === 'listening'`)
  await click('Cancelar')
  await expectEventually(`${coreState} === 'idle' && ${draft} === ''`)
  await click('Simular entrada por voz')
  await expectEventually(`${draft} === 'Sobre Aurora Nexus'`)
  assert.equal(await page.evaluate("document.querySelector('.conversation-history')"), null)
  await click('Enviar')
  await expectEventually(`${coreState} === 'thinking'`)
  await expectEventually("document.querySelector('.conversation-history li:last-child span')?.textContent === 'Vou consultar a descrição '")
  await expectEventually(`${coreState} === 'success' && document.querySelector('.conversation-history').textContent.includes('Memória, conhecimento e contexto.')`)
  await screenshot('conversa-windows')

  await click('Repousar')
  await expectEventually(`${coreState} === 'sleep'`)
  await click('Acordar')
  await expectEventually(`${coreState} === 'idle'`)

  const module = await page.evaluate(`[...document.querySelectorAll('.module')].find((button) =>
    document.getElementById(button.getAttribute('aria-describedby')).textContent.trim() ===
      'Nenhum executável configurado.')?.getAttribute('aria-label')`)
  assert.ok(module, 'Use uma instalação de teste com ao menos um módulo sem executável cadastrado.')
  await send('Abrir ' + module)
  await expectEventually(`${status} === ${JSON.stringify(`Autorizar a abertura de ${module}?`)}`)
  await expectEventually("document.activeElement.textContent === 'Recusar'")
  await screenshot('confirmacao-windows')
  await page.evaluate("document.querySelector('.conversation-confirmation .conversation-primary').click()")
  assert.match(await page.evaluate(status), /^Autorizar/)
  await click('Recusar')
  await expectEventually(`${status} === 'Abertura recusada.'`)
  await send('Abrir ' + module)
  await expectEventually(`${status}.startsWith('Autorizar')`)
  await click('Autorizar abertura')
  await expectEventually(`${coreState} === 'error' && ${status}.includes('Nenhum executável configurado.')`)
  const launcherNotice = await page.evaluate(status)

  const recognition = await page.evaluate(`(async () => {
    const API = window.SpeechRecognition ?? window.webkitSpeechRecognition
    return await API?.available?.({langs:['pt-BR'],processLocally:true}).catch(() => 'unavailable') ?? 'unsupported'
  })()`)
  await click('Microfone')
  if (recognition === 'available') {
    await expectEventually(`${coreState} === 'listening' || ${coreState} === 'error'`)
    if (await page.evaluate(`${coreState} === 'listening'`)) await click('Cancelar')
  } else {
    await expectEventually(`${coreState} === 'error' && ${status}.includes('reconhecimento local')`)
  }
  const recognitionNotice = await page.evaluate(status)
  await page.evaluate("document.querySelector('.conversation-tools input').click()")
  await send('Olá')
  await expectEventually(`${coreState} === 'speaking' || ${coreState} === 'success' || ${coreState} === 'error'`, 8_000)
  const speakingObserved = await page.evaluate(`${coreState} === 'speaking'`)
  if (speakingObserved) await screenshot('falando-windows')
  await expectEventually(`${coreState} === 'success' || ${coreState} === 'error'`, 32_000)
  const playback = await page.evaluate(`({
    state: ${coreState}, notice: ${status},
    localPortugueseVoices: speechSynthesis?.getVoices().filter((voice) =>
      voice.localService && /^pt(?:-|$)/i.test(voice.lang)).map((voice) => voice.lang) ?? []
  })`)
  assert.match(await page.evaluate("document.querySelector('.conversation-history').textContent"), /resposta é uma simulação local/)

  await page.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 560, deviceScaleFactor: 1, mobile: false })
  await expectEventually("innerWidth === 480 && document.querySelector('.scene').clientWidth < 480")
  await expectEventually(`(() => {
    const log = document.querySelector('.conversation-history')
    return log.scrollHeight - log.scrollTop - log.clientHeight < 4
  })()`)
  assert.ok(await page.evaluate(`[...document.querySelectorAll('.module, .conversation, .home-links')].every((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return left >= 0 && top >= 0 && right <= innerWidth && bottom <= innerHeight
  })`))
  await screenshot('conversa-480-windows')
  await click('Fechar')
  await expectEventually("!document.querySelector('.conversation') && document.activeElement.textContent === 'Conversa'")
  await click('Ambiental')
  await expectEventually("document.querySelector('.home').dataset.mode === 'ambiental' && !document.querySelector('.home-links')")
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await expectEventually("document.querySelector('.home').dataset.mode === 'central'")

  assert.deepEqual(browserErrors, [])
  const evidence = {
    webview: targets.version, origin: await page.evaluate('location.origin'), renderer: 'webgl',
    viewports: [[1280, 800], [480, 560]], textStreaming: true,
    simulatedTranscription: true, voiceCancellation: true, sleepAndWake: true,
    syntheticConfirmationRejected: true, refusal: true, launcherNotice,
    recognition: { availability: recognition, notice: recognitionNotice },
    playback: { ...playback, speakingObserved }, browserErrors,
  }
  await writeFile(join(directory, 'validacao-webview.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await page.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
  page.close()
}
