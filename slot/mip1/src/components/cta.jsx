import ctaImage from "../Assets/img/cta.webp";

// Shared by the gameplay CTA, compatibility helpers, and end-scene overlay.
// eslint-disable-next-line react-refresh/only-export-components
export function openClickthrough() {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
}

export const Cta = ({ ready = true, active = true }) => (
  <>
    <img
      src={ctaImage}
      alt="Shop Now"
      className="pointer-events-none absolute left-1/2 top-[1632px] z-50 w-[610px] -translate-x-1/2 select-none entrance-asset cta-entrance animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      data-cta="true"
      aria-label="Shop Now"
      disabled={!ready || !active}
      className="pointer-events-auto absolute left-1/2 top-[1615.1px] z-[60] h-[202.8px] w-[732px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-sm bg-transparent focus-visible:outline-4 focus-visible:outline-white disabled:pointer-events-none"
      onClick={event => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
