import endSceneHtml from '../assets/endscene/spotminders_acslanot_sip_20261022_05_ecomm_product_infographic_human_none_none.html?endcard'
import { openDestination } from './cta.js'
import { playOneShot } from '../sound.js'
import { scheduleReveal } from '../utils/reveal.js'

export class SipEndScene {
  constructor() {
    this.root = document.createElement('section')
    this.root.className = 'sip-end-scene end-scene-fade'
    this.root.hidden = true
    this.root.setAttribute('aria-label', 'Spotminders offer')
    this.frame = document.createElement('iframe')
    this.frame.title = 'Spotminders end scene'
    this.frame.tabIndex = -1
    this.frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox')
    this.overlay = document.createElement('button')
    this.overlay.type = 'button'
    this.overlay.disabled = true
    this.overlay.setAttribute('aria-label', 'Open offer')
    this.overlay.setAttribute('data-cta', '')
    this.overlay.setAttribute('data-sfx-exclude', '')
    this.overlay.addEventListener('click', openDestination)
    this.overlay.addEventListener('pointerdown', event => event.stopPropagation())
    this.overlay.addEventListener('touchend', event => event.stopPropagation())
    this.root.append(this.frame, this.overlay)
    document.getElementById('app').appendChild(this.root)
    this.shown = false
  }

  show(onRevealed) {
    if (this.shown || this.disposed) return
    this.shown = true
    this.root.hidden = false
    let video
    let ready
    const prepared = new Promise(resolve => { ready = resolve })
    const onLoad = () => {
      try {
        video = this.frame.contentDocument?.querySelector('video')
        if (!video || video.readyState >= 2) ready()
        else {
          video.addEventListener('loadeddata', ready, { once: true })
          video.addEventListener('error', ready, { once: true })
        }
      } catch { ready() }
    }
    this.clearReadiness = () => {
      this.frame.removeEventListener('load', onLoad)
      video?.removeEventListener('loadeddata', ready)
      video?.removeEventListener('error', ready)
    }
    this.frame.addEventListener('load', onLoad, { once: true })
    this.cancelReveal = scheduleReveal(prepared, () => {
      this.clearReadiness()
      this.root.classList.add('is-visible')
      this.overlay.disabled = false
      this.cue = playOneShot('finalEndScene')
    }, onRevealed, this.root)
    this.frame.srcdoc = endSceneHtml
  }

  dispose() {
    this.disposed = true
    this.cancelReveal?.()
    this.clearReadiness?.()
    this.cue?.stop?.()
    this.overlay.disabled = true
    this.frame.srcdoc = ""
    this.root.remove()
  }
}
