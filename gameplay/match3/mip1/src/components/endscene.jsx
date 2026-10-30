import { useCallback, useEffect, useRef, useState } from "react";
import endSceneHtml from "../assets/endscene/2mprojectllcmagnesium_acslanot_sip_20261015_02_emily_product_card_human_dh_unique.html?endcard";
import { openDestination } from "./cta";
import useSound, { playSound, stopSound } from "../hooks/useSound";
import endSceneSound from "../assets/sounds/endscene1.mp3";

// Preserve the supplied document; only forward the host's ad-network globals.
const bridgeScript = `
<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (error) {}
</script>`;
const bridgedHtml = endSceneHtml.replace("</head>", `${bridgeScript}</head>`);

export default function EndScene({ onReady, active = true, promoHeadline, dateLabel }) {
  const [visible, setVisible] = useState(false);
  const revealed = useRef(false);
  const readySent = useRef(false);
  const fallback = useRef(null);
  const frames = useRef([]);
  const mounted = useRef(false);
  const scheduled = useRef(false);
  const endSceneAudio = useSound(endSceneSound);
  const soundSource = useRef(null);
  const iframeRef = useRef(null);

  const syncText = useCallback(() => {
    const document = iframeRef.current?.contentDocument;
    const promo = document?.querySelector('[data-hirelief-promo]');
    const date = document?.querySelector('[data-hirelief-date]');
    if (promo) promo.textContent = promoHeadline ?? '';
    if (date) date.textContent = dateLabel ?? '';
    if (promo || date) iframeRef.current.contentWindow.dispatchEvent(new Event('resize'));
  }, [promoHeadline, dateLabel]);
  useEffect(() => { if (active) syncText(); }, [active, syncText]);

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
    if (!active) return;
    mounted.current = true;
    scheduled.current = false;
    fallback.current = window.setTimeout(scheduleReveal, 1200);
    const pendingFrames = frames.current;
    const iframe = iframeRef.current;
    return () => {
      mounted.current = false;
      window.clearTimeout(fallback.current);
      pendingFrames.forEach(cancelAnimationFrame);
      stopSound(soundSource.current);
      try { iframe?.contentWindow?.__mip?.disposeCalendar?.(); } catch { /* The frame may already be disposed. */ }
    };
  }, [active, scheduleReveal]);

  useEffect(() => {
    if (!active || !visible || readySent.current) return;
    readySent.current = true;
    soundSource.current = playSound(endSceneAudio);
    onReady?.();
  }, [active, visible, onReady, endSceneAudio]);

  if (!active) return null;

  return (
    <section
      aria-label="End scene"
      data-end-scene="provided"
      className={`end-scene-fade absolute inset-0 z-[100] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
    >
      <iframe
        tabIndex={-1}
        ref={iframeRef}
        title="HiRelief promotional end scene"
        srcDoc={bridgedHtml}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        onLoad={() => { syncText(); scheduleReveal(); }}
      />
      <button
        type="button"
        aria-label="Open offer"
        data-cta=""
        onPointerDown={event => event.stopPropagation()}
        disabled={!visible}
        className="absolute inset-0 z-30 h-full w-full touch-manipulation cursor-pointer border-0 bg-transparent p-0"
        onClick={(event) => {
          event.stopPropagation();
          openDestination();
        }}
      />
    </section>
  );
}
