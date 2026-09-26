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
const bridgedHtml = /* @__PURE__ */ endSceneHtml.replace(/<\/head\s*>/i, `${bridgeScript}</head>`);

const EndScene = ({ active, onReady }) => {
  // Mount the pool before the spin tap so that gesture can prime this delayed cue.
  const soundPool = useSound(endSceneSound);
  const soundRef = useRef(null);
  const viewableRef = useRef(true);
  const iframeRef = useRef(null);
  const revealedRef = useRef(false);
  const framesRef = useRef([]);
  const mediaCleanupRef = useRef(null);
  const endSoundPlayedRef = useRef(false);
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
    };
  }, [active, revealAfterPaint]);

  const handleLoad = useCallback(() => {
    mediaCleanupRef.current?.();
    const video = iframeRef.current?.contentDocument?.querySelector("video");
    if (!video || video.readyState >= 2) {
      revealAfterPaint();
      return;
    }
    // A loaded HTML document can still be waiting for its first video frame.
    video.addEventListener("loadeddata", revealAfterPaint, { once: true });
    mediaCleanupRef.current = () => video.removeEventListener("loadeddata", revealAfterPaint);
  }, [revealAfterPaint]);

  useEffect(() => {
    if (!visible || endSoundPlayedRef.current) return;
    endSoundPlayedRef.current = true;
    if (!document.hidden && viewableRef.current) {
      soundRef.current = playSound(soundPool);
    }
  }, [visible, soundPool]);

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
      aria-label="Laura Geller special offer"
      aria-hidden={!visible}
      inert={!visible}
      className={`absolute inset-0 z-[100] h-dvh w-full overflow-hidden end-scene-fade ${visible ? "is-visible" : "pointer-events-none"}`}
    >
      <iframe
        ref={iframeRef}
        title="Laura Geller special offer"
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
