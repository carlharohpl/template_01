import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Bodies from 'matter-js/src/factory/Bodies'
import Body from 'matter-js/src/body/Body'
import Composite from 'matter-js/src/body/Composite'
import Engine from 'matter-js/src/core/Engine'
import Events from 'matter-js/src/core/Events'
import Runner from 'matter-js/src/core/Runner'
import './game.css'
import useScaleUI from './hooks/useScaleUI'
import { useSound, waitForSoundCompletion } from './hooks/useSound'
import { Cta } from './components/cta'
import EndScene from './components/EndScene'
import logo from './assets/img/logo.webp'
import subtitle from './assets/img/subtitle.webp'
import background from './assets/img/bg.webp'
import hand from './assets/img/hand.webp'
import retry from './assets/img/tryagainbox.webp'
import winSlot from './assets/img/youwonbox.webp'
import overlay from './assets/img/blurrbg.webp'
import youWon from './assets/img/youwon.webp'
import cta from './assets/img/cta.webp'
import pegboard from './assets/img/ball.webp'
import dropball from './assets/img/dropball.webp'
import clickSfx from './assets/sfx/click.wav?inline'
import bounceSfx from './assets/sfx/bounce.wav?inline'
import correctSfx from './assets/sfx/correct1.mp3?inline'
import wrongSfx from './assets/sfx/wrong3.mp3?inline'
import gameWinSfx from './assets/sfx/gamewin2.mp3?inline'
import endSceneSfx from './assets/sfx/endscene1.mp3?inline'

// Retain Matter's original world units inside the 1080 x 1920 design canvas.
const UNIT = 3.75
const PHYSICS_SPEED = 0.65
const START = { x: 144, y: 142.6 }
const RADIUS = 6.5
const OUTCOMES = [1, 3, 2]
const RELEASE_VELOCITIES = [-0.47, 0.47, 0.92]
const GUIDE_FORCES = [0.00012, 0.00012, 0.00012]
const CENTERS = Array.from({ length: 5 }, (_, i) => 57.6 * (i + 0.5))
const PEGS = [3, 4, 5, 6, 7, 8].flatMap((count, row) =>
  Array.from({ length: count }, (_, col) => ({
    x: (288 - (count - 1) * 34) / 2 + col * 34,
    y: 161.3 + row * 36.1,
  })))
const ASSETS = [logo, subtitle, background, hand, retry, winSlot, overlay, youWon, cta, pegboard, dropball]

export default function App() {
  const { wrapperRef, appRef } = useScaleUI(1080, 1920)
  const engineRef = useRef(null)
  const runnerRef = useRef(null)
  const bodyRef = useRef(null)
  const ballRef = useRef(null)
  const inputRef = useRef(null)
  const phaseRef = useRef('preparing')
  const countRef = useRef(0)
  const targetRef = useRef(null)
  const resultSoundPlayed = useRef(false)
  const bounceAt = useRef(0)
  const progress = useRef({ y: 0, time: 0 })
  const resultTimer = useRef(0)
  const resultSource = useRef(null)
  const cancelResult = useRef(null)
  const entranceTimer = useRef(0)
  const [entrance, setEntrance] = useState(false)
  const [phase, setPhase] = useState('preparing')
  const [count, setCount] = useState(0)
  const [landed, setLanded] = useState(null)
  const [showEndScene, setShowEndScene] = useState(false)
  const [hidden, setHidden] = useState(document.hidden || window.__mraidViewable === false)
  const clickSound = useSound(clickSfx, 0.8)
  const bounceSound = useSound(bounceSfx, 0.55)
  const correctSound = useSound(correctSfx, 0.8)
  const wrongSound = useSound(wrongSfx, 0.8)
  const gameWinSound = useSound(gameWinSfx, 0.8)
  const endSceneSound = useSound(endSceneSfx, 0.8)
  const sounds = useMemo(() => [clickSound, bounceSound, correctSound, wrongSound, gameWinSound, endSceneSound],
    [clickSound, bounceSound, correctSound, wrongSound, gameWinSound, endSceneSound])
  const unlock = useCallback(event => sounds.forEach(sound => sound.unlock(event)), [sounds])
  const endSceneReady = useCallback(() => {
    sounds.forEach(sound => sound.stop())
    endSceneSound.play()
  }, [endSceneSound, sounds])

  useEffect(() => {
    if (phase !== 'won') return
    sounds.forEach(sound => sound.stop())
    const source = gameWinSound.play()
    return waitForSoundCompletion(source, { minimumMs: 2000, onComplete: () => setShowEndScene(true) })
  }, [gameWinSound, phase, sounds])
  const paint = useCallback((x, y, angle = 0) => {
    if (ballRef.current) ballRef.current.style.transform =
      'translate(' + (x - START.x) * UNIT + 'px,' + (y - START.y) * UNIT + 'px) rotate(' + angle + 'rad)'
  }, [])
  const entranceDone = useCallback(() => {
    if (phaseRef.current !== 'preparing') return
    clearTimeout(entranceTimer.current)
    phaseRef.current = 'ready'
    setPhase('ready')
  }, [])

  useEffect(() => {
    let cancelled = false
    let frame1 = 0
    let frame2 = 0
    const cleanup = []
    const pending = ASSETS.map(src => new Promise(resolve => {
      const image = new Image()
      let done = false
      const settle = () => {
        if (done) return
        done = true
        clearTimeout(timeout)
        image.onload = image.onerror = null
        resolve()
      }
      const timeout = setTimeout(settle, 1800)
      cleanup.push(settle)
      image.onload = () => image.decode ? image.decode().catch(() => {}).then(settle) : settle()
      image.onerror = settle
      image.src = src
      if (image.complete && image.naturalWidth) image.onload()
    }))
    pending.push(new Promise(resolve => {
      const timeout = setTimeout(resolve, 1800)
      cleanup.push(() => { clearTimeout(timeout); resolve() })
      document.fonts.load('700 46px "Sofia Pro"').catch(() => {}).finally(() => {
        clearTimeout(timeout)
        resolve()
      })
    }))
    Promise.allSettled(pending).then(() => {
      if (cancelled) return
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (cancelled) return
          setEntrance(true)
          entranceTimer.current = setTimeout(entranceDone, 1600)
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      cleanup.forEach(fn => fn())
      clearTimeout(entranceTimer.current)
      clearTimeout(resultTimer.current)
      cancelResult.current?.()
    }
  }, [entranceDone])

  useEffect(() => {
    const update = () => {
      const paused = document.hidden || window.__mraidViewable === false
      setHidden(paused)
      if (runnerRef.current) runnerRef.current.enabled = !paused && phaseRef.current === 'falling'
      progress.current.time = performance.now()
    }
    document.addEventListener('visibilitychange', update)
    window.addEventListener('mraidViewableChange', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('mraidViewableChange', update)
    }
  }, [])
  useEffect(() => {
    const input = inputRef.current
    input.addEventListener('pointerdown', unlock)
    input.addEventListener('touchstart', unlock, { passive: true })
    input.addEventListener('pointerup', unlock)
    input.addEventListener('pointermove', unlock)
    return () => {
      input.removeEventListener('pointerdown', unlock)
      input.removeEventListener('touchstart', unlock)
      input.removeEventListener('pointerup', unlock)
      input.removeEventListener('pointermove', unlock)
    }
  }, [unlock])

  const finish = useCallback((slot) => {
    if (!bodyRef.current || phaseRef.current !== 'falling' || slot !== targetRef.current) return
    Composite.remove(engineRef.current.world, bodyRef.current)
    bodyRef.current = null
    runnerRef.current.enabled = false
    phaseRef.current = 'landing'
    setPhase('landing')
    setLanded(slot)
    const completed = ++countRef.current
    setCount(completed)
    if (!resultSoundPlayed.current) {
      resultSoundPlayed.current = true
      bounceSound.stop()
      resultSource.current = slot % 2 === 0 ? correctSound.play() : wrongSound.play()
    }
    if (completed === 3) {
      cancelResult.current = waitForSoundCompletion(resultSource.current, { minimumMs: 650, onComplete: () => {
        phaseRef.current = 'won'
        setPhase('won')
      } })
      return
    }
    resultTimer.current = setTimeout(() => {
        paint(START.x, START.y)
        phaseRef.current = 'ready'
        setPhase('ready')
    }, 550)
  }, [bounceSound, correctSound, paint, wrongSound])

  useEffect(() => {
    const engine = Engine.create({ gravity: { x: 0, y: 0.78, scale: 0.001 } })
    engine.timing.timeScale = PHYSICS_SPEED
    engine.positionIterations = 8
    engine.velocityIterations = 6
    engineRef.current = engine
    Composite.add(engine.world, [
      ...PEGS.map(({ x, y }, i) => Bodies.circle(x, y, 6.7, {
        isStatic: true, label: 'peg-' + i, restitution: 0.72, friction: 0.02,
      })),
      Bodies.rectangle(-5, 280, 10, 310, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(293, 280, 10, 310, { isStatic: true, label: 'wall' }),
      // Invisible sloped boundaries follow the outer edges of the peg triangle.
      ...[[97, 142, 0, 365], [191, 142, 288, 365]].map(([x1, y1, x2, y2]) =>
        Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), 6, {
          isStatic: true, label: 'board-edge', angle: Math.atan2(y2 - y1, x2 - x1), restitution: 0.12, friction: 0.01,
        })),
      ...Array.from({ length: 6 }, (_, i) => Bodies.rectangle(i * 57.6, 411, 3, 68, {
        isStatic: true, label: 'divider', restitution: 0.25,
      })),
      Bodies.rectangle(144, 430, 288, 8, { isStatic: true, label: 'floor' }),
      ...CENTERS.map((x, i) => Bodies.rectangle(x, 406, 3, 8, {
        isStatic: true, isSensor: true, label: 'box-' + i,
      })),
    ])
    const collision = ({ pairs }) => {
      const ball = bodyRef.current
      if (!ball) return
      for (const { bodyA, bodyB } of pairs) {
        const other = bodyA === ball ? bodyB : bodyB === ball ? bodyA : null
        if (other?.label.startsWith('peg-') && performance.now() - bounceAt.current > 90) {
          bounceAt.current = performance.now()
          bounceSound.play()
        }
      }
    }
    const sync = () => {
      const ball = bodyRef.current
      if (!ball) return
      const { x, y } = ball.position
      const difference = CENTERS[targetRef.current] - x
      const guideForce = GUIDE_FORCES[countRef.current]
      const now = performance.now()
      // Keep peg deflections horizontal; never launch the ball back up the board.
      if (ball.velocity.y < 0.35) Body.setVelocity(ball, { x: ball.velocity.x, y: 0.35 })
      if (y > progress.current.y + 1.5) progress.current = { y, time: now }
      // Preserve real collisions and the established attraction to a result slot.
      if (y > 175 && y < 345) Body.applyForce(ball, ball.position, {
        x: Math.max(-guideForce, Math.min(guideForce, difference * 0.000008)), y: 0,
      })
      // Settle only inside the slot already reached, behind its foreground edge.
      // Do not pull the falling ball across neighboring result slots.
      const actualSlot = Math.max(0, Math.min(4, Math.floor(x / 57.6)))
      if (y > 390 && actualSlot === targetRef.current) Body.setVelocity(ball, {
        x: Math.max(-0.7, Math.min(0.7, difference * 0.12)),
        y: Math.max(ball.velocity.y, 1.15),
      })
      if (now - progress.current.time > 650 / PHYSICS_SPEED && y < 356) {
        const direction = Math.sign(difference) || (countRef.current === 1 ? 1 : -1)
        Body.setVelocity(ball, { x: direction * 1.6, y: 0.65 })
        progress.current.time = now
      }
      paint(x, y, ball.angle)
      // Cue each result on arrival, without waiting for hidden slot centering.
      if (y >= 400 && actualSlot === targetRef.current && !resultSoundPlayed.current) {
        resultSoundPlayed.current = true
        bounceSound.stop()
        resultSource.current = actualSlot % 2 === 0 ? correctSound.play() : wrongSound.play()
      }
      if (y >= 400 && Math.abs(difference) < 1) finish(targetRef.current)
    }
    Events.on(engine, 'collisionStart', collision)
    Events.on(engine, 'afterUpdate', sync)
    const runner = Runner.create({ delta: 1000 / 60 })
    runner.enabled = false
    runnerRef.current = runner
    Runner.run(runner, engine)
    return () => {
      Runner.stop(runner)
      Events.off(engine, 'collisionStart', collision)
      Events.off(engine, 'afterUpdate', sync)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      bodyRef.current = null
      engineRef.current = null
    }
  }, [bounceSound, correctSound, finish, paint, wrongSound])

  const release = useCallback(event => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return
    if (phaseRef.current !== 'ready' || bodyRef.current || hidden || !engineRef.current) return
    phaseRef.current = 'falling'
    setPhase('falling')
    unlock(event)
    clickSound.play()
    targetRef.current = OUTCOMES[countRef.current]
    resultSoundPlayed.current = false
    progress.current = { y: START.y, time: performance.now() }
    const ball = Bodies.circle(START.x, START.y, RADIUS, {
      label: 'ball', restitution: 0.55, friction: 0.012, frictionAir: 0.006, density: 0.0024,
    })
    const direction = countRef.current === 2 && Math.random() < 0.5 ? -1 : 1
    Body.setVelocity(ball, { x: RELEASE_VELOCITIES[countRef.current] * direction, y: 0.35 })
    bodyRef.current = ball
    Composite.add(engineRef.current.world, ball)
    runnerRef.current.enabled = true
  }, [clickSound, hidden, unlock])

  return (
    <main className={'app-wrapper relative h-dvh w-full overflow-hidden overscroll-none bg-[#f7eeeb]' + (entrance ? ' entrance-running' : '') + (hidden || showEndScene ? ' scene-paused' : '') + (phase === 'won' ? ' is-won' : '')} ref={wrapperRef}>
      <img
        src={background}
        alt="Cosmetic texture background"
        className="scene-background pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover"
        draggable="false"
      />
      <div className="canvas-position absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
        <div className="app plinko absolute h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible select-none text-black" ref={appRef} data-phase={phase} data-landed-slot={landed}>
          <img
            src={logo}
            alt="Jones Road"
            className="plinko-logo pointer-events-none absolute left-1/2 top-[53px] z-50 w-[682px] -translate-x-1/2 select-none asset-enter"
            draggable="false"
          />
          <div className="gameplay-surface absolute inset-0 z-0 overflow-visible">
            <img
              src={subtitle}
              alt="Where will you land? Tap to drop"
              className="plinko-heading pointer-events-none absolute left-1/2 top-[200px] z-10 w-[700px] -translate-x-1/2 select-none asset-enter"
              draggable="false"
            />
            <span
              className="ball-counter absolute left-1/2 top-[415px] z-10 grid h-[75px] w-[195px] -translate-x-1/2 select-none place-items-center rounded-[9px] bg-black font-['Sofia_Pro'] text-[46px] font-bold leading-none text-white asset-enter"
              aria-live="polite"
              aria-label={count + ' of 3 balls completed'}
            >
              {count}/3
            </span>
            <img
              src={pegboard}
              alt="Triangular black pegboard"
              className="pegboard pointer-events-none absolute left-[70px] top-[577px] z-2 w-[940px] select-none asset-enter"
              draggable="false"
            />
            <img
              src={winSlot}
              alt="YOU WON"
              className="result-slot pointer-events-none absolute left-[6px] top-[1411px] z-5 w-[204px] select-none asset-enter"
              draggable="false"
            />
            <img
              src={retry}
              alt="TRY AGAIN"
              className="result-slot slot-second pointer-events-none absolute left-[222px] top-[1411px] z-5 w-[204px] select-none asset-enter"
              draggable="false"
            />
            <img
              src={winSlot}
              alt="YOU WON"
              className="result-slot slot-third pointer-events-none absolute left-[438px] top-[1411px] z-5 w-[204px] select-none asset-enter"
              draggable="false"
            />
            <img
              src={retry}
              alt="TRY AGAIN"
              className="result-slot slot-fourth pointer-events-none absolute left-[654px] top-[1411px] z-5 w-[204px] select-none asset-enter"
              draggable="false"
            />
            <img
              src={winSlot}
              alt="YOU WON"
              className="result-slot slot-fifth pointer-events-none absolute left-[870px] top-[1411px] z-5 w-[204px] select-none asset-enter"
              draggable="false"
            />
            <div className="box-rail asset-enter" aria-hidden="true" />
            <span
              className={'drop-ripple pointer-events-none absolute left-[541px] top-[533px] z-3 h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-[#ec2552] select-none' + (phase === 'ready' ? ' is-ready' : '')}
              aria-hidden="true"
            />
            <img
              src={dropball}
              alt="Red drop ball"
              className="ball-position pointer-events-none absolute left-[516px] top-[508px] z-4 w-[50px] select-none ball-enter"
              draggable="false"
              ref={ballRef}
              onAnimationEnd={entranceDone}
            />
            <div ref={inputRef} className="drop-area" onPointerDown={release} aria-label="Tap to drop ball" />
            <img
              src={hand}
              alt="Tap guidance"
              className={'aim-hand pointer-events-none absolute left-[570px] top-[550px] z-20 w-[150px] origin-[24%_20%] select-none' + (phase === 'ready' ? ' hand-visible' : '')}
              draggable="false"
            />
          </div>
          {phase === 'won' && <>
            <img
              src={overlay}
              alt="Winning overlay"
              className="win-overlay pointer-events-none absolute left-[calc(-1*var(--ui-left,0px)/var(--ui-scale,1))] top-[calc(-1*var(--ui-top,0px)/var(--ui-scale,1))] z-40 h-[calc(100dvh/var(--ui-scale,1))] w-[calc(100dvw/var(--ui-scale,1))] max-w-none select-none object-cover"
              draggable="false"
            />
            <img
              src={youWon}
              alt="YOU WON!"
              className="win-message pointer-events-none absolute left-1/2 top-[838px] z-50 w-[647px] -translate-x-1/2 select-none"
              draggable="false"
            />
          </>}
          <Cta ready={entrance} />
        </div>
      </div>
      {showEndScene && <EndScene onReady={endSceneReady} />}
    </main>
  )
}
