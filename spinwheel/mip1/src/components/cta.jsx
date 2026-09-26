import cta from "../assets/img/newassets/cta.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
};

export const Cta = () => (
  <>
    <img
      src={cta}
      alt="Shop now"
      className="pointer-events-none absolute left-1/2 top-[1678px] z-10 w-[649px] -translate-x-1/2 select-none scene-entrance cta-enter animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="Shop now"
      tabIndex={-1}
      className="absolute left-1/2 top-[1670px] z-20 h-[177px] w-[728px] -translate-x-1/2 touch-none cursor-pointer rounded-full border-0 bg-transparent scene-entrance cta-hit-area"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
