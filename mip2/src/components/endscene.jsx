import { useCallback, useEffect, useRef, useState } from "react";
import { openDestination } from "./cta";

// Replace this inactive value with the supplied .html?endcard import when available.
// Internal offer buttons must call parent.__mip.activateDestination().
const endSceneHtml = null;

const EndScene = ({ onReady }) => {
  const [visible, setVisible] = useState(false);
  const iframeRef = useRef(null);
  const frameRef = useRef(null);
  const fallbackRef = useRef(null);
  const revealedRef = useRef(false);
  const notifiedRef = useRef(false);
  const syncMediaRef = useRef(null);

  const handleLoad = useCallback(() => {
    syncMediaRef.current?.();
    if (!endSceneHtml || revealedRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (revealedRef.current) return;
        revealedRef.current = true;
        clearTimeout(fallbackRef.current);
        setVisible(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!endSceneHtml) return;
    fallbackRef.current = setTimeout(handleLoad, 1200);
    return () => {
      clearTimeout(fallbackRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [handleLoad]);

  useEffect(() => {
    if (!visible || notifiedRef.current) return;
    notifiedRef.current = true;
    onReady?.();
  }, [visible, onReady]);

  useEffect(() => {
    if (!endSceneHtml) return;
    let hostVisible = true;
    let pageHidden = false;
    let active = true;
    let removeViewable = null;
    const sync = () => {
      if (!active) return;
      try {
        iframeRef.current?.contentDocument?.querySelectorAll("video, audio").forEach(media => {
          if (document.hidden || pageHidden || !hostVisible) media.pause();
          else if (media.tagName === "VIDEO" && media.autoplay) media.play()?.catch(() => {});
        });
      } catch { /* A supplied cross-origin frame may not expose its media. */ }
    };
    const hide = () => { pageHidden = true; sync(); };
    const show = () => { pageHidden = false; sync(); };
    const viewable = value => { hostVisible = Boolean(value); sync(); };
    syncMediaRef.current = sync;
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    try {
      if (typeof window.mraid?.isViewable === "function") hostVisible = Boolean(window.mraid.isViewable());
      if (typeof window.mraid?.addEventListener === "function" && typeof window.mraid?.removeEventListener === "function") {
        removeViewable = window.mraid.removeEventListener.bind(window.mraid, "viewableChange", viewable);
        window.mraid.addEventListener("viewableChange", viewable);
      }
    } catch { /* Browser without host lifecycle support. */ }
    sync();
    return () => {
      active = false;
      syncMediaRef.current = null;
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      if (removeViewable) { try { removeViewable(); } catch { /* Host disposed. */ } }
    };
  }, []);

  if (!endSceneHtml) return null;
  return (
    <section
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="End scene"
      aria-hidden={!visible}
    >
      <iframe
        ref={iframeRef}
        srcDoc={endSceneHtml}
        title="Offer"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        onLoad={handleLoad}
      />
      <button
        type="button"
        data-sfx-exclude=""
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-30 h-full w-full cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4"
        onClick={event => {
          event.stopPropagation();
          openDestination();
        }}
      />
    </section>
  );
};

export default EndScene;
