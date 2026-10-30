import { useCallback, useEffect, useRef, useState } from "react";
import { openDestination } from "./cta";
import defaultHtml from "../Assets/endscene/endscenedefault.html?endcard";
import dhHtml from "../Assets/endscene/endscene_dh.html?endcard";

const bridgeScript = `
<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (error) {}
</script>`;
const documents = {
  default: defaultHtml.replace("</head>", bridgeScript + "</head>"),
  dh: dhHtml.replace("</head>", bridgeScript + "</head>"),
};

export default function EndScene({ variant = "default", onReady }) {
  const buttonRef = useRef(null);
  const loaded = useRef(false);
  const revealed = useRef(false);
  const scheduleReveal = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;
    let frame1;
    let frame2;
    const reveal = () => {
      if (cancelled || scheduled || revealed.current) return;
      scheduled = true;
      clearTimeout(fallback);
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (cancelled) return;
          revealed.current = true;
          setVisible(true);
          onReady?.();
        });
      });
    };
    const fallback = window.setTimeout(reveal, 1200);
    scheduleReveal.current = reveal;
    if (loaded.current) reveal();
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      scheduleReveal.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    if (visible) buttonRef.current?.focus({ preventScroll: true });
  }, [visible]);

  const handleLoad = useCallback(() => {
    loaded.current = true;
    scheduleReveal.current?.();
  }, []);

  const handleClick = useCallback(event => {
    event.stopPropagation();
    openDestination();
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] h-dvh w-full end-scene-fade ${visible ? "is-visible" : ""}`}
      data-end-card={variant}
      aria-hidden={!visible}
    >
      <iframe
        title="Jones Road offer"
        srcDoc={documents[variant]}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-transparent"
        tabIndex={-1}
        onLoad={handleLoad}
      />
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open offer"
        disabled={!visible}
        className="pointer-events-auto absolute inset-0 z-30 h-full w-full cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-white disabled:pointer-events-none"
        onClick={handleClick}
      />
    </div>
  );
}
