import { useCallback, useEffect, useRef, useState } from "react";
import endSceneHtml from "../assets/endscene/endscene.html?endcard";
import { openDestination } from "./cta";

// Preserve the supplied document; only forward the host's ad-network globals.
const bridgeScript = `
<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (error) {}
</script>`;
const bridgedHtml = endSceneHtml.replace("</head>", `${bridgeScript}</head>`);

export default function EndScene({ onReady }) {
  const [visible, setVisible] = useState(false);
  const revealed = useRef(false);
  const readySent = useRef(false);
  const fallback = useRef(null);
  const frames = useRef([]);
  const mounted = useRef(false);
  const scheduled = useRef(false);

  const reveal = useCallback(() => {
    if (!mounted.current || revealed.current) return;
    revealed.current = true;
    window.clearTimeout(fallback.current);
    setVisible(true);
  }, []);

  const scheduleReveal = useCallback(() => {
    if (!mounted.current || revealed.current || scheduled.current) return;
    scheduled.current = true;
    window.clearTimeout(fallback.current);
    frames.current.push(requestAnimationFrame(() => {
      frames.current.push(requestAnimationFrame(reveal));
    }));
  }, [reveal]);

  useEffect(() => {
    mounted.current = true;
    scheduled.current = false;
    fallback.current = window.setTimeout(scheduleReveal, 1200);
    const pendingFrames = frames.current;
    return () => {
      mounted.current = false;
      window.clearTimeout(fallback.current);
      pendingFrames.forEach(cancelAnimationFrame);
    };
  }, [scheduleReveal]);

  useEffect(() => {
    if (!visible || readySent.current) return;
    readySent.current = true;
    onReady?.();
  }, [visible, onReady]);

  return (
    <section
      aria-label="End scene"
      data-end-scene="provided"
      className={`end-scene-fade absolute inset-0 z-[100] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
    >
      <iframe
        title="Liquid I.V. end scene"
        srcDoc={bridgedHtml}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        tabIndex={-1}
        onLoad={scheduleReveal}
      />
      <button
        type="button"
        data-cta=""
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-30 h-full w-full touch-manipulation cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openDestination();
        }}
      />
    </section>
  );
}

