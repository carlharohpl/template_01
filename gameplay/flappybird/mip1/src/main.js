import Phaser from 'phaser'
import './index.css'
import { WIN_HOLD_MS } from './constants.js'
import { FlappyBirdScene } from './game.js'
import { Hud } from './game/Hud.js'
import { EndCard } from './scenes/EndCard.js'
import { SipEndScene } from './scenes/SipEndScene.js'
import { openDestination } from './scenes/cta.js'
import { viewport } from './utils/responsive.js'
import { disposeNetwork, bindLifecycle, installLifecycleStubs, mraidReady, notifyGameReady, notifyGameEnd, notifyGameStart, notifyEndcardShown } from './networks.js'
import { PreloaderScene } from './preloader.js'
import { disposeSound, initSound, playOneShot, stopBgm } from './sound.js'

let booted = false
let disposed = false
let disposeMedia
const holds = new Map()
const hold = ms => new Promise(resolve => {
  const timer = setTimeout(() => { holds.delete(timer); resolve() }, ms)
  holds.set(timer, resolve)
})
const clearHolds = () => {
  for (const [timer, resolve] of holds) { clearTimeout(timer); resolve() }
  holds.clear()
}
let disposeCreative = () => {
  disposed = true; clearHolds(); disposeMedia?.(); disposeSound(); disposeNetwork(); window.isMraidUsable.dispose?.()
}
window.__mip.activateDestination = openDestination

function renderSize(width, height, pixelRatio) {
  // Phaser 3 does not support a `resolution` config option. Size its backing
  // canvas explicitly; CSS and the DOM overlays remain in viewport pixels.
  const density = Math.max(1, Math.min(pixelRatio, 2.25,
    Math.sqrt(1450000 / (width * height))))
  return { width: Math.round(width * density), height: Math.round(height * density) }
}

async function boot() {
  if (booted) return
  booted = true
  installLifecycleStubs()
  await mraidReady
  if (disposed) return
  disposeMedia = window.__mip.setupMediaViewability()
  await Promise.race([
    document.fonts?.load('600 102px Yellix').catch(() => {}),
    hold(1500),
  ])
  if (disposed) { disposeMedia?.(); return }
  const app = document.getElementById('app')
  const hud = new Hud()
  const endCard = new EndCard()
  const sipEndScene = new SipEndScene()
  const gameHost = document.getElementById('game')
  let game
  let gameEnded = false
  let gameDestroyed = false
  let gameRenderingRetired = false
  let rendererFailed = false
  let readyNotified = false
  let startupTimer
  let winCue
  const announceReady = () => {
    if (readyNotified) return
    readyNotified = true
    notifyGameReady()
  }
  const showRendererFallback = () => {
    if (rendererFailed || gameDestroyed || sipEndScene.shown) return
    rendererFailed = true
    gameEnded = true
    clearTimeout(startupTimer)
    stopBgm()
    winCue?.stop?.()
    endCard.dispose()
    gameHost.hidden = true
    if (game) {
      gameDestroyed = true
      game.destroy(true)
    }
    announceReady()
    notifyEndcardShown()
    sipEndScene.show(() => {
      hud.hide()
      endCard.root.hidden = true
    })
  }
  const onContextLost = event => {
    event.preventDefault()
    showRendererFallback()
  }
  gameHost.addEventListener('webglcontextlost', onContextLost, true)
  gameHost.addEventListener('webglcontextcreationerror', showRendererFallback, true)
  const removeRendererListeners = () => {
    gameHost.removeEventListener('webglcontextlost', onContextLost, true)
    gameHost.removeEventListener('webglcontextcreationerror', showRendererFallback, true)
  }
  window.addEventListener('pagehide', event => {
    if (event.persisted) return
    clearTimeout(startupTimer)
    removeRendererListeners()
    endCard.dispose()
    sipEndScene.dispose()
  })
  window.__mip.activateDestination = openDestination
  initSound()
  const view = viewport()
  const backing = renderSize(view.width, view.height, window.devicePixelRatio || 1)
  try {
    game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: document.getElementById('game'),
    width: backing.width,
    height: backing.height,
    transparent: true,
    scene: [PreloaderScene, FlappyBirdScene],
    fps: { target: 60, min: 30, smoothStep: true },
    audio: { disableWebAudio: true },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.NONE, width: backing.width, height: backing.height },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    input: { activePointers: 2, touch: { capture: true } },
    loader: { imageLoadType: 'HTMLImageElement' },
    })
  } catch (error) {
    console.warn('[Renderer] Showing HTML offer after initialization failure', error)
    bindLifecycle(null)
    showRendererFallback()
    return
  }
  startupTimer = setTimeout(showRendererFallback, 4000)
  let lastWidth = 0
  let lastHeight = 0
  let lastPixelRatio = 0
  const resize = () => {
    const { width, height } = viewport()
    const pixelRatio = window.devicePixelRatio || 1
    if (width === lastWidth && height === lastHeight && pixelRatio === lastPixelRatio) return
    lastWidth = width
    lastHeight = height
    lastPixelRatio = pixelRatio
    app.style.width = `${width}px`
    app.style.height = `${height}px`
    if (!gameDestroyed && !gameRenderingRetired && game.isBooted) {
      const size = renderSize(width, height, pixelRatio)
      // Set CSS bounds before Phaser refreshes its pointer-coordinate mapping.
      game.canvas.style.width = `${width}px`
      game.canvas.style.height = `${height}px`
      game.scale.resize(size.width, size.height)
    }
    hud.relayout(width, height)
    endCard.relayout()
  }
  let resizeFrame
  const resizeTimers = new Set()
  const queueResize = () => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(resize)
    for (const timer of resizeTimers) clearTimeout(timer)
    resizeTimers.clear()
    for (const delay of [100, 300, 600]) {
      const timer = setTimeout(() => { resizeTimers.delete(timer); if (!disposed) resize() }, delay)
      resizeTimers.add(timer)
    }
  }
  window.addEventListener('resize', queueResize)
  window.addEventListener('orientationchange', queueResize)
  window.visualViewport?.addEventListener('resize', queueResize)
  game.events.on(Phaser.Core.Events.PRE_STEP, resize)
  game.events.once(Phaser.Core.Events.READY, () => { lastWidth = 0; resize() })
  game.events.once('assets-loaded', announceReady)
  game.events.once('render-unavailable', showRendererFallback)
  game.events.once('destroy', removeRendererListeners)
  game.events.once('game-scene-ready', () => {
    clearTimeout(startupTimer)
    hud.ready.then(() => { if (!gameEnded) hud.root.hidden = false })
  })
  game.events.once('game-started', notifyGameStart)
  game.events.on('score-changed', score => hud.setScore(score))
  game.events.once('game-complete', () => {
    if (gameEnded) return
    gameEnded = true
    stopBgm()
    notifyGameEnd()
    winCue = playOneShot('endScene', { retryOnGesture: true })
    Promise.all([
      hold(WIN_HOLD_MS),
      winCue?.finished,
    ]).then(() => {
      if (disposed || rendererFailed) return
      endCard.show(() => {
        hud.hide()
        gameRenderingRetired = true
        game.pause()
        removeRendererListeners()
        Promise.all([
          hold(3500),
          endCard.cue?.finished,
        ]).then(() => !disposed && endCard.showSecondOffer(() => {
          Promise.all([
            hold(3500),
            endCard.cue?.finished,
          ]).then(() => !disposed && sipEndScene.show(() => {
            gameDestroyed = true
            game.destroy(true)
            gameHost.hidden = true
            endCard.root.hidden = true
            endCard.dispose()
          }))
        }))
      })
    })
  })
  bindLifecycle(game)
  disposeCreative = () => {
    disposed = true; clearHolds(); clearTimeout(startupTimer); cancelAnimationFrame(resizeFrame);
    for (const timer of resizeTimers) clearTimeout(timer); resizeTimers.clear();
    window.removeEventListener('resize', queueResize);
    window.removeEventListener('orientationchange', queueResize);
    window.visualViewport?.removeEventListener('resize', queueResize);
    removeRendererListeners(); winCue?.stop?.(); endCard.dispose(); sipEndScene.dispose();
    if (!gameDestroyed) { gameDestroyed = true; game.destroy(true) }
    disposeMedia?.(); disposeSound(); disposeNetwork(); window.isMraidUsable.dispose?.();
  }
  resize()
}

const cancelBoot = window.__mip.ready(() => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
})
const onPageHide = event => { if (!event.persisted) { cancelBoot?.(); disposeCreative() } }
window.addEventListener('pagehide', onPageHide)
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('pagehide', onPageHide);
  cancelBoot?.(); disposed = true; document.removeEventListener('DOMContentLoaded', boot); disposeCreative();
})
