import Phaser from 'phaser'
import { GAME_SPRITES } from './assets.js'

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('PreloaderScene')
  }

  preload() {
    this.failed = false
    this.load.once('loaderror', () => {
      this.failed = true
      this.game.events.emit('render-unavailable')
    })
    Object.entries(GAME_SPRITES).forEach(([key, src]) => {
      this.load.image(key, src)
    })
  }

  create() {
    if (this.failed) return
    this.game.events.emit('assets-loaded')
    this.scene.start('FlappyBirdScene')
  }
}
