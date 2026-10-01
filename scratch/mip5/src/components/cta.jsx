import { useLayoutEffect, useRef } from "react";
import cta from "../assets/img/cta.webp";

// Keep the shared raw-inline MRAID guard and destination handling in index.html.
// eslint-disable-next-line react-refresh/only-export-components -- shared clickthrough entry point
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
};

export const Cta = ({ scene = "gameplay" }) => {
  const imageRef = useRef(null);
  const buttonRef = useRef(null);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const button = buttonRef.current;
    // Follow the image's layout, leaving the existing CSS entrance and pulse alone.
    // offset sizes are in design-canvas pixels, unaffected by viewport scaling.
    const alignHitArea = () => {
      const width = image.offsetWidth;
      const height = image.offsetHeight;
      button.style.left = `${image.offsetLeft}px`;
      button.style.top = `${image.offsetTop - 13}px`;
      button.style.width = `${Math.ceil(width * 1.12)}px`;
      button.style.height = `${height + 26}px`;
    };
    alignHitArea();
    const resizeObserver = new ResizeObserver(alignHitArea);
    resizeObserver.observe(image);
    const mutationObserver = new MutationObserver(alignHitArea);
    mutationObserver.observe(image, { attributes: true, attributeFilter: ["class", "style"] });
    image.addEventListener("load", alignHitArea);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      image.removeEventListener("load", alignHitArea);
    };
  }, [scene]);

  return (
    <>
      {/* Edit top and width HERE for both gameplay and end scene. The hit area follows. */}
      <img
        src={cta}
        alt="GET MY DISCOUNT"
        className={`pointer-events-none absolute left-1/2 top-[1732px] z-[60] w-[628px] -translate-x-1/2 select-none ${scene === "end" ? "wolt-end-cta-enter" : "ev-cta-enter"} animate-scale-pulse`}
        draggable="false"
        ref={imageRef}
      />
      <button
        ref={buttonRef}
        type="button"
        aria-label="GET MY DISCOUNT"
        data-end-cta={scene === "end" ? "true" : undefined}
        className={`pointer-events-auto absolute z-[70] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white ${scene === "end" ? "wolt-end-slide-up" : "ev-cta-hit-enter"}`}
        onClick={(event) => {
          event.stopPropagation();
          openClickthrough();
        }}
      />
    </>
  );
};
