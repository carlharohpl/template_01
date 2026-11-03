import { useCallback, useEffect, useRef, useState } from "react";
import sipHtml from "../assets/endcard/sip-date-20260804-1511.html?endcard";
import { playSound, stopSound } from "../hooks/useSound";
import { openDestination } from "./cta";

export default function EndScene({ soundPool, onReady }) {
  const [visible, setVisible] = useState(false);
  const scheduler = useRef(null);
  const frameRef = useRef(null);
  const loadedRef = useRef(false);
  const unregisterMedia = useRef(null);
  useEffect(() => {
    let scheduled = false;
    let disposed = false;
    let first;
    let second;
    let cue;
    let fadeTimer;
    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          if (disposed) return;
          setVisible(true);
          cue = playSound(soundPool, { volume: 0.3 });
          fadeTimer = setTimeout(onReady, 500);
        });
      });
    };
    scheduler.current = schedule;
    if (loadedRef.current) schedule();
    const fallback = setTimeout(schedule, 1200);
    return () => {
      disposed = true;
      scheduler.current = null;
      clearTimeout(fallback);
      clearTimeout(fadeTimer);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      stopSound(cue);
      unregisterMedia.current?.();
      unregisterMedia.current = null;
    };
  }, [soundPool, onReady]);
  const loaded = useCallback(() => {
    loadedRef.current = true;
    unregisterMedia.current?.();
    try { unregisterMedia.current = window.__mip.registerMediaDocument(frameRef.current.contentDocument); } catch { /* Isolated host. */ }
    scheduler.current?.();
  }, []);
  return (
    <div className={`absolute inset-0 z-40 h-full w-full end-scene-fade ${visible ? "is-visible" : ""}`} inert={!visible}>
      <iframe
        ref={frameRef}
        srcDoc={sipHtml}
        title="End Scene"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="absolute inset-0 h-full w-full border-0 bg-transparent"
        onLoad={loaded}
      />
      <button
        type="button"
        aria-label="Open offer"
        data-sfx-exclude=""
        className="absolute inset-0 z-30 h-full w-full cursor-pointer bg-transparent focus-visible:outline-2"
        onClick={event => { event.stopPropagation(); openDestination(); }}
      />
    </div>
  );
}
