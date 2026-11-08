import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { bindSoundGestures, handleUnlockGesture, playSound, retrySound, stopSound, waitForSoundCompletion } from "./hooks/useSound";
import scratchingSound from "./assets/sounds/scratching.mp3?inline";
import gameWinSound from "./assets/sounds/gamewin5.mp3?inline";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import endSceneSound from "./assets/sounds/endscene3.wav?inline";
import logo from "./assets/img/logo.webp";
import scratch from "./assets/img/scratch.webp";
import reveal from "./assets/img/reveal.webp";
import headline from "./assets/img/headline.webp";
import holidayCard from "./assets/img/holiday-card.webp";
import instruction from "./assets/img/instruction.webp";
import subBackground from "./assets/img/holiday-background.webp";
import hand from "./assets/img/hand.webp";
import snowflakeLeft from "./assets/img/snowflake-left.webp";
import snowflakeRight from "./assets/img/snowflake-right.webp";

const CELL_WIDTH = 570;
const CELL_HEIGHT = 424;
const SCRATCH_WIDTH = 570;
const SCRATCH_HEIGHT = 424;
const MASK_WIDTH = 82;
const MASK_HEIGHT = 108;
const BRUSH_WIDTH = 110;
const REVEAL_THRESHOLD = 0.75;
const REVEAL_FADE_MS = 500;
const SECTIONS = [
  { x: 0, y: 0, scratch, reveal },
];
const sectionAt = (x, y) => ((x - 285) / 270) ** 2 + ((y - 212) / 197) ** 2 <= 1 ? 0 : -1;

// Bounded preparation stays local to gameplay; abort removes all pending work.
function prepareImage(image, signal) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", finish);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const decode = () => {
      try { Promise.resolve(image.decode?.()).then(finish, finish); }
      catch { finish(); }
    };
    const timer = setTimeout(finish, 1800);
    image.addEventListener("load", decode, { once: true });
    image.addEventListener("error", finish, { once: true });
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
    else if (image.complete) decode();
  });
}

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  useEffect(() => bindSoundGestures(wrapperRef.current), [wrapperRef]);
  const scratchAudio = useSound(scratchingSound, { backend: "media" });
  const gameWinAudio = useSound(gameWinSound, { backend: "media", overflow: "drop-new" });
  const endSceneAudio = useSound(endSceneSound, { backend: "media", overflow: "drop-new" });
  const endSceneSourceRef = useRef(null);
  const endScenePlayedRef = useRef(false);
  const scratchSourceRef = useRef(null);
  const gameWinSourceRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const guideTimerRef = useRef(null);
  const rewardTimerRef = useRef(null);
  const handRef = useRef(null);
  const hostVisibleRef = useRef(true);
  const scratchSurfaceRef = useRef(null);
  const settledScratchRef = useRef([]);
  const liveScratchRef = useRef([]);
  const scratchFrameRef = useRef(null);
  const scratchRef = useRef(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [entrancesRunning, setEntrancesRunning] = useState(false);
  const [scene, setScene] = useState("initial");
  const [viewable, setViewable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const preparation = new AbortController();
    const coatings = SECTIONS.map((section) => {
      const image = new Image();
      image.src = section.scratch;
      return image;
    });
    const rewards = SECTIONS.map((section) => {
      const image = new Image();
      image.src = section.reveal;
      return image;
    });
    // Decode the matching layers before accepting scratch input.
    Promise.allSettled([...coatings, ...rewards].map(image => prepareImage(image, preparation.signal)).concat([
      holidayCard, instruction, subBackground, logo, headline, hand, snowflakeLeft, snowflakeRight,
    ].map((src) => {
      const asset = new Image();
      asset.src = src;
      return prepareImage(asset, preparation.signal);
    }))).then(() => {
      if (cancelled) return;
      const eligible = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
      const sections = SECTIONS.map(() => ({
        total: 0, erased: 0, complete: false, settledPath: "", livePath: "", nextPath: "",
      }));
      for (let i = 0; i < eligible.length; i += 1) {
        const section = sectionAt((i % MASK_WIDTH + 0.5) * SCRATCH_WIDTH / MASK_WIDTH,
          (Math.floor(i / MASK_WIDTH) + 0.5) * SCRATCH_HEIGHT / MASK_HEIGHT);
        if (section !== -1) {
          eligible[i] = section + 1;
          sections[section].total += 1;
        }
      }
      scratchRef.current = {
        eligible, sections, activeSection: null, covered: new Uint8Array(eligible.length), 
        pointerId: null, previous: null, bounds: null,
      };
      setReady(true);
    }).catch(() => {
      // Keep the opaque coating visible if an asset cannot be decoded.
    });

    return () => {
      cancelled = true;
      preparation.abort();
      if (scratchFrameRef.current !== null) cancelAnimationFrame(scratchFrameRef.current);
      scratchFrameRef.current = null;
      scratchRef.current = null;
    };
  }, []);


  const hideGuide = useCallback(() => {
    clearTimeout(guideTimerRef.current);
    guideTimerRef.current = null;
    handRef.current?.classList.remove("is-guiding");
  }, []);

  const showGuide = useCallback(() => {
    const state = scratchRef.current;
    if (!state || completedRef.current || state.pointerId !== null || document.hidden || !hostVisibleRef.current) return;
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < state.eligible.length; i++) {
      if (!state.eligible[i] || state.covered[i]) continue;
      const x = (i % MASK_WIDTH + .5) * SCRATCH_WIDTH / MASK_WIDTH;
      const y = (Math.floor(i / MASK_WIDTH) + .5) * SCRATCH_HEIGHT / MASK_HEIGHT;
      const distance = (x - 330) ** 2 + (y - 255) ** 2;
      if (distance < bestDistance) { best = i; bestDistance = distance; }
    }
    if (best < 0) return;
    const x = (best % MASK_WIDTH + .5) * SCRATCH_WIDTH / MASK_WIDTH;
    const y = (Math.floor(best / MASK_WIDTH) + .5) * SCRATCH_HEIGHT / MASK_HEIGHT;
    handRef.current.style.setProperty("--guide-x", `${x - 330}px`);
    handRef.current.style.setProperty("--guide-y", `${y - 255}px`);
    handRef.current.classList.add("is-guiding");
  }, []);

  const scheduleGuide = useCallback((delay = 2000) => {
    hideGuide();
    if (!completedRef.current) guideTimerRef.current = setTimeout(showGuide, delay);
  }, [hideGuide, showGuide]);

  useEffect(() => {
    if (!ready) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setEntrancesRunning(true);
        scheduleGuide(1450);
      });
    });
    return () => { cancelAnimationFrame(frame); hideGuide(); };
  }, [ready, scheduleGuide, hideGuide]);

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
    if (!document.hidden && hostVisibleRef.current) endSceneSourceRef.current = playSound(endSceneAudio);
  }, [endSceneAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "revealed") return;
    let cancelled = false;
    let cancelCompletion;
    rewardTimerRef.current = setTimeout(() => {
      rewardTimerRef.current = null;
      if (cancelled) return;
      if (!document.hidden && hostVisibleRef.current) gameWinSourceRef.current = playSound(gameWinAudio);
      cancelCompletion = waitForSoundCompletion(gameWinSourceRef.current, {
        minimumMs: 2000,
        onComplete: () => { if (!cancelled) setScene("end"); },
      });
    }, REVEAL_FADE_MS + 300);
    return () => {
      cancelled = true;
      clearTimeout(rewardTimerRef.current);
      cancelCompletion?.();
      stopSound(gameWinSourceRef.current);
    };
  }, [scene, gameWinAudio]);

  const soundWhileScratching = (gesture) => {
    if (!["pending", "playing"].includes(scratchSourceRef.current?.status)) {
      scratchSourceRef.current = playSound(scratchAudio, { volume: 0.65, loop: true, gesture });
    }
    if (scratchSourceRef.current) scratchSourceRef.current.muted = false;
    retrySound(scratchSourceRef.current, gesture);
    window.clearTimeout(scratchIdleRef.current);
    // Keep one loop across overlapping strokes and edge crossings; idle is silent.
    scratchIdleRef.current = window.setTimeout(muteScratching, 160);
  };

  useEffect(() => {
    const unbind = bindSoundGestures(scratchSurfaceRef.current);
    const stopAll = () => {
      hideGuide();
      stopScratching();
      stopSound(gameWinSourceRef.current);
      stopSound(endSceneSourceRef.current);

      if (scratchRef.current) {
        scratchRef.current.pointerId = null;
        scratchRef.current.previous = null;
      }
    };
    const handleBlur = () => {
      stopAll();
      // A visible embedded ad can lose focus to its surrounding preview.
      // End the gesture and audio, but keep incomplete-game idle guidance alive.
      if (!document.hidden && hostVisibleRef.current) scheduleGuide();
    };
    const handleVisibility = () => {
      setViewable(!document.hidden && hostVisibleRef.current);
      wrapperRef.current?.setAttribute("data-motion-paused", String(document.hidden || !hostVisibleRef.current));
      if (document.hidden || !hostVisibleRef.current) stopAll();
      else scheduleGuide();
    };
    let removeHostListener;
    try {
      if (typeof window.mraid?.isViewable === "function") hostVisibleRef.current = Boolean(window.mraid.isViewable());
      if (typeof window.mraid?.addEventListener === "function") {
        const changed = value => { hostVisibleRef.current = Boolean(value); handleVisibility(); };
        window.mraid.addEventListener("viewableChange", changed);
        removeHostListener = window.mraid.removeEventListener?.bind(window.mraid, "viewableChange", changed);
      }
    } catch { /* Host lifecycle is optional in a browser. */ }
    handleVisibility();
    window.addEventListener("focus", handleVisibility);
    window.addEventListener("pageshow", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", stopAll);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopAll();
      unbind();
      removeHostListener?.();
      window.removeEventListener("focus", handleVisibility);
      window.removeEventListener("pageshow", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", stopAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stopScratching, wrapperRef, hideGuide, scheduleGuide]);

  const checkProgress = () => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const section = state.sections[state.activeSection];
    if (!section || section.complete) return;
    if (section.erased / section.total >= REVEAL_THRESHOLD) {
      completedRef.current = true;
      section.complete = true;
      // Flush only the final live segment. Keep both existing paths in place
      // throughout the fade instead of rebuilding the whole mask at threshold.
      if (scratchFrameRef.current !== null) cancelAnimationFrame(scratchFrameRef.current);
      paintScratch();
      window.clearTimeout(scratchIdleRef.current);
      scratchIdleRef.current = null;
      stopScratching();
      hideGuide();
      const pointerId = state.pointerId;
      state.pointerId = null;
      state.previous = null;
      if (typeof pointerId === "number" && scratchSurfaceRef.current.hasPointerCapture(pointerId)) {
        scratchSurfaceRef.current.releasePointerCapture(pointerId);
      }
      commitScratch();
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
    if (
      column < 0 || column >= MASK_WIDTH || row < 0 || row >= MASK_HEIGHT ||
      state.eligible[row * MASK_WIDTH + column] !== state.activeSection + 1
    ) {
      // Keep a gesture in its original section, even when it crosses a divider.
      state.previous = null;
      return;
    }
    const { previous } = state;
    if (previous && (x - previous.x) ** 2 + (y - previous.y) ** 2 < 4) return;
    const pointX = x.toFixed(2);
    const pointY = y.toFixed(2);
    section.nextPath += previous
      ? `L${pointX} ${pointY}`
      : `M${pointX} ${pointY}l0.01 0`;
    // Count newly covered sample cells along the same round brush segment.
    // This stays in CPU memory: no canvas copies or GPU pixel readbacks while dragging.
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
          ? Math.max(0, Math.min(1, ((sampleX - from.x) * dx + (sampleY - from.y) * dy) / lengthSquared))
          : 0;
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
    // Event-driven rendering only: batch incoming points into one write per paint.
    // The round brush remains constant-width for the entire gesture.
    if (scratchFrameRef.current === null) {
      scratchFrameRef.current = requestAnimationFrame(paintScratch);
    }
  };
  const handlePointerDown = (event) => {
    const state = scratchRef.current;
    if (!ready || !entrancesRunning || document.hidden || !hostVisibleRef.current || !state || completedRef.current || state.pointerId !== null || event.button !== 0) return;
    // Settle the entrance before measuring so an early gesture stays aligned.
    const bounds = event.currentTarget.getBoundingClientRect();
    const section = sectionAt((event.clientX - bounds.left) * SCRATCH_WIDTH / bounds.width,
      (event.clientY - bounds.top) * SCRATCH_HEIGHT / bounds.height);
    if (section === -1 || state.sections[section].complete) return;
    event.preventDefault();
    event.currentTarget.classList.add("is-active");
    // Entrance scale and pointer mapping settle together before the first point.
    const settledBounds = event.currentTarget.getBoundingClientRect();
    commitScratch();
    state.activeSection = section;
    hideGuide();
    state.pointerId = event.pointerId;
    state.previous = null;
    if (event.pointerType !== "touch") event.currentTarget.setPointerCapture(event.pointerId);
    state.bounds = settledBounds;
    setScene("scratching");
    scratchSamples([event], state.bounds);
    if (state.previous) soundWhileScratching(event.nativeEvent || event);
    checkProgress();
  };

  const handlePointerMove = (event) => {
    if (scratchRef.current?.pointerId !== event.pointerId || completedRef.current) return;
    event.preventDefault();
    const samples = event.nativeEvent.getCoalescedEvents?.() || [];
    const state = scratchRef.current;
    state.bounds ||= event.currentTarget.getBoundingClientRect();
    scratchSamples(samples.length ? samples : [event], state.bounds);
    if (scratchRef.current.previous) soundWhileScratching(event.nativeEvent || event);
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
    stopScratching();
    state.pointerId = null;
    state.previous = null;
    if (event.pointerType !== "touch" && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scheduleGuide();
  };


  // Touch events remain tied to the original finger in embedded iOS WebViews.
  // Handle them directly and non-passively; do not depend on pointer capture.
  const handleNativeTouch = useEffectEvent((event) => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const starting = event.type === "touchstart";
    if (starting && state.pointerId !== null) return;
    const touch = starting
      ? event.changedTouches[0]
      : Array.from(event.changedTouches).find((point) => state.pointerId === `touch:${point.identifier}`);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    const input = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerId: `touch:${touch.identifier}`,
      pointerType: "touch",
      button: 0,
      currentTarget: scratchSurfaceRef.current,
      nativeEvent: event,
      type: event.type === "touchend" ? "pointerup" : event.type,
      preventDefault: () => { if (event.cancelable) event.preventDefault(); },
    };
    if (starting) {
      handleUnlockGesture(event);
      handlePointerDown(input);
    } else if (event.type === "touchmove") {
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
    // useScaleUI writes these variables after a viewport change.
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

  const inputLocked = scene === "revealed" || scene === "end";

  return (
    <main className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#1c493b] select-none">
      <div
        ref={wrapperRef}
        className="relative h-dvh w-full overflow-hidden overscroll-none"
        data-scene={scene}
        data-entrances-running={entrancesRunning}
      >
        <img
          src={subBackground}
          alt="Evergreen holiday pattern"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
          draggable="false"
          fetchPriority="high"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[calc(206px*var(--ui-scale,1))] bg-white shadow-[0_calc(8px*var(--ui-scale,1))_calc(22px*var(--ui-scale,1))_#00000015]" />
        <img
          src={logo}
          alt="Xoravelyza"
          className="pointer-events-none absolute left-1/2 top-[calc(-10px*var(--ui-scale,1))] z-50 w-[calc(407px*var(--ui-scale,1))] -translate-x-1/2 select-none holiday-logo-enter"
          draggable="false"
        />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            inert={scene === "end"}
            aria-hidden={scene === "end"}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
          >
            <img
              src={holidayCard}
              alt="Decorative holiday card"
              className="pointer-events-none absolute left-1/2 top-[68px] z-10 w-[869px] -translate-x-1/2 select-none holiday-card-enter"
              draggable="false"
            />
            <img
              src={headline}
              alt="Your Holiday Surprise!"
              className="pointer-events-none absolute left-1/2 top-[416px] z-20 w-[523px] -translate-x-1/2 select-none holiday-headline-enter"
              draggable="false"
            />
            <img
              src={instruction}
              alt="Scratch to Reveal"
              className="pointer-events-none absolute left-1/2 top-[776px] z-20 w-[432px] -translate-x-1/2 select-none holiday-instruction-enter"
              draggable="false"
            />
            <svg
              ref={scratchSurfaceRef}
              viewBox={`0 0 ${SCRATCH_WIDTH} ${SCRATCH_HEIGHT}`}
              width={SCRATCH_WIDTH}
              height={SCRATCH_HEIGHT}
              className={`holiday-scratch-enter ${scene !== "initial" ? "is-active" : ""} absolute left-1/2 top-[902px] z-20 h-[424px] w-[570px] origin-center -translate-x-1/2 overflow-visible touch-none select-none [-webkit-touch-callout:none] ${inputLocked || !ready ? "pointer-events-none" : "cursor-default"}`}
              aria-label={inputLocked ? "Limited Time: 50% Discount" : "Scratch to reveal your holiday surprise"}
              onPointerDown={(event) => { if (event.pointerType !== "touch") handlePointerDown(event); }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              onContextMenu={(event) => event.preventDefault()}
            >
              <defs>
                <clipPath id="holiday-scratch-inset"><ellipse cx="285" cy="212" rx="270" ry="197" /></clipPath>
                <mask id="holiday-scratch-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={CELL_WIDTH} height={CELL_HEIGHT} className="[mask-type:luminance]">
                  <rect width={CELL_WIDTH} height={CELL_HEIGHT} fill="white" />
                  <g clipPath="url(#holiday-scratch-inset)">
                    <path ref={(node) => { settledScratchRef.current[0] = node; }} fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    <path ref={(node) => { liveScratchRef.current[0] = node; }} fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </mask>
                <linearGradient id="holiday-shine"><stop stopColor="white" stopOpacity="0" /><stop offset=".5" stopColor="white" stopOpacity=".22" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
              </defs>
              <image href={reveal} width={CELL_WIDTH} height={CELL_HEIGHT} className={`pointer-events-none holiday-reward ${inputLocked ? "is-revealed" : ""}`} />
              <image href={scratch} width={CELL_WIDTH} height={CELL_HEIGHT} mask="url(#holiday-scratch-mask)" className={`pointer-events-none holiday-coating ${inputLocked ? "is-revealed" : ""}`} />
              <g clipPath="url(#holiday-scratch-inset)" className="pointer-events-none">
                <rect x="-160" width="160" height={CELL_HEIGHT} fill="url(#holiday-shine)" className={inputLocked ? "holiday-reward-shimmer" : "holiday-shimmer"} />
              </g>
              <ellipse cx="285" cy="212" rx="285" ry="212" fill="transparent" />
            </svg>
            <img
              src={snowflakeLeft}
              alt="Left holiday snowflake"
              className="pointer-events-none absolute left-[255.5px] top-[1315.5px] z-20 w-[89px] select-none holiday-snowflake-left"
              draggable="false"
              aria-hidden="true"
            />
            <img
              src={snowflakeRight}
              alt="Right holiday snowflake"
              className="pointer-events-none absolute left-[735.5px] top-[1315.5px] z-20 w-[89px] select-none holiday-snowflake-right"
              draggable="false"
              aria-hidden="true"
            />
            <img
              ref={handRef}
              src={hand}
              alt="Hand scratch guide"
              className="pointer-events-none absolute left-[540px] top-[1070px] z-30 w-[280px] select-none holiday-hand"
              draggable="false"
            />
            <Cta ready={entrancesRunning} />
            <p className="sr-only" role="status">{inputLocked ? "Limited Time: 50% Discount" : ""}</p>
          </div>
        </div>
        {scene === "end" && <EndScene active={viewable} onReady={handleEndSceneReady} />}
      </div>
    </main>
  );
};

export default App;
