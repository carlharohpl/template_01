import ctaImage from "../assets/img/shop-now.webp";

// Shared by the gameplay CTA, compatibility helpers, and end-scene overlay.
// eslint-disable-next-line react-refresh/only-export-components
export function openDestination() {
  console.log("CTA clicked");
  window.__mip.openDestination();
}

export const Cta = ({ ready = true, active = true }) => (
  <>
    <img
      src={ctaImage}
      alt="Shop Now"
      className="pointer-events-none absolute left-1/2 top-[1662px] z-50 w-[624px] -translate-x-1/2 select-none entrance-asset cta-entrance animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      data-cta="true"
      data-sfx-exclude=""
      aria-label="Shop Now"
      disabled={!ready || !active}
      className="pointer-events-auto absolute left-1/2 top-[1641.5px] z-[60] h-[246px] w-[748.8px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-sm bg-transparent focus-visible:outline-4 focus-visible:outline-[#283456] disabled:pointer-events-none"
      onClick={event => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
);

