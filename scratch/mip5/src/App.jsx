import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import usePromoDate from "./hooks/usePromoDate";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import scratchingSound from "./assets/sounds/scratching.mp3";
import gameWinSound from "./assets/sounds/gamewin5.mp3";
import endSceneSound from "./assets/sounds/endscene3.wav";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import background from "./assets/img/bg.webp";
import logo from "./assets/img/logo.webp";
import scratch from "./assets/img/scratch.webp";
import save80 from "./assets/img/reveal.webp";
import headline from "./assets/img/subtitle1.webp";
import congratulations from "./assets/img/subtitle2.webp";
import youveGot from "./assets/img/subtitle3.webp";
import hand from "./assets/img/hand.webp";
import cta from "./assets/img/cta.webp";

const CELL_WIDTH = 920;
const CELL_HEIGHT = 970;
const SCRATCH_WIDTH = 920;
const SCRATCH_HEIGHT = 970;
const MASK_WIDTH = 184;
const MASK_HEIGHT = 194;
const BRUSH_WIDTH = 200;
const REVEAL_THRESHOLD = 0.7;
const REVEAL_FADE_MS = 500;
const REWARD_HOLD_MS = 2000;
const END_SCENE_ENABLED = true;
const STANDALONE_END_SCENE = END_SCENE_ENABLED && import.meta.env.MODE === "endscene";
const SECTIONS = [
  { id: "save80", label: "SAVE 80% ANNUALLY. WORLD’S #1 VPN", x: 0, y: 0, reveal: save80 },
];
const sectionAt = (x, y) => SECTIONS.findIndex((section) =>
  x >= section.x && x < section.x + CELL_WIDTH &&
  y >= section.y && y < section.y + CELL_HEIGHT,
);

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const promoDate = usePromoDate();
  const scratchAudio = useSound(STANDALONE_END_SCENE ? null : scratchingSound);
  const gameWinAudio = useSound(STANDALONE_END_SCENE ? null : gameWinSound, { lowLatency: true });
  const endSceneAudio = useSound(STANDALONE_END_SCENE ? null : endSceneSound, { lowLatency: true });
  const scratchSourceRef = useRef(null);
  const gameWinSourceRef = useRef(null);
  const endSceneSourceRef = useRef(null);
  const endScenePlayedRef = useRef(false);
  const revealFrameRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const scratchSurfaceRef = useRef(null);
  const settledScratchRef = useRef([]);
  const liveScratchRef = useRef([]);
  const scratchFrameRef = useRef(null);
  const scratchRef = useRef(null);
  const completedRef = useRef(STANDALONE_END_SCENE);
  const [ready, setReady] = useState(false);
  const [entrancesRunning, setEntrancesRunning] = useState(STANDALONE_END_SCENE);
  const [scratchReady, setScratchReady] = useState(STANDALONE_END_SCENE);
  const [resultRunning, setResultRunning] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [scene, setScene] = useState(STANDALONE_END_SCENE ? "end" : "initial");
  const [completedSections, setCompletedSections] = useState(
    STANDALONE_END_SCENE ? SECTIONS.map(() => true) : [],
  );

  useEffect(() => {
    if (STANDALONE_END_SCENE) return;
    let cancelled = false;
    let prepared = false;
    const pendingImages = [];
    const prepare = () => {
      if (cancelled || prepared) return;
      prepared = true;
      window.clearTimeout(fallback);
      // Use the same sampled coverage model as the original scratch mechanic.
      // Match the supplied coating's inset; exclude its border and transparent shadow.
      const eligible = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
      const sections = SECTIONS.map(() => ({
        total: 0, erased: 0, complete: false, settledPath: "", livePath: "", nextPath: "",
      }));
      for (let i = 0; i < eligible.length; i += 1) {
        const x = (i % MASK_WIDTH + 0.5) * SCRATCH_WIDTH / MASK_WIDTH;
        const y = (Math.floor(i / MASK_WIDTH) + 0.5) * SCRATCH_HEIGHT / MASK_HEIGHT;
        const index = sectionAt(x, y);
        if (index === -1) continue;
        const localX = x - SECTIONS[index].x;
        const localY = y - SECTIONS[index].y;
        const dx = localX - Math.max(76, Math.min(844, localX));
        const dy = localY - Math.max(74, Math.min(892, localY));
        if (dx * dx + dy * dy <= 16 * 16) {
          eligible[i] = index + 1;
          sections[index].total += 1;
        }
      }
      scratchRef.current = {
        eligible, sections, activeSection: null, covered: new Uint8Array(eligible.length), animationIndex: 0,
        pointerId: null, previous: null, bounds: null,
      };
      setReady(true);
    };
    const fallback = window.setTimeout(prepare, 1800);
    Promise.allSettled([
      background, logo, scratch, save80, headline,
      congratulations, youveGot, hand, cta,
    ].map((src) => new Promise((resolve) => {
      const image = new Image();
      pendingImages.push(image);
      image.onload = () => {
        if (typeof image.decode !== "function") resolve();
      };
      image.onerror = resolve;
      image.src = src;
      if (typeof image.decode === "function") {
        image.decode().then(resolve, () => {
          if (image.complete) resolve();
          else image.onload = resolve;
        });
      }
      else if (image.complete) resolve();
    }))).then(prepare);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      pendingImages.forEach((image) => { image.onload = image.onerror = null; });
      if (scratchFrameRef.current !== null) cancelAnimationFrame(scratchFrameRef.current);
      scratchFrameRef.current = null;
      scratchRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntrancesRunning(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (!entrancesRunning || STANDALONE_END_SCENE) return;
    // Read CSS timing so hit testing starts only once all coatings have settled.
    // Reduced motion naturally shortens this wait without relying on animation events.
    const duration = Math.max(0, ...Array.from(
      scratchSurfaceRef.current.querySelectorAll("[data-section]"),
      (card) => {
        const style = getComputedStyle(card);
        return (parseFloat(style.animationDuration) + parseFloat(style.animationDelay)) * 1000;
      },
    ));
    const timeout = window.setTimeout(() => setScratchReady(true), duration);
    return () => window.clearTimeout(timeout);
  }, [entrancesRunning]);

  useEffect(() => {
    if (scene !== "winning") return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setResultRunning(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [scene]);

  useEffect(() => {
    if (!END_SCENE_ENABLED || scene !== "winning" || !resultRunning) return;
    const timeout = window.setTimeout(() => setScene("end"), REWARD_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [scene, resultRunning]);

  useEffect(() => {
    if (scene !== "revealed") return;
    const timeout = window.setTimeout(() => setScene("winning"), REVEAL_FADE_MS + 300);
    return () => window.clearTimeout(timeout);
  }, [scene]);

  const muteScratching = useCallback(() => {
    window.clearTimeout(scratchIdleRef.current);
    if (scratchSourceRef.current) scratchSourceRef.current.muted = true;
    scratchIdleRef.current = null;
  }, []);

  const stopScratching = useCallback(() => {
    muteScratching();
    stopSound(scratchSourceRef.current);
    scratchSourceRef.current = null;
  }, [muteScratching]);

  const handleEndSceneReady = useCallback(() => {
    if (endScenePlayedRef.current) return;
    endScenePlayedRef.current = true;
    stopScratching();
    stopSound(gameWinSourceRef.current);
    if (!document.hidden) endSceneSourceRef.current = playSound(endSceneAudio);
  }, [endSceneAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "winning" || !resultRunning) return;
    stopScratching();
    if (!document.hidden && !gameWinSourceRef.current) {
      gameWinSourceRef.current = playSound(gameWinAudio);
    }
    return () => {
      stopSound(gameWinSourceRef.current);
      gameWinSourceRef.current = null;
    };
  }, [scene, resultRunning, gameWinAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "revealed") return;
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = requestAnimationFrame(() => {
        revealFrameRef.current = null;
        stopScratching();
      });
    });
    return () => {
      if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
    };
  }, [scene, stopScratching]);

  const soundWhileScratching = () => {
    if (!scratchSourceRef.current) {
      scratchSourceRef.current = playSound(scratchAudio, { volume: 0.65, loop: true });
    }
    if (scratchSourceRef.current) scratchSourceRef.current.muted = false;
    window.clearTimeout(scratchIdleRef.current);
    scratchIdleRef.current = window.setTimeout(muteScratching, 160);
  };

  useEffect(() => {
    const surface = scratchSurfaceRef.current;
    const unlock = (event) => {
      if (completedRef.current || event.pointerType === "touch") return;
      if (event.type === "pointerdown" || scratchRef.current?.pointerId === event.pointerId) {
        handleUnlockGesture();
      }
    };
    const stopAll = () => {
      if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
      stopScratching();
      stopSound(gameWinSourceRef.current);
      stopSound(endSceneSourceRef.current);
      if (scratchRef.current) {
        scratchRef.current.pointerId = null;
        scratchRef.current.previous = null;
      }
    };
    const handleVisibility = () => { if (document.hidden) stopAll(); };
    surface.addEventListener("pointerdown", unlock);
    surface.addEventListener("pointermove", unlock);
    window.addEventListener("blur", stopAll);
    window.addEventListener("pagehide", stopAll);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopAll();
      surface.removeEventListener("pointerdown", unlock);
      surface.removeEventListener("pointermove", unlock);
      window.removeEventListener("blur", stopAll);
      window.removeEventListener("pagehide", stopAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stopScratching]);

  const checkProgress = () => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const section = state.sections[state.activeSection];
    if (!section || section.complete) return;
    if (section.erased / section.total >= REVEAL_THRESHOLD) {
      completedRef.current = true;
      // Capture this exact card before the first transition; never replace it.
      setSelectedReward(SECTIONS[state.activeSection]);
      section.complete = true;
      if (scratchFrameRef.current !== null) cancelAnimationFrame(scratchFrameRef.current);
      paintScratch();
      window.clearTimeout(scratchIdleRef.current);
      scratchIdleRef.current = null;
      if (scratchSourceRef.current) scratchSourceRef.current.muted = true;
      const pointerId = state.pointerId;
      state.pointerId = null;
      state.previous = null;
      if (typeof pointerId === "number" && scratchSurfaceRef.current.hasPointerCapture(pointerId)) {
        scratchSurfaceRef.current.releasePointerCapture(pointerId);
      }
      setCompletedSections(state.sections.map((item) => item.complete));
      setScene("revealed");
    }
  };

  const eraseAt = (event, bounds) => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const section = state.sections[state.activeSection];
    if (!section || section.complete) return;
    const x = (event.clientX - bounds.left) * SCRATCH_WIDTH / bounds.width;
    const y = (event.clientY - bounds.top) * SCRATCH_HEIGHT / bounds.height;
    const column = Math.floor(x * MASK_WIDTH / SCRATCH_WIDTH);
    const row = Math.floor(y * MASK_HEIGHT / SCRATCH_HEIGHT);
    if (column < 0 || column >= MASK_WIDTH || row < 0 || row >= MASK_HEIGHT ||
      state.eligible[row * MASK_WIDTH + column] !== state.activeSection + 1) {
      state.previous = null;
      return;
    }
    const { previous } = state;
    if (previous && (x - previous.x) ** 2 + (y - previous.y) ** 2 < 4) return;
    const pointX = x.toFixed(2);
    const pointY = y.toFixed(2);
    section.nextPath += previous ? `L${pointX} ${pointY}` : `M${pointX} ${pointY}l0.01 0`;
    // Retain the original CPU coverage sampling and event-driven SVG strokes.
    const from = previous || { x, y };
    const dx = x - from.x;
    const dy = y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const radius = BRUSH_WIDTH / 2;
    const cellWidth = SCRATCH_WIDTH / MASK_WIDTH;
    const cellHeight = SCRATCH_HEIGHT / MASK_HEIGHT;
    const minColumn = Math.max(0, Math.floor((Math.min(from.x, x) - radius) / cellWidth));
    const maxColumn = Math.min(MASK_WIDTH - 1, Math.floor((Math.max(from.x, x) + radius) / cellWidth));
    const minRow = Math.max(0, Math.floor((Math.min(from.y, y) - radius) / cellHeight));
    const maxRow = Math.min(MASK_HEIGHT - 1, Math.floor((Math.max(from.y, y) + radius) / cellHeight));
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const sampleY = (rowIndex + 0.5) * cellHeight;
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
        const index = rowIndex * MASK_WIDTH + columnIndex;
        if (state.eligible[index] !== state.activeSection + 1 || state.covered[index]) continue;
        const sampleX = (columnIndex + 0.5) * cellWidth;
        const along = lengthSquared
          ? Math.max(0, Math.min(1, ((sampleX - from.x) * dx + (sampleY - from.y) * dy) / lengthSquared)) : 0;
        const distanceX = sampleX - (from.x + along * dx);
        const distanceY = sampleY - (from.y + along * dy);
        if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
          state.covered[index] = 1;
          section.erased += 1;
        }
      }
    }
    state.previous = { x, y };
  };

  const paintScratch = () => {
    scratchFrameRef.current = null;
    const state = scratchRef.current;
    if (state && state.activeSection !== null) {
      liveScratchRef.current[state.activeSection].setAttribute("d", state.sections[state.activeSection].livePath);
    }
  };

  const commitScratch = () => {
    if (scratchFrameRef.current !== null) {
      cancelAnimationFrame(scratchFrameRef.current);
      scratchFrameRef.current = null;
    }
    const state = scratchRef.current;
    const section = state?.sections[state.activeSection];
    if (!section?.livePath) return;
    section.settledPath += section.livePath;
    settledScratchRef.current[state.activeSection].setAttribute("d", section.settledPath);
    section.livePath = "";
    liveScratchRef.current[state.activeSection].removeAttribute("d");
  };

  const scratchSamples = (samples, bounds) => {
    const state = scratchRef.current;
    const section = state.sections[state.activeSection];
    section.nextPath = "";
    for (const sample of samples) eraseAt(sample, bounds);
    if (!section.nextPath) return;
    section.livePath += section.nextPath;
    if (scratchFrameRef.current === null) scratchFrameRef.current = requestAnimationFrame(paintScratch);
  };

  const handlePointerDown = (event) => {
    const state = scratchRef.current;
    if (!state || !scratchReady || completedRef.current || state.pointerId !== null || event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const section = sectionAt((event.clientX - bounds.left) * SCRATCH_WIDTH / bounds.width,
      (event.clientY - bounds.top) * SCRATCH_HEIGHT / bounds.height);
    if (section === -1 || state.sections[section].complete) return;
    if (state.activeSection !== null && state.activeSection !== section) return;
    const column = Math.floor((event.clientX - bounds.left) * MASK_WIDTH / bounds.width);
    const row = Math.floor((event.clientY - bounds.top) * MASK_HEIGHT / bounds.height);
    if (state.eligible[row * MASK_WIDTH + column] !== section + 1) return;
    event.preventDefault();
    commitScratch();
    state.activeSection = section;
    state.animationIndex = 1 - state.animationIndex;
    liveScratchRef.current[section].setAttribute("class",
      `beam-scratch-stroke ${state.animationIndex ? "is-stroke-a" : "is-stroke-b"}`);
    state.pointerId = event.pointerId;
    state.previous = null;
    if (event.pointerType !== "touch") event.currentTarget.setPointerCapture(event.pointerId);
    state.bounds = bounds;
    setScene("scratching");
    scratchSamples([event], state.bounds);
    if (state.previous) soundWhileScratching();
    checkProgress();
  };

  const handlePointerMove = (event) => {
    if (scratchRef.current?.pointerId !== event.pointerId || completedRef.current) return;
    event.preventDefault();
    const samples = event.nativeEvent.getCoalescedEvents?.() || [];
    const state = scratchRef.current;
    state.bounds ||= event.currentTarget.getBoundingClientRect();
    scratchSamples(samples.length ? samples : [event], state.bounds);
    if (state.previous) soundWhileScratching();
    else muteScratching();
    checkProgress();
  };

  const handlePointerEnd = (event) => {
    const state = scratchRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.type === "pointerup") {
      state.bounds ||= event.currentTarget.getBoundingClientRect();
      scratchSamples([event], state.bounds);
    }
    checkProgress();
    if (completedRef.current) return;
    commitScratch();
    muteScratching();
    state.pointerId = null;
    state.previous = null;
    if (event.pointerType !== "touch" && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Preserve direct, non-passive touch events for embedded iOS WebViews.
  const handleNativeTouch = useEffectEvent((event) => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const starting = event.type === "touchstart";
    if (starting && state.pointerId !== null) return;
    const touch = starting ? event.changedTouches[0]
      : Array.from(event.changedTouches).find((point) => state.pointerId === `touch:${point.identifier}`);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    const input = {
      clientX: touch.clientX, clientY: touch.clientY,
      pointerId: `touch:${touch.identifier}`, pointerType: "touch", button: 0,
      currentTarget: scratchSurfaceRef.current, nativeEvent: event,
      type: event.type === "touchend" ? "pointerup" : event.type,
      preventDefault: () => { if (event.cancelable) event.preventDefault(); },
    };
    if (starting) {
      handleUnlockGesture();
      handlePointerDown(input);
    } else if (event.type === "touchmove") {
      const now = performance.now();
      if (scratchSourceRef.current?.paused && now - (state.audioRetryAt || 0) > 250) {
        state.audioRetryAt = now;
        handleUnlockGesture();
      }
      handlePointerMove(input);
    } else {
      handlePointerEnd(input);
    }
  });

  useEffect(() => {
    const surface = scratchSurfaceRef.current;
    const wrapper = wrapperRef.current;
    const options = { passive: false };
    const onTouch = (event) => handleNativeTouch(event);
    const invalidateBounds = () => {
      if (scratchRef.current) {
        scratchRef.current.bounds = null;
        scratchRef.current.previous = null;
      }
    };
    surface.addEventListener("touchstart", onTouch, options);
    window.addEventListener("touchmove", onTouch, options);
    window.addEventListener("touchend", onTouch, options);
    window.addEventListener("touchcancel", onTouch, options);
    const observer = new MutationObserver(invalidateBounds);
    observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
    return () => {
      surface.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouch);
      window.removeEventListener("touchcancel", onTouch);
      observer.disconnect();
    };
  }, [wrapperRef]);

  const inputLocked = ["revealed", "winning", "end"].includes(scene);
  const showingResult = scene === "winning" || scene === "end";

  return (
    <main className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#1c3949] select-none">
      <div
        ref={wrapperRef}
        className={`relative h-dvh w-full overflow-hidden overscroll-none ev-creative ${entrancesRunning ? "ev-running" : ""} ${scratchReady ? "ev-scratch-ready" : ""} ${showingResult || scene === "end" ? "ev-result" : ""} ${resultRunning ? "ev-result-running" : ""}`}
        data-scene={scene}
        data-selected-reward={selectedReward?.id || ""}
        data-ready={scratchReady}
      >
        <img
          src={background}
          alt=""
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
          draggable="false"
        />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-10 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            inert={scene === "end"}
            aria-hidden={scene === "end"}
            className={`absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible ${scene === "end" ? "ev-completed-canvas" : ""} ${STANDALONE_END_SCENE ? "standalone-end-background" : ""}`}
          >
            <img
              src={logo}
              alt="ExpressVPN"
              className={`pointer-events-none absolute left-1/2 top-[94px] z-30 w-[434px] -translate-x-1/2 select-none ev-logo-enter ${scene === "end" ? "invisible" : ""}`}
              draggable="false"
            />
            <img
              src={headline}
              alt="Scratch to reveal your deal"
              className={`pointer-events-none absolute left-1/2 top-[309px] z-10 w-[830px] -translate-x-1/2 select-none ev-headline-enter ${showingResult ? "invisible" : ""}`}
              draggable="false"
            />
            {SECTIONS.map((section, index) => (
              <img
                key={section.id}
                src={section.reveal}
                alt={section.label}
                className={`pointer-events-none absolute left-1/2 top-[680px] z-10 w-[920px] -translate-x-1/2 select-none ev-grid-reward ${showingResult ? "ev-offer-celebrate" : ""}`}
                draggable="false"
                aria-hidden={!completedSections[index]}
                data-reward-card={section.id}
              />
            ))}
            {/* Live date sits below the coating; its motion pivots around the card's center. */}
            <p
              className={`pointer-events-none absolute left-1/2 top-[1290px] z-10 w-[750px] -translate-x-1/2 origin-[50%_-125px] select-none font-[Jost] text-[72px] font-normal leading-[1.1] tracking-[0px] text-center text-black ev-grid-reward ev-reveal-date ${showingResult ? "ev-offer-celebrate" : ""}`}
              aria-hidden={!completedSections[0]}
            >
              OFFER ENDS ON<br />{promoDate}
            </p>
            <svg
              ref={scratchSurfaceRef}
              viewBox={`0 0 ${SCRATCH_WIDTH} ${SCRATCH_HEIGHT}`}
              width={SCRATCH_WIDTH}
              height={SCRATCH_HEIGHT}
              className={`absolute left-[80px] top-[680px] z-20 h-[970px] w-[920px] touch-none select-none [-webkit-touch-callout:none] ${showingResult ? "invisible" : ""} ${inputLocked || !scratchReady ? "pointer-events-none" : "cursor-crosshair"}`}
              aria-label={selectedReward ? selectedReward.label : "Scratch to reveal your deal"}
              onPointerDown={(event) => {
                if (event.pointerType !== "touch") handlePointerDown(event);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              onContextMenu={(event) => event.preventDefault()}
            >
              <defs>
                {SECTIONS.map((section, index) => (
                  <clipPath key={section.id} id={`ev-inset-${index}`}>
                    <rect x={section.x + 60} y={section.y + 58} width="800" height="850" rx="16" />
                  </clipPath>
                ))}
                {SECTIONS.map((section, index) => (
                  <mask key={section.id} id={`ev-scratch-${index}`} maskUnits="userSpaceOnUse"
                    x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT}
                    className="[mask-type:luminance]">
                    <rect x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT} fill="white" />
                    <g clipPath={`url(#ev-inset-${index})`}>
                      <path ref={(node) => { settledScratchRef.current[index] = node; }} fill="none"
                        stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                      <path ref={(node) => { liveScratchRef.current[index] = node; }}
                        style={{ "--scratch-brush-width": BRUSH_WIDTH }} className="beam-scratch-stroke"
                        fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                    <rect x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT} fill="black"
                      className={`ev-section-clear ${completedSections[index] ? "is-complete" : ""}`} />
                  </mask>
                ))}
              </defs>
              {SECTIONS.map((section, index) => (
                <image key={section.id} href={scratch} x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT}
                  className={`pointer-events-none ${scratchReady ? "" : "ev-card-enter"}`} mask={`url(#ev-scratch-${index})`}
                  data-section={index} data-complete={!!completedSections[index]} />
              ))}
              <rect width={SCRATCH_WIDTH} height={SCRATCH_HEIGHT} fill="transparent" />
            </svg>
            {scene === "initial" && (
              <img
                src={hand}
                alt="Hand scratch guide"
                className="pointer-events-none absolute left-[530px] top-[1250px] z-30 w-[200px] select-none ev-single-hand-guide"
                draggable="false"
              />
            )}
            {showingResult && (
              <>
                <img
                  src={congratulations}
                  alt="Congratulations!"
                  className="pointer-events-none absolute left-1/2 top-[319px] z-30 w-[890px] -translate-x-1/2 select-none ev-congratulations-enter"
                  draggable="false"
                />
                <img
                  src={youveGot}
                  alt="You've got..."
                  className="pointer-events-none absolute left-1/2 top-[494px] z-30 w-[536px] -translate-x-1/2 select-none ev-youve-got-enter"
                  draggable="false"
                />
              </>
            )}
            <Cta />
          </div>
        </div>
        {END_SCENE_ENABLED && scene === "end" && <EndScene onReady={handleEndSceneReady} promoDate={promoDate} />}
      </div>
    </main>
  );
};

export default App;
