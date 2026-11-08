import { setPlaybackState } from './sound.js'

let mraidReadyPromise
let mraidViewable = true
let mraidExposed = true
let hostMuted = false
let hostPaused = false
let hostVolume = 1
let boundGame = null
let lifecycleBound = false
const GAME_SCENE_KEY = 'FlappyBirdScene'
let listenersBound = new WeakSet()
const removals = []
let cancelReady = null
let detectTimer = null
let disposed = false

function safeCall(name, callback) {
  try { callback() } catch (error) { console.warn(`[Network] ${name} failed`, error) }
}
export function trackEvent(eventName) {
  safeCall('analytics', () => {
    if (typeof window.ALPlayableAnalytics?.trackEvent === 'function') window.ALPlayableAnalytics.trackEvent(eventName)
    else if (typeof window.playableSDK?.reportEvent === 'function') window.playableSDK.reportEvent(eventName)
    else console.log('[Analytics]', eventName)
  })
}
export function installLifecycleStubs() {
  const names = ['gameReady', 'gameStart', 'gameEnd', 'gameClose', 'gameRetry']
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i]
    if (typeof window[name] !== 'function') window[name] = () => console.log(`[Lifecycle] ${name}`)
  }
}
export function notifyGameReady() {
  safeCall('gameReady', () => window.gameReady?.())
  trackEvent('DISPLAYED')
}
export function notifyGameStart() {
  safeCall('gameStart', () => window.gameStart?.())
  trackEvent('CHALLENGE_STARTED')
}
export function notifyGameEnd() {
  safeCall('gameEnd', () => window.gameEnd?.())
  trackEvent('CHALLENGE_SOLVED')
}
export function notifyEndcardShown() { trackEvent('ENDCARD_SHOWN') }
export function notifyGameClose() {
  safeCall('gameClose', () => window.gameClose?.())
  trackEvent('CTA_CLICKED')
}

function applyPauseState() {
  const paused = document.hidden || hostPaused || !mraidViewable || !mraidExposed
  document.documentElement.classList.toggle('host-paused', paused)
  setPlaybackState({ paused, muted: hostMuted, volume: hostVolume })
  if (!boundGame?.isBooted) return
  if (boundGame.sound) {
    boundGame.sound.mute = paused || hostMuted
    boundGame.sound.volume = hostVolume
  }
  if (paused) boundGame.scene.pause(GAME_SCENE_KEY)
  else boundGame.scene.resume(GAME_SCENE_KEY)
}

function setupMraidListeners() {
  if (!window.mraid || listenersBound.has(window.mraid)) return
  listenersBound.add(window.mraid)
  const listen = (name, callback) => {
    if (typeof window.mraid?.removeEventListener !== 'function') return
    const remove = window.mraid.removeEventListener.bind(window.mraid, name, callback)
    window.mraid.addEventListener(name, callback)
    removals.push(remove)
  }
  safeCall('initial visibility', () => {
    if (typeof window.mraid.isViewable === 'function') mraidViewable = Boolean(window.mraid.isViewable())
  })
  if (typeof window.mraid.addEventListener === 'function') {
    listen('error', (message, action) => console.warn('[MRAID error]', { message, action }))
    listen('stateChange', state => {
      if (state === 'hidden') hostPaused = true
      else if (state === 'default' || state === 'expanded') hostPaused = false
      applyPauseState()
    })
    listen('exposureChange', value => {
      if (typeof value === 'number') { mraidExposed = value > 0; applyPauseState() }
    })
    listen('viewableChange', value => { mraidViewable = Boolean(value); applyPauseState() })
    listen('audioVolumeChange', value => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        hostVolume = Math.max(0, Math.min(1, value / 100))
        applyPauseState()
      }
    })
  }
  applyPauseState()
}

export function initMraid(detectTimeoutMs = 500) {
  if (mraidReadyPromise) return mraidReadyPromise
  disposed = false
  mraidReadyPromise = new Promise(resolve => {
    const started = Date.now()
    const detect = () => {
      if (disposed) { resolve(false); return }
      if (!window.mraid && Date.now() - started < detectTimeoutMs) {
        detectTimer = setTimeout(detect, 50); return
      }
      cancelReady = window.__mip.ready(() => {
        if (disposed) { resolve(false); return }
        setupMraidListeners()
        resolve(Boolean(window.mraid))
      })
    }
    detect()
  })
  return mraidReadyPromise
}
export const mraidReady = initMraid()

function listen(target, name, callback) {
  target.addEventListener(name, callback)
  removals.push(() => target.removeEventListener(name, callback))
}
export function bindLifecycle(game) {
  boundGame = game
  game?.events.on('game-scene-ready', applyPauseState)
  game?.events.once('destroy', () => { boundGame = null })
  if (!lifecycleBound) {
    lifecycleBound = true
    const pause = () => { hostPaused = true; applyPauseState() }
    const resume = () => { hostPaused = false; applyPauseState() }
    listen(document, 'visibilitychange', applyPauseState)
    listen(window, 'pagehide', pause)
    listen(window, 'pageshow', resume)
    listen(window, 'ad-event-pause', pause)
    listen(window, 'ad-event-resume', resume)
    listen(window, 'luna:pause', pause)
    listen(window, 'luna:resume', resume)
    listen(window, 'luna:mute', () => { hostMuted = true; applyPauseState() })
    listen(window, 'luna:unmute', () => { hostMuted = false; applyPauseState() })
    listen(window, 'message', event => {
      if (event.data === 'onPause') pause()
      if (event.data === 'onResume') resume()
    })
  }
  applyPauseState()
}

export function disposeNetwork() {
  disposed = true; clearTimeout(detectTimer); cancelReady?.();
  for (const remove of removals.splice(0)) { try { remove() } catch { /* Disposed host. */ } }
  boundGame?.events.off('game-scene-ready', applyPauseState)
  boundGame = null; lifecycleBound = false; listenersBound = new WeakSet(); mraidReadyPromise = null;
}
