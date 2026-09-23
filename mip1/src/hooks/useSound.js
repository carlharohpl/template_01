import { useLayoutEffect, useRef } from "react";

const registeredPools = [];
const primedElements = new WeakSet();
const pendingRetries = [];
let desktopUnlockListenerAdded = false;

// iPadOS 13+ reports as desktop Safari ("MacIntel") but is still a touch
// WebView needing the mobile priming/retry path — real Mac desktops report
// maxTouchPoints 0, and Windows touchscreen laptops report a non-Mac
// platform, so neither of those false-positives here.
function isMobileMediaPlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";

  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }

  return false;
}

function primeElement(audio) {
  if (primedElements.has(audio)) return;
  primedElements.add(audio);

  const wasMuted = audio.muted;
  const previousVolume = audio.volume;

  audio.muted = true;
  audio.volume = 0;

  const playPromise = audio.play();
  audio.pause();

  audio.muted = wasMuted;
  audio.volume = previousVolume;

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function primeAllRegisteredPools() {
  registeredPools.forEach((pool) => {
    pool.elements.forEach(primeElement);
  });
}

function flushPendingRetries() {
  for (let i = pendingRetries.length - 1; i >= 0; i -= 1) {
    const { element, volume } = pendingRetries[i];
    element.currentTime = 0;
    element.volume = volume;
    element.muted = false;

    const playPromise = element.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.then(
        () => pendingRetries.splice(i, 1),
        () => {}, // still blocked — stays queued for the next gesture
      );
    } else {
      pendingRetries.splice(i, 1);
    }
  }
}

// Call from a draggable/interactive element's own gesture handlers (attach
// as a real DOM listener on the element itself, not only a React prop —
// some mobile WebViews require audio authorization on the touched element
// rather than through React's delegated events). Safe to call repeatedly
// (pointerdown, pointermove, pointerup) — already-primed elements are
// skipped, and it also retries any timer-delayed cue that was previously
// rejected, which is required for reliable drag-to-start audio on iOS/Android.
export function handleUnlockGesture() {
  primeAllRegisteredPools();
  flushPendingRetries();
}

function handleFirstPointerDown() {
  primeAllRegisteredPools();
  window.removeEventListener("pointerdown", handleFirstPointerDown);
}

function ensureDesktopUnlockListener() {
  if (desktopUnlockListenerAdded) return;
  desktopUnlockListenerAdded = true;
  window.addEventListener("pointerdown", handleFirstPointerDown);
}

// poolSize: instance count on iOS/Android. desktopPoolSize: instance count
// on desktop browsers, defaults to poolSize. Use >1 when a sound may
// overlap itself or be restarted quickly (e.g. rapid repeated taps).
export default function useSound(src, { poolSize = 1, desktopPoolSize } = {}) {
  const poolRef = useRef(null);
  const effectiveSize = isMobileMediaPlatform()
    ? poolSize
    : (desktopPoolSize ?? poolSize);

  useLayoutEffect(() => {
    if (!poolRef.current) {
      const elements = Array.from(
        { length: effectiveSize },
        () => new Audio(src),
      );
      poolRef.current = { elements, nextIndex: 0 };
      registeredPools.push(poolRef.current);
    }
    ensureDesktopUnlockListener();
  }, [src, effectiveSize]);

  return poolRef;
}

// Always play through this helper so playback resets to the beginning and
// picks an idle pool instance — never call .play() directly on a pool
// element outside this file. Returns the specific element used, so it can
// be passed to stopSound() to cut it off early if needed.
export function playSound(poolRef, { volume = 1 } = {}) {
  const pool = poolRef?.current;
  if (!pool || pool.elements.length === 0) return null;

  let element = pool.elements.find((el) => el.paused || el.ended);
  if (!element) {
    element = pool.elements[pool.nextIndex];
    pool.nextIndex = (pool.nextIndex + 1) % pool.elements.length;
  }

  element.currentTime = 0;
  element.volume = volume;
  element.muted = false;

  const playPromise = element.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Blocked (e.g. a timer-delayed cue on mobile) — retried on the next
      // handleUnlockGesture() call during an active drag.
      pendingRetries.push({ element, volume });
    });
  }

  return element;
}

export function stopSound(source) {
  if (source) source.pause();
}
