import Phaser from 'phaser'
import { layout } from './utils/responsive.js'
import { HEIGHT, PRODUCT_GOAL, WIDTH, DEPTH } from './constants.js'
import { playCombo, playOneShot, startBgm } from './sound.js'

const PIPE_INTERVAL_MS = 1300
const TAP_INPUT_MIN_MS = 50
const CLICK_SFX_MIN_MS = 120
const TAP_FLYING_MS = 110


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export class FlappyBirdScene extends Phaser.Scene {
  constructor() {
    super('FlappyBirdScene')
    this.score = 0
    this.started = false
    this.crashed = false
    this.finished = false
    this.pipeTimer = null
    this.timeLimitEvent = null
    this.handShowEvent = null
    this.nextItemIndex = 0
    this.pipesSpawned = 0
    this.emptyPipeStreak = 0
    this.lastOrientation = null
    this.idleBirdY = 0
    this.idleBirdTexture = null
    this.activeBirdTexture = null
    this.tapSpriteUntil = 0
    this.lastTapAt = -Infinity
    this.lastClickSoundAt = -Infinity
    this.bgmStarted = false
    this.headerMetrics = { bottom: 0, height: 0 }
    this.footerMetrics = { top: Infinity, height: 0 }
  }

  create() {
    this.sound.pauseOnBlur = false
    this.cameras.main.roundPixels = true
    this.score = 0
    this.started = false
    this.crashed = false
    this.finished = false
    this.nextItemIndex = 0
    this.idleBirdY = 0
    this.idleBirdTexture = null
    this.activeBirdTexture = null
    this.tapSpriteUntil = 0
    this.lastTapAt = -Infinity
    this.lastClickSoundAt = -Infinity
    this.bgmStarted = false
    this.headerMetrics = { bottom: 0, height: 0 }
    this.footerMetrics = { top: Infinity, height: 0 }

    this.pipes = this.physics.add.group({ allowGravity: false, immovable: true })
    this.items = this.physics.add.group({ allowGravity: false })

    this.createUi()
    this.createBird()
    this.createHint()

    this.physics.add.collider(this.bird, this.pipes, () => this.handleCrash())
    this.physics.add.overlap(this.bird, this.items, (_bird, item) => this.collectItem(item))
    this.createPreStartObstacles()

    this.input.on('pointerdown', this.handleTap, this)
    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handleTap, this)
      this.scale.off('resize', this.handleResize, this)
      this.pipeTimer?.remove()
      this.timeLimitEvent?.remove()
      this.handShowEvent?.remove()
      this.failCue?.stop?.()
    })

    this.lastOrientation = this.getOrientation()
    this.lastHeight = this.scale.height
    this.game.events.emit('game-scene-ready')
  }

  getSizeUnit() {
    return WIDTH * this.getSceneScale()
  }

  getSceneScale() {
    return Math.min(this.scale.width / WIDTH, this.scale.height / HEIGHT)
  }

  isLandscape() {
    return this.scale.width > this.scale.height
  }

  getOrientation() {
    return this.isLandscape() ? 'landscape' : 'portrait'
  }

  getBirdHome() {
    const width = this.scale.width
    const height = this.scale.height
    const landscape = this.isLandscape()
    return {
      x: width * 0.5,
      y: landscape ? height * 0.55 : layout(width, height).sy(1060),
    }
  }

  computeTuning() {
    const height = this.scale.height
    const unit = this.getSizeUnit()
    this.gravityY = height * 1.55
    this.flapVelocity = -height * 0.46
    this.pipeSpeed = -unit * 0.46
    this.pipeGap = clamp(unit * 0.46, height * 0.26, height * 0.44)
    this.physics.world.gravity.y = this.started && !this.crashed ? this.gravityY : 0
  }

  createUi() {
    this.computeTuning()
    this.layoutUi()
  }

  createBird() {
    const home = this.getBirdHome()
    this.bird = this.physics.add.sprite(home.x, home.y, 'birdFlying')
      .setDepth(DEPTH.bird)
      .setCollideWorldBounds(false)
    this.bird.body.setAllowGravity(false)
    this.idleBirdY = home.y
    this.activeBirdTexture = 'birdFlying'
    this.layoutBird()
  }

  createHint() {
    this.hand = this.add.image(0, 0, 'hand').setDepth(DEPTH.hint).setVisible(false)
    this.tapToBegin = this.add.image(0, 0, 'tapToBegin').setDepth(DEPTH.hint)
    this.layoutHint()
    this.scheduleHandHint()
  }

  layoutUi() {
    const c = layout(this.scale.width, this.scale.height)
    this.headerMetrics = { height: c.sd(500), bottom: c.sy(500) }
    this.footerMetrics = { height: c.sd(280), top: c.sy(1640) }
  }

  layoutBird() {
    if (!this.bird) return
    const unit = this.getSizeUnit()
    const texture = this.textures.get('birdFlying').getSourceImage()
    const targetW = unit * (236 / WIDTH)
    const targetH = targetW * (texture.height / texture.width)
    this.bird.setDisplaySize(targetW, targetH)
    this.birdBaseScaleX = this.bird.scaleX
    this.birdBaseScaleY = this.bird.scaleY
    this.bird.body.setSize(texture.width * 0.58, texture.height * 0.62, true)
  }

  layoutHint() {
    if (!this.hand || !this.bird) return
    const c = layout(this.scale.width, this.scale.height)
    const handTexture = this.textures.get('hand').getSourceImage()
    this.hand.setDisplaySize(c.sd(363), c.sd(363 * handTexture.height / handTexture.width))
      .setOrigin(0.5)
      .setPosition(c.sx(785), c.sy(1370))
    this.handBaseScaleX = this.hand.scaleX
    this.handBaseScaleY = this.hand.scaleY
    const hintTexture = this.textures.get('tapToBegin').getSourceImage()
    this.tapToBegin.setDisplaySize(c.sd(597), c.sd(597 * hintTexture.height / hintTexture.width))
      .setPosition(c.sx(540), c.sy(760))
  }

  scheduleHandHint() {
    this.handShowEvent?.remove()
    this.hand.setVisible(true)
    this.hand.setScale(this.handBaseScaleX, this.handBaseScaleY)
    this.handShowEvent = this.time.delayedCall(1, () => {
      if (this.started || this.crashed || this.finished || !this.hand) return
      this.hand.setVisible(true)
    })
  }

  handleTap() {
    if (this.finished) return
    if (this.crashed) return
    const now = this.time.now
    if (now - this.lastTapAt < TAP_INPUT_MIN_MS) return
    this.lastTapAt = now

    if (!this.bgmStarted) {
      startBgm()
      this.bgmStarted = true
    }
    if (now - this.lastClickSoundAt >= CLICK_SFX_MIN_MS) {
      playOneShot('click')
      this.lastClickSoundAt = now
    }
    if (!this.started) this.startGame()

    if (this.activeBirdTexture !== 'birdFlying') {
      this.bird.setTexture('birdFlying')
      this.activeBirdTexture = 'birdFlying'
    }
    this.bird.setVelocityY(this.flapVelocity)
    this.tapSpriteUntil = now + TAP_FLYING_MS
    this.bird.setScale(this.birdBaseScaleX, this.birdBaseScaleY)
  }

  startGame() {
    this.started = true
    this.game.events.emit('game-started')
    this.hand.setVisible(false)
    this.tapToBegin?.setVisible(false)
    this.handShowEvent?.remove()
    this.bird.body.setAllowGravity(true)
    this.physics.world.gravity.y = this.gravityY
    this.startObstacles()

    this.pipeTimer = this.time.delayedCall(this.getInitialPipeSpawnDelay(), () => {
      this.spawnPipePair()
      this.pipeTimer = this.time.addEvent({
        delay: this.getPipeInterval(),
        loop: true,
        callback: this.spawnPipePair,
        callbackScope: this,
      })
    })
  }

  getPreStartPipeCount() {
    return this.getPreStartPipePositions().length
  }

  getPipeInterval() {
    return this.isLandscape() ? 1600 : PIPE_INTERVAL_MS
  }

  getInitialPipeSpawnDelay() {
    return this.getPipeInterval() * this.getPreStartPipeCount()
  }

  createPreStartObstacles() {
    this.pipes.clear(true, true)
    this.items.clear(true, true)
    this.nextItemIndex = 0
    this.pipesSpawned = 0
    this.emptyPipeStreak = 0

    const home = this.getBirdHome()
    const positions = this.getPreStartPipePositions()

    for (let i = 0; i < positions.length; i += 1) {
      this.spawnPipePair({
        x: positions[i],
        centerY: i === 0 ? home.y : null,
        velocity: 0,
      })
    }
  }

  getPreStartPipePositions() {
    const width = this.scale.width
    const pipeW = this.getPipeWidth()

    if (!this.isLandscape()) {
      return [width]
    }

    const firstX = width
    const spacing = Math.max(width * 0.2, pipeW * 2.2)
    return [firstX, firstX + spacing]
  }

  getPipeWidth() {
    return Math.max(1, this.getSizeUnit() * (257 / WIDTH))
  }

  startObstacles() {
    this.pipes.children.iterate((pipe) => pipe?.setVelocityX(this.pipeSpeed))
    this.items.children.iterate((item) => item?.setVelocityX(this.pipeSpeed))
  }

  spawnPipePair({ x = null, centerY = null, velocity = this.pipeSpeed } = {}) {
    if (this.crashed || this.finished) return

    const width = this.scale.width
    const height = this.scale.height
    const unit = this.getSizeUnit()
    const pipeTexture = this.textures.get('pipe').getSourceImage()
    const pipeW = this.getPipeWidth()
    const pipeH = pipeW * (pipeTexture.height / pipeTexture.width)
    const spawnX = x ?? width + pipeW
    const safeTop = Math.max(height * 0.38, this.headerMetrics.bottom + this.pipeGap / 2)
    const safeBottom = Math.min(height * 0.83, this.footerMetrics.top - unit * 0.45)
    const gapCenterY = centerY ?? Phaser.Math.Between(safeTop, Math.max(safeTop + 1, safeBottom))
    const itemTargetH = Math.max(1, Math.min(unit * (240 / WIDTH), this.pipeGap * 0.48))
    const itemBob = Math.max(3, Math.min(unit * 0.018, (this.pipeGap - itemTargetH) * 0.14))

    const topY = gapCenterY - this.pipeGap / 2 - pipeH / 2
    const bottomY = gapCenterY + this.pipeGap / 2 + pipeH / 2
    const top = this.createPipe(spawnX, topY, pipeW, pipeH, false, velocity)
    const bottom = this.createPipe(spawnX, bottomY, pipeW, pipeH, true, velocity)

    const hasProduct = this.pipesSpawned === 0 || this.emptyPipeStreak >= 2 || Math.random() < 0.55
    this.pipesSpawned += 1
    this.emptyPipeStreak = hasProduct ? 0 : this.emptyPipeStreak + 1
    if (!hasProduct) return { top, bottom, item: null }

    const itemKey = 'product'
    this.nextItemIndex += 1
    const item = this.items.get(spawnX, gapCenterY, itemKey)
    item.enableBody(true, spawnX, gapCenterY, true, true)
    item.collected = false
    item.productKey = itemKey
    const itemTexture = this.textures.get(itemKey).getSourceImage()
    const itemW = itemTargetH * (itemTexture.width / itemTexture.height)
    item.setDisplaySize(itemW, itemTargetH)
    item.setDepth(DEPTH.product)
    item.setVelocityX(velocity)
    item.body.setAllowGravity(false)
    item.body.setSize(itemTexture.width * 0.7, itemTexture.height * 0.7, true)

    if (itemBob > 4) {
      this.tweens.add({
        targets: item,
        y: gapCenterY + itemBob,
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    return { top, bottom, item }
  }

  createPipe(x, y, width, height, flipY, velocity = this.pipeSpeed) {
    const pipeTexture = this.textures.get('pipe').getSourceImage()
    const pipe = this.pipes.get(x, y, flipY ? 'pipeBottom' : 'pipe')
    pipe.setTexture(flipY ? 'pipeBottom' : 'pipe')
    pipe.enableBody(true, x, y, true, true)
    pipe
      .setOrigin(0.5)
      .setDepth(DEPTH.pipes)
      .setFlipY(false)
      .setDisplaySize(width, height)
      .setVelocityX(velocity)
      .setImmovable(true)
    pipe.body.setAllowGravity(false)
    pipe.body.setSize(pipeTexture.width * 0.78, pipeTexture.height * 0.96, true)
    return pipe
  }

  collectItem(item) {
    if (this.crashed || this.finished || item.collected) return
    item.collected = true
    playCombo(this.score)
    this.tweens.killTweensOf(item)
    this.emitItemEffect(item.x, item.y)
    item.disableBody(true, true)
    this.incrementScore()
  }

  emitItemEffect(x, y) {
    const unit = this.getSizeUnit()
    const texture = this.textures.get('itemEffect').getSourceImage()
    const effectW = Math.max(1, unit * 0.42)
    const effect = this.add.image(x, y, 'itemEffect')
      .setDepth(DEPTH.effect)
      .setAlpha(0)
      .setDisplaySize(effectW, effectW * (texture.height / texture.width))
      .setAngle(Phaser.Math.Between(-14, 14))
    const baseScaleX = effect.scaleX
    const baseScaleY = effect.scaleY
    effect.setScale(baseScaleX * 0.35, baseScaleY * 0.35)
    this.tweens.add({
      targets: effect,
      x: x + this.pipeSpeed * 0.46,
      duration: 460,
      ease: 'Linear',
    })

    this.tweens.add({
      targets: effect,
      alpha: { from: 0, to: 1 },
      scaleX: baseScaleX * 1.08,
      scaleY: baseScaleY * 1.08,
      angle: effect.angle + 24,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: effect,
          alpha: 0,
          scaleX: baseScaleX * 1.34,
          scaleY: baseScaleY * 1.34,
          duration: 300,
          ease: 'Sine.easeIn',
          onComplete: () => effect.destroy(),
        })
      },
    })
  }

  incrementScore() {
    this.score += 1
    this.game.events.emit('score-changed', this.score)
    if (this.score >= PRODUCT_GOAL) {
      this.finishWin()
    }
  }

  finishWin() {
    if (this.finished || this.crashed || this.score < PRODUCT_GOAL) return
    this.finished = true
    this.pipeTimer?.remove()
    this.handShowEvent?.remove()
    this.hand.setVisible(false)
    this.stopObstacles()
    this.bird.body.setAllowGravity(false)
    this.bird.setVelocity(0, 0)
    this.game.events.emit('game-complete')
  }

  handleCrash() {
    if (this.crashed || this.finished || !this.started) return
    this.crashed = true
    this.failCue?.stop?.()
    this.failCue = playOneShot('failure')
    this.pipeTimer?.remove()
    this.timeLimitEvent?.remove()
    this.stopObstacles()
    this.bird.body.setAllowGravity(false)
    this.bird.setVelocity(0, 0)
    this.time.delayedCall(500, () => {
      this.crashed = false
      this.started = false
      this.score = 0
      this.game.events.emit('score-changed', this.score)
      const home = this.getBirdHome()
      this.bird.setPosition(home.x, home.y).setAngle(0)
      this.tapToBegin.setVisible(true)
      this.scheduleHandHint()
      this.createPreStartObstacles()
    })
  }

  stopObstacles() {
    this.pipes.children.iterate((pipe) => pipe?.setVelocityX(0))
    this.items.children.iterate((item) => item?.setVelocityX(0))
  }

  update() {
    if (!this.bird) return

    if (!this.started && !this.crashed) {
      const home = this.getBirdHome()
      const unit = this.getSizeUnit()
      const cycleMs = 940
      const flapMs = 280
      const cycleTime = this.time.now % cycleMs
      const startY = home.y + unit * 0.03
      const peakY = home.y - unit * 0.04
      const endY = home.y + unit * 0.03
      const isFlapping = cycleTime < flapMs
      const progress = isFlapping ? cycleTime / flapMs : (cycleTime - flapMs) / (cycleMs - flapMs)
      const eased = isFlapping
        ? Phaser.Math.Easing.Cubic.Out(progress)
        : Phaser.Math.Easing.Quadratic.In(progress)
      const nextY = isFlapping
        ? Phaser.Math.Linear(startY, peakY, eased)
        : Phaser.Math.Linear(peakY, endY, eased)

      const nextTexture = isFlapping ? 'birdFlying' : 'birdFalling'
      if (this.idleBirdTexture !== nextTexture) {
        this.bird.setTexture(nextTexture)
        this.idleBirdTexture = nextTexture
        this.activeBirdTexture = nextTexture
      }
      this.bird.setPosition(home.x, nextY)
      this.bird.setAngle(isFlapping ? -14 : 18)
      this.idleBirdY = nextY

      if (this.hand?.visible) {
        const handScale = isFlapping
          ? Phaser.Math.Linear(1, 0.78, eased)
          : Phaser.Math.Linear(0.78, 1, eased)
        this.hand.setScale(this.handBaseScaleX * handScale, this.handBaseScaleY * handScale)
      }
      return
    }

    if (!this.crashed && !this.finished) {
      if (this.tapSpriteUntil && this.time.now >= this.tapSpriteUntil && this.activeBirdTexture !== 'birdFalling') {
        this.bird.setTexture('birdFalling')
        this.activeBirdTexture = 'birdFalling'
      }
      const velocityY = this.bird.body.velocity.y
      this.bird.setAngle(clamp(velocityY * 0.055, -24, 76))
    }

    const pipes = this.pipes.getChildren()
    for (let i = 0; i < pipes.length; i += 1) {
      if (pipes[i].active && pipes[i].x < -pipes[i].displayWidth) pipes[i].disableBody(true, true)
    }
    const items = this.items.getChildren()
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].active && items[i].x < -items[i].displayWidth) {
        this.tweens.killTweensOf(items[i])
        items[i].disableBody(true, true)
      }
    }

    if (!this.crashed && !this.finished && (
      this.bird.y > this.scale.height + this.bird.displayHeight
      || this.bird.y < -this.bird.displayHeight
    )) {
      this.handleCrash()
    }
  }

  handleResize() {
    if (!this.bird) return
    const relativeY = this.bird.y / (this.lastHeight || this.scale.height)
    this.lastHeight = this.scale.height
    this.computeTuning()
    this.layoutUi()
    this.layoutBird()
    this.layoutHint()

    const home = this.getBirdHome()
    if (!this.started) {
      this.bird.setPosition(home.x, home.y)
      this.idleBirdY = home.y
      this.layoutHint()
      this.createPreStartObstacles()
      this.lastOrientation = this.getOrientation()
      return
    }

    if (this.crashed) {
      this.bird.setPosition(home.x, home.y)
      this.idleBirdY = home.y
      this.layoutHint()
    } else {
      this.bird.setPosition(home.x, clamp(relativeY * this.scale.height, this.bird.displayHeight, this.scale.height - this.bird.displayHeight))
    }

    const orientation = this.getOrientation()
    if (this.started && !this.crashed && !this.finished && orientation !== this.lastOrientation) {
      this.pipes.clear(true, true)
      this.items.clear(true, true)
      this.spawnPipePair({ centerY: this.bird.y })
    } else {
      const speed = this.finished || this.crashed ? 0 : this.pipeSpeed
      this.pipes.children.iterate((pipe) => pipe?.setVelocityX(speed))
      this.items.children.iterate((item) => item?.setVelocityX(speed))
    }
    this.lastOrientation = orientation
  }
}
