import { SPRITES } from '../assets.js'
import { layout, place } from '../utils/responsive.js'
import { ShopButton } from '../scenes/cta.js'

export class Hud {
  constructor() {
    this.root = document.getElementById('game-ui')
    this.logo = document.getElementById('game-logo')
    this.score = document.getElementById('game-score')
    this.value = document.getElementById('score-value')
    this.logo.src = SPRITES.logo
    this.cta = new ShopButton(this.root)
    this.ready = Promise.race([
      Promise.allSettled([this.logo.decode?.(), this.cta.image.decode?.()]),
      new Promise(resolve => setTimeout(resolve, 1200)),
    ])
  }
  setScore(score) { this.value.textContent = String(score) }
  hide() { this.root.hidden = true }
  relayout(width, height) {
    const c = layout(width, height)
    place(this.logo, c, 299, 90, 482)
    place(this.score, c, 540, 403, 770)
    this.score.style.fontSize = `${c.sd(98)}px`
    this.score.style.padding = `${c.sd(10)}px ${c.sd(30)}px ${c.sd(17)}px`
    this.score.style.borderRadius = `${c.sd(24)}px`
    this.cta.relayout(c)
  }
}
