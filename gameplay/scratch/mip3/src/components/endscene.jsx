import { useCallback, useEffect, useRef, useState } from "react";
import { openDestination } from "./cta";
import background from "../assets/img/crumpled-paper.webp";
import endCardHtml from "../assets/endscene/endscene.html?endcard";

const endCardDocument = endCardHtml.replace(/<\/head>/i, `<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (error) {}
</script></head>`);

const EndScene = ({ onReady }) => {
  const [visible, setVisible] = useState(false);
  const revealedRef = useRef(false);
  const frameRef = useRef(null);
  const fallbackRef = useRef(null);
  const cancelledRef = useRef(false);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    window.clearTimeout(fallbackRef.current);
    setVisible(true);
    onReady?.();
  }, [onReady]);

  const scheduleReveal = useCallback(() => {
    if (cancelledRef.current || revealedRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (!cancelledRef.current) reveal();
      });
    });
  }, [reveal]);

  useEffect(() => {
    cancelledRef.current = false;
    fallbackRef.current = window.setTimeout(scheduleReveal, 1200);
    return () => {
      cancelledRef.current = true;
      window.clearTimeout(fallbackRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [scheduleReveal]);

  return (
    <section
      className={`end-scene-fade absolute inset-0 z-[80] overflow-hidden bg-[#dedede] ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="Memowrite offer"
      aria-hidden={!visible}
    >
      <img
        src={background}
        alt="Crumpled paper background"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
        draggable="false"
      />
      <iframe
        title="Memowrite offer"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full border-0"
        srcDoc={endCardDocument}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        onLoad={scheduleReveal}
      />
      <button
        type="button"
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-30 h-full w-full cursor-pointer touch-manipulation bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-black"
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openDestination();
        }}
      />
    </section>
  );
};

export default EndScene;
