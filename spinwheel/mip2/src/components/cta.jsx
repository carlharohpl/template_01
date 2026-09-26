import cta from "../assets/img/cta.webp";

// Delegate to the existing guarded inline MRAID bridge.
// eslint-disable-next-line react-refresh/only-export-components
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
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
      aria-label="Shop now"
      tabIndex={-1}
      className={`absolute left-1/2 top-[1648px] z-[81] h-[164px] w-[680px] -translate-x-1/2 touch-none cursor-pointer border-0 bg-transparent scene-entrance ${offerPanel ? "offer-panel-hit" : "cta-hit-area"}`}
      onClick={(event) => {
        if (event.detail === 0 || event.button !== 0) return;
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
