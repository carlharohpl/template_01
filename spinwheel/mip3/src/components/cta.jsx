import cta from "../assets/img/newassets/ctablack.webp";
import ctawhite from "../assets/img/newassets/ctawhite.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
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
      aria-label="Shop now"
      tabIndex={-1}
      className={`absolute left-1/2 z-[81] h-[155px] w-[490px] -translate-x-1/2 touch-none cursor-pointer border-0 bg-transparent scene-entrance cta-hit-area ${won ? "top-[1696px]" : "top-[1672px]"}`}
      onClick={(event) => {
        if (event.detail === 0 || event.button !== 0) return;
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
