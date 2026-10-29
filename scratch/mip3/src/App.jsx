import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound, waitForSoundCompletion } from "./hooks/useSound";
import scratchingSound from "./assets/sounds/scratching.mp3";
import gameWinSound from "./assets/sounds/gamewin5.mp3";
import endSceneSound from "./assets/sounds/endscene1.mp3";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import background from "./assets/img/crumpled-paper.webp";
import logo from "./assets/img/memowrite-logo.webp";
import scratch from "./assets/img/scratch-card-covered.webp";
import reward from "./assets/img/scratch-card-revealed.webp";
import headline from "./assets/img/erase-instruction.webp";
import surprise from "./assets/img/surprise.webp";
import hand from "./assets/img/hand-eraser.webp";
import sun from "./assets/img/sun.webp";
import rainbow from "./assets/img/rainbow-stars.webp";
import cloudsLeft from "./assets/img/clouds-left.webp";
import cloudsRight from "./assets/img/clouds-right.webp";
import heart from "./assets/img/heart-small.webp";
import heartsLeft from "./assets/img/hearts-left.webp";
import heartsRight from "./assets/img/hearts-right.webp";
import disclaimer from "./assets/img/offer-disclaimer.webp";
import cta from "./assets/img/claim-discount.webp";

const CELL_WIDTH = 953;
const CELL_HEIGHT = 1026;
const SCRATCH_WIDTH = CELL_WIDTH;
const SCRATCH_HEIGHT = CELL_HEIGHT;
const MASK_WIDTH = 191;
const MASK_HEIGHT = 206;
const BRUSH_WIDTH = 150;
const REVEAL_THRESHOLD = 0.8;
const REVEAL_FADE_MS = 500;
const REWARD_HOLD_MS = 2000;
const SECTIONS = [
  { id: "discount64", label: "64% OFF", x: 0, y: 0, reveal: reward },
];
const sectionAt = (x, y) => SECTIONS.findIndex((section) =>
  x >= section.x && x < section.x + CELL_WIDTH &&
  y >= section.y && y < section.y + CELL_HEIGHT,
);

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const scratchAudio = useSound(scratchingSound);
  const gameWinAudio = useSound(gameWinSound, { lowLatency: true });
  const endSceneAudio = useSound(endSceneSound, { lowLatency: true });
  const scratchSourceRef = useRef(null);
  const gameWinSourceRef = useRef(null);
  const endSceneSourceRef = useRef(null);
  const endSceneCueStartedRef = useRef(false);
  const revealFrameRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const scratchSurfaceRef = useRef(null);
  const settledScratchRef = useRef([]);
  const liveScratchRef = useRef([]);
  const scratchFrameRef = useRef(null);
  const scratchRef = useRef(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [coatingLoaded, setCoatingLoaded] = useState(false);
  const [entrancesRunning, setEntrancesRunning] = useState(false);
  const [scratchReady, setScratchReady] = useState(false);
  const [resultRunning, setResultRunning] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [scene, setScene] = useState("initial");
  const [completedSections, setCompletedSections] = useState([]);
  const [guiding, setGuiding] = useState(false);
  const handRef = useRef(null);
  const guideIdleRef = useRef(null);
  const lastInteractionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let prepared = false;
    const pendingImages = [];
    let coatingImage;
    const prepare = () => {
      if (cancelled || (prepared && scratchRef.current?.sections[0].total > 0)) return;
      prepared = true;
      window.clearTimeout(fallback);
      // Keep the existing sampled SVG-mask mechanic. The supplied coating is a
      // complete paper composite: count only its dark brush pixels, not paper,
      // transparent edges, border, or bottom doodles. Canvas is read once only.
      const eligible = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
      const sections = SECTIONS.map(() => ({
        total: 0, erased: 0, complete: false, settledPath: "", livePath: "", nextPath: "",
      }));
      if (coatingImage?.naturalWidth) {
        const sample = document.createElement("canvas");
        sample.width = MASK_WIDTH;
        sample.height = MASK_HEIGHT;
        const context = sample.getContext("2d", { willReadFrequently: true });
        context.drawImage(coatingImage, 0, 0, MASK_WIDTH, MASK_HEIGHT);
        const pixels = context.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
        for (let i = 0; i < eligible.length; i += 1) {
          const x = (i % MASK_WIDTH + 0.5) * SCRATCH_WIDTH / MASK_WIDTH;
          const y = (Math.floor(i / MASK_WIDTH) + 0.5) * SCRATCH_HEIGHT / MASK_HEIGHT;
          if (x > 40 && x < 910 && y > 180 && y < 825 &&
              pixels[i * 4 + 3] > 128 && pixels[i * 4] < 140) {
            eligible[i] = 1;
            sections[0].total += 1;
          }
        }
      }
      scratchRef.current = {
        eligible, sections, activeSection: null, covered: new Uint8Array(eligible.length), animationIndex: 0,
        pointerId: null, previous: null, bounds: null,
      };
      setCoatingLoaded(sections[0].total > 0);
      setReady(true);
    };
    const fallback = window.setTimeout(prepare, 1800);
    Promise.allSettled([
      background, logo, scratch, reward, headline, surprise, hand, cta,
      sun, rainbow, cloudsLeft, cloudsRight, heart, heartsLeft, heartsRight, disclaimer,
    ].map((src) => new Promise((resolve) => {
      const image = new Image();
      if (src === scratch) coatingImage = image;
      pendingImages.push(image);
      image.onload = () => {
        if (typeof image.decode !== "function") resolve();
        if (src === scratch && prepared) prepare();
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
    if (!entrancesRunning || !coatingLoaded) return;
    // Read CSS timing so hit testing starts only once all coatings have settled.
    const duration = Math.max(0, ...Array.from(
      scratchSurfaceRef.current.querySelectorAll("[data-section]"),
      (card) => {
        const style = getComputedStyle(card);
        return (parseFloat(style.animationDuration) + parseFloat(style.animationDelay)) * 1000;
      },
    ));
    const timeout = window.setTimeout(() => {
      setScratchReady(true);
    }, duration);
    guideIdleRef.current = window.setTimeout(() => {
      guideIdleRef.current = null;
      if (!completedRef.current && scratchRef.current?.pointerId === null && lastInteractionRef.current === 0) {
        setGuiding(true);
      }
    }, Math.max(duration, 1000));
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(guideIdleRef.current);
    };
  }, [entrancesRunning, coatingLoaded]);

  useEffect(() => {
    if (scene !== "winning") return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setResultRunning(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [scene]);


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
    if (endSceneCueStartedRef.current) return;
    endSceneCueStartedRef.current = true;
    if (!document.hidden) endSceneSourceRef.current = playSound(endSceneAudio);
  }, [endSceneAudio]);

  useEffect(() => {
    if (scene !== "winning" || !resultRunning) return;
    stopScratching();
    if (!document.hidden && !gameWinSourceRef.current) {
      gameWinSourceRef.current = playSound(gameWinAudio);
    }
    const cancel = waitForSoundCompletion(gameWinSourceRef.current, {
      minimumMs: REWARD_HOLD_MS,
      onComplete: () => setScene("end"),
    });
    return () => {
      cancel();
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

  const hideGuide = useCallback(() => {
    window.clearTimeout(guideIdleRef.current);
    guideIdleRef.current = null;
    handRef.current?.removeAttribute("data-scratching");
    setGuiding(false);
  }, []);

  const scheduleGuide = useCallback(() => {
    window.clearTimeout(guideIdleRef.current);
    if (completedRef.current || scratchRef.current?.pointerId !== null) return;
    guideIdleRef.current = window.setTimeout(() => {
      guideIdleRef.current = null;
      const state = scratchRef.current;
      if (!state || completedRef.current || state.pointerId !== null || document.hidden) return;
      const targets = [[680, 250], [300, 350], [720, 480], [280, 620], [650, 730]];
      const remaining = targets.map(() => ({ distance: Infinity, x: 0, y: 0 }));
      for (let i = 0; i < state.eligible.length; i += 1) {
        if (!state.eligible[i] || state.covered[i]) continue;
        const x = (i % MASK_WIDTH + .5) * SCRATCH_WIDTH / MASK_WIDTH;
        const y = (Math.floor(i / MASK_WIDTH) + .5) * SCRATCH_HEIGHT / MASK_HEIGHT;
        targets.forEach(([targetX, targetY], index) => {
          const distance = (x - targetX) ** 2 + (y - targetY) ** 2;
          if (distance < remaining[index].distance) remaining[index] = { distance, x, y };
        });
      }
      const handImage = handRef.current;
      if (handImage) {
        const bounds = scratchSurfaceRef.current.getBoundingClientRect();
        const canvasBounds = appRef.current.getBoundingClientRect();
        const scale = bounds.width / SCRATCH_WIDTH;
        // Resolve the idle sweep from the existing coverage grid once per pause.
        // CSS owns the motion; these points never change the scratch mask.
        remaining.forEach(({ distance, x, y }, index) => {
          if (!Number.isFinite(distance)) return;
          handImage.style.setProperty(`--guide-${index + 1}-x`,
            `${(bounds.left - canvasBounds.left) / scale + x - handImage.offsetLeft - 32}px`);
          handImage.style.setProperty(`--guide-${index + 1}-y`,
            `${(bounds.top - canvasBounds.top) / scale + y - handImage.offsetTop - 74}px`);
        });
      }
      setGuiding(true);
    }, Math.max(0, 2000 - (performance.now() - lastInteractionRef.current)));
  }, [appRef]);

  useEffect(() => () => window.clearTimeout(guideIdleRef.current), []);

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
        handleUnlockGesture(event);
      }
    };
    const stopAll = (event) => {
      if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
      stopScratching();
      // Clicking outside the creative can blur the host without starting a
      // scratch. Keep the idle demonstration in that case.
      if (event?.type !== "blur" || scratchRef.current?.pointerId !== null) hideGuide();
      stopSound(gameWinSourceRef.current);
      stopSound(endSceneSourceRef.current);
      if (scratchRef.current) {
        scratchRef.current.pointerId = null;
        scratchRef.current.previous = null;
        scratchRef.current.bounds = null;
      }
    };
    const resumeGuide = () => scheduleGuide();
    const handleVisibility = () => { if (document.hidden) stopAll(); else resumeGuide(); };
    surface.addEventListener("pointerdown", unlock);
    surface.addEventListener("pointermove", unlock);
    window.addEventListener("blur", stopAll);
    window.addEventListener("focus", resumeGuide);
    window.addEventListener("pagehide", stopAll);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopAll();
      surface.removeEventListener("pointerdown", unlock);
      surface.removeEventListener("pointermove", unlock);
      window.removeEventListener("blur", stopAll);
      window.removeEventListener("focus", resumeGuide);
      window.removeEventListener("pagehide", stopAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stopScratching, hideGuide, scheduleGuide]);

  const checkProgress = () => {
    const state = scratchRef.current;
    if (!state || completedRef.current) return;
    const section = state.sections[state.activeSection];
    if (!section || section.complete) return;
    if (section.erased / section.total >= REVEAL_THRESHOLD) {
      completedRef.current = true;
      hideGuide();
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
      x < 40 || x > 910 || y < 180 || y > 825) {
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
    lastInteractionRef.current = performance.now();
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
    if (!state) return;
    const section = state.sections[state.activeSection];
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
    const handImage = handRef.current;
    if (handImage && state.previous) {
      // Use the same design-space point as the mask. Anchor the pink eraser's
      // contact face (32, 74 in the displayed image) to the real pointer.
      const canvasBounds = appRef.current.getBoundingClientRect();
      const scale = bounds.width / SCRATCH_WIDTH;
      handImage.style.setProperty("--scratch-hand-x",
        `${(bounds.left - canvasBounds.left) / scale + state.previous.x - handImage.offsetLeft - 32}px`);
      handImage.style.setProperty("--scratch-hand-y",
        `${(bounds.top - canvasBounds.top) / scale + state.previous.y - handImage.offsetTop - 74}px`);
      handImage.setAttribute("data-scratching", "true");
    } else {
      handImage?.removeAttribute("data-scratching");
    }
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
    hideGuide();
    lastInteractionRef.current = performance.now();
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
    state.bounds = event.currentTarget.getBoundingClientRect();
    scratchSamples(samples.length ? samples : [event], state.bounds);
    if (state.previous) soundWhileScratching();
    else muteScratching();
    checkProgress();
  };

  const handlePointerEnd = (event) => {
    const state = scratchRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.type === "pointerup") {
      state.bounds = event.currentTarget.getBoundingClientRect();
      scratchSamples([event], state.bounds);
    }
    checkProgress();
    handRef.current?.removeAttribute("data-scratching");
    if (completedRef.current) return;
    commitScratch();
    muteScratching();
    state.pointerId = null;
    state.previous = null;
    scheduleGuide();
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
      handleUnlockGesture(event);
      handlePointerDown(input);
    } else if (event.type === "touchmove") {
      const now = performance.now();
      if (scratchSourceRef.current?.paused && now - (state.audioRetryAt || 0) > 250) {
        state.audioRetryAt = now;
        handleUnlockGesture(event);
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
      handRef.current?.removeAttribute("data-scratching");
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

  const inputLocked = completedSections[0];

  return (
    <main className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#dedede] select-none">
      <div
        ref={wrapperRef}
        className={"relative h-dvh w-full overflow-hidden overscroll-none memo-creative " + (entrancesRunning ? "memo-running " : "") + (scratchReady ? "memo-scratch-ready " : "") + (resultRunning ? "memo-result-running" : "")}
        data-scene={scene}
        data-selected-reward={selectedReward?.id || ""}
        data-ready={scratchReady}
      >
        <img
          src={background}
          alt="Crumpled paper background"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
          draggable="false"
        />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-10 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            inert={scene === "end"}
            aria-hidden={scene === "end"}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
          >
            <img
              src={scratch}
              alt="Torn paper with house, tree, and dashed border"
              className="pointer-events-none absolute left-1/2 top-[491px] z-10 w-[953px] -translate-x-1/2 select-none memo-paper-enter"
              draggable="false"
              aria-hidden="true"
            />
            <img
              src={reward}
              alt="64% OFF"
              className="pointer-events-none absolute left-1/2 top-[491px] z-[15] w-[953px] -translate-x-1/2 select-none [clip-path:inset(180px_43px_201px_40px)] memo-reward"
              draggable="false"
              aria-hidden={!completedSections[0]}
              data-reward-card="discount64"
            />
            {scene === "winning" && (
              <img
                src={reward}
                alt="64% OFF reveal celebration"
                className="pointer-events-none absolute left-1/2 top-[491px] z-[25] w-[953px] -translate-x-1/2 select-none [clip-path:inset(240px_225px_265px_225px)] memo-discount-pop"
                draggable="false"
                aria-hidden="true"
              />
            )}
            <svg
              ref={scratchSurfaceRef}
              viewBox={"0 0 " + SCRATCH_WIDTH + " " + SCRATCH_HEIGHT}
              width={SCRATCH_WIDTH}
              height={SCRATCH_HEIGHT}
              className={"absolute left-1/2 top-[491px] z-20 h-[1026px] w-[953px] -translate-x-1/2 touch-none select-none [-webkit-touch-callout:none] " + (inputLocked || !scratchReady ? "pointer-events-none" : "cursor-default")}
              aria-label="Scratch to reveal 64% OFF"
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
                <clipPath id="memo-inset">
                  <rect x="40" y="180" width="870" height="645" />
                </clipPath>
                <mask id="memo-scratch" maskUnits="userSpaceOnUse"
                  x="0" y="0" width={CELL_WIDTH} height={CELL_HEIGHT}
                  className="[mask-type:luminance]">
                  <rect width={CELL_WIDTH} height={CELL_HEIGHT} fill="white" />
                  <g clipPath="url(#memo-inset)">
                    <path ref={(node) => { settledScratchRef.current[0] = node; }} fill="none"
                      stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    <path ref={(node) => { liveScratchRef.current[0] = node; }}
                      style={{ "--scratch-brush-width": BRUSH_WIDTH }} className="beam-scratch-stroke"
                      fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </mask>
              </defs>
              <image href={scratch} width={CELL_WIDTH} height={CELL_HEIGHT}
                className={"pointer-events-none memo-paper-enter memo-coating " + (completedSections[0] ? "is-complete" : "")}
                clipPath="url(#memo-inset)" mask="url(#memo-scratch)" data-section="0" data-complete={!!completedSections[0]} />
              <rect width={SCRATCH_WIDTH} height={SCRATCH_HEIGHT} fill="transparent" />
            </svg>
            <img
              src={logo}
              alt="Memowrite"
              className="pointer-events-none absolute left-1/2 top-[120px] z-30 w-[462px] -translate-x-1/2 select-none memo-logo-enter"
              draggable="false"
            />
            <img
              src={sun}
              alt="Illustrated sun"
              className="pointer-events-none absolute left-[59px] top-[53px] z-30 w-[174px] select-none memo-sun"
              draggable="false"
            />
            <img
              src={rainbow}
              alt="Rainbow and stars"
              className="pointer-events-none absolute left-[767px] top-[22px] z-30 w-[285px] select-none memo-rainbow"
              draggable="false"
            />
            <img
              src={heart}
              alt="Red heart"
              className="pointer-events-none absolute left-[240px] top-[25px] z-30 w-[60px] select-none memo-heart-top"
              draggable="false"
            />
            <img
              src={cloudsLeft}
              alt="Left clouds"
              className="pointer-events-none absolute left-[60px] top-[280px] z-30 w-[132px] select-none memo-clouds-left"
              draggable="false"
            />
            <img
              src={cloudsRight}
              alt="Right clouds"
              className="pointer-events-none absolute left-[857px] top-[290px] z-30 w-[155px] select-none memo-clouds-right"
              draggable="false"
            />
            <img
              src={headline}
              alt="Erase to reveal your"
              className="pointer-events-none absolute left-1/2 top-[284px] z-30 w-[632px] -translate-x-1/2 select-none memo-instruction-enter"
              draggable="false"
            />
            <img
              src={surprise}
              alt="SURPRISE!"
              className="pointer-events-none absolute left-1/2 top-[380px] z-30 w-[933px] -translate-x-1/2 select-none memo-surprise-enter"
              draggable="false"
            />
            <img
              src={hand}
              alt="Drag the eraser across the coating"
              className={"pointer-events-none absolute left-[716px] top-[639px] z-40 w-[220px] select-none memo-hand " + (guiding && !inputLocked ? "is-guiding" : "")}
              draggable="false"
              ref={handRef}
              aria-hidden="true"
            />
            <img
              src={heartsLeft}
              alt="Left red hearts"
              className="pointer-events-none absolute left-[64px] top-[1565px] z-40 w-[128px] select-none memo-hearts-left"
              draggable="false"
            />
            <img
              src={heartsRight}
              alt="Right red hearts"
              className="pointer-events-none absolute left-[889px] top-[1565px] z-40 w-[128px] select-none memo-hearts-right"
              draggable="false"
            />
            <Cta />
            <img
              src={disclaimer}
              alt="OFFER EXPIRES TONIGHT AT MIDNIGHT"
              className="pointer-events-none absolute left-1/2 top-[1784px] z-30 w-[603px] -translate-x-1/2 select-none memo-disclaimer-enter"
              draggable="false"
            />
          </div>
        </div>
        {scene === "end" && <EndScene onReady={handleEndSceneReady} />}
      </div>
    </main>
  );
};

export default App;
