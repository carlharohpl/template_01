import { useEffect, useLayoutEffect, useRef } from "react";
import cardPop from '../assets/sounds/pop1.mp3';
import correctMatch from '../assets/sounds/correct1.mp3';
import wrongMatch from '../assets/sounds/wrong3.mp3';
import gameWin from '../assets/sounds/gamewin5.mp3';
import rewardReveal from '../assets/sounds/gamewin2.mp3';

const registeredPools = [];
const primedElements = new WeakSet();
const pendingRetries = new Set();
const playbackVersions = new WeakMap();
let desktopUnlockListenerAdded = false;
let gesturePrimed = false;

// iPadOS 13+ reports as desktop Safari ("MacIntel") but is still a touch
// WebView needing the mobile priming/retry path â€” real Mac desktops report
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
  pendingRetries.forEach((retry) => {
    const { element, volume, version } = retry;
    if (playbackVersions.get(element) !== version) {
      pendingRetries.delete(retry);
      return;
    }
    element.currentTime = 0;
    element.volume = volume;
    element.muted = false;
    const promise = element.play();
    if (promise?.then) {
      promise.then(() => pendingRetries.delete(retry), () => {});
    } else {
      pendingRetries.delete(retry);
    }
  });
}

// Call from a draggable/interactive element's own gesture handlers (attach
// as a real DOM listener on the element itself, not only a React prop â€”
// some mobile WebViews require audio authorization on the touched element
// rather than through React's delegated events). Safe to call repeatedly
// (pointerdown, pointermove, pointerup) â€” already-primed elements are
// skipped, and it also retries any timer-delayed cue that was previously
// rejected, which is required for reliable drag-to-start audio on iOS/Android.
export function handleUnlockGesture(event) {
  if (event?.target?.closest?.('[data-cta]')) return;
  if (!gesturePrimed && event && !['pointerdown', 'touchstart', 'click'].includes(event.type)) return;
  gesturePrimed = true;
  primeAllRegisteredPools();
  flushPendingRetries();
}

function handleFirstPointerDown(event) {
  if (event.target?.closest?.('[data-cta]')) return;
  gesturePrimed = true;
  primeAllRegisteredPools();
  window.removeEventListener("pointerdown", handleFirstPointerDown);
  desktopUnlockListenerAdded = false;
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
    const pool = {
      elements: Array.from({ length: effectiveSize }, () => new Audio(src)),
      nextIndex: 0,
    };
    poolRef.current = pool;
    registeredPools.push(pool);
    ensureDesktopUnlockListener();
    return () => {
      pool.elements.forEach(stopSound);
      const index = registeredPools.indexOf(pool);
      if (index !== -1) registeredPools.splice(index, 1);
      if (poolRef.current === pool) poolRef.current = null;
      if (!registeredPools.length) {
        window.removeEventListener("pointerdown", handleFirstPointerDown);
        desktopUnlockListenerAdded = false;
      }
    };
  }, [src, effectiveSize]);

  return poolRef;
}

// Always play through this helper so playback resets to the beginning and
// picks an idle pool instance â€” never call .play() directly on a pool
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
  const version = playbackVersions.get(element);
  element.currentTime = 0;
  element.volume = volume;
  element.muted = false;

  const playPromise = element.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Blocked (e.g. a timer-delayed cue on mobile) â€” retried on the next
      // handleUnlockGesture() call during an active drag.
      if (playbackVersions.get(element) === version) {
        pendingRetries.add({ element, volume, version });
      }
    });
  }

  return element;
}

export function stopSound(source) {
  if (!source) return;
  playbackVersions.set(source, (playbackVersions.get(source) ?? 0) + 1);
  source.pause();
  pendingRetries.forEach(retry => {
    if (retry.element === source) pendingRetries.delete(retry);
  });
}

// Current gameplay cues share the existing unlock, pooling, and cleanup lifecycle.
export function useGameSounds(game, wrapperRef, onWinSoundEnded, onRewardSoundEnded) {
  const correctAudio = useSound(correctMatch);
  const wrongAudio = useSound(wrongMatch);
  const winAudio = useSound(gameWin);
  const rewardAudio = useSound(rewardReveal);
  const feedbackSource = useRef(null);
  const winStarted = useRef(false);
  const rewardStarted = useRef(false);
  const activePops = useRef(new Set());
  const soundPhase = game.phase === 'reward' ? 'reward-entering' : game.phase;
  useEffect(() => {
    const controls = wrapperRef.current?.querySelectorAll('[data-card-id]') ?? [];
    const events = ['pointerdown', 'pointermove', 'pointerup'];
    controls.forEach(control => events.forEach(type => control.addEventListener(type, handleUnlockGesture)));
    return () => controls.forEach(control => events.forEach(type => control.removeEventListener(type, handleUnlockGesture)));
  }, [wrapperRef]);

  useEffect(() => {
    if (soundPhase === 'complete') {
      stopSound(feedbackSource.current);
      activePops.current.forEach(audio => audio.pause());
      activePops.current.clear();
      return;
    }
    const pool = soundPhase === 'mismatch' ? wrongAudio : soundPhase === 'matched' ? correctAudio : soundPhase === 'won' ? winAudio : soundPhase === 'reward-entering' ? rewardAudio : null;
    if (!pool) return;
    if (soundPhase === 'reward-entering') {
      if (rewardStarted.current) return;
      rewardStarted.current = true;
    }
    if (soundPhase === 'won') {
      if (winStarted.current) return;
      winStarted.current = true;
      activePops.current.forEach(audio => audio.pause());
      activePops.current.clear();
    }
    stopSound(feedbackSource.current);
    feedbackSource.current = playSound(pool);
    if (soundPhase !== 'won' && soundPhase !== 'reward-entering') return;

    const source = feedbackSource.current;
    let settled = false;
    let fallback;
    let lastPlaybackTime = -1;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      source?.removeEventListener('ended', finish);
      source?.removeEventListener('error', finish);
      stopSound(source);
      if (soundPhase === 'won') onWinSoundEnded?.();
      else onRewardSoundEnded?.();
    };
    // Playback completion owns the handoff. The watchdog only releases failed/stalled audio.
    const checkPlayback = () => {
      if (source && !source.ended && !source.error && !source.paused && source.currentTime > lastPlaybackTime) {
        lastPlaybackTime = source.currentTime;
        const remaining = (source.duration - source.currentTime) * 1000;
        fallback = window.setTimeout(checkPlayback, Number.isFinite(remaining) ? Math.max(500, remaining + 500) : 1000);
      } else finish();
    };
    source?.addEventListener('ended', finish);
    source?.addEventListener('error', finish);
    fallback = window.setTimeout(checkPlayback, Number.isFinite(source?.duration) ? Math.max(2000, source.duration * 1000 + 1000) : 5000);
    if (source?.ended || source?.error) finish();
    return () => {
      settled = true;
      window.clearTimeout(fallback);
      source?.removeEventListener('ended', finish);
      source?.removeEventListener('error', finish);
    };
  }, [soundPhase, correctAudio, wrongAudio, winAudio, rewardAudio, onWinSoundEnded, onRewardSoundEnded]);

  useEffect(() => {
    const pops = activePops.current;
    return () => {
      pops.forEach(audio => audio.pause());
      pops.clear();
      stopSound(feedbackSource.current);
    };
  }, []);

  const playCardPop = () => {
    stopSound(feedbackSource.current);
    const audio = new Audio(cardPop);
    activePops.current.add(audio);
    const release = () => activePops.current.delete(audio);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    audio.play()?.catch(release);
  };

  return playCardPop;
}


