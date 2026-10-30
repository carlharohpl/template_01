import cta from "../assets/img/cta.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ won = false, offerPanel = false }) => (
  <>
    <img
      src={cta}
      alt="Shop now"
      className={`pointer-events-none absolute left-1/2 top-[1658px] z-[80] w-[679px] -translate-x-1/2 select-none scene-entrance animate-scale-pulse ${offerPanel ? "offer-panel-cta" : won ? "offer-cta-enter" : "cta-enter"}`}
      draggable="false"
    />
    <button
      type="button"
      data-cta="true"
      aria-label="Shop now"
      className={`absolute left-1/2 top-[1643.62px] z-[81] h-[172.55px] w-[814.8px] -translate-x-1/2 touch-none cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-4 border-0 bg-transparent scene-entrance ${offerPanel ? "offer-panel-hit" : "cta-hit-area"}`}
      onClick={(event) => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
);
