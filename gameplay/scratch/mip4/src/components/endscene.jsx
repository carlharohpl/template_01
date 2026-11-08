import { useCallback, useEffect, useRef, useState } from "react";
import { openDestination } from "./cta";

import endSceneHtml from "../assets/endscene/xoravelyza_acslanot_sip_20261029_03_adsmanager_product_checkoutcart_human_dt_christmas.html?endcard";

const EndScene = ({ active = true, onReady }) => {
  const [visible, setVisible] = useState(false);
  const revealedRef = useRef(false);
  const notifiedRef = useRef(false);
  const iframeRef = useRef(null);
  const mediaCleanupRef = useRef(null);
  const frameRef = useRef(null);
  const fallbackRef = useRef(null);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    clearTimeout(fallbackRef.current);
    frameRef.current = null;
    setVisible(true);
  }, []);

  const scheduleReveal = useCallback(() => {
    if (!active || revealedRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(reveal);
    });
  }, [active, reveal]);

  const handleLoad = useCallback(() => {
    mediaCleanupRef.current?.();
    const child = iframeRef.current?.contentWindow;
    const video = child?.document.querySelector("video");
    child?.__sipSetViewable?.(active && !document.hidden);
    if (video?.readyState >= 2) scheduleReveal();
    else if (!video) return;
    else {
      video.addEventListener("loadeddata", scheduleReveal, { once: true });
      mediaCleanupRef.current = () => video.removeEventListener("loadeddata", scheduleReveal);
    }
  }, [active, scheduleReveal]);

  useEffect(() => {
    const child = iframeRef.current?.contentWindow;
    child?.__sipSetViewable?.(active && !document.hidden);
    if (!active) return;
    handleLoad();
    fallbackRef.current = setTimeout(scheduleReveal, 1200);
    return () => {
      clearTimeout(fallbackRef.current);
      mediaCleanupRef.current?.();
      child?.__sipSetViewable?.(false);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, handleLoad, scheduleReveal]);

  useEffect(() => {
    if (!visible || !active || notifiedRef.current) return;
    notifiedRef.current = true;
    onReady?.();
  }, [visible, active, onReady]);

  return (
    <section
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden bg-[#1c493b] ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="Xoravelyza offer"
      aria-hidden={!visible}
    >
      {endSceneHtml && (
        <iframe
          ref={iframeRef}
          srcDoc={endSceneHtml}
          title="Xoravelyza offer"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay"
          tabIndex={-1}
          onLoad={handleLoad}
        />
      )}
      <button
        type="button"
        data-sfx-exclude=""
        aria-label="Open offer"
        disabled={!visible || !active}
        className="absolute inset-0 z-30 h-full w-full cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4"
        onClick={(event) => { event.stopPropagation(); openDestination(); }}
      />
    </section>
  );
};

export default EndScene;
