import { useLayoutEffect, useRef } from "react";

const registeredPools = [];
const primedElements = new WeakSet();
const pendingRetries = [];
const playbackRequests = new WeakMap();
let desktopUnlockListenerAdded = false;
let cueContext = null;

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
  if (cueContext && cueContext.state !== "running" && cueContext.state !== "closed") {
    cueContext.resume().catch(() => {});
  }
  registeredPools.forEach((pool) => {
    pool.elements.forEach(primeElement);
  });
}

function flushPendingRetries() {
  for (const retry of [...pendingRetries]) {
    if (retry.pending || playbackRequests.get(retry.element) !== retry.request) continue;
    const { element, volume } = retry;
    retry.pending = true;
    element.currentTime = 0;
    element.volume = volume;
    element.muted = false;
    const remove = () => {
      const index = pendingRetries.indexOf(retry);
      if (index !== -1) pendingRetries.splice(index, 1);
    };
    Promise.resolve(element.play()).then(remove, () => {
      retry.pending = false;
    });
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
export default function useSound(src, { poolSize = 1, desktopPoolSize, lowLatency = false } = {}) {
  const poolRef = useRef(null);
  const effectiveSize = isMobileMediaPlatform()
    ? poolSize
    : (desktopPoolSize ?? poolSize);

  useLayoutEffect(() => {
    // Silent exports pass no source, so no media, decoding, or unlock work is created.
    if (!src) return;
    if (!poolRef.current) {
      const elements = Array.from(
        { length: effectiveSize },
        () => new Audio(src),
      );
      poolRef.current = { elements, nextIndex: 0 };
      registeredPools.push(poolRef.current);
      if (lowLatency) {
        // Decode short cues ahead of gameplay; never start an MP3 decoder at reveal.
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context) {
          try {
            cueContext ||= new Context({ latencyHint: "interactive" });
            const pool = poolRef.current;
            pool.context = cueContext;
            const bytes = src.startsWith("data:")
              ? Promise.resolve(Uint8Array.from(atob(src.split(",")[1]), (char) => char.charCodeAt(0)).buffer)
              : fetch(src).then((response) => response.arrayBuffer());
            bytes.then((data) => pool.context.decodeAudioData(data))
              .then((buffer) => { pool.buffer = buffer; })
              .catch(() => {}); // The existing primed media pool remains the fallback.
          } catch { /* Unsupported/blocked audio contexts use the media pool. */ }
        }
      }
    }
    ensureDesktopUnlockListener();
  }, [src, effectiveSize, lowLatency]);

  return poolRef;
}

export function canPlaySoundImmediately(poolRef) {
  const pool = poolRef?.current;
  return Boolean(pool?.buffer && pool.context?.state === "running");
}

// Always play through this helper so playback resets to the beginning and
// picks an idle pool instance — never call .play() directly on a pool
// element outside this file. Returns the specific element used, so it can
// be passed to stopSound() to cut it off early if needed.
export function playSound(poolRef, { volume = 1, loop = false } = {}) {
  const pool = poolRef?.current;
  if (!pool || pool.elements.length === 0) return null;

  if (canPlaySoundImmediately(poolRef)) {
    const node = pool.context.createBufferSource();
    const gain = pool.context.createGain();
    node.buffer = pool.buffer;
    node.loop = loop;
    gain.gain.value = volume;
    node.connect(gain);
    gain.connect(pool.context.destination);
    let stopped = false;
    const disconnect = () => {
      stopped = true;
      node.disconnect();
      gain.disconnect();
    };
    node.onended = disconnect;
    node.start();
    return {
      pause() {
        if (stopped) return;
        node.stop();
        disconnect();
      },
    };
  }

  let element = pool.elements.find((el) => el.paused || el.ended);
  if (!element) {
    element = pool.elements[pool.nextIndex];
    pool.nextIndex = (pool.nextIndex + 1) % pool.elements.length;
  }

  stopSound(element);
  const request = {};
  playbackRequests.set(element, request);
  element.loop = loop;
  element.currentTime = 0;
  element.volume = volume;
  element.muted = false;

  const playPromise = element.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Blocked (e.g. a timer-delayed cue on mobile) — retried on the next
      // handleUnlockGesture() call during an active drag.
      if (playbackRequests.get(element) === request) {
        pendingRetries.push({ element, volume, request });
      }
    });
  }

  return element;
}

export function stopSound(source) {
  if (!source) return;
  playbackRequests.delete(source);
  for (let i = pendingRetries.length - 1; i >= 0; i -= 1) {
    if (pendingRetries[i].element === source) pendingRetries.splice(i, 1);
  }
  source.pause();
}
