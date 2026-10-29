import cta from "../assets/img/newassets/cta.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
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
      data-cta="true"
      aria-label="Shop now"
      className="absolute left-1/2 top-[1662.32px] z-20 h-[188.11px] w-[778.8px] -translate-x-1/2 touch-none cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-4 rounded-full border-0 bg-transparent scene-entrance cta-hit-area"
      onClick={(event) => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
);
