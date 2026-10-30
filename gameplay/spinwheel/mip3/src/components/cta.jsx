import cta from "../assets/img/newassets/ctablack.webp";
import ctawhite from "../assets/img/newassets/ctawhite.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ won = false }) => (
  <>
    <img
      src={won ? ctawhite : cta}
      alt="Shop now"
      className={`pointer-events-none absolute left-1/2 z-[80] -translate-x-1/2 select-none scene-entrance animate-scale-pulse ${won ? "top-[1685px] w-[438px] drop-shadow-[0_8px_22px_#0009] offer-cta-enter" : "top-[1685px] w-[438px] cta-enter"}`}
      draggable="false"
    />
    <button
      type="button"
      data-cta="true"
      aria-label="Shop now"
      className={`absolute left-1/2 z-[81] h-[162.74px] w-[525.6px] -translate-x-1/2 touch-none cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-4 border-0 bg-transparent scene-entrance cta-hit-area ${won ? "top-[1671.44px]" : "top-[1671.44px]"}`}
      onClick={(event) => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
);
