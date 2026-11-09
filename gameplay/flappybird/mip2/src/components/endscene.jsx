import { useCallback, useEffect, useRef, useState } from "react";
import endSceneHtml from "../assets/endscene/spotminders_acslanot_sip_20261022_05_ecomm_product_infographic_human_none_none.html?endcard";
import { openDestination } from "./cta";

export default function EndScene({ onReady }) {
  const [visible, setVisible] = useState(false);
  const frameRef = useRef(null);
  const prepareRef = useRef(null);
  const notifiedRef = useRef(false);
  const handleLoad = useCallback(() => prepareRef.current?.(), []);

  useEffect(() => {
    let active = true;
    let scheduled = false;
    let firstFrame;
    let secondFrame;
    let video;
    let unregister;
    const reveal = () => {
      if (!active || scheduled) return;
      scheduled = true;
      clearTimeout(fallback);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => { if (active) setVisible(true); });
      });
    };
    const prepare = () => {
      try {
        const doc = frameRef.current?.contentDocument;
        unregister?.();
        unregister = doc && window.__mip.registerMediaDocument?.(doc);
        video = doc?.querySelector("video");
        if (!video || video.readyState >= 2) reveal();
        else {
          video.addEventListener("loadeddata", reveal, { once: true });
          video.addEventListener("error", reveal, { once: true });
        }
      } catch { reveal(); }
    };
    const fallback = setTimeout(reveal, 1200);
    prepareRef.current = prepare;
    if (frameRef.current?.contentDocument?.readyState === "complete" && frameRef.current.contentDocument.body?.children.length) prepare();
    return () => {
      active = false;
      prepareRef.current = null;
      clearTimeout(fallback);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      video?.removeEventListener("loadeddata", reveal);
      video?.removeEventListener("error", reveal);
      unregister?.();
    };
  }, []);

  useEffect(() => {
    if (visible && !notifiedRef.current) { notifiedRef.current = true; onReady?.(); }
  }, [visible, onReady]);

  return (
    <section
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="Spotminders offer"
      aria-hidden={!visible}
    >
      <iframe
        ref={frameRef}
        srcDoc={endSceneHtml}
        title="Spotminders end scene"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        onLoad={handleLoad}
      />
      <button
        type="button"
        aria-label="Open offer"
        data-sfx-exclude=""
        disabled={!visible}
        className="absolute inset-0 z-30 h-full w-full cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-4 focus-visible:-outline-offset-4"
        onClick={event => { event.stopPropagation(); openDestination(); }}
      />
    </section>
  );
}
