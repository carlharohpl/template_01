import cta from "../assets/img/cta.webp";
import endCta from "../assets/endscene/cta.webp";

// Keep the shared raw-inline MRAID guard and destination handling in index.html.
// eslint-disable-next-line react-refresh/only-export-components -- shared clickthrough entry point
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
};

export const Cta = ({ scene = "gameplay" }) => scene === "end" ? (
  <>
    <img
      src={endCta}
      alt="ZUR APP"
      className="pointer-events-none absolute left-1/2 top-[1692px] z-[60] w-[424px] -translate-x-1/2 select-none wolt-end-cta-enter animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="ZUR APP"
      data-end-cta="true"
      className="pointer-events-auto absolute left-1/2 top-[1683px] z-[70] h-[162px] w-[476px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white wolt-end-slide-up"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
) : (
  <>
    <img
      src={cta}
      alt="ZUR APP"
      className="pointer-events-none absolute left-1/2 top-[1543px] z-30 w-[424px] -translate-x-1/2 select-none wolt-cta-enter animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="ZUR APP"
      className="wolt-cta-hit-enter absolute left-1/2 top-[1541px] z-40 h-[162px] w-[484px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
