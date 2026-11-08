import bgmSrc from './assets/sfx/bgm-96k.mp3?inline'
import clickSrc from './assets/sfx/click.mp3?inline'
import combo1Src from './assets/sfx/combo-1.mp3?inline'
import combo2Src from './assets/sfx/combo-2.mp3?inline'
import combo3Src from './assets/sfx/combo-3.mp3?inline'
import endSceneSrc from './assets/sfx/end-scene.mp3?inline'
import finalEndSceneSrc from './assets/sfx/endscene1.mp3?inline'
import firstOfferSrc from './assets/sfx/promo scene.mp3?inline'
import secondOfferSrc from './assets/sfx/endscene4.mp3?inline'
import failureSrc from './assets/sfx/wrong3.mp3?inline'

const FAST = { click: clickSrc, combo1: combo1Src, combo2: combo2Src, combo3: combo3Src }
// Explicit backend: delayed, short scene cues share the gesture-unlocked context.
const SCENE = { endScene: endSceneSrc, firstOffer: firstOfferSrc, secondOffer: secondOfferSrc, finalEndScene: finalEndSceneSrc }
const buffers = new Map()
const preparations = new Map()
const media = new Map()
const sources = new Set()
const completions = new Set()
let initialized = false
let context = null
let master = null
let sceneGain = null
let activationBuffer = null
let bgm = null
let bgmStarted = false
let paused = false
let muted = false
let volume = 1
let activated = false
let primed = false
let pendingCue = null
let generation = 0
let gameplayGesture = false
const gestureRemovals = []

function blocked() { return paused || muted || volume <= 0 || document.hidden }
function audioElement(src, baseVolume, loop = false) {
  const audio = new Audio(src)
  audio.preload = 'auto'
  audio.loop = loop
  audio.playsInline = true
  audio.volume = baseVolume * volume
  audio.muted = blocked()
  audio.baseVolume = baseVolume
  audio.generation = 0
  return audio
}
function prepareBuffers() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return
  try {
    context = new AudioCtor({ latencyHint: 'interactive' })
    master = context.createGain()
    master.connect(context.destination)
    master.gain.value = blocked() ? 0 : volume
    sceneGain = context.createGain()
    sceneGain.gain.value = 0.72
    sceneGain.connect(master)
    activationBuffer = context.createBuffer(1, 1, 22050)
    const preparingContext = context
    const assets = { ...FAST, ...SCENE }
    for (const key in assets) {
      const bytes = atob(assets[key].slice(assets[key].indexOf(',') + 1))
      const data = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i += 1) data[i] = bytes.charCodeAt(i)
      preparations.set(key, context.decodeAudioData(data.buffer).then(buffer => {
        if (context !== preparingContext || !initialized) return false
        buffers.set(key, buffer)
        return true
      }).catch(() => false))
    }
  } catch { context = null }
}
function unlock(event) {
  if (!event.isTrusted) return
  const release = event.type === 'pointerup' || event.type === 'touchend'
  const fromGame = Boolean(event.target?.closest?.('#game'))
  const eligible = fromGame || (release && gameplayGesture)
  if (release) gameplayGesture = false
  if (!eligible || event.target?.closest?.('[data-cta], [data-sfx-exclude]') || blocked()) return
  if (!release) gameplayGesture = true
  activated = true
  if (context && context.state !== 'closed') {
    // Both calls stay inside the native gesture, including iOS tracked release.
    if (context.state !== 'running') context.resume().catch(() => {})
    if (activationBuffer) {
      const activation = context.createBufferSource()
      activation.buffer = activationBuffer
      activation.connect(master)
      activation.onended = () => activation.disconnect()
      activation.start()
    }
  }
  if (!primed) {
    primed = true
    for (const audio of media.values()) {
      const token = audio.generation
      audio.muted = true
      const promise = audio.play()
      audio.pause()
      audio.muted = blocked()
      promise?.catch(() => { if (audio.generation === token) primed = false })
    }
  }
  if (bgmStarted && bgm?.paused) bgm.play().catch(() => {})
  if (pendingCue) {
    const retry = pendingCue
    pendingCue = null
    retry()
  }
}
function listenGesture(type, listener, options) {
  window.addEventListener(type, listener, options)
  gestureRemovals.push(() => window.removeEventListener(type, listener, options))
}
export function initSound() {
  if (initialized) return
  initialized = true
  bgm = audioElement(bgmSrc, 0.42, true)
  media.set('failure', audioElement(failureSrc, 0.72))
  prepareBuffers()
  listenGesture('pointerdown', unlock, { capture: true, passive: true })
  listenGesture('touchstart', unlock, { capture: true, passive: true })
  listenGesture('pointerup', unlock, { capture: true, passive: true })
  listenGesture('touchend', unlock, { capture: true, passive: true })
  const cancelGesture = () => { gameplayGesture = false }
  listenGesture('pointercancel', cancelGesture)
  listenGesture('touchcancel', cancelGesture)
  listenGesture('blur', cancelGesture)
}

export function setPlaybackState(next) {
  const previouslyBlocked = blocked()
  paused = next.paused
  muted = next.muted
  volume = next.volume
  const silence = blocked()
  if (master) master.gain.value = silence ? 0 : volume
  if (bgm) {
    bgm.volume = 0.42 * volume
    bgm.muted = silence
    if (silence) bgm.pause()
    else if (previouslyBlocked && bgmStarted && activated) bgm.play().catch(() => {})
  }
  for (const audio of media.values()) {
    audio.volume = audio.baseVolume * volume
    audio.muted = silence
    if (silence) audio.pause()
  }
  if (silence) {
    gameplayGesture = false
    generation += 1
    pendingCue = null
    for (const source of sources) { try { source.stop() } catch { /* Already ended. */ } }
    sources.clear()
    for (const complete of [...completions]) complete()
    if (context?.state === 'running') context.suspend().catch(() => {})
  } else if (activated && context?.state === 'suspended') context.resume().catch(() => {})
}

export function startBgm() {
  initSound()
  if (!bgm || bgmStarted || blocked()) return
  bgmStarted = true
  bgm.currentTime = 0
  bgm.play().catch(() => {})
}
export function stopBgm() {
  if (!bgm) return
  bgmStarted = false
  bgm.pause()
  bgm.currentTime = 0
}

function playSceneCue(key) {
  if (!context || !sceneGain) return { finished: Promise.resolve({ state: 'failed' }) }
  let source
  let watchdog
  let state = 'pending'
  let settle
  let startedAt = 0
  let lastProgressAt = performance.now()
  let lastContextTime = context.currentTime
  const token = generation
  const finished = new Promise(resolve => { settle = resolve })
  const complete = (result = 'cancelled') => {
    if (state === 'ended' || state === 'failed' || state === 'cancelled') return
    state = result
    clearTimeout(pendingTimer)
    clearInterval(watchdog)
    context.removeEventListener('statechange', start)
    completions.delete(complete)
    if (source) {
      source.onended = null
      try { source.stop() } catch { /* Already ended. */ }
      source.disconnect()
      sources.delete(source)
    }
    settle({ state: result })
  }
  const start = () => {
    if (state !== 'pending') return
    if (token !== generation || blocked() || context.state === 'closed') { complete('cancelled'); return }
    if (context.state !== 'running' || !buffers.has(key)) return
    if (sources.size >= 8) { complete('failed'); return }
    clearTimeout(pendingTimer)
    context.removeEventListener('statechange', start)
    try {
      source = context.createBufferSource()
      source.buffer = buffers.get(key)
      source.connect(sceneGain)
      source.onended = () => complete('ended')
      startedAt = context.currentTime
      lastContextTime = startedAt
      lastProgressAt = performance.now()
      state = 'playing'
      sources.add(source)
      source.start()
      watchdog = setInterval(() => {
        if (context.currentTime > lastContextTime) {
          lastContextTime = context.currentTime
          lastProgressAt = performance.now()
        }
        if (performance.now() - lastProgressAt > 2000 ||
            context.currentTime - startedAt > source.buffer.duration + 1) complete('failed')
      }, 250)
    } catch { complete('failed') }
  }
  const pendingTimer = setTimeout(() => complete('failed'), 2000)
  completions.add(complete)
  context.addEventListener('statechange', start)
  preparations.get(key)?.then(ready => { if (ready) start(); else complete('failed') })
  start()
  return { finished, stop: () => complete('cancelled'), get state() { return state } }
}

export function playOneShot(key, { retryOnGesture = false } = {}) {
  initSound()
  if (blocked() || !activated) return { finished: Promise.resolve() }
  if (key in SCENE) return playSceneCue(key)
  if (key in FAST) {
    if (context?.state !== 'running' || !buffers.has(key) || sources.size >= 8) return
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffers.get(key)
    gain.gain.value = key === 'click' ? 0.28 : 0.62
    source.connect(gain)
    gain.connect(master)
    sources.add(source)
    source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect() }
    source.start()
    return
  }
  const audio = media.get(key)
  if (!audio) return { finished: Promise.resolve() }
  let done = false
  let timer
  let lastTime = 0
  let progressAt = performance.now()
  let complete
  const token = generation
  const finished = new Promise(resolve => {
    complete = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      audio.removeEventListener('ended', complete)
      audio.removeEventListener('error', complete)
      if (pendingCue === play) pendingCue = null
      completions.delete(complete)
      audio.pause()
      resolve()
    }
    const play = () => {
      if (done || token !== generation || blocked()) { complete(); return }
      audio.generation += 1
      audio.muted = false
      audio.currentTime = 0
      audio.play().catch(() => {
        if (done) return
        if (retryOnGesture && token === generation && !blocked()) pendingCue = play
        else complete()
      })
    }
    completions.add(complete)
    audio.addEventListener('ended', complete, { once: true })
    audio.addEventListener('error', complete, { once: true })
    const monitor = () => {
      if (done) return
      if (audio.currentTime > lastTime + 0.01) { lastTime = audio.currentTime; progressAt = performance.now() }
      if (audio.ended || performance.now() - progressAt >= 4000) complete()
      else timer = setTimeout(monitor, 250)
    }
    timer = setTimeout(monitor, 250)
    play()
  })
  return { finished, stop: complete }
}
export function playCombo(index) { playOneShot(`combo${index % 3 + 1}`) }

export function disposeSound() {
  paused = true; generation += 1; pendingCue = null; gameplayGesture = false;
  for (const remove of gestureRemovals.splice(0)) remove();
  for (const complete of [...completions]) complete();
  for (const source of sources) { try { source.stop(); source.disconnect() } catch { /* Ended. */ } }
  sources.clear(); stopBgm(); bgm?.removeAttribute('src'); bgm?.load(); bgm = null;
  for (const audio of media.values()) { audio.pause(); audio.removeAttribute('src'); audio.load() }
  media.clear(); buffers.clear(); preparations.clear();
  const closing = context; context = null; master = null; sceneGain = null; activationBuffer = null;
  closing?.close()?.catch(() => {}); initialized = false; activated = false; primed = false;
}
