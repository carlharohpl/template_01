import { SPRITES } from '../assets.js'
import { notifyGameClose } from '../networks.js'
import { place } from '../utils/responsive.js'

export function openDestination(event) {
  event?.stopPropagation()
  notifyGameClose()
  console.log('CTA clicked')
  window.__mip.openDestination()
}

export class ShopButton {
  constructor(parent) {
    this.image = document.createElement('img')
    this.image.src = SPRITES.cta
    this.image.alt = 'Shop Now'
    this.image.draggable = false
    this.image.className = 'positioned shop-image animate-scale-pulse'
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'positioned shop-button'
    this.button.setAttribute('aria-label', 'Shop Now')
    this.button.setAttribute('data-cta', '')
    this.button.setAttribute('data-sfx-exclude', '')
    this.button.addEventListener('click', openDestination)
    this.button.addEventListener('pointerdown', event => event.stopPropagation())
    this.button.addEventListener('touchend', event => event.stopPropagation())
    parent.append(this.image, this.button)
  }
  relayout(c) {
    place(this.image, c, 232, 1665, 616)
    place(this.button, c, 170.4, 1651.8, 739.2, 158.4)
    this.button.style.borderRadius = `${c.sd(80)}px`
  }
}
