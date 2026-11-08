import { useCallback, useEffect, useRef, useState } from "react";
import { Cta, openDestination } from "./cta";
import useSound, { playSound, stopSound } from "../hooks/useSound";
import endSound from "../assets/sounds/endscene1.mp3?inline";
import endSceneHtml from "../assets/endscene/simplydraw_acslanot_sip_20261026_05_emily_product_pop_human_dt_none.html?endcard";

const EndScene = ({ active = false, onReady }) => {
  // Prepare with gameplay so the first native gesture also unlocks this later cue.
  const soundPool = useSound(endSound, { backend: "web", poolSize: 1, overflow: "drop-new" });
  const soundHandleRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const iframeRef = useRef(null);
  const sectionRef = useRef(null);
  const layoutCleanupRef = useRef(null);
  const syncLayoutRef = useRef(null);
  const frameRef = useRef(null);
  const fallbackRef = useRef(null);
  const revealedRef = useRef(false);
  const notifiedRef = useRef(false);
  const syncMediaRef = useRef(null);
  const mediaReadyCleanupRef = useRef(null);

  const handleLoad = useCallback(() => {
    syncMediaRef.current?.();
    syncLayoutRef.current?.();
    if (!active || revealedRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (revealedRef.current) return;
        revealedRef.current = true;
        clearTimeout(fallbackRef.current);
        setVisible(true);
      });
    });
  }, [active]);

  const handleFrameLoad = useCallback(() => {
    mediaReadyCleanupRef.current?.();
    layoutCleanupRef.current?.();
    syncMediaRef.current?.();
    const frameWindow = iframeRef.current?.contentWindow;
    frameWindow?.__mipUseParentCta?.();
    const syncLayout = () => {
      const root = iframeRef.current?.contentDocument?.documentElement;
      const section = sectionRef.current;
      if (!root || !section) return;
      section.style.setProperty("--end-left", root.style.getPropertyValue("--art-left") || "0px");
      section.style.setProperty("--end-top", root.style.getPropertyValue("--art-top") || "0px");
      section.style.setProperty("--end-scale", root.style.getPropertyValue("--art-scale") || "1");
    };
    syncLayoutRef.current = syncLayout;
    frameWindow?.addEventListener("challenge-layout", syncLayout);
    layoutCleanupRef.current = () => {
      frameWindow?.removeEventListener("challenge-layout", syncLayout);
      syncLayoutRef.current = null;
      layoutCleanupRef.current = null;
    };
    syncLayout();
    const video = iframeRef.current?.contentDocument?.querySelector("video");
    let cancelled = false;
    const settle = () => {
      video?.removeEventListener("loadeddata", settle);
      video?.removeEventListener("error", settle);
      Promise.resolve(frameWindow?.__mipTextReady).then(() => {
        if (!cancelled) handleLoad();
      });
    };
    mediaReadyCleanupRef.current = () => {
      cancelled = true;
      video?.removeEventListener("loadeddata", settle);
      video?.removeEventListener("error", settle);
      mediaReadyCleanupRef.current = null;
    };
    if (!video || video.readyState >= 2 || video.error) settle();
    else {
      video.addEventListener("loadeddata", settle);
      video.addEventListener("error", settle);
    }
  }, [handleLoad]);

  useEffect(() => {
    if (!active) return;
    fallbackRef.current = setTimeout(handleLoad, 1200);
    return () => {
      mediaReadyCleanupRef.current?.();
      layoutCleanupRef.current?.();
      clearTimeout(fallbackRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, handleLoad]);

  useEffect(() => {
    if (!active || !visible || notifiedRef.current) return;
    notifiedRef.current = true;
    soundHandleRef.current = playSound(soundPool, { volume: 0.85, pendingMs: 1500 });
    onReady?.();
  }, [active, visible, onReady, soundPool]);

  useEffect(() => () => stopSound(soundHandleRef.current), []);

  useEffect(() => {
    if (!active) return;
    let hostVisible = true;
    let pageHidden = false;
    let listening = true;
    let removeViewable = null;
    const sync = () => {
      if (!listening) return;
      try {
        const viewable = !document.hidden && !pageHidden && hostVisible;
        iframeRef.current?.contentWindow?.__mipSetViewable?.(viewable);
        iframeRef.current?.contentDocument?.querySelectorAll("video, audio").forEach(media => {
          if (!viewable) media.pause();
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
      listening = false;
      syncMediaRef.current = null;
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      if (removeViewable) { try { removeViewable(); } catch { /* Host disposed. */ } }
    };
  }, [active]);

  if (!active) return null;
  return (
    <section
      ref={sectionRef}
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="End scene"
      aria-hidden={!visible}
      inert={!visible}
      data-started={visible}
    >
      <iframe
        ref={iframeRef}
        srcDoc={endSceneHtml}
        title="Offer"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        onLoad={handleFrameLoad}
      />
      <Cta scene="end" />
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
