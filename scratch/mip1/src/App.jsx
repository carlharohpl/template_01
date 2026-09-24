import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import scratchingSound from "./assets/sounds/scratching.mp3";
import gameWinSound from "./assets/sounds/gamewin5.mp3";
import endSceneSound from "./assets/sounds/endscene3.wav";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/logo.webp";
import scratch from "./assets/img/scratch.webp";
import reveal from "./assets/img/reveal.webp";
import headline from "./assets/img/subtitle1.webp";
import product from "./assets/img/product.webp";
import platform from "./assets/img/platform.webp";
import subBackground from "./assets/img/sub_bg.webp";
import hand from "./assets/img/hand.webp";

const CELL_WIDTH = 817;
const CELL_HEIGHT = 474;
const SCRATCH_WIDTH = 817;
const SCRATCH_HEIGHT = 474;
const MASK_WIDTH = 82;
const MASK_HEIGHT = 108;
const BRUSH_WIDTH = 110;
const REVEAL_THRESHOLD = 0.45;
const REVEAL_FADE_MS = 500;
const REWARD_HOLD_MS = 2000;
const SECTIONS = [
  { x: 0, y: 0, scratch, reveal },
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
  const endScenePlayedRef = useRef(false);
  const revealFrameRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const scratchSurfaceRef = useRef(null);
  const settledScratchRef = useRef([]);
  const liveScratchRef = useRef([]);
  const scratchFrameRef = useRef(null);
  const scratchRef = useRef(null);
  const completedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [scene, setScene] = useState("initial");
  const [completedSections, setCompletedSections] = useState([]);

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
    // Decode the matching layers before accepting scratch input.
    Promise.all([...coatings, ...rewards].map((image) => image.decode()).concat([
      product, platform, subBackground, logo, headline, hand,
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
      // Only the rounded white inset is scratchable; the textured frame stays put.
      maskContext.save();
      maskContext.scale(MASK_WIDTH / SCRATCH_WIDTH, MASK_HEIGHT / SCRATCH_HEIGHT);
      maskContext.beginPath();
      maskContext.moveTo(64, 34);
      maskContext.lineTo(753, 34);
      maskContext.quadraticCurveTo(783, 34, 783, 64);
      maskContext.lineTo(783, 410);
      maskContext.quadraticCurveTo(783, 440, 753, 440);
      maskContext.lineTo(64, 440);
      maskContext.quadraticCurveTo(34, 440, 34, 410);
      maskContext.lineTo(34, 64);
      maskContext.quadraticCurveTo(34, 34, 64, 34);
      maskContext.closePath();
      maskContext.restore();
      maskContext.clip();
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

  useEffect(() => {
    if (scene !== "winning") return;
    const timeout = window.setTimeout(() => {
      // Hold the revealed offer in place for the existing two-second handoff.
      setScene("end");
    }, REWARD_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [scene]);

  useEffect(() => {
    if (scene !== "revealed") return;
    const timeout = window.setTimeout(() => {
      setScene("winning");
    }, REVEAL_FADE_MS + 300);
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
    if (scene !== "winning") return;
    stopScratching();
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
    // Keep one loop across overlapping strokes and edge crossings; idle is silent.
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
    // Settle the entrance before measuring so an early gesture stays aligned.
    event.currentTarget.classList.add("is-active");
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

  const inputLocked = ["revealed", "winning", "end"].includes(scene);

  return (
    <main className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#46010B] select-none">
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
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
          >
            <img
              src={subBackground}
              alt="White curved panel on burgundy"
              className="pointer-events-none absolute left-1/2 top-[-748px] z-0 w-[1195px] max-w-none -translate-x-1/2 select-none"
              draggable="false"
              fetchPriority="high"
              decoding="sync"
            />
            <img
              src={logo}
              alt="I·M·8"
              className="im8-logo-enter pointer-events-none absolute left-1/2 top-[87px] z-10 w-[272px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <img
              src={headline}
              alt="Claim Your Exclusive Offer"
              className="im8-headline-enter pointer-events-none absolute left-1/2 top-[266px] z-10 w-[584px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <svg
              ref={scratchSurfaceRef}
              viewBox={`0 0 ${SCRATCH_WIDTH} ${SCRATCH_HEIGHT}`}
              width={SCRATCH_WIDTH}
              height={SCRATCH_HEIGHT}
              className={`${completedSections[0] ? "im8-offer-reveal" : "im8-scratch-enter"} absolute left-1/2 top-[514px] z-20 h-[474px] w-[817px] origin-center -translate-x-1/2 overflow-hidden rounded-[45px] touch-none select-none [-webkit-touch-callout:none] ${inputLocked || !ready ? "pointer-events-none" : "cursor-crosshair"}`}
              aria-label={inputLocked ? "30% Off + Free Reset Kit" : "Scratch Here to reveal your exclusive offer"}
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
                <clipPath id="im8-scratch-inset">
                  <rect x="34" y="34" width="749" height="406" rx="30" />
                </clipPath>
                {SECTIONS.map((section, index) => (
                  <mask key={index} id={`im8-scratch-${index}`} maskUnits="userSpaceOnUse"
                    x={section.x} y={section.y} width={CELL_WIDTH} height={CELL_HEIGHT}
                    className="[mask-type:luminance]">
                    <rect width={CELL_WIDTH} height={CELL_HEIGHT} fill="white" />
                    <g clipPath="url(#im8-scratch-inset)">
                      <path ref={(node) => { settledScratchRef.current[index] = node; }} fill="none"
                        stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                      <path ref={(node) => { liveScratchRef.current[index] = node; }}
                        style={{ "--scratch-brush-width": BRUSH_WIDTH }} className="beam-scratch-stroke"
                        fill="none" stroke="black" strokeWidth={BRUSH_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                      <rect width={CELL_WIDTH} height={CELL_HEIGHT} fill="black"
                        className={`musely-section-clear ${completedSections[index] ? "is-complete" : ""}`} />
                    </g>
                  </mask>
                ))}
              </defs>
              <g className="pointer-events-none">
                {SECTIONS.map((section, index) => (
                  <g key={index} data-section={index} data-complete={!!completedSections[index]}>
                    <g clipPath="url(#im8-scratch-inset)">
                      <image href={section.reveal} width={CELL_WIDTH} height={CELL_HEIGHT} />
                    </g>
                    <image href={section.scratch} width={CELL_WIDTH} height={CELL_HEIGHT}
                      mask={`url(#im8-scratch-${index})`} />
                  </g>
                ))}
              </g>
              <rect width={SCRATCH_WIDTH} height={SCRATCH_HEIGHT} fill="transparent" />
            </svg>
            {scene === "initial" && (
              <img
                src={hand}
                alt="Hand scratch guide"
                className="im8-hand-guide pointer-events-none absolute left-[530px] top-[810px] z-30 w-[150px] select-none"
                draggable="false"
              />
            )}
            <img
              src={platform}
              alt="White tiered pedestal"
              className="im8-platform-enter pointer-events-none absolute left-1/2 top-[1404px] z-10 w-[1081px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <img
              src={product}
              alt="I·M·8 product collection"
              className="im8-product-enter pointer-events-none absolute left-[558px] top-[948px] z-20 w-[811px] -translate-x-1/2 select-none"
              draggable="false"
            />
            <Cta />
            <p className="sr-only" role="status">
              {inputLocked ? "30% Off + Free Reset Kit" : ""}
            </p>
          </div>
        </div>
        {scene === "end" && <EndScene onReady={handleEndSceneReady} />}
      </div>
    </main>
  );
};

export default App;
