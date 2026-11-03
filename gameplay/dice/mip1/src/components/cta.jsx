import ctaImage from "../assets/img/CTA.png";

// This shared handler also serves the supplied card's native controls.
// eslint-disable-next-line react-refresh/only-export-components
export function openDestination() {
  console.log("CTA clicked");
  window.__mip.openDestination();
}

export const Cta = () => (
  <>
    <img
      src={ctaImage}
      alt="CTA"
      className="pointer-events-none absolute bottom-[129px] left-1/2 z-20 w-[616px] -translate-x-1/2 select-none animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="Open offer"
      data-sfx-exclude=""
      data-cta=""
      className="absolute bottom-[114.79827px] left-1/2 z-20 h-[170.42075px] w-[739.2px] -translate-x-1/2 cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-4"
      onClick={event => { event.stopPropagation(); openDestination(); }}
    />
  </>
);
