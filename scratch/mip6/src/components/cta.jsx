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
      className="musely-cta-enter animate-scale-pulse pointer-events-none absolute left-1/2 top-[1649px] z-30 w-[460px] -translate-x-1/2 select-none"
      draggable="false"
    />
    <button
      type="button"
      aria-label="Shop Now"
      className="musely-cta-hit-enter absolute left-1/2 top-[1645px] z-40 h-[168px] w-[597px] -translate-x-1/2 cursor-pointer rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#780c2e]"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
