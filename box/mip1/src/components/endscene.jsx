import { useEffect, useRef, useState } from "react";
import useSound, { playSound, stopSound } from "../hooks/useSound";
import { openDestination } from "./cta";
import endCardHtml from "../assets/endscene/endscene.html?endcard";
import endSound from "../assets/sounds/gamewin5.mp3";

const endCardDocument = endCardHtml.replace(/<\/head>/i, `<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (_) {}
</script></head>`);

const EndScene = ({ active = false, onReady }) => {
  const soundPool = useSound(endSound);
  const wrapper = useRef(null);
  const loaded = useRef(false);
  const reveal = useRef(null);
  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let scheduled = false;
    let completed = false;
    let firstFrame;
    let secondFrame;
    let fadeFallback;
    let sound;
    const element = wrapper.current;
    const finish = () => {
      if (cancelled || completed) return;
      completed = true;
      clearTimeout(fadeFallback);
      setInteractive(true);
      onReady?.();
    };
    const onTransitionEnd = (event) => {
      if (event.target === element && event.propertyName === "opacity") finish();
    };
    const start = () => {
      if (cancelled || scheduled) return;
      scheduled = true;
      clearTimeout(readinessFallback);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (cancelled) return;
          setVisible(true);
          sound = playSound(soundPool);
          const duration = parseFloat(getComputedStyle(element).transitionDuration) * 1000;
          fadeFallback = setTimeout(finish, duration + 150);
        });
      });
    };
    const readinessFallback = setTimeout(start, 1200);
    element.addEventListener("transitionend", onTransitionEnd);
    reveal.current = start;
    if (loaded.current) start();
    return () => {
      cancelled = true;
      clearTimeout(readinessFallback);
      clearTimeout(fadeFallback);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      element.removeEventListener("transitionend", onTransitionEnd);
      reveal.current = null;
      stopSound(sound);
    };
  }, [active, onReady, soundPool]);

  if (!active) return null;
  return (
    <section
      ref={wrapper}
      className={`absolute inset-0 z-60 h-full w-full end-scene-fade ${visible ? "is-visible" : ""}`}
      aria-label="Memowrite end scene"
    >
      <iframe
        title="Memowrite offer"
        srcDoc={endCardDocument}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0"
        tabIndex={-1}
        onLoad={() => {
          loaded.current = true;
          reveal.current?.();
        }}
      />
      <button
        type="button"
        aria-label="Open offer"
        className="absolute inset-0 z-30 h-full w-full"
        disabled={!interactive}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (interactive) openDestination();
        }}
      />
    </section>
  );
};

export default EndScene;
