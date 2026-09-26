import { useCallback, useEffect, useRef, useState } from "react";
import endSceneHtml from "../assets/endscene/endscene.html?raw";
import { openClickthrough } from "./cta";
import useSound, { playSound, stopSound } from "../hooks/useSound";
import endSceneSound from "../assets/sounds/endscene1.mp3";

// Preserve the supplied HTML; only bridge the parent ad host into its iframe.
const bridgeScript = `
<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
    window.clickTag1 = parent.clickTag1 || window.clickTag1;
    window.clickthrough = parent.clickthrough || window.clickthrough;
    window.clickThrough = parent.clickThrough || window.clickThrough;
  } catch (error) {}
</script>`;
const bridgedHtml = endSceneHtml.replace(/<\/head\s*>/i, `${bridgeScript}</head>`);
// Start the offer cue at the requested point in the original videos.
const OFFER_REVEAL_SECONDS = 3;

const EndScene = ({ active, onReady }) => {
  // Mount the pool before the spin tap so that gesture can prime this delayed cue.
  const soundPool = useSound(endSceneSound);
  const soundRef = useRef(null);
  const viewableRef = useRef(true);
  const iframeRef = useRef(null);
  const revealedRef = useRef(false);
  const framesRef = useRef([]);
  const mediaCleanupRef = useRef(null);
  const audioCleanupRef = useRef(null);
  const offerSoundPlayedRef = useRef(false);
  const fallbackRef = useRef(null);
  const [visible, setVisible] = useState(false);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    window.clearTimeout(fallbackRef.current);
    mediaCleanupRef.current?.();
    setVisible(true);
    onReady?.();
  }, [onReady]);

  const revealAfterPaint = useCallback(() => {
    if (revealedRef.current) return;
    framesRef.current.forEach(cancelAnimationFrame);
    framesRef.current = [requestAnimationFrame(() => {
      framesRef.current.push(requestAnimationFrame(reveal));
    })];
  }, [reveal]);

  useEffect(() => {
    if (!active) return;
    // Some ad hosts suppress iframe load/media events; keep a bounded fallback.
    fallbackRef.current = window.setTimeout(revealAfterPaint, 1200);
    return () => {
      window.clearTimeout(fallbackRef.current);
      framesRef.current.forEach(cancelAnimationFrame);
      mediaCleanupRef.current?.();
      audioCleanupRef.current?.();
    };
  }, [active, revealAfterPaint]);

  const handleLoad = useCallback(() => {
    mediaCleanupRef.current?.();
    audioCleanupRef.current?.();
    const video = iframeRef.current?.contentDocument?.querySelector("video");
    if (video) {
      // Follow media time so buffering, pauses, and orientation changes stay in sync.
      const syncOfferSound = () => {
        if (
          offerSoundPlayedRef.current ||
          !revealedRef.current ||
          document.hidden ||
          !viewableRef.current ||
          video.paused ||
          video.seeking ||
          video.currentTime < OFFER_REVEAL_SECONDS
        ) return;
        offerSoundPlayedRef.current = true;
        soundRef.current = playSound(soundPool);
      };
      const events = ["timeupdate", "playing", "seeked"];
      events.forEach((event) => video.addEventListener(event, syncOfferSound));
      audioCleanupRef.current = () => {
        events.forEach((event) => video.removeEventListener(event, syncOfferSound));
      };
      syncOfferSound();
    }
    if (!video || video.readyState >= 2) {
      revealAfterPaint();
      return;
    }
    // A loaded HTML document can still be waiting for its first video frame.
    video.addEventListener("loadeddata", revealAfterPaint, { once: true });
    mediaCleanupRef.current = () => video.removeEventListener("loadeddata", revealAfterPaint);
  }, [revealAfterPaint, soundPool]);

  useEffect(() => {
    const stopAudio = () => {
      stopSound(soundRef.current);
      soundRef.current = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) stopAudio();
    };
    const onViewableChange = (viewable) => {
      viewableRef.current = Boolean(viewable);
      if (!viewable) stopAudio();
    };
    const mraid = window.mraid;
    try {
      viewableRef.current = mraid?.isViewable?.() ?? true;
    } catch {
      // Keep the default for preview bridges without viewability support.
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    mraid?.addEventListener?.("viewableChange", onViewableChange);
    return () => {
      stopAudio();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      mraid?.removeEventListener?.("viewableChange", onViewableChange);
    };
  }, []);

  if (!active) return null;

  return (
    <section
      aria-label="Prose special offer"
      aria-hidden={!visible}
      inert={!visible}
      className={`absolute inset-0 z-[100] h-dvh w-full overflow-hidden end-scene-fade ${visible ? "is-visible" : "pointer-events-none"}`}
    >
      <iframe
        ref={iframeRef}
        title="Prose special offer"
        srcDoc={bridgedHtml}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full border-0"
        onLoad={handleLoad}
      />
      <button
        type="button"
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[#4D523C]"
        onClick={(event) => {
          event.stopPropagation();
          openClickthrough();
        }}
      />
    </section>
  );
};

export default EndScene;
