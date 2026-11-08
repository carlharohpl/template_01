import { SPRITES } from '../assets.js'
import { layout, place, viewport } from '../utils/responsive.js'
import { notifyEndcardShown } from '../networks.js'
import { playOneShot } from '../sound.js'
import { ShopButton } from './cta.js'
import { scheduleReveal } from '../utils/reveal.js'

const OFFERS = [
  {
    id: 'offer-buy-3',
    images: {
      'offer-title': ['offerBuy3', 207.5, 657, 665],
      'offer-tag-left': ['tagRight', 54, 824, 214],
      'offer-tag-right': ['tagLeft', 828, 824, 214],
      'offer-badge-1': ['freeShipping', 117, 1325, 415],
      'offer-badge-2': ['mysteryGift', 548, 1325, 415],
      'offer-badge-3': ['freeTwoTags', 117, 1437, 415],
      'offer-badge-4': ['charger', 548, 1437, 415],
    },
  },
  {
    id: 'offer-buy-2',
    images: {
      'offer-title': ['offerBuy2', 39.5, 655, 1001],
      'offer-badge-1': ['freeOneTag', 90, 1100, 435],
      'offer-badge-2': ['freeShippingWide', 555, 1100, 435],
      'offer-tag-1': ['tagFront1', 147, 1219, 263],
      'offer-tag-2': ['tagFront2', 408.5, 1219, 263],
      'offer-tag-3': ['tagFront3', 670, 1219, 263],
    },
  },
]

export class EndCard {
  constructor() {
    this.root = document.getElementById('end-card')
    this.root.classList.add('end-scene-fade')
    this.logo = document.getElementById('end-logo')
    this.heading = document.getElementById('end-congratulations')
    this.pipe = document.getElementById('end-backdrop-pipe')
    this.confetti = document.getElementById('end-confetti')
    this.logo.src = SPRITES.logo
    this.heading.src = SPRITES.congratulations
    this.pipe.src = SPRITES.pipe
    this.cta = new ShopButton(document.getElementById('end-content'))
    for (let i = 0; i < OFFERS.length; i += 1) {
      const offer = OFFERS[i]
      const root = document.getElementById(offer.id)
      root.classList.add('end-scene-fade', 'offer-entrance')
      for (const name in offer.images) root.querySelector(`.${name}`).src = SPRITES[offer.images[name][0]]
    }
    const images = this.root.querySelectorAll('img')
    this.prepared = Promise.allSettled(Array.from(images, image => image.decode?.()))
    this.shown = false
  }

  show(onRevealed) {
    if (this.shown || this.disposed) return
    this.shown = true
    this.offer = OFFERS[0]
    this.root.dataset.offer = this.offer.id
    document.getElementById(this.offer.id).hidden = false
    this.root.hidden = false
    this.backdropScore = document.getElementById('game-score').cloneNode(true)
    this.backdropScore.id = 'end-score-backdrop'
    this.backdropScore.querySelector('span').removeAttribute('id')
    this.backdropScore.setAttribute('aria-hidden', 'true')
    this.backdropScore.style.opacity = '0.22'
    this.root.insertBefore(this.backdropScore, this.confetti)
    this.addConfetti()
    this.relayout()
    this.cancelReveal = scheduleReveal(this.prepared, () => {
      this.root.classList.add('is-visible')
      document.getElementById(this.offer.id).classList.add('is-visible', 'is-entering')
      this.cue = playOneShot('firstOffer')
      notifyEndcardShown()
    }, onRevealed, this.root)
  }

  showSecondOffer(onRevealed) {
    if (!this.shown || this.disposed || this.transitioning || this.offer === OFFERS[1]) return
    this.transitioning = true
    const previous = document.getElementById(this.offer.id)
    this.cancelReveal?.()
    this.cancelReveal = scheduleReveal(this.prepared, () => {
      previous.classList.remove('is-visible')
    }, () => {
      previous.hidden = true
      this.offer = OFFERS[1]
      const next = document.getElementById(this.offer.id)
      next.hidden = false
      this.relayout()
      this.cancelReveal = scheduleReveal(this.prepared, () => {
        this.root.dataset.offer = this.offer.id
        next.classList.add('is-visible', 'is-entering')
        this.cue = playOneShot('secondOffer')
      }, onRevealed, next)
    }, previous)
  }

  dispose() {
    this.disposed = true
    this.cancelReveal?.()
    this.cue?.stop?.()
  }

  addConfetti() {
    for (let i = 0; i < 36; i += 1) {
      const piece = document.createElement('div')
      piece.style.left = `${(i * 37.3) % 100}%`
      piece.style.top = '0'
      piece.style.setProperty('--duration', `${7 + i % 5}s`)
      piece.style.setProperty('--delay', `${-((i * 1.73) % 11)}s`)
      piece.style.setProperty('--x', `${(i % 2 ? 1 : -1) * (2 + i % 7)}vw`)
      piece.style.setProperty('--rotate', '480deg')
      this.confetti.appendChild(piece)
    }
  }

  relayout() {
    if (!this.shown) return
    const { width, height } = viewport()
    const c = layout(width, height)
    this.root.style.setProperty('--offer-enter-distance', `${c.sd(80)}px`)
    place(this.logo, c, 299, 90, 482)
    place(this.heading, c, 130, 342, 820)
    this.cta.relayout(c)
    this.heading.style.filter = `drop-shadow(0 ${c.sd(14)}px ${c.sd(17)}px rgba(0,0,0,.22))`
    this.pipe.style.width = `${c.sd(257)}px`
    this.pipe.style.filter = `blur(${c.sd(14)}px)`
    place(this.backdropScore, c, 540, 403, 770)
    this.backdropScore.style.fontSize = `${c.sd(98)}px`
    this.backdropScore.style.padding = `${c.sd(10)}px ${c.sd(30)}px ${c.sd(17)}px`
    this.backdropScore.style.borderRadius = `${c.sd(24)}px`
    this.backdropScore.style.filter = `blur(${c.sd(13)}px)`
    const root = document.getElementById(this.offer.id)
    for (const name in this.offer.images) {
      const [, x, y, w] = this.offer.images[name]
      place(root.querySelector(`.${name}`), c, x, y, w)
    }
    const pieces = this.confetti.children
    for (let i = 0; i < pieces.length; i += 1) {
      pieces[i].style.width = `${c.sd(11 + i % 8)}px`
      pieces[i].style.height = `${c.sd(24 + i % 16)}px`
    }
  }
}
