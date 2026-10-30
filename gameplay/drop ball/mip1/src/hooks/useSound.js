import { useCallback, useEffect, useMemo, useRef } from 'react'

let iosAudioContext = null
let iosAudioUsers = 0
let previousAudioSessionType = null

function retryPendingAudio(retries, volume) {
  for (const [audio, request] of retries) {
    if (!request.pending) continue
    const retry = { pending: false }
    retries.set(audio, retry)
    audio.muted = false
    audio.volume = volume
    audio.play()?.then(() => {
      if (retries.get(audio) === retry) retries.delete(audio)
    }, () => {
      if (retries.get(audio) === retry) retry.pending = true
    })
  }
}

function createIOSSound(src, volume, isViewable) {
  iosAudioUsers++
  // Vite supplies embedded audio in development and production; no runtime requests.
  let bytes = null
  try {
    if (/^data:audio\/[^,]+;base64,/.test(src)) {
      const binary = atob(src.slice(src.indexOf(',') + 1))
      bytes = Uint8Array.from(binary, character => character.charCodeAt(0)).buffer
    }
  } catch { /* Invalid audio must not block gameplay. */ }
  let disposed = false
  let pending = false
  let buffer = null
  let decoding = null
  let context = null
  let gain = null
  let activeSource = null
  let playback = null
  let startedAt = null
  let finished = false

  const stopSource = () => {
    if (!activeSource) return
    activeSource.onended = null
    try { activeSource.stop() } catch { /* The source has already ended. */ }
    activeSource.disconnect()
    activeSource = null
  }
  const flush = () => {
    if (disposed || !pending || !buffer || !isViewable() || context?.state !== 'running') return
    pending = false
    stopSource()
    if (!gain) {
      gain = context.createGain()
      gain.gain.value = volume
      gain.connect(context.destination)
    }
    // AudioBuffer is reused; each one-shot needs a fresh, lightweight source node.
    const source = context.createBufferSource()
    const ticket = playback
    source.buffer = buffer
    source.connect(gain)
    activeSource = source
    source.onended = () => {
      source.disconnect()
      if (activeSource === source) {
        finished = true
        activeSource = null
        ticket?.dispatchEvent(new Event('ended'))
      }
    }
    startedAt = context.currentTime
    source.start()
  }
  const contextChanged = () => {
    if (context?.state === 'running') flush()
    else stopSource()
  }
  const prepare = () => {
    if (buffer || decoding || !context || disposed) return
    const decodingContext = context
    decoding = Promise.resolve(bytes).then(data => {
      if (!data || disposed || decodingContext.state === 'closed') return null
      return decodingContext.decodeAudioData(data.slice(0))
    }).then(decoded => {
      if (disposed) return
      buffer = decoded
      flush()
    }).catch(() => {}).finally(() => { decoding = null })
  }
  const resume = () => {
    if (!context || disposed || !isViewable()) return
    if (context.state !== 'running') context.resume().then(flush).catch(() => {})
    prepare()
    flush()
  }
  const stop = () => {
    pending = false
    stopSource()
  }
  return {
    unlock() {
      if (disposed || !isViewable()) return
      // This method runs directly in the native gameplay gesture listener.
      if (!iosAudioContext || iosAudioContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        try {
          iosAudioContext = new AudioContextClass({ latencyHint: 'interactive' })
        } catch { return }
        try {
          if (navigator.audioSession) {
            previousAudioSessionType = navigator.audioSession.type
            navigator.audioSession.type = 'playback'
          }
        } catch { /* Older Safari versions do not expose session configuration. */ }
      }
      if (context !== iosAudioContext) {
        context?.removeEventListener('statechange', contextChanged)
        context = iosAudioContext
        context.addEventListener('statechange', contextChanged)
      }
      resume()
    },
    play({ restart = true } = {}) {
      if (disposed || !isViewable() || (!restart && activeSource)) return
      stop()
      startedAt = null
      finished = false
      const ticket = new EventTarget()
      Object.defineProperties(ticket, {
        currentTime: { get: () => startedAt === null ? 0 : Math.min(context.currentTime - startedAt, buffer?.duration ?? Infinity) },
        duration: { get: () => buffer?.duration ?? NaN },
        ended: { get: () => finished },
      })
      ticket.pause = () => { if (playback === ticket) stop() }
      playback = ticket
      pending = true
      resume()
      return ticket
    },
    stop,
    resume,
    dispose() {
      disposed = true
      stop()
      context?.removeEventListener('statechange', contextChanged)
      gain?.disconnect()
      buffer = null
      bytes = null
      iosAudioUsers--
      if (iosAudioUsers === 0 && iosAudioContext) {
        const closingContext = iosAudioContext
        iosAudioContext = null
        closingContext.close().catch(() => {})
        try {
          if (previousAudioSessionType !== null && navigator.audioSession?.type === 'playback') {
            navigator.audioSession.type = previousAudioSessionType
          }
        } catch { /* Session configuration may be unavailable during teardown. */ }
        previousAudioSessionType = null
      }
    },
  }
}

export const useSound = (src, volume = 0.7, voiceCount = 1) => {
  const audioRefs = useRef([])
  const activeVoicesRef = useRef(new Set())
  const nextVoiceRef = useRef(0)
  const unlockedRef = useRef(false)
  const viewableRef = useRef(!document.hidden && window.__mraidViewable !== false)
  const iosSoundRef = useRef(null)
  const retriesRef = useRef(new Map())
  const gestureSeen = useRef(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (isIOS && (window.AudioContext || window.webkitAudioContext)) {
      const sound = createIOSSound(src, volume, () => viewableRef.current)
      iosSoundRef.current = sound
      const viewability = () => {
        viewableRef.current = !document.hidden && window.__mraidViewable !== false
        if (viewableRef.current) sound.resume()
        else sound.stop()
      }
      document.addEventListener('visibilitychange', viewability)
      window.addEventListener('mraidViewableChange', viewability)
      return () => {
        document.removeEventListener('visibilitychange', viewability)
        window.removeEventListener('mraidViewableChange', viewability)
        sound.dispose()
        iosSoundRef.current = null
      }
    }
    const activeVoices = activeVoicesRef.current
    const retries = retriesRef.current
    const audios = Array.from({ length: voiceCount }, (_, index) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = volume
      audio.addEventListener('ended', () => activeVoices.delete(index))
      return audio
    })
    audioRefs.current = audios

    const handleViewableChange = (event) => {
      viewableRef.current = event.detail?.viewable !== false
      if (viewableRef.current) return

      audios.forEach((audio) => audio.pause())
      retries.clear()
      activeVoices.clear()
    }
    window.addEventListener('mraidViewableChange', handleViewableChange)

    return () => {
      window.removeEventListener('mraidViewableChange', handleViewableChange)
      audios.forEach((audio) => audio.pause())
      retries.clear()
      activeVoices.clear()
      audioRefs.current = []
    }
  }, [src, voiceCount, volume])

  const play = useCallback(({ restart = true } = {}) => {
    if (iosSoundRef.current) return iosSoundRef.current.play({ restart })
    if (!viewableRef.current) return

    const audios = audioRefs.current
    if (!audios.length) return

    let voiceIndex = audios.findIndex((_, index) => !activeVoicesRef.current.has(index))
    if (voiceIndex === -1 && !restart) return
    if (voiceIndex === -1) voiceIndex = nextVoiceRef.current % audios.length
    nextVoiceRef.current = (voiceIndex + 1) % audios.length

    const audio = audios[voiceIndex]
    const request = { pending: false }
    retriesRef.current.set(audio, request)
    audio.cancelPlayback = () => retriesRef.current.delete(audio)
    activeVoicesRef.current.add(voiceIndex)
    audio.muted = false
    audio.volume = volume
    const alreadyPlaying = !audio.paused && !audio.ended
    if (audio.currentTime !== 0) audio.currentTime = 0
    // Rewind the live instance without repeatedly stopping and starting its media pipeline.
    if (alreadyPlaying) { retriesRef.current.delete(audio); return audio }
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (retriesRef.current.get(audio) === request) retriesRef.current.delete(audio)
      }, () => {
        if (retriesRef.current.get(audio) === request) request.pending = true
      })
    }
    return audio
  }, [volume])

  const unlock = useCallback((event) => {
    if (event && !['pointerdown', 'touchstart', 'click', 'keydown'].includes(event.type) && !gestureSeen.current) return
    gestureSeen.current = true
    if (iosSoundRef.current) return iosSoundRef.current.unlock()
    if (!viewableRef.current) return

    const audios = audioRefs.current
    if (!audios.length) return
    if (!unlockedRef.current) audios.forEach((audio) => {
      audio.muted = true
      audio.volume = 0
      audio.currentTime = 0
      const playPromise = audio.play()

      // iOS requires the pause to happen synchronously in this same gesture.
      audio.pause()
      audio.currentTime = 0
      audio.volume = volume
      audio.muted = false

      if (playPromise !== undefined) playPromise.catch(() => {})
    })
    unlockedRef.current = true
    retryPendingAudio(retriesRef.current, volume)
  }, [volume])

  const stop = useCallback(() => {
    if (iosSoundRef.current) return iosSoundRef.current.stop()
    audioRefs.current.forEach(audio => {
      if (!audio.paused) audio.pause()
      if (audio.currentTime !== 0) audio.currentTime = 0
    })
    activeVoicesRef.current.clear()
    retriesRef.current.clear()
  }, [])

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (mobile) return
    const desktopUnlock = event => {
      if (!event.target?.closest?.('[data-cta]')) unlock(event)
    }
    window.addEventListener('pointerdown', desktopUnlock)
    return () => window.removeEventListener('pointerdown', desktopUnlock)
  }, [unlock])

  return useMemo(() => ({ play, unlock, stop }), [play, unlock, stop])
}

export function stopSound(source) {
  source?.cancelPlayback?.();
  source?.pause();
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
