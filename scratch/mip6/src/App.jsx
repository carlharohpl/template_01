import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import scratchingSound from "./assets/sounds/scratching.mp3";
import tryAgainSound from "./assets/sounds/wrong3.mp3";
import gameWinSound from "./assets/sounds/gamewin5.mp3";
import endSceneSound from "./assets/sounds/endscene3.wav";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/logo.webp";
import ticket from "./assets/img/ticket.webp";
import scratch1 from "./assets/img/scratch1.webp";
import scratch2 from "./assets/img/scratch2.webp";
import scratch3 from "./assets/img/scratch3.webp";
import scratch4 from "./assets/img/scratch4.webp";
import reveal1 from "./assets/img/reveal1.webp";
import reveal2 from "./assets/img/reveal2.webp";
import reveal3 from "./assets/img/reveal3.webp";
import reveal4 from "./assets/img/reveal4.webp";
import tryAgain from "./assets/img/tryagain.webp";
import headline from "./assets/img/subtitle1.webp";
import subtitle from "./assets/img/subtitle2.webp";
import congratulations from "./assets/img/subtitle3.webp";
import exclusiveOffer from "./assets/img/subtitle4.webp";
import product from "./assets/img/product.webp";
import discount from "./assets/img/discount.webp";
import hand from "./assets/img/hand.webp";

const CELL_WIDTH = 336;
const CELL_HEIGHT = 368;
const SCRATCH_WIDTH = 684;
const SCRATCH_HEIGHT = 748;
const MASK_WIDTH = 82;
const MASK_HEIGHT = 108;
const BRUSH_WIDTH = 110;
const REVEAL_THRESHOLD = 0.45;
const REVEAL_FADE_MS = 500;
const REWARD_HOLD_MS = 2000;
const TRY_AGAIN_HOLD_MS = 2000;
const SECTIONS = [
  { x: 0, y: 0, outcome: "try-again", scratch: scratch1, reveal: reveal1 },
  { x: 348, y: 0, outcome: "win", scratch: scratch2, reveal: reveal2 },
  { x: 0, y: 380, outcome: "win", scratch: scratch3, reveal: reveal3 },
  { x: 348, y: 380, outcome: "try-again", scratch: scratch4, reveal: reveal4 },
];
const sectionAt = (x, y) => SECTIONS.findIndex((section) =>
  x >= section.x && x < section.x + CELL_WIDTH &&
  y >= section.y && y < section.y + CELL_HEIGHT,
);

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const scratchAudio = useSound(scratchingSound);
  const tryAgainAudio = useSound(tryAgainSound, { lowLatency: true });
  const gameWinAudio = useSound(gameWinSound, { lowLatency: true });
  const endSceneAudio = useSound(endSceneSound, { lowLatency: true });
  const scratchSourceRef = useRef(null);
  const tryAgainSourceRef = useRef(null);
  const gameWinSourceRef = useRef(null);
  const endSceneSourceRef = useRef(null);
  const endScenePlayedRef = useRef(false);
  const revealFrameRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const scratchSurfaceRef = useRef(null);
  const retryCardRef = useRef(null);
  const settledScratchRef = useRef([]);
  const liveScratchRef = useRef([]);
  const scratchFrameRef = useRef(null);
  const scratchRef = useRef(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [scene, setScene] = useState("initial");
  const [completedSections, setCompletedSections] = useState([]);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    let cancelled = false;
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
    const ticketImage = new Image();
    ticketImage.src = ticket;

    // Decode each tile's matching layers before accepting scratch input.
    Promise.all([...coatings, ...rewards, ticketImage].map((image) => image.decode()).concat([
      product, discount, congratulations, exclusiveOffer, tryAgain,
    ].map((src) => {
      const asset = new Image();
      asset.src = src;
      return asset.decode();
    }))).then(() => {
      if (cancelled) return;
      const mask = document.createElement("canvas");
      mask.width = MASK_WIDTH;
      mask.height = MASK_HEIGHT;
      const maskContext = mask.getContext("2d", { willReadFrequently: true });
      SECTIONS.forEach((section, index) => {
        maskContext.drawImage(coatings[index],
          section.x * MASK_WIDTH / SCRATCH_WIDTH, section.y * MASK_HEIGHT / SCRATCH_HEIGHT,
          CELL_WIDTH * MASK_WIDTH / SCRATCH_WIDTH, CELL_HEIGHT * MASK_HEIGHT / SCRATCH_HEIGHT);
      });
      const pixels = maskContext.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data;
      const eligible = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
      const sections = SECTIONS.map(() => ({
        total: 0, erased: 0, complete: false, settledPath: "", livePath: "", nextPath: "",
      }));
      for (let i = 0; i < eligible.length; i += 1) {
        const section = sectionAt((i % MASK_WIDTH + 0.5) * SCRATCH_WIDTH / MASK_WIDTH,
          (Math.floor(i / MASK_WIDTH) + 0.5) * SCRATCH_HEIGHT / MASK_HEIGHT);
        if (pixels[i * 4 + 3] > 128 && section !== -1) {
          eligible[i] = section + 1;
          sections[section].total += 1;
        }
      }
      scratchRef.current = {
        eligible, sections, activeSection: null, covered: new Uint8Array(eligible.length), animationIndex: 0,
        pointerId: null, previous: null, bounds: null,
        artwork: { coatings, rewards, ticket: ticketImage },
      };
      setReady(true);
    }).catch(() => {
      // Keep the opaque coating visible if an asset cannot be decoded.
    });

    return () => {
      cancelled = true;
      if (scratchFrameRef.current !== null) cancelAnimationFrame(scratchFrameRef.current);
      scratchFrameRef.current = null;
      scratchRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!["try-again", "winning"].includes(scene) || !scratchRef.current || !retryCardRef.current) return;
    // Snapshot the existing layers once. A normal canvas filter avoids scaled
    // backdrop sampling/tiling bugs in embedded WebViews and keeps every mark.
    const state = scratchRef.current;
    const context = retryCardRef.current.getContext("2d");
    context.clearRect(0, 0, 939, 1045);
    context.drawImage(state.artwork.ticket, 48, 48, 843, 949);
    const coating = document.createElement("canvas");
    coating.width = CELL_WIDTH;
    coating.height = CELL_HEIGHT;
    const coatingContext = coating.getContext("2d");
    SECTIONS.forEach((section, index) => {
      const x = 48 + (843 - SCRATCH_WIDTH) / 2 + section.x;
      const y = 48 + 98 + section.y;
      context.drawImage(state.artwork.rewards[index], x, y, CELL_WIDTH, CELL_HEIGHT);
      if (state.sections[index].complete) return;
      coatingContext.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      coatingContext.drawImage(state.artwork.coatings[index], 0, 0, CELL_WIDTH, CELL_HEIGHT);
      coatingContext.save();
      coatingContext.globalCompositeOperation = "destination-out";
      coatingContext.translate(-section.x, -section.y);
      coatingContext.lineWidth = BRUSH_WIDTH;
      coatingContext.lineCap = "round";
      coatingContext.lineJoin = "round";
      coatingContext.stroke(new Path2D(state.sections[index].settledPath + state.sections[index].livePath));
      coatingContext.restore();
      context.drawImage(coating, x, y);
    });
  }, [scene]);

  useEffect(() => {
    if (scene !== "winning") return;
    const timeout = window.setTimeout(() => {
      // Hold the Congratulations presentation for two seconds before handoff.
      setScene("end");
    }, REWARD_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [scene]);

  useEffect(() => {
    if (scene !== "revealed") return;
    const timeout = window.setTimeout(() => {
      setScene(outcome === "win" ? "winning" : "try-again");
    }, REVEAL_FADE_MS + 300);
    return () => window.clearTimeout(timeout);
  }, [scene, outcome]);

  useEffect(() => {
    if (scene !== "try-again") return;
    const timeout = window.setTimeout(() => {
      // Only the completed tile stays disabled; all scratch paths are retained.
      completedRef.current = false;
      setOutcome(null);
      setScene("scratching");
    }, TRY_AGAIN_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [scene]);


  const stopScratching = useCallback(() => {
    window.clearTimeout(scratchIdleRef.current);
    stopSound(scratchSourceRef.current);
    scratchSourceRef.current = null;
    scratchIdleRef.current = null;
  }, []);

  const handleEndSceneReady = useCallback(() => {
    if (endScenePlayedRef.current) return;
    endScenePlayedRef.current = true;
    stopScratching();
    stopSound(tryAgainSourceRef.current);
    stopSound(gameWinSourceRef.current);
    if (!document.hidden) endSceneSourceRef.current = playSound(endSceneAudio);
  }, [endSceneAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "try-again") return;
    stopScratching();
    if (!document.hidden && !tryAgainSourceRef.current) {
      tryAgainSourceRef.current = playSound(tryAgainAudio);
    }
    return () => {
      stopSound(tryAgainSourceRef.current);
      tryAgainSourceRef.current = null;
    };
  }, [scene, tryAgainAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "winning") return;
    stopScratching();
    stopSound(tryAgainSourceRef.current);
    if (!document.hidden && !gameWinSourceRef.current) {
      gameWinSourceRef.current = playSound(gameWinAudio);
    }
    return () => {
      stopSound(gameWinSourceRef.current);
      gameWinSourceRef.current = null;
    };
  }, [scene, gameWinAudio, stopScratching]);

  useEffect(() => {
    if (scene !== "revealed") return;
    // Preserve the scratch sound's stop timing after the reveal has painted.
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
    scratchIdleRef.current = window.setTimeout(() => {
      // Keep the same decoder alive during a held gesture; idle is silent.
      if (scratchSourceRef.current) scratchSourceRef.current.muted = true;
      scratchIdleRef.current = null;
    }, 160);
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
      stopSound(tryAgainSourceRef.current);
      stopSound(gameWinSourceRef.current);
      stopSound(endSceneSourceRef.current);
      if (scratchRef.current) {
        scratchRef.current.pointerId = null;
        scratchRef.current.previous = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) stopAll();
    };
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
      section.complete = true;
      // Flush only the final live segment. Keep both existing paths in place
      // throughout the fade instead of rebuilding the whole mask at threshold.
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
      setOutcome(SECTIONS[state.activeSection].outcome);
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
    // The CSS stroke animation is started once on pointer/touch down.
    if (scratchFrameRef.current === null) {
      scratchFrameRef.current = requestAnimationFrame(paintScratch);
    }
  };
  const handlePointerDown = (event) => {
    const state = scratchRef.current;
    if (!state || completedRef.current || state.pointerId !== null || event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const section = sectionAt((event.clientX - bounds.left) * SCRATCH_WIDTH / bounds.width,
      (event.clientY - bounds.top) * SCRATCH_HEIGHT / bounds.height);
    if (section === -1 || state.sections[section].complete) return;
    event.preventDefault();
    commitScratch();
    state.activeSection = section;
    state.animationIndex = 1 - state.animationIndex;
    liveScratchRef.current[section].setAttribute(
      "class",
      `beam-scratch-stroke ${state.animationIndex ? "is-stroke-a" : "is-stroke-b"}`,
    );
    state.pointerId = event.pointerId;
    state.previous = null;
    if (event.pointerType !== "touch") event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("is-active");
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
    if (scratchRef.current.previous) soundWhileScratching();
    else stopScratching();
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
      handleUnlockGesture();
      handlePointerDown(input);
    } else if (event.type === "touchmove") {
      // Retry blocked audio occasionally, not on every high-frequency touch sample.
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

  const winning = scene === "winning" || scene === "end";
  const retrying = scene === "try-again";
  const inputLocked = scene === "revealed" || retrying || winning;

  return (
    <main className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#d2e8dd] select-none">
      <div
        ref={wrapperRef}
        className="relative h-dvh w-full overflow-hidden overscroll-none"
        data-scene={scene}
      >
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            inert={scene === "end"}
            aria-hidden={scene === "end"}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible font-sans text-[#780c2e]"
          >
            <img
              src={logo}
              alt="Musely"
              className="musely-logo-enter pointer-events-none absolute left-1/2 top-[74px] z-40 w-[286px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <img
              src={headline}
              alt="Try your luck"
              className={`${winning ? "opacity-60 blur-[12px] [-webkit-filter:blur(12px)]" : "musely-headline-enter"} pointer-events-none absolute left-1/2 top-[259px] z-10 w-[556px] -translate-x-1/2 select-none`}
              draggable="false"
              aria-hidden={winning}
            />
            <img
              src={subtitle}
              alt="Scratch below to see what you win"
              className={`${winning ? "opacity-60 blur-[12px] [-webkit-filter:blur(12px)]" : "musely-subtitle-enter"} pointer-events-none absolute left-1/2 top-[373px] z-10 w-[757px] -translate-x-1/2 select-none`}
              draggable="false"
              aria-hidden={winning}
            />
            <img
              src={ticket}
              alt="Burgundy postage stamp"
              className={`musely-ticket-enter musely-card-state ${retrying || winning ? "is-hidden" : ""} pointer-events-none absolute left-1/2 top-[530px] z-0 w-[842px] -translate-x-1/2 select-none`}
              draggable="false"
            />
            <svg
              ref={scratchSurfaceRef}
              viewBox={`0 0 ${SCRATCH_WIDTH} ${SCRATCH_HEIGHT}`}
              width={SCRATCH_WIDTH}
              height={SCRATCH_HEIGHT}
              className={`musely-card-state ${scene === "initial" ? "musely-grid-enter" : ""} ${winning || retrying ? "is-hidden" : ""} absolute left-1/2 top-[630px] z-20 h-[748px] w-[684px] -translate-x-1/2 touch-none select-none [-webkit-touch-callout:none] ${inputLocked || !ready ? "pointer-events-none" : "cursor-crosshair"}`}
              aria-label="Scratch a section to reveal Try Again or SAVE 20%"
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
                  <mask key={index} id={`musely-scratch-${index}`} maskUnits="userSpaceOnUse"
                    x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT}
                    className="[mask-type:luminance]">
                    <rect x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT} fill="white" />
                    <path ref={(node) => { settledScratchRef.current[index] = node; }} fill="none"
                      stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    <path ref={(node) => { liveScratchRef.current[index] = node; }}
                      style={{ "--scratch-brush-width": BRUSH_WIDTH }} className="beam-scratch-stroke"
                      fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    <rect x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT} fill="black"
                      className={`musely-section-clear ${completedSections[index] ? "is-complete" : ""}`} />
                  </mask>
                ))}
              </defs>
              <g className="pointer-events-none">
                {SECTIONS.map((section, index) => (
                  <g key={index} data-section={index} data-complete={!!completedSections[index]}>
                    <image href={section.reveal} x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT} />
                    <image href={section.scratch} x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT}
                      mask={`url(#musely-scratch-${index})`} />
                  </g>
                ))}
              </g>
              <rect width={SCRATCH_WIDTH} height={SCRATCH_HEIGHT} fill="transparent" />
            </svg>
            {scene === "initial" && (
              <img
                src={hand}
                alt="Hand scratch guide"
                className="scratch-hand musely-hand-enter pointer-events-none absolute left-[474px] top-[859px] z-30 w-[160px] select-none"
                draggable="false"
              />
            )}
            <canvas
              ref={retryCardRef}
              width="939"
              height="1045"
              className={`musely-retry-card-state pointer-events-none absolute left-1/2 top-[482px] z-[25] h-[1045px] w-[939px] -translate-x-1/2 select-none blur-[12px] [-webkit-filter:blur(12px)] ${retrying || winning ? "opacity-30" : "opacity-0"}`}
              aria-hidden="true"
            />
            {retrying && (
              <img
                src={tryAgain}
                alt="Try Again!"
                className="musely-retry-enter pointer-events-none absolute left-1/2 top-[886px] z-30 w-[300px] -translate-x-1/2 select-none"
                draggable="false"
              />
            )}
            {winning && (
              <>
                {/* The final result sits over the retained, blurred gameplay. */}
                <div className="musely-result-enter pointer-events-none absolute inset-0 z-[27] bg-[#d2e8dd]/35" />
                <img
                  src={congratulations}
                  alt="Congratulations!"
                  className="musely-congratulations-enter pointer-events-none absolute left-1/2 top-[259px] z-30 w-[760px] -translate-x-1/2 select-none"
                  draggable="false"
                />
                <img
                  src={exclusiveOffer}
                  alt="New Patient Exclusive Offer"
                  className="musely-offer-enter pointer-events-none absolute left-1/2 top-[399px] z-30 w-[744px] -translate-x-1/2 select-none"
                  draggable="false"
                />
                <img
                  src={ticket}
                  alt="Burgundy winning panel"
                  className="musely-result-enter pointer-events-none absolute left-1/2 top-[530px] z-30 w-[842px] -translate-x-1/2 select-none drop-shadow-[0_8px_14px_rgba(54,87,70,0.22)]"
                  draggable="false"
                />
                <img
                  src={product}
                  alt="Musely FaceRx product"
                  className="musely-product-enter pointer-events-none absolute left-1/2 top-[711px] z-30 w-[443px] -translate-x-1/2 select-none"
                  draggable="false"
                />
                <img
                  src={discount}
                  alt="20% OFF"
                  className="musely-discount-enter pointer-events-none absolute left-[618px] top-[605px] z-30 w-[280px] select-none"
                  draggable="false"
                />
              </>
            )}
            {inputLocked && (
              <div
                className="absolute left-[70px] top-[482px] z-[25] h-[1045px] w-[939px] touch-none"
                aria-hidden="true"
              />
            )}
            <Cta />
            <p className="sr-only" role="status">
              {retrying ? "Try Again! Scratch another section." : winning ? "Congratulations! New Patient Exclusive Offer. Save 20%." : ""}
            </p>
          </div>
        </div>
        {winning && (
          <div
            className="musely-result-enter pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_5px_rgba(54,87,70,0.22)]"
            aria-hidden="true"
          />
        )}
        {scene === "end" && <EndScene onReady={handleEndSceneReady} />}
      </div>
    </main>
  );
};

export default App;
