import { useLayoutEffect, useRef } from "react";

const registeredPools = [];
const primedElements = new WeakSet();
const pendingRetries = new Map();
const playbackVersions = new WeakMap();
let desktopUnlockListenerAdded = false;
let gestureUnlocked = false;

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

  try {
    const playPromise = audio.play();
    audio.pause();
    playPromise?.catch(() => {});
  } catch {
    // Media failures must not interrupt the input handler.
  } finally {
    audio.muted = wasMuted;
    audio.volume = previousVolume;
  }
}

function primeAllRegisteredPools() {
  registeredPools.forEach((pool) => {
    pool.elements.forEach(primeElement);
  });
}

function flushPendingRetries() {
  for (const [element, { volume, version }] of [...pendingRetries]) {
    pendingRetries.delete(element);
    if (playbackVersions.get(element) !== version) continue;
    startPlayback(element, volume, version);
  }
}

function startPlayback(element, volume, version) {
  const retry = () => {
    if (playbackVersions.get(element) === version) {
      pendingRetries.set(element, { volume, version });
    }
  };
  try {
    element.currentTime = 0;
    element.volume = volume;
    element.muted = false;
    element.play()?.catch(retry);
  } catch {
    // A synchronous failure is handled just like a rejected play promise.
    retry();
  }
}

// Call from a draggable/interactive element's own gesture handlers (attach
// as a real DOM listener on the element itself, not only a React prop —
// some mobile WebViews require audio authorization on the touched element
// rather than through React's delegated events). Safe to call repeatedly
// (pointerdown, pointermove, pointerup) — already-primed elements are
// skipped, and it also retries any timer-delayed cue that was previously
// rejected, which is required for reliable drag-to-start audio on iOS/Android.
export function handleUnlockGesture(event) {
  if (!event?.isTrusted) return;
  if (["pointerdown", "touchstart", "click"].includes(event.type)) {
    gestureUnlocked = true;
    primeAllRegisteredPools();
  }
  if (!gestureUnlocked) return;
  flushPendingRetries();
}

function handleFirstPointerDown(event) {
  if (!event.isTrusted) return;
  handleUnlockGesture(event);
  window.removeEventListener("pointerdown", handleFirstPointerDown);
}

function ensureDesktopUnlockListener() {
  if (desktopUnlockListenerAdded || isMobileMediaPlatform()) return;
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
    const pool = poolRef.current;
    return () => {
      pool.elements.forEach(stopSound);
      const index = registeredPools.indexOf(pool);
      if (index !== -1) registeredPools.splice(index, 1);
      poolRef.current = null;
      if (registeredPools.length === 0) {
        window.removeEventListener("pointerdown", handleFirstPointerDown);
        desktopUnlockListenerAdded = false;
        gestureUnlocked = false;
      }
    };
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

  stopSound(element);
  startPlayback(element, volume, playbackVersions.get(element));

  return element;
}

export function stopSound(source) {
  if (!source) return;
  playbackVersions.set(source, (playbackVersions.get(source) ?? 0) + 1);
  pendingRetries.delete(source);
  try {
    source.pause();
  } catch {
    // Stopping an unavailable media element must still cancel its retry.
  }
}
