import { useCallback, useEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { bindSoundGestures, handleUnlockGesture, playSound, setSoundMuted, stopSound, waitForSoundCompletion } from "./hooks/useSound";
import { Cta, openDestination } from "./components/cta";
import EndScene from "./components/endscene";
import background from "./assets/img/cloud-background.webp";
import logo from "./assets/img/spotminders-logo.webp";
import birdFlying from "./assets/img/bird-tap-flying.webp";
import birdFalling from "./assets/img/bird-wing-up.webp";
import hand from "./assets/img/tap-hand.webp";
import hint from "./assets/img/tap-to-fly-up.webp";
import pipeTop from "./assets/img/pipe-top.webp";
import pipeBottom from "./assets/img/pipe-bottom.webp";
import product from "./assets/img/smart-tag.webp";
import sparkles from "./assets/img/collection-sparkles.webp";
import congratulations from "./assets/img/congratulations.webp";
import offerBuy3 from "./assets/img/offer-buy-3-get-2.webp";
import offerBuy2 from "./assets/img/offer-buy-2-get-1.webp";
import tagLeft from "./assets/img/smart-tag-tilt-left.webp";
import tagRight from "./assets/img/smart-tag-tilt-right.webp";
import tagFront1 from "./assets/img/smart-tag-front-1.webp";
import tagFront2 from "./assets/img/smart-tag-front-2.webp";
import tagFront3 from "./assets/img/smart-tag-front-3.webp";
import freeShipping from "./assets/img/badge-free-shipping.webp";
import mysteryGift from "./assets/img/badge-free-mystery-gift.webp";
import freeTwoTags from "./assets/img/badge-free-2-tags.webp";
import charger from "./assets/img/badge-free-usb-c-charger.webp";
import freeOneTag from "./assets/img/badge-free-1-tag.webp";
import freeShippingWide from "./assets/img/badge-free-shipping-wide.webp";
import bgmSrc from "./assets/sounds/bgm-96k.mp3?inline";
import clickSrc from "./assets/sounds/click.mp3?inline";
import combo1Src from "./assets/sounds/combo-1.mp3?inline";
import combo2Src from "./assets/sounds/combo-2.mp3?inline";
import combo3Src from "./assets/sounds/combo-3.mp3?inline";
import winSrc from "./assets/sounds/end-scene.mp3?inline";
import firstOfferSrc from "./assets/sounds/promo scene.mp3?inline";
import secondOfferSrc from "./assets/sounds/endscene4.mp3?inline";
import finalSrc from "./assets/sounds/endscene1.mp3?inline";
import failureSrc from "./assets/sounds/wrong3.mp3?inline";

const ART = [background, logo, birdFlying, birdFalling, hand, hint, pipeTop, pipeBottom, product, sparkles,
  congratulations, offerBuy3, offerBuy2, tagLeft, tagRight, tagFront1, tagFront2, tagFront3,
  freeShipping, mysteryGift, freeTwoTags, charger, freeOneTag, freeShippingWide];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function prepareImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); image.onload = null; image.onerror = null; resolve(); };
    const loaded = () => { if (image.decode) image.decode().then(finish, finish); else finish(); };
    const timer = setTimeout(finish, 1200);
    image.onload = loaded;
    image.onerror = finish;
    image.src = src;
    if (image.complete) loaded();
  });
}

function notify(callback, event) {
  try {
    if (callback) window[callback]?.();
    if (typeof window.ALPlayableAnalytics?.trackEvent === "function") window.ALPlayableAnalytics.trackEvent(event);
    else window.playableSDK?.reportEvent?.(event);
  } catch { /* Host callbacks never own scene progression. */ }
}

export default function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const [phase, setPhase] = useState("loading");
  const [score, setScore] = useState(0);
  const [pipes, setPipes] = useState([]);
  const [effects, setEffects] = useState([]);
  const [offer, setOffer] = useState(0);
  const [offerVisible, setOfferVisible] = useState(false);
  const [offerItemsVisible, setOfferItemsVisible] = useState(false);
  const [gameVisible, setGameVisible] = useState(true);
  const [sipVisible, setSipVisible] = useState(false);
  const engine = useRef(null);
  const birdRef = useRef(null);
  const pipeNodes = useRef(new Map());
  const clickPool = useSound(clickSrc, { backend: "web", poolSize: 2 });
  const combo1Pool = useSound(combo1Src, { backend: "web" });
  const combo2Pool = useSound(combo2Src, { backend: "web" });
  const combo3Pool = useSound(combo3Src, { backend: "web" });
  const winPool = useSound(winSrc, { backend: "web" });
  const firstPool = useSound(firstOfferSrc, { backend: "web" });
  const secondPool = useSound(secondOfferSrc, { backend: "web" });
  const finalPool = useSound(finalSrc, { backend: "web" });
  const failurePool = useSound(failureSrc, { backend: "media" });
  const onSipReady = useCallback(() => engine.current?.sipReady(), []);

  useEffect(() => {
    const root = wrapperRef.current;
    const canvas = appRef.current;
    let active = true;
    let raf;
    let lastFrame = 0;
    let accumulator = 0;
    let nextId = 0;
    const timers = new Set();
    const frames = new Set();
    const gates = new Set();
    const handles = new Set();
    const removals = [];
    const e = { mode: "loading", paused: false, score: 0, y: 1060, velocity: 0, angle: 0, time: 0, pipes: [],
      spawned: 0, emptyStreak: 0, nextSpawn: Infinity, crashUntil: 0, tapUntil: 0,
      lastTap: -Infinity, lastClick: -Infinity, bgmWanted: false, hostPaused: false, hostVisible: true,
      exposed: true, hostMuted: false, volume: 1, sipStarted: false };
    engine.current = e;
    // Music remains a single streaming media element, as in the original game.
    const music = new Audio(bgmSrc);
    music.preload = "auto";
    music.loop = true;
    music.volume = 0.42;
    const later = (callback, ms) => {
      const id = setTimeout(() => { timers.delete(id); if (active) callback(); }, ms);
      timers.add(id);
      return id;
    };
    const twoFrames = callback => {
      const frame = requestAnimationFrame(() => {
        frames.delete(frame);
        const second = requestAnimationFrame(() => { frames.delete(second); if (active) callback(); });
        frames.add(second);
      });
      frames.add(frame);
    };
    const sound = (pool, volume, scene = false) => {
      const handle = playSound(pool, { volume: volume * e.volume, ...(scene ? { pendingMs: 2000 } : {}) });
      if (handle) { handles.add(handle); handle.finished.then(() => handles.delete(handle)); }
      return handle;
    };
    const gate = (handle, minimumMs, callback) => {
      const cancel = waitForSoundCompletion(handle, { minimumMs, onComplete: () => { gates.delete(cancel); if (active) callback(); } });
      gates.add(cancel);
    };
    const setMode = mode => { e.mode = mode; canvas.dataset.mode = mode; setPhase(mode); };
    const syncPipes = () => setPipes([...e.pipes]);
    const home = () => e.landscape ? e.top + e.height * 0.55 : 1060;
    const placeBird = () => {
      canvas.style.setProperty("--bird-y", `${e.y}px`);
      canvas.style.setProperty("--bird-angle", `${e.angle}deg`);
      canvas.dataset.wing = e.time < e.tapUntil ? "up" : "down";
    };
    const spawn = (x = e.left + e.width + 257, center = null) => {
      const safeTop = Math.max(e.top + e.height * 0.38, 500 + e.gap / 2);
      const safeBottom = Math.min(e.top + e.height * 0.83, 1640 - 1080 * 0.45);
      const y = center ?? Math.floor(safeTop + Math.random() * (Math.max(safeTop + 1, safeBottom) - safeTop + 1));
      const hasProduct = e.spawned === 0 || e.emptyStreak >= 2 || Math.random() < 0.55;
      e.spawned++;
      e.emptyStreak = hasProduct ? 0 : e.emptyStreak + 1;
      const height = Math.min(240, e.gap * 0.48);
      const bob = Math.max(3 / e.scale, Math.min(19.44, (e.gap - height) * 0.14));
      e.pipes.push({ id: ++nextId, x, y, gap: e.gap, hasProduct, collected: false, height, bob: bob * e.scale * e.density > 4 ? bob : 0, born: e.time });
      syncPipes();
    };
    const resetPipes = () => {
      e.pipes = []; e.spawned = 0; e.emptyStreak = 0;
      spawn(e.left + e.width, home());
      if (e.landscape) spawn(e.left + e.width + Math.max(e.width * 0.2, 257 * 2.2));
    };
    const size = () => {
      const rect = root.getBoundingClientRect();
      const previousHeight = e.height;
      const relativeY = previousHeight ? (e.y - e.top) / previousHeight : 0.55;
      const oldLandscape = e.landscape;
      e.scale = Math.round(1080 * Math.min(rect.width / 1080, rect.height / 1920)) / 1080 || 1;
      e.width = rect.width / e.scale;
      e.height = rect.height / e.scale;
      e.left = (1080 - e.width) / 2;
      e.top = (1920 - e.height) / 2;
      e.density = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.25, Math.sqrt(1450000 / (rect.width * rect.height))));
      e.landscape = rect.width > rect.height;
      e.gravity = e.height * 1.55;
      e.flap = -e.height * 0.46;
      e.gap = clamp(496.8, e.height * 0.26, e.height * 0.44);
      canvas.style.setProperty("--home-y", `${home()}px`);
      if (["loading", "idle", "crashed"].includes(e.mode)) { e.y = home(); resetPipes(); }
      else if (e.mode === "playing") {
        e.y = e.top + clamp(relativeY * e.height, 186, e.height - 186);
        if (oldLandscape !== e.landscape) { e.pipes = []; spawn(e.left + e.width + 257, e.y); }
      }
      placeBird();
    };
    const musicPlay = () => {
      if (e.bgmWanted && !e.paused && !e.hostMuted && e.volume > 0 && music.paused) music.play()?.catch(() => {});
    };
    const syncVisibility = () => {
      e.paused = document.hidden || e.hostPaused || !e.hostVisible || !e.exposed;
      root.classList.toggle("host-paused", e.paused);
      const muted = e.paused || e.hostMuted || e.volume <= 0;
      setSoundMuted(muted);
      music.volume = 0.42 * e.volume;
      music.muted = muted;
      if (muted) music.pause(); else musicPlay();
    };
    const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); removals.push(() => target.removeEventListener(name, fn, options)); };
    const pause = () => { e.hostPaused = true; syncVisibility(); };
    const resume = () => { e.hostPaused = false; syncVisibility(); };
    listen(document, "visibilitychange", syncVisibility);
    for (const name of ["pagehide", "ad-event-pause", "luna:pause"]) listen(window, name, pause);
    for (const name of ["pageshow", "ad-event-resume", "luna:resume"]) listen(window, name, resume);
    listen(window, "luna:mute", () => { e.hostMuted = true; syncVisibility(); });
    listen(window, "luna:unmute", () => { e.hostMuted = false; syncVisibility(); });
    listen(window, "message", event => {
      if (event.source !== window.parent) return;
      if (event.data === "onPause") pause();
      if (event.data === "onResume") resume();
    });
    try {
      if (typeof window.mraid?.isViewable === "function") e.hostVisible = Boolean(window.mraid.isViewable());
      const listenHost = (name, fn) => {
        if (typeof window.mraid?.addEventListener !== "function" || typeof window.mraid?.removeEventListener !== "function") return;
        const remove = window.mraid.removeEventListener.bind(window.mraid, name, fn);
        window.mraid.addEventListener(name, fn);
        removals.push(remove);
      };
      listenHost("viewableChange", visible => { e.hostVisible = Boolean(visible); syncVisibility(); });
      listenHost("stateChange", state => { if (state === "hidden") pause(); else if (["default", "expanded"].includes(state)) resume(); });
      listenHost("exposureChange", value => { if (typeof value === "number") { e.exposed = value > 0; syncVisibility(); } });
      listenHost("audioVolumeChange", value => { if (Number.isFinite(value)) { e.volume = clamp(value / 100, 0, 1); syncVisibility(); } });
    } catch { /* Browser without host lifecycle APIs. */ }

    const showSecond = () => {
      setOfferItemsVisible(false);
      later(() => {
        setOffer(2);
        twoFrames(() => {
          setOfferItemsVisible(true);
          const cue = sound(secondPool, 0.72, true);
          later(() => gate(cue, 3500, () => setMode("sip")), 500);
        });
      }, 500);
    };
    const showFirst = () => {
      setOffer(1);
      setMode("offer");
      twoFrames(() => {
        setOfferVisible(true);
        setOfferItemsVisible(true);
        const cue = sound(firstPool, 0.72, true);
        notify(null, "ENDCARD_SHOWN");
        later(() => { setGameVisible(false); gate(cue, 3500, showSecond); }, 500);
      });
    };
    e.sipReady = () => {
      if (e.sipStarted || !active) return;
      e.sipStarted = true;
      sound(finalPool, 0.72, true);
      later(() => { setSipVisible(true); setOfferVisible(false); }, 500);
    };
    const finish = () => {
      if (e.mode !== "playing") return;
      setMode("won");
      e.velocity = 0;
      e.bgmWanted = false;
      music.pause(); music.currentTime = 0;
      notify("gameEnd", "CHALLENGE_SOLVED");
      const cue = sound(winPool, 0.72, true);
      gate(cue, 2000, showFirst);
    };
    const crash = () => {
      if (e.mode !== "playing") return;
      setMode("crashed");
      e.velocity = 0;
      stopSound(e.failure);
      e.failure = sound(failurePool, 0.72);
      e.crashUntil = e.time + 500;
    };
    const tap = event => {
      if (!event.isTrusted || event.isPrimary === false || (event.button != null && event.button !== 0) || event.target.closest?.("[data-sfx-exclude],button") || e.paused || !["idle", "playing"].includes(e.mode)) return;
      const now = performance.now();
      if (now - e.lastTap < 50) return;
      e.lastTap = now;
      handleUnlockGesture(event);
      e.bgmWanted = true;
      musicPlay();
      if (now - e.lastClick >= 120) { sound(clickPool, 0.28); e.lastClick = now; }
      if (e.mode === "idle") {
        const rect = birdRef.current.getBoundingClientRect();
        const origin = canvas.getBoundingClientRect();
        e.y = (rect.top + rect.height / 2 - origin.top) / e.scale;
        setMode("playing");
        e.nextSpawn = e.time + (e.landscape ? 1600 * 2 : 1300);
        if (!e.startedNotified) { e.startedNotified = true; notify("gameStart", "CHALLENGE_STARTED"); }
      }
      e.velocity = e.flap;
      e.tapUntil = e.time + 110;
      placeBird();
      if (event.cancelable) event.preventDefault();
    };
    const unbindSound = bindSoundGestures(root);
    listen(root, window.PointerEvent ? "pointerdown" : "touchstart", tap, { passive: false });
    const collision = (x, y, width, height) => Math.abs(x - 540) < (width + 236 * 0.58) / 2 && Math.abs(y - e.y) < (height + 186 * 0.62) / 2;
    const step = dt => {
      e.time += dt * 1000;
      if (e.mode === "crashed" && e.time >= e.crashUntil) {
        e.score = 0; setScore(0); e.y = home(); e.angle = 0; setMode("idle"); resetPipes(); placeBird();
      }
      if (e.mode !== "playing") return;
      e.velocity += e.gravity * dt;
      e.y += e.velocity * dt;
      e.angle = clamp(e.velocity * e.scale * e.density * 0.055, -24, 76);
      if (e.time >= e.nextSpawn) { spawn(); e.nextSpawn += e.landscape ? 1600 : 1300; }
      for (const p of e.pipes) {
        p.x -= 496.8 * dt;
        if (collision(p.x, p.y - p.gap / 2 - 858, 257 * 0.78, 1716 * 0.96) || collision(p.x, p.y + p.gap / 2 + 858, 257 * 0.78, 1716 * 0.96)) { crash(); break; }
        const itemY = p.y + p.bob * (1 - Math.cos((e.time - p.born) / 760 * Math.PI)) / 2;
        if (p.hasProduct && !p.collected && collision(p.x, itemY, p.height * 180 / 272 * 0.7, p.height * 0.7)) {
          p.collected = true;
          sound([combo1Pool, combo2Pool, combo3Pool][e.score], 0.62);
          const effect = { id: p.id, x: p.x, y: itemY, angle: Math.floor(Math.random() * 29) - 14 };
          setEffects(previous => [...previous, effect]);
          later(() => setEffects(previous => previous.filter(item => item.id !== effect.id)), 460);
          e.score++; setScore(e.score); syncPipes();
          if (e.score >= 3) { finish(); break; }
        }
      }
      if (e.pipes.some(p => p.x < e.left - 257)) { e.pipes = e.pipes.filter(p => p.x >= e.left - 257); syncPipes(); }
      if (e.y > e.top + e.height + 186 || e.y < e.top - 186) crash();
    };
    const tick = now => {
      if (!active) return;
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
      lastFrame = now;
      if (!e.paused) {
        accumulator += delta;
        while (accumulator >= 1 / 120) { step(1 / 120); accumulator -= 1 / 120; }
        if (!["idle", "loading"].includes(e.mode)) placeBird();
        if (e.mode === "playing") for (const p of e.pipes) for (const suffix of ["top", "bottom", "item"]) pipeNodes.current.get(`${p.id}-${suffix}`)?.style.setProperty("--pipe-x", `${p.x}px`);
      } else accumulator = 0;
      if (!["won", "offer", "sip"].includes(e.mode)) raf = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(size);
    resize.observe(root);
    size(); syncVisibility();
    Promise.allSettled([...ART.map(prepareImage), Promise.race([document.fonts?.load("600 98px Yellix"), new Promise(resolve => later(resolve, 1500))])]).then(() => {
      if (!active) return;
      twoFrames(() => { e.time = 0; for (const p of e.pipes) p.born = 0; setMode("idle"); notify("gameReady", "DISPLAYED"); });
    });
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      engine.current = null;
      cancelAnimationFrame(raf);
      for (const frame of frames) cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      for (const cancel of gates) cancel();
      for (const handle of handles) stopSound(handle);
      unbindSound(); resize.disconnect();
      for (const remove of removals) { try { remove(); } catch { /* Host disposed. */ } }
      music.pause(); music.removeAttribute("src"); music.load();
      setSoundMuted(false);
    };
  }, [appRef, wrapperRef, clickPool, combo1Pool, combo2Pool, combo3Pool, winPool, firstPool, secondPool, finalPool, failurePool]);

  return (
    <main ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#c0e5f6]" data-phase={phase} data-score={score}>
      <img
        src={background}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        draggable="false"
      />
      {offer > 0 && !sipVisible && (
        <>
          <div className={`end-scene-fade absolute inset-0 z-20 ${offerVisible ? "is-visible" : ""}`}>
            <img src={background} alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" draggable="false" />
            <img src={pipeTop} alt="" className="pointer-events-none absolute left-1/2 top-[-10%] h-[120%] w-[calc(257px*var(--ui-scale,1))] max-w-none -translate-x-1/2 select-none offer-backdrop-pipe" draggable="false" />
            <p aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[calc(var(--ui-top,0px)+403px*var(--ui-scale,1))] m-0 w-max -translate-x-1/2 -translate-y-1/2 select-none bg-black whitespace-nowrap text-white offer-backdrop-score">YOUR SCORE: 3</p>
            <div className="offer-wash absolute inset-0" />
          </div>
          <div className={`end-confetti absolute inset-0 z-[21] overflow-hidden ${offerVisible ? "is-visible" : ""}`} aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => <div key={i} style={{ left: `${(i * 37.3) % 100}%`, "--duration": `${7 + i % 5}s`, "--delay": `${-((i * 1.73) % 11)}s`, "--x": `${(i % 2 ? 1 : -1) * (2 + i % 7)}vw`, width: `calc(${11 + i % 8}px * var(--ui-scale,1))`, height: `calc(${24 + i % 16}px * var(--ui-scale,1))` }} />)}
          </div>
          <button type="button" aria-label="Open offer" data-sfx-exclude="" disabled={!offerVisible} className="absolute inset-0 z-30 h-full w-full cursor-pointer border-0 bg-transparent p-0" onClick={event => { event.stopPropagation(); openDestination(); }} />
        </>
      )}
      <div className="pointer-events-none absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-10 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
        <div ref={appRef} className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]" data-mode={phase}>
          {gameVisible && <div className={`gameplay-layer ${phase === "loading" ? "is-preparing" : ""}`}>
            {pipes.map(p => <div className="contents" key={p.id}>
              <img
                src={pipeTop}
                alt=""
                className="pointer-events-none absolute z-10 w-[257px] select-none game-pipe"
                draggable="false"
                ref={node => { if (node) pipeNodes.current.set(`${p.id}-top`, node); else pipeNodes.current.delete(`${p.id}-top`); }}
                style={{ "--pipe-x": `${p.x}px`, top: `${p.y - p.gap / 2 - 1716}px` }}
              />
              <img
                src={pipeBottom}
                alt=""
                className="pointer-events-none absolute z-10 w-[257px] select-none game-pipe"
                draggable="false"
                ref={node => { if (node) pipeNodes.current.set(`${p.id}-bottom`, node); else pipeNodes.current.delete(`${p.id}-bottom`); }}
                style={{ "--pipe-x": `${p.x}px`, top: `${p.y + p.gap / 2}px` }}
              />
              {p.hasProduct && !p.collected && <img
                src={product}
                alt="Collect a Spotminders smart tag"
                className="pointer-events-none absolute z-[15] select-none game-product"
                draggable="false"
                ref={node => { if (node) pipeNodes.current.set(`${p.id}-item`, node); else pipeNodes.current.delete(`${p.id}-item`); }}
                style={{ "--pipe-x": `${p.x}px`, "--bob": `${p.bob}px`, top: `${p.y - p.height / 2}px`, width: `${p.height * 180 / 272}px` }}
              />}
            </div>)}
            {effects.map(effect => <img
              key={effect.id}
              src={sparkles}
              alt=""
              className="pointer-events-none absolute z-[18] w-[453.6px] select-none collection-effect"
              draggable="false"
              style={{ left: `${effect.x}px`, top: `${effect.y}px`, "--effect-angle": `${effect.angle}deg` }}
            />)}
            <img
              src={birdFlying}
              alt="Spotminders bird"
              className="pointer-events-none absolute left-1/2 z-20 w-[236px] select-none game-bird bird-up"
              draggable="false"
              ref={birdRef}
            />
            <img
              src={birdFalling}
              alt=""
              className="pointer-events-none absolute left-1/2 z-20 w-[236px] select-none game-bird bird-down"
              draggable="false"
              aria-hidden="true"
            />
            {phase === "idle" && <>
              <img
                src={hint}
                alt="Tap to fly up"
                className="pointer-events-none absolute left-1/2 top-[760px] z-[35] w-[597px] -translate-x-1/2 -translate-y-1/2 select-none"
                draggable="false"
              />
              <img
                src={hand}
                alt=""
                className="pointer-events-none absolute left-[785px] top-[1370px] z-[35] w-[363px] -translate-x-1/2 -translate-y-1/2 select-none hand-guide"
                draggable="false"
              />
            </>}
            <img
              src={logo}
              alt="Spotminders"
              className="pointer-events-none absolute left-1/2 top-[90px] z-40 w-[482px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <p
              className="pointer-events-none absolute left-1/2 top-[403px] z-40 m-0 w-max -translate-x-1/2 -translate-y-1/2 select-none rounded-[24px] bg-black px-[30px] pt-[10px] pb-[17px] font-[Yellix] text-[98px] leading-none font-semibold whitespace-nowrap text-white"
              role="status"
              aria-live="polite"
            >
              YOUR SCORE: <span>{score}</span>
            </p>
            <Cta />
          </div>}
        </div>
      </div>
      <div className="pointer-events-none absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-40 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
        <div className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]">
          {offer > 0 && !sipVisible && <div className={`offer-layer end-scene-fade ${offerVisible ? "is-visible" : ""}`}>
            <img
              src={logo}
              alt="Spotminders"
              className="pointer-events-none absolute left-1/2 top-[90px] z-40 w-[482px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <img
              src={congratulations}
              alt="Congratulations! You've got"
              className="pointer-events-none absolute left-1/2 top-[342px] z-40 w-[820px] -translate-x-1/2 select-none offer-heading"
              draggable="false"
            />
            {offer === 1 && <div key="offer-1" className={`offer-items end-scene-fade ${offerItemsVisible ? "is-visible" : ""}`}>
              <img
                src={offerBuy3}
                alt="Buy 3 Get 2 Free"
                className="pointer-events-none absolute left-[207.5px] top-[657px] z-40 w-[665px] select-none offer-title"
                draggable="false"
              />
              <img
                src={tagRight}
                alt="Spotminders smart tag"
                className="pointer-events-none absolute left-[54px] top-[824px] z-40 w-[214px] select-none offer-left"
                draggable="false"
              />
              <img
                src={tagLeft}
                alt="Spotminders smart tag"
                className="pointer-events-none absolute left-[828px] top-[824px] z-40 w-[214px] select-none offer-right"
                draggable="false"
              />
              <img
                src={freeShipping}
                alt="Free shipping"
                className="pointer-events-none absolute left-[117px] top-[1325px] z-40 w-[415px] select-none offer-badge"
                draggable="false"
              />
              <img
                src={mysteryGift}
                alt="Free mystery gift"
                className="pointer-events-none absolute left-[548px] top-[1325px] z-40 w-[415px] select-none offer-badge"
                draggable="false"
              />
              <img
                src={freeTwoTags}
                alt="Free 2x smart tags"
                className="pointer-events-none absolute left-[117px] top-[1437px] z-40 w-[415px] select-none offer-badge"
                draggable="false"
              />
              <img
                src={charger}
                alt="Free USB-C charger"
                className="pointer-events-none absolute left-[548px] top-[1437px] z-40 w-[415px] select-none offer-badge"
                draggable="false"
              />
            </div>}
            {offer === 2 && <div key="offer-2" className={`offer-items end-scene-fade ${offerItemsVisible ? "is-visible" : ""}`}>
              <img
                src={offerBuy2}
                alt="Buy 2 Get +1 Free"
                className="pointer-events-none absolute left-[39.5px] top-[655px] z-40 w-[1001px] select-none offer-title"
                draggable="false"
              />
              <img
                src={freeOneTag}
                alt="Free 1x smart tags"
                className="pointer-events-none absolute left-[90px] top-[1100px] z-40 w-[435px] select-none offer-badge"
                draggable="false"
              />
              <img
                src={freeShippingWide}
                alt="Free shipping"
                className="pointer-events-none absolute left-[555px] top-[1100px] z-40 w-[435px] select-none offer-badge"
                draggable="false"
              />
              <img
                src={tagFront1}
                alt="Spotminders smart tag"
                className="pointer-events-none absolute left-[147px] top-[1219px] z-40 w-[263px] select-none offer-left"
                draggable="false"
              />
              <img
                src={tagFront2}
                alt="Spotminders smart tag"
                className="pointer-events-none absolute left-[408.5px] top-[1219px] z-40 w-[263px] select-none offer-product"
                draggable="false"
              />
              <img
                src={tagFront3}
                alt="Spotminders smart tag"
                className="pointer-events-none absolute left-[670px] top-[1219px] z-40 w-[263px] select-none offer-right"
                draggable="false"
              />
            </div>}
            <Cta />
          </div>}
        </div>
      </div>
      {phase === "sip" && <EndScene onReady={onSipReady} />}
    </main>
  );
}
