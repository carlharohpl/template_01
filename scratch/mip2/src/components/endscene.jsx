import { useCallback, useEffect, useRef, useState } from "react";
import { Cta, openClickthrough } from "./cta";
import logo from "../assets/endscene/logo.webp";
import heading from "../assets/endscene/subtitle1.webp";
import code from "../assets/endscene/code.webp";
import promo from "../assets/endscene/promo.webp";
import offer from "../assets/endscene/subtitle3.webp";
import divider from "../assets/endscene/line1.webp";
import cta from "../assets/endscene/cta.webp";

const CONFETTI_SHAPES = [
  { width: 7, height: 11, clip: "polygon(12% 0,100% 15%,82% 100%,0 83%)" },
  { width: 4, height: 26, clip: "polygon(0 0,100% 6%,75% 100%,18% 91%)" },
  { width: 19, height: 19, clip: "polygon(0 8%,90% 0,100% 94%,8% 100%)" },
  { width: 23, height: 14, clip: "polygon(0 12%,43% 0,60% 22%,100% 7%,89% 90%,55% 100%,36% 75%,8% 94%)" },
];
const CONFETTI = Array.from({ length: 128 }, (_, index) => {
  const kind = index % 9;
  const shape = CONFETTI_SHAPES[kind < 3 ? 0 : kind < 5 ? 1 : kind < 8 ? 2 : 3];
  const duration = 8 + ((index * 13) % 55) / 10;
  const phase = (index * .754877666) % 1;
  return {
    id: index,
    x: ((index * .618033989 + .017) % 1) * 1080,
    width: index % 17 === 0 ? 28 : shape.width,
    height: index % 17 === 0 ? 26 : shape.height,
    clip: shape.clip,
    drift: (index * 47) % 180 - 90,
    spin: (index % 2 ? -1 : 1) * (180 + (index * 67) % 540),
    duration,
    delay: -duration * phase,
    flutter: 2.2 + ((index * 7) % 25) / 10,
    rest: 60 + phase * 1920,
    opacity: .72 + (index % 5) * .07,
    color: ["#ffb500", "#ffa600", "#ffc32a"][index % 3],
  };
});

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

  useEffect(() => {
    let cancelled = false;
    fallbackRef.current = window.setTimeout(reveal, 1200);
    Promise.all([logo, heading, code, promo, offer, divider, cta].map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode();
    })).then(() => {
      if (cancelled) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          reveal();
        });
      });
    }).catch(() => {
      // The existing readiness fallback still reveals cached/loaded artwork.
    });
    return () => {
      cancelled = true;
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
    <>
      <div
        className={`end-scene-fade pointer-events-none absolute inset-0 z-50 bg-[#001b38]/65 ${visible ? "is-visible" : ""}`}
        aria-hidden="true"
      />
    <section
      className={`end-scene-fade absolute inset-0 z-[60] overflow-hidden ${visible ? "is-visible" : "pointer-events-none"}`}
      aria-label="Glückwunsch! Dein Wolt-Code"
      aria-hidden={!visible}
    >
      <button
        type="button"
        aria-label="Open offer"
        disabled={!visible}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer touch-manipulation bg-transparent focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-white"
        onClick={(event) => {
          event.stopPropagation();
          openClickthrough();
        }}
      />
      {visible && CONFETTI.map((piece) => (
        <span
          key={piece.id}
          aria-hidden="true"
          className="pointer-events-none absolute top-[-60px] z-[15] [clip-path:var(--confetti-shape)] wolt-end-confetti"
          style={{
            left: `${piece.x / 1080 * 100}%`,
            width: `clamp(1.38px, calc(var(--ui-scale,1) * ${piece.width * 1.38}px), 13.8px)`,
            height: `clamp(2.76px, calc(var(--ui-scale,1) * ${piece.height * 1.38}px), 16.56px)`,
            background: `linear-gradient(110deg, #ae6900 0%, ${piece.color} 22%, #ffd15b 48%, ${piece.color} 72%, #c37b00 100%)`,
            opacity: piece.opacity,
            "--confetti-shape": piece.clip,
            "--confetti-drift": `calc(var(--ui-scale,1) * ${piece.drift}px)`,
            "--confetti-spin": `${piece.spin}deg`,
            "--confetti-duration": `${piece.duration}s`,
            "--confetti-delay": `${piece.delay}s`,
            "--confetti-flutter": `${piece.flutter}s`,
            "--confetti-rest": `${piece.rest / 1920 * 100}dvh`,
          }}
        />
      ))}
      {/* Both orientations retain the same composition within the shared design canvas. */}
      <div className="pointer-events-none absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-20 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
        <div className="pointer-events-none absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible">
          <img
            src={logo}
            alt="Wolt"
            className="pointer-events-none absolute left-1/2 top-[70px] z-30 w-[231px] -translate-x-1/2 select-none"
            draggable="false"
          />
          {visible && (
            <>
              {/* Extend the panel to the viewport bottom, including tall-screen letterboxing. */}
              <div className="pointer-events-none absolute left-1/2 top-[933px] z-40 h-[max(987px,calc((100dvh_-_var(--ui-top,0px))_/_var(--ui-scale,1)_-_933px))] w-[1080px] -translate-x-1/2 rounded-t-[48px] bg-[#001735] wolt-end-slide-up" />
              <img
                src={heading}
                alt="Glückwunsch!"
                className="pointer-events-none absolute left-1/2 top-[1058px] z-50 w-[706px] -translate-x-1/2 select-none wolt-end-slide-up"
                draggable="false"
              />
              <img
                src={code}
                alt="Dein Code:"
                className="pointer-events-none absolute left-1/2 top-[1248px] z-50 w-[810px] -translate-x-1/2 select-none wolt-end-slide-up"
                draggable="false"
              />
              <img
                src={promo}
                alt="JETZTBLAU"
                className="pointer-events-none absolute left-1/2 top-[1320px] z-50 w-[507px] -translate-x-1/2 select-none wolt-end-slide-up"
                draggable="false"
              />
              <img
                src={offer}
                alt="7 € Rabatt auf deine erste Bestellung"
                className="pointer-events-none absolute left-1/2 top-[1474px] z-50 w-[801px] -translate-x-1/2 select-none wolt-end-slide-up"
                draggable="false"
              />
              <img
                src={divider}
                alt="Dashed divider"
                className="pointer-events-none absolute left-1/2 top-[1559px] z-50 w-[812px] -translate-x-1/2 select-none wolt-end-slide-up"
                draggable="false"
              />
              <Cta scene="end" />
            </>
          )}
        </div>
      </div>
    </section>
    </>
  );
};

export default EndScene;
