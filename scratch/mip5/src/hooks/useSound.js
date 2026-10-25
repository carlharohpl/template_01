import { useCallback, useLayoutEffect, useRef } from "react";

const pools = new Set();
const primed = new WeakSet();
const requests = new WeakMap();
const retries = new Map();
let context;
let gestureSeen = false;
let listening = false;

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function prime(audio) {
  if (primed.has(audio)) return;
  primed.add(audio);
  const muted = audio.muted;
  const volume = audio.volume;
  audio.muted = true;
  audio.volume = 0;
  try {
    const pending = audio.play();
    audio.pause();
    pending?.catch(() => {});
  } catch { /* A later real play can still succeed. */ }
  audio.muted = muted;
  audio.volume = volume;
}

function attempt(audio, request, volume) {
  if (requests.get(audio) !== request) return;
  audio.muted = false;
  audio.volume = volume;
  try {
    Promise.resolve(audio.play()).then(() => {
      if (requests.get(audio) === request) retries.delete(audio);
    }, () => {
      if (requests.get(audio) === request) retries.set(audio, { request, volume, pending: false });
    });
  } catch {
    retries.set(audio, { request, volume, pending: false });
  }
}

export function handleUnlockGesture(event) {
  if (event && !["pointerdown", "touchstart", "click", "keydown"].includes(event.type) && !gestureSeen) return;
  gestureSeen = true;
  if (context?.state === "suspended") context.resume().catch(() => {});
  for (const pool of pools) pool.elements.forEach(prime);
  for (const [audio, retry] of retries) {
    if (retry.pending || requests.get(audio) !== retry.request) continue;
    retry.pending = true;
    audio.currentTime = 0;
    attempt(audio, retry.request, retry.volume);
  }
}

function desktopUnlock(event) {
  // Promotional controls do not prime or retry audio.
  if (isMobile() || event.target?.closest?.('[data-cta], [aria-label="Open offer"]')) return;
  handleUnlockGesture(event);
}

export default function useSoundPool(src, { poolSize = 1, desktopPoolSize, lowLatency = false } = {}) {
  const ref = useRef(null);
  const size = isMobile() ? poolSize : desktopPoolSize ?? poolSize;
  useLayoutEffect(() => {
    if (!src) return;
    const pool = { elements: Array.from({ length: size }, () => new Audio(src)), nextIndex: 0, active: new Set() };
    ref.current = pool;
    pools.add(pool);
    if (!listening) {
      window.addEventListener("pointerdown", desktopUnlock);
      listening = true;
    }
    if (lowLatency && src.includes(";base64,")) {
      const Context = window.AudioContext || window.webkitAudioContext;
      try {
        if (Context) {
          context ||= new Context({ latencyHint: "interactive" });
          pool.context = context;
          const bytes = Promise.resolve(Uint8Array.from(atob(src.split(",")[1]), char => char.charCodeAt(0)).buffer);
          bytes.then(data => context.decodeAudioData(data)).then(buffer => {
            if (pools.has(pool)) pool.buffer = buffer;
          }).catch(() => {});
        }
      } catch { /* Use the primed media pool on unsupported hosts. */ }
    }
    return () => {
      pools.delete(pool);
      pool.elements.forEach(stopSound);
      pool.active.forEach(stopSound);
      if (ref.current === pool) ref.current = null;
      if (!pools.size) {
        window.removeEventListener("pointerdown", desktopUnlock);
        listening = false;
        gestureSeen = false;
      }
    };
  }, [src, size, lowLatency]);
  return ref;
}

export function canPlaySoundImmediately(ref) {
  return Boolean(ref?.current?.buffer && ref.current.context.state === "running");
}

export function playSound(ref, { volume = 1, loop = false } = {}) {
  const pool = ref?.current;
  if (!pool) return null;
  if (canPlaySoundImmediately(ref)) {
    const node = pool.context.createBufferSource();
    const gain = pool.context.createGain();
    const source = new EventTarget();
    const started = pool.context.currentTime;
    let stopped = false;
    let finished = false;
    let muted = false;
    node.buffer = pool.buffer;
    node.loop = loop;
    gain.gain.value = volume;
    node.connect(gain);
    gain.connect(pool.context.destination);
    Object.defineProperties(source, {
      currentTime: { get: () => Math.min(pool.context.currentTime - started, loop ? Infinity : pool.buffer.duration) },
      duration: { get: () => pool.buffer.duration },
      paused: { get: () => stopped },
      ended: { get: () => finished },
      muted: { get: () => muted, set: value => { muted = value; gain.gain.value = value ? 0 : volume; } },
    });
    source.pause = () => {
      if (stopped || finished) return;
      stopped = true;
      node.stop();
      node.disconnect();
      gain.disconnect();
      pool.active.delete(source);
    };
    node.onended = () => {
      if (stopped) return;
      finished = true;
      node.disconnect();
      gain.disconnect();
      pool.active.delete(source);
      source.dispatchEvent(new Event("ended"));
    };
    pool.active.add(source);
    node.start();
    return source;
  }
  const audio = pool.elements.find(item => item.paused || item.ended) || pool.elements[pool.nextIndex++ % pool.elements.length];
  stopSound(audio);
  const request = {};
  requests.set(audio, request);
  audio.currentTime = 0;
  audio.loop = loop;
  attempt(audio, request, volume);
  return audio;
}

export function stopSound(source) {
  if (!source) return;
  requests.delete(source);
  retries.delete(source);
  source.pause();
}

// The minimum hold and actual playback completion must both settle. A stalled
// or blocked cue expires only after no playback progress, never while advancing.
export function waitForSoundCompletion(source, { minimumMs = 0, onComplete }) {
  let disposed = false;
  let minimumDone = minimumMs <= 0;
  let audioDone = !source || source.ended;
  let lastTime = source?.currentTime || 0;
  let lastProgress = performance.now();
  let minimumTimer;
  let pollTimer;
  const cleanup = () => {
    clearTimeout(minimumTimer);
    clearInterval(pollTimer);
    source?.removeEventListener("ended", ended);
    source?.removeEventListener("error", failed);
  };
  const finish = () => {
    if (disposed || !minimumDone || !audioDone) return;
    disposed = true;
    cleanup();
    onComplete();
  };
  const ended = () => { audioDone = true; finish(); };
  const failed = () => {
    if (disposed || audioDone) return;
    stopSound(source);
    audioDone = true;
    finish();
  };
  source?.addEventListener("ended", ended);
  source?.addEventListener("error", failed);
  minimumTimer = setTimeout(() => { minimumDone = true; finish(); }, minimumMs);
  pollTimer = setInterval(() => {
    if (disposed || audioDone) return;
    if (source.ended) { ended(); return; }
    const time = source.currentTime || 0;
    if (time > lastTime + 0.001) { lastTime = time; lastProgress = performance.now(); }
    else if (performance.now() - lastProgress >= 4000) failed();
  }, 200);
  return () => { disposed = true; cleanup(); stopSound(source); };
}

// Compatibility for the slot's completion-based cue callbacks; all playback
// still uses the same pools, unlock/retry path and actual-instance gate above.
export function useSound(src, volume = 0.7) {
  const pool = useSoundPool(src, { lowLatency: true });
  const pending = useRef(new Set());
  useLayoutEffect(() => {
    const entries = pending.current;
    return () => { entries.forEach(cancel => cancel()); entries.clear(); };
  }, []);
  return useCallback((minimumMs = 0) => new Promise(resolve => {
    const source = playSound(pool, { volume });
    const cancel = waitForSoundCompletion(source, { minimumMs, onComplete: () => {
      pending.current.delete(cancel);
      resolve();
    } });
    pending.current.add(cancel);
  }), [pool, volume]);
}

export const unlockSounds = handleUnlockGesture;
