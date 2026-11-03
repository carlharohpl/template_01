import { useLayoutEffect, useRef } from "react";

// Short effects only. Import assets with ?inline in both development and builds.
// No context, listeners, media players, or decoding are created by module import.
const MAX_VOICES = 32;
const MAX_ASSETS = 32;
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const MAX_PENDING_MS = 2000;
const EXCLUDE = 'a, [data-sfx-exclude], [data-cta], [aria-label="Open offer"]';
let shared = null;
let muted = false;
const bindings = new WeakMap();
const handledGestures = new WeakSet();
const mediaPools = new Set();

function isIosMediaPlatform() {
  return typeof navigator !== "undefined" && (/iPhone|iPod|iPad/i.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
}

function isMobileMediaPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPod|iPad/i.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function cancelAll(session, reason) {
  for (const handle of [...session.handles]) settle(handle, "cancelled", reason);
}

function refreshVisibility(session) {
  session.visible = !document.hidden && !session.pageHidden && session.hostVisible;
  if (!session.visible) {
    cancelAll(session, "hidden");
    clearGestureSource(session);
    session.gestureWarmed = false;
    try { Promise.resolve(session.context.suspend()).catch(() => {}); } catch { /* Unsupported host state. */ }
  }
  // Returning to view never creates a new context or assumes activation survived.
}

function getSession() {
  if (shared) {
    clearTimeout(shared.disposeTimer);
    return shared;
  }
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error("Web Audio is unavailable; short SFX remain silent.");
  const context = new Context({ latencyHint: "interactive" });
  let gestureBuffer = null;
  // Prepare once, outside input handling; no loading/decoding or audible cue.
  if (isIosMediaPlatform()) {
    try { gestureBuffer = context.createBuffer(1, 1, context.sampleRate); } catch { /* Resume remains available. */ }
  }
  const session = {
    gestureBuffer, gestureSource: null, gestureWarmed: false,
    context, pools: new Set(), handles: new Set(), pending: new Map(), cache: new Map(),
    bytes: 0, slots: 0, visible: true, hostVisible: true, pageHidden: false,
    closed: false, hasRun: context.state === "running", attempt: null, disposeTimer: null, removeListeners: [],
  };
  shared = session;
  const listen = (target, name, handler) => {
    target.addEventListener(name, handler);
    session.removeListeners.push(() => target.removeEventListener(name, handler));
  };
  listen(context, "statechange", () => {
    if (session.closed) return;
    if (context.state === "running") {
      session.hasRun = true;
      flushPending(session);
    } else if (session.hasRun) {
      cancelAll(session, "interrupted");
      clearGestureSource(session);
      session.gestureWarmed = false;
    }
  });
  listen(document, "visibilitychange", () => refreshVisibility(session));
  listen(window, "pagehide", () => { session.pageHidden = true; refreshVisibility(session); });
  listen(window, "pageshow", () => { session.pageHidden = false; refreshVisibility(session); });
  try {
    if (typeof window.mraid?.isViewable === "function") session.hostVisible = Boolean(window.mraid.isViewable());
    if (typeof window.mraid?.addEventListener === "function" && typeof window.mraid?.removeEventListener === "function") {
      const onViewable = value => { session.hostVisible = Boolean(value); refreshVisibility(session); };
      const removeViewableListener = window.mraid.removeEventListener.bind(window.mraid);
      window.mraid.addEventListener("viewableChange", onViewable);
      session.removeListeners.push(() => removeViewableListener("viewableChange", onViewable));
    }
  } catch { /* Browser/host without a usable media lifecycle bridge. */ }
  refreshVisibility(session);
  return session;
}

function evictUnused(session, incomingBytes = 0) {
  for (const [src, entry] of session.cache) {
    if (session.cache.size < MAX_ASSETS && session.bytes + incomingBytes <= MAX_DECODED_BYTES) break;
    if (entry.references || !entry.settled) continue;
    session.cache.delete(src);
    session.bytes -= entry.bytes;
  }
}

function prepareBuffer(session, src) {
  let entry = session.cache.get(src);
  if (entry) { entry.references++; return entry; }
  evictUnused(session);
  if (session.cache.size >= MAX_ASSETS) throw new Error("Too many prepared SFX assets; release unused scenes first.");
  entry = { references: 1, bytes: 0, buffer: null, error: null, settled: false };
  session.cache.set(src, entry);
  // Cache the promise before work begins, including simultaneous scene consumers.
  entry.ready = Promise.resolve().then(async () => {
    if (session.closed) return null;
    const match = /^data:audio\/[^;,]+;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(src);
    if (!match || match[1].length % 4 || match[1].length > 8 * 1024 * 1024) {
      throw new Error("Short SFX require a nonempty Base64 audio import with ?inline.");
    }
    const bytes = Uint8Array.from(atob(match[1]), char => char.charCodeAt(0));
    const buffer = await session.context.decodeAudioData(bytes.buffer);
    if (session.closed) return null;
    const decodedBytes = buffer.length * buffer.numberOfChannels * 4;
    evictUnused(session, decodedBytes);
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || session.bytes + decodedBytes > MAX_DECODED_BYTES) {
      throw new Error("SFX decoded-memory budget exceeded or invalid sound; keep long tracks on their separate media lifecycle.");
    }
    entry.buffer = buffer;
    entry.bytes = decodedBytes;
    session.bytes += decodedBytes;
    return buffer;
  }).catch(error => {
    entry.error = error;
    return null;
  }).finally(() => { entry.settled = true; });
  return entry;
}

// Also usable by a non-React scene. Dispose the owner when its scene is finished.
export function createSoundPool(src, { poolSize = 1, desktopPoolSize, overflow = "replace-oldest", channel, backend = "media" } = {}) {
  if (!src) return unavailablePool(null);
  const size = isMobileMediaPlatform() ? poolSize : (desktopPoolSize ?? poolSize);
  if (!["media", "web"].includes(backend) || !Number.isInteger(size) || size < 1 || size > MAX_VOICES ||
      !["replace-oldest", "drop-new"].includes(overflow)) {
    return unavailablePool(new Error("Invalid SFX backend, voice count, or overflow policy."));
  }
  if (backend === "media") return createMediaGroup(src, size, overflow, channel);
  const pool = { session: null, entry: null, slots: [], disposed: false, error: null, overflow, channel };
  pool.channel ??= pool;
  pool.dispose = () => disposePool(pool);
  try {
    if (!Number.isInteger(size) || size < 1 || size > MAX_VOICES || !["replace-oldest", "drop-new"].includes(overflow)) {
      throw new Error("Invalid SFX voice count or overflow policy.");
    }
    const session = getSession();
    pool.session = session;
    session.pools.add(pool);
    if (session.slots + mediaPools.size + size > MAX_VOICES) throw new Error("Shared SFX voice budget exceeded.");
    pool.entry = prepareBuffer(session, src);
    for (let i = 0; i < size; i++) {
      const gain = session.context.createGain();
      gain.connect(session.context.destination);
      pool.slots.push({ gain, handle: null });
      session.slots++;
    }
    pool.ready = pool.entry.ready.then(buffer => {
      if (pool.disposed) return false;
      pool.error = pool.entry.error;
      if (!buffer) {
        for (const handle of [...session.handles]) {
          if (handle.pool === pool) settle(handle, "failed", "preparation", pool.error);
        }
      } else flushPending(session);
      return Boolean(buffer);
    });
  } catch (error) {
    pool.error = error;
    pool.ready = Promise.resolve(false);
  }
  return pool;
}

function disposePool(pool) {
  if (pool.disposed) return;
  pool.disposed = true;
  const session = pool.session;
  if (!session) return;
  for (const handle of [...session.handles]) {
    if (handle.pool === pool) settle(handle, "cancelled", "disposed");
  }
  for (const slot of pool.slots) slot.gain.disconnect();
  session.slots -= pool.slots.length;
  pool.slots = [];
  if (pool.entry) pool.entry.references--;
  pool.entry = null;
  session.pools.delete(pool);
  if (session.pools.size) return;
  // A synchronous StrictMode cleanup/remount reuses this session and decode cache.
  session.disposeTimer = setTimeout(() => {
    if (session.pools.size || session.closed) return;
    session.closed = true;
    session.attempt = null;
    clearGestureSource(session);
    session.gestureBuffer = null;
    for (const remove of session.removeListeners) {
      try { remove(); } catch { /* Host already disposed its bridge. */ }
    }
    session.cache.clear();
    session.bytes = 0;
    if (shared === session) shared = null;
    try { Promise.resolve(session.context.close()).catch(() => {}); } catch { /* Already closed. */ }
  }, 0);
}

export default function useSound(src, { poolSize = 1, desktopPoolSize, overflow = "replace-oldest", channel, backend = "media" } = {}) {
  const poolRef = useRef(null);
  useLayoutEffect(() => {
    if (!src) return;
    const pool = createSoundPool(src, { poolSize, desktopPoolSize, overflow, channel, backend });
    poolRef.current = pool;
    return () => {
      pool.dispose();
      if (poolRef.current === pool) poolRef.current = null;
    };
  }, [src, poolSize, desktopPoolSize, overflow, channel, backend]);
  return poolRef;
}

function settle(handle, status, reason = null, error = null) {
  if (!["pending", "playing"].includes(handle.status)) return;
  const session = handle.pool.session;
  handle.elapsed = handle.currentTime;
  handle.status = status;
  handle.reason = reason;
  handle.error = error;
  clearTimeout(handle.timer);
  if (session?.pending.get(handle.pool.channel) === handle) session.pending.delete(handle.pool.channel);
  session?.handles.delete(handle);
  if (handle.source) {
    handle.source.onended = null;
    if (status !== "ended") { try { handle.source.stop(); } catch { /* Already stopped. */ } }
    handle.source.disconnect();
    handle.source = null;
  }
  if (handle.slot?.handle === handle) handle.slot.handle = null;
  handle.slot = null;
  handle.resolveFinished({ status, reason, error });
  handle.dispatchEvent(new Event(status === "failed" ? "error" : status));
}

function start(handle, immediate = false, gesture = null) {
  const pool = handle.pool;
  const session = pool.session;
  if (handle.status !== "pending" || pool.disposed || session.closed) return;
  if (!immediate && performance.now() > handle.expiresAt) { settle(handle, "cancelled", "expired"); return; }
  if (muted || !session.visible || !pool.entry?.buffer) return;
  const running = session.context.state === "running";
  const nativeStart = gesture?.isTrusted && ["pointerdown", "touchstart"].includes(gesture.type) &&
    !gesture.target?.closest?.(EXCLUDE);
  if (!running && !(immediate && nativeStart && session.context.state === "suspended")) return;
  const markPlaying = () => {
    if (handle.status !== "pending") return;
    clearTimeout(handle.timer);
    if (session.pending.get(pool.channel) === handle) session.pending.delete(pool.channel);
    handle.status = "playing";
    monitorPlayback(handle);
  };
  // The prepared source may already have been started in native touchstart.
  // Readiness only marks it running; it must never start a second source.
  if (handle.source) {
    if (running) markPlaying();
    return;
  }
  let slot = pool.slots.find(item => !item.handle);
  if (!slot) {
    if (pool.overflow === "drop-new") { settle(handle, "cancelled", "voice-limit"); return; }
    slot = pool.slots.reduce((oldest, item) => item.handle.startedAt < oldest.handle.startedAt ? item : oldest);
    settle(slot.handle, "cancelled", "replaced");
  }
  try {
    const source = session.context.createBufferSource();
    handle.source = source;
    handle.slot = slot;
    slot.handle = handle;
    source.buffer = pool.entry.buffer;
    source.loop = handle.loop;
    slot.gain.gain.value = handle.muted ? 0 : handle.volume;
    source.connect(slot.gain);
    source.onended = () => settle(handle, "ended");
    handle.startedAt = session.context.currentTime;
    handle.durationSeconds = source.buffer.duration;
    // Keep this source.start() on the original trusted input stack, even if
    // resume has not settled yet. Pending expiry/stop still cancels the source.
    source.start();
    if (session.context.state === "running") markPlaying();
  } catch (error) { settle(handle, "failed", "playback", error); }
}

function monitorPlayback(handle) {
  // A stalled source or lost ended event must not leave completion waiting forever.
  let previous = handle.pool.session.context.currentTime;
  let lastProgress = performance.now();
  const check = () => {
    if (handle.status !== "playing") return;
    const now = handle.pool.session.context.currentTime;
    if (now > previous) lastProgress = performance.now();
    previous = now;
    if (performance.now() - lastProgress >= 2000 || (!handle.loop && now - handle.startedAt > handle.duration + 1)) {
      settle(handle, "failed", "stalled-or-missing-end");
      return;
    }
    handle.timer = setTimeout(check, 500);
  };
  handle.timer = setTimeout(check, 500);
}

function flushPending(session) {
  for (const handle of [...session.pending.values()]) start(handle);
}

// Returns a playback handle, NOT an HTMLAudioElement. Only natural end emits ended.
export function playSound(poolRef, { volume = 1, pendingMs, replace = false, loop = false, gesture = null } = {}) {
  const pool = poolRef?.current ?? poolRef;
  if (!pool || pool.disposed || !pool.ready || pool.inactive) return null;
  if (gesture && (!gesture.isTrusted || gesture.target?.closest?.(EXCLUDE))) return null;
  if (pool.backend === "media-group") return playMediaGroup(pool, { volume, loop, gesture, pendingMs, replace });
  const session = pool.session;
  const handle = new EventTarget();
  Object.assign(handle, {
    pool, loop: Boolean(loop), status: "pending", reason: null, error: null, source: null, slot: null,
    startedAt: null, durationSeconds: null, elapsed: 0, timer: null,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1,
    expiresAt: loop && pendingMs === undefined ? Infinity : performance.now() + Math.max(0, Math.min(MAX_PENDING_MS, Number.isFinite(pendingMs) ? pendingMs : 250)),
    stop: () => settle(handle, "cancelled", "stopped"),
  });
  handle.finished = new Promise(resolve => { handle.resolveFinished = resolve; });
  let locallyMuted = false;
  Object.defineProperties(handle, {
    // Keep the existing scratch loop's phase while its 160ms idle gate is silent.
    muted: {
      get: () => locallyMuted,
      set: value => {
        locallyMuted = Boolean(value);
        if (handle.slot?.handle === handle) handle.slot.gain.gain.value = locallyMuted ? 0 : handle.volume;
      },
    },
    paused: { get: () => handle.status !== "playing" },
    duration: { get: () => handle.durationSeconds ?? pool.entry?.buffer?.duration ?? 0 },
    ended: { get: () => handle.status === "ended" },
    currentTime: { get: () => handle.startedAt !== null && handle.status === "playing"
      ? Math.min(handle.loop ? Infinity : handle.duration, Math.max(0, session.context.currentTime - handle.startedAt)) : handle.elapsed },
  });
  if (pool.error) { settle(handle, "failed", "preparation", pool.error); return handle; }
  if (!session || session.closed || muted || !session.visible) {
    settle(handle, "cancelled", muted ? "muted" : "hidden");
    return handle;
  }
  const previous = session.pending.get(pool.channel);
  if (previous) settle(previous, "cancelled", "superseded");
  if (replace) {
    for (const current of [...session.handles]) {
      if (current.pool.channel === pool.channel) settle(current, "cancelled", "replaced");
    }
  }
  session.handles.add(handle);
  session.pending.set(pool.channel, handle);
  start(handle, true, gesture);
  if (handle.status === "pending" && Number.isFinite(handle.expiresAt)) handle.timer = setTimeout(() => settle(handle, "cancelled", "expired"), Math.max(0, handle.expiresAt - performance.now()));
  return handle;
}

export function stopSound(handle) { handle?.stop?.(); }

export function setSoundMuted(value) {
  muted = Boolean(value);
  if (muted) for (const pool of mediaPools) pool.handle?.stop();
  if (muted && shared) {
    cancelAll(shared, "muted");
    clearGestureSource(shared);
  }
}

function clearGestureSource(session) {
  const source = session.gestureSource;
  session.gestureSource = null;
  if (!source) return;
  source.onended = null;
  try { source.stop(); } catch { /* Already ended. */ }
  source.disconnect();
}

function startGestureSource(session) {
  if (!session.gestureBuffer || session.gestureWarmed) return;
  // WebKit may need a source start INSIDE the trusted gesture, not only resume.
  // Keep at most one pending silent source; never wait for a click or a promise.
  clearGestureSource(session);
  try {
    const source = session.context.createBufferSource();
    session.gestureSource = source;
    source.buffer = session.gestureBuffer;
    source.connect(session.context.destination);
    source.onended = () => {
      if (session.gestureSource !== source) return;
      session.gestureSource = null;
      source.onended = null;
      source.disconnect();
      if (!session.closed && session.visible && session.context.state === "running") {
        session.gestureWarmed = true;
        flushPending(session);
      }
    };
    source.start(0);
  } catch { clearGestureSource(session); }
}

// Call only from native gameplay input; never defer resume behind preparation.
export function handleUnlockGesture(event) {
  if (!event?.isTrusted || !["pointerdown", "pointerup", "touchstart", "touchend", "click", "keydown"].includes(event.type) ||
    event.target?.closest?.(EXCLUDE) || handledGestures.has(event)) return false;
  handledGestures.add(event);
  if (muted) return false;
  let mediaReady = false;
  for (const pool of mediaPools) {
    if (pool.disposed || pool.error || !pool.visible) continue;
    // Unlock future win/end cues on the same first touch as the scratch loop.
    primeMediaPool(pool);
    attemptMediaSound(pool.handle);
    mediaReady = true;
  }
  const session = shared;
  if (!session || session.closed || !session.visible) return mediaReady;
  startGestureSource(session);
  if (session.context.state === "running") { flushPending(session); return true; }
  const attempt = {};
  session.attempt = attempt;
  try {
    // A pending promise never locks out a fresh gesture (including iOS release).
    const result = session.context.resume();
    Promise.resolve(result).then(() => {
      if (session.closed || session.attempt !== attempt) return;
      session.attempt = null;
      if (session.context.state === "running") flushPending(session);
    }, () => { if (session.attempt === attempt) session.attempt = null; });
    return true;
  } catch {
    if (session.attempt === attempt) session.attempt = null;
    return false;
  }
}

// Bind once on the stable gameplay container in an effect; return its cleanup.
// Release is captured on window so disabled/removed controls cannot swallow it.
export function bindSoundGestures(element, { exclude = "", keyboard = false } = {}) {
  if (!element) return () => {};
  const existing = bindings.get(element);
  if (existing) {
    existing.owners++;
    return bindingLease(element, existing);
  }
  const binding = { owners: 1, remove: [] };
  bindings.set(element, binding);
  const pointers = new Set();
  const touches = new Set();
  const allowed = event => event.isTrusted && !event.target?.closest?.(EXCLUDE) && (!exclude || !event.target?.closest?.(exclude));
  const listen = (target, name, handler) => {
    target.addEventListener(name, handler, { capture: true, passive: true });
    binding.remove.push(() => target.removeEventListener(name, handler, true));
  };
  listen(element, "pointerdown", event => {
    if (!allowed(event)) return;
    pointers.add(event.pointerId);
    handleUnlockGesture(event);
  });
  listen(element, "touchstart", event => {
    if (!allowed(event)) return;
    for (const touch of event.changedTouches) touches.add(touch.identifier);
    handleUnlockGesture(event);
  });
  listen(window, "pointerup", event => {
    const startedHere = pointers.delete(event.pointerId);
    if (startedHere && allowed(event)) handleUnlockGesture(event);
  });
  listen(window, "touchend", event => {
    let startedHere = false;
    for (const touch of event.changedTouches) startedHere = touches.delete(touch.identifier) || startedHere;
    if (startedHere && allowed(event)) handleUnlockGesture(event);
  });
  listen(window, "pointercancel", event => pointers.delete(event.pointerId));
  listen(window, "touchcancel", event => { for (const touch of event.changedTouches) touches.delete(touch.identifier); });
  listen(element, "click", event => { if (allowed(event)) handleUnlockGesture(event); });
  if (keyboard) listen(element, "keydown", event => {
    if (!event.repeat && ["Enter", " "].includes(event.key) && allowed(event)) handleUnlockGesture(event);
  });
  const clear = () => { pointers.clear(); touches.clear(); };
  listen(window, "blur", clear);
  listen(window, "pagehide", clear);
  listen(document, "visibilitychange", () => { if (document.hidden) clear(); });
  binding.remove.push(clear);
  return bindingLease(element, binding);
}

function bindingLease(element, binding) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--binding.owners) return;
    for (const remove of binding.remove) remove();
    bindings.delete(element);
  };
}

// Retain the scratch scene's minimum hold plus actual-instance completion gate.
// Failed/cancelled handles use the backend's bounded fallback, never replay a cue.
export function waitForSoundCompletion(handle, { minimumMs = 0, onComplete }) {
  let disposed = false;
  let minimumDone = false;
  let audioDone = !handle;
  const finish = () => {
    if (disposed || !minimumDone || !audioDone) return;
    disposed = true;
    onComplete();
  };
  const timer = setTimeout(() => { minimumDone = true; finish(); }, Math.max(0, minimumMs));
  handle?.finished.then(() => {
    if (disposed) return;
    audioDone = true;
    finish();
  });
  return () => {
    disposed = true;
    clearTimeout(timer);
    stopSound(handle);
  };
}

// Explicit pooled media backend; prepare each player in the first gameplay gesture.
// Delayed scene cues reuse those players without requiring a second tap.
function createMediaPool(src, overflow) {
  const pool = { backend: "media", overflow, disposed: false, audio: null, handle: null, primed: false, visible: true, error: null };
  const remove = [];
  let hostVisible = true;
  let pageHidden = false;
  const listen = (target, name, fn) => {
    target.addEventListener(name, fn);
    remove.push(() => target.removeEventListener(name, fn));
  };
  const sync = () => {
    pool.visible = !document.hidden && !pageHidden && hostVisible;
    if (!pool.visible) {
      pool.handle?.stop();
      pool.primed = false;
    }
  };
  pool.dispose = () => {
    if (pool.disposed) return;
    pool.disposed = true;
    pool.handle?.stop();
    for (const cleanup of remove) { try { cleanup(); } catch { /* Host already exited. */ } }
    if (pool.audio) {
      pool.audio.pause();
      pool.audio.removeAttribute("src");
      pool.audio.load();
    }
    mediaPools.delete(pool);
  };
  try {
    pool.audio = new Audio(src);
    pool.audio.preload = "auto";
    mediaPools.add(pool);
    listen(document, "visibilitychange", sync);
    listen(window, "pagehide", () => { pageHidden = true; sync(); });
    listen(window, "pageshow", () => { pageHidden = false; sync(); });
      try {
      if (typeof window.mraid?.isViewable === "function") hostVisible = Boolean(window.mraid.isViewable());
      if (typeof window.mraid?.addEventListener === "function" && typeof window.mraid?.removeEventListener === "function") {
        const changed = value => { hostVisible = Boolean(value); sync(); };
        const removeViewableListener = window.mraid.removeEventListener.bind(window.mraid);
        window.mraid.addEventListener("viewableChange", changed);
        remove.push(() => removeViewableListener("viewableChange", changed));
      }
    } catch { /* Browser without a usable bridge. */ }
    sync();
  } catch (error) { pool.error = error; }
  pool.ready = Promise.resolve(!pool.error);
  return pool;
}

function primeMediaPool(pool) {
  if (pool.primed || pool.disposed || pool.error || muted || !pool.visible) return;
  pool.primed = true;
  const audio = pool.audio;
  const wasMuted = audio.muted;
  const volume = audio.volume;
  // Match mip2's native muted play/pause for every already-mounted player.
  audio.muted = true;
  audio.volume = 0;
  try { Promise.resolve(audio.play()).catch(() => {}); } catch { /* Real play can retry. */ }
  audio.pause();
  audio.muted = wasMuted;
  audio.volume = volume;
}

function playMediaSound(pool, { volume, loop, gesture, pendingMs }) {
  if (pool.error || muted || !pool.visible) return null;
  if (gesture) {
    if (!gesture.isTrusted || !["touchstart", "pointerdown"].includes(gesture.type) ||
        gesture.target?.closest?.(EXCLUDE)) return null;
    primeMediaPool(pool);
  }
  // Scene cues may run later, but cannot autoplay before gameplay activation.
  if (!pool.primed) return null;
  if (pool.handle && pool.overflow === "drop-new") return null;
  pool.handle?.stop();
  const audio = pool.audio;
  audio.muted = false;
  audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  audio.loop = Boolean(loop);
  try { audio.currentTime = 0; } catch { /* Metadata may still be loading. */ }
  const handle = new EventTarget();
  Object.assign(handle, { requestedAt: performance.now(), status: "pending", reason: null, error: null, lastRetry: -Infinity, attempt: null, timer: null, expiryTimer: null, elapsed: 0, durationSeconds: 0, pool });
  handle.finished = new Promise(resolve => { handle.resolveFinished = resolve; });
  const finish = (status, error = null, reason = null) => {
    if (!["pending", "playing"].includes(handle.status)) return;
    handle.elapsed = audio.currentTime;
    handle.durationSeconds = audio.duration;
    handle.status = status;
    handle.error = error;
    handle.reason = reason ?? (status === "cancelled" ? "stopped" : status === "failed" ? "media-error" : null);
    handle.attempt = null;
    clearTimeout(handle.timer);
    clearTimeout(handle.expiryTimer);
    audio.removeEventListener("ended", ended);
    audio.removeEventListener("error", failed);
    audio.pause();
    if (pool.handle === handle) pool.handle = null;
    handle.resolveFinished({ status, reason: handle.reason, error });
    handle.dispatchEvent(new Event(status === "failed" ? "error" : status));
  };
  const ended = () => finish("ended");
  const failed = () => finish("failed", audio.error);
  handle.stop = () => finish("cancelled");
  Object.defineProperties(handle, {
    muted: { get: () => audio.muted, set: value => { if (pool.handle === handle) audio.muted = Boolean(value); } },
    paused: { get: () => pool.handle !== handle || audio.paused },
    ended: { get: () => handle.status === "ended" },
    currentTime: { get: () => pool.handle === handle ? audio.currentTime : handle.elapsed },
    duration: { get: () => pool.handle === handle ? audio.duration : handle.durationSeconds },
  });
  audio.addEventListener("ended", ended);
  audio.addEventListener("error", failed);
  pool.handle = handle;
  attemptMediaSound(handle);
  if (Number.isFinite(pendingMs)) {
    handle.expiryTimer = setTimeout(() => {
      if (handle.status === "pending") finish("cancelled", null, "expired");
    }, Math.max(0, Math.min(MAX_PENDING_MS, pendingMs)));
  }
  if (!loop) {
    let previous = audio.currentTime;
    let lastProgress = performance.now();
    const check = () => {
      if (!["pending", "playing"].includes(handle.status)) return;
      if (audio.ended) { ended(); return; }
      if (audio.currentTime > previous) lastProgress = performance.now();
      previous = audio.currentTime;
      // A late-starting but progressing cue gets its full playback duration.
      if (performance.now() - lastProgress >= 4000) {
        finish("failed", handle.error, "blocked-or-stalled");
        return;
      }
      handle.timer = setTimeout(check, 250);
    };
    handle.timer = setTimeout(check, 250);
  }
  return handle;
}

// Called only for the active scratch finger. Movement retries require its
// preceding native start, reuse the same player, and are limited to once/250ms.
export function retrySound(handle, event) {
  if (!event?.isTrusted || !["touchstart", "pointerdown", "touchmove", "pointermove"].includes(event.type) ||
      event.target?.closest?.(EXCLUDE)) return;
  attemptMediaSound(handle);
}

function attemptMediaSound(handle) {
  const pool = handle?.pool;
  if (pool?.backend !== "media" || pool.disposed || pool.handle !== handle || muted || !pool.visible ||
      pool.audio.muted || !pool.audio.paused) return;
  const now = performance.now();
  if (now - handle.lastRetry < 250) return;
  handle.lastRetry = now;
  const attempt = {};
  handle.attempt = attempt;
  try {
    const playing = pool.audio.play();
    Promise.resolve(playing).then(() => {
      if (pool.disposed || pool.handle !== handle) {
        if (!pool.handle) pool.audio.pause();
        return;
      }
      if (handle.attempt !== attempt) return;
      clearTimeout(handle.expiryTimer);
      handle.status = "playing";
      handle.error = null;
      handle.attempt = null;
    }, error => {
      if (pool.handle === handle && handle.attempt === attempt) {
        handle.error = error;
        handle.attempt = null;
      }
    });
  } catch (error) { handle.error = error; handle.attempt = null; }
}

function unavailablePool(error) {
  return { inactive: true, error, ready: Promise.resolve(false), disposed: false,
    dispose() { this.disposed = true; } };
}

function createMediaGroup(src, size, overflow, channel) {
  if (typeof src !== "string" || !/^data:audio\/[^;,]+;base64,[A-Za-z0-9+/]+={0,2}$/i.test(src)) {
    return unavailablePool(new Error("Short SFX require a nonempty Base64 audio import with ?inline."));
  }
  const payload = src.slice(src.indexOf(",") + 1);
  if (payload.length % 4 || payload.length > 8 * 1024 * 1024) {
    return unavailablePool(new Error("Invalid or oversized Base64 SFX payload."));
  }
  if (mediaPools.size + (shared?.slots || 0) + size > MAX_VOICES) {
    return unavailablePool(new Error("Shared SFX voice budget exceeded."));
  }
  const group = { backend: "media-group", voices: [], overflow, disposed: false, error: null };
  group.channel = channel ?? group;
  group.dispose = () => {
    if (group.disposed) return;
    group.disposed = true;
    for (const voice of group.voices) voice.dispose();
  };
  for (let i = 0; i < size; i++) {
    const voice = createMediaPool(src, overflow);
    voice.channel = group.channel;
    group.voices.push(voice);
    if (voice.error) {
      group.error = voice.error;
      group.dispose();
      break;
    }
  }
  group.ready = Promise.resolve(!group.error);
  return group;
}

function playMediaGroup(group, options) {
  if (group.error || muted || !group.voices.some(voice => voice.visible)) return null;
  if (options.gesture && (!options.gesture.isTrusted ||
      !["touchstart", "pointerdown"].includes(options.gesture.type) || options.gesture.target?.closest?.(EXCLUDE))) return null;
  if (options.gesture) {
    // Direct callers need the same all-pool priming as bindSoundGestures.
    handleUnlockGesture(options.gesture);
  }
  if (!group.voices.some(voice => voice.primed && voice.visible)) return null;
  for (const voice of mediaPools) {
    if (voice.channel === group.channel && (options.replace || voice.handle?.status === "pending")) voice.handle?.stop();
  }
  let voice = group.voices.find(item => !item.handle && item.visible);
  if (!voice) {
    if (group.overflow === "drop-new") return null;
    voice = group.voices.filter(item => item.visible).reduce((oldest, item) =>
      item.handle.requestedAt < oldest.handle.requestedAt ? item : oldest);
  }
  return playMediaSound(voice, options);
}
