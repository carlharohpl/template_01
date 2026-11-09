import ctaImage from "../assets/img/shop-now.webp";

// eslint-disable-next-line react-refresh/only-export-components -- parent and end card share this activation entry point.
export function openDestination() {
  try {
    window.gameClose?.();
    if (typeof window.ALPlayableAnalytics?.trackEvent === "function") window.ALPlayableAnalytics.trackEvent("CTA_CLICKED");
    else window.playableSDK?.reportEvent?.("CTA_CLICKED");
  } catch { /* Host analytics must not block the destination. */ }
  console.log("CTA clicked");
  window.__mip.openDestination();
}

export function Cta() {
  return (
    <>
      <img
        src={ctaImage}
        alt="Shop Now"
        className="pointer-events-none absolute left-1/2 top-[1665px] z-40 w-[616px] -translate-x-1/2 select-none animate-scale-pulse"
        draggable="false"
      />
      <button
        type="button"
        aria-label="Shop Now"
        data-cta=""
        data-sfx-exclude=""
        className="pointer-events-auto absolute left-1/2 top-[1651.8px] z-50 h-[158.4px] w-[739.2px] -translate-x-1/2 cursor-pointer rounded-[80px] border-0 bg-transparent p-0 focus-visible:outline-4 focus-visible:outline-white"
        onPointerDown={event => event.stopPropagation()}
        onTouchEnd={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); openDestination(); }}
      />
    </>
  );
}
