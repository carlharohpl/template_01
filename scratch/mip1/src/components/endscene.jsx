import { useCallback, useEffect, useRef, useState } from "react";
import { openClickthrough } from "./cta";
import endSceneHtml from "../assets/endscene/endscene.html?raw";

// Supply the host's real bridge before the provided creative starts its runtime.
const bridgeScript = `<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
    window.clickTag1 = parent.clickTag1 || window.clickTag1;
    window.clickthrough = parent.clickthrough || window.clickthrough;
    window.clickThrough = parent.clickThrough || window.clickThrough;
  } catch (error) {}
</script>`;
const endSceneDocument = endSceneHtml.replace("</head>", `${bridgeScript}</head>`);

const EndScene = ({ onReady }) => {
  const [visible, setVisible] = useState(false);
  const revealedRef = useRef(false);
  const frameRef = useRef(null);
  const fallbackRef = useRef(null);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    window.clearTimeout(fallbackRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setVisible(true);
  }, []);

  const handleLoad = useCallback(() => {
    if (revealedRef.current || frameRef.current !== null) return;
    // Let the iframe paint before starting the crossfade and its sound.
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        reveal();
      });
    });
  }, [reveal]);

  useEffect(() => {
    fallbackRef.current = window.setTimeout(reveal, 1200);
    return () => {
      window.clearTimeout(fallbackRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [reveal]);

  useEffect(() => {
    if (!visible) return;
    onReady?.();
  }, [visible, onReady]);

  return (
    <section
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden bg-[#46010B] ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="Musely end scene"
      aria-hidden={!visible}
    >
      <iframe
        srcDoc={endSceneDocument}
        title="Musely exclusive offer"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay"
        tabIndex={-1}
        onLoad={handleLoad}
      />
      <button
        type="button"
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4"
        onClick={(event) => {
          event.stopPropagation();
          openClickthrough();
        }}
      />
    </section>
  );
};

export default EndScene;
