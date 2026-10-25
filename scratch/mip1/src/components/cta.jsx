import cta from "../assets/img/cta.webp";

// Keep the shared raw-inline MRAID guard and destination handling in index.html.
// eslint-disable-next-line react-refresh/only-export-components -- shared clickthrough entry point
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
};

export const Cta = () => (
  <>
    <img
      src={cta}
      alt="Shop Now"
      className="im8-cta-enter animate-scale-pulse pointer-events-none absolute left-1/2 top-[1653px] z-30 w-[701px] -translate-x-1/2 select-none"
      draggable="false"
    />
    <button
      type="button"
      data-cta="true"
      aria-label="Shop Now"
      className="im8-cta-hit-enter absolute left-1/2 top-[1638.6px] z-40 h-[172.8px] w-[841.2px] -translate-x-1/2 cursor-pointer rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
