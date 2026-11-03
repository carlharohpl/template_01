import { useEffect, useState } from "react";
import { prepareImage } from "../hooks/prepareImage";
import cta from "../assets/img/cta.webp";

// Keep the shared raw-inline MRAID guard and destination handling in index.html.
// eslint-disable-next-line react-refresh/only-export-components -- shared destination entry point
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let frame = null;
    const image = new Image();
    image.src = cta;
    prepareImage(image).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { if (!cancelled) setReady(true); });
      });
    });
    return () => { cancelled = true; if (frame !== null) cancelAnimationFrame(frame); };
  }, []);
  return (
  <>
    <img
      src={cta}
      alt="Shop Now"
      className="pointer-events-none absolute left-1/2 top-[1653px] z-30 w-[701px] -translate-x-1/2 select-none im8-cta-enter animate-scale-pulse"
      draggable="false"
      data-cta-ready={ready}
    />
    <button
      type="button"
      data-sfx-exclude=""
      data-cta-ready={ready}
      data-cta="true"
      aria-label="Shop Now"
      className="im8-cta-hit-enter absolute left-1/2 top-[1638.6px] z-40 h-[172.8px] w-[841.2px] -translate-x-1/2 cursor-pointer rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4"
      onClick={(event) => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
  );
};
