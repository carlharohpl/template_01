import cta from "../assets/img/cta.webp";

// Keep the shared raw-inline MRAID guard and destination handling in index.html.
// eslint-disable-next-line react-refresh/only-export-components -- shared clickthrough entry point
export const openClickthrough = () => {
  console.log("CTA clicked");
  window.__mip.openClickthrough();
};

export const Cta = ({ scene = "gameplay" }) => scene === "end" ? (
  <>
    <img
      src={cta}
      alt="CLAIM MY DEAL"
      className="pointer-events-none absolute left-1/2 top-[1732px] z-[60] w-[470px] -translate-x-1/2 select-none wolt-end-cta-enter animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="CLAIM MY DEAL"
      data-end-cta="true"
      className="pointer-events-auto absolute left-1/2 top-[1719px] z-[70] h-[152px] w-[526px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white wolt-end-slide-up"
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
      alt="CLAIM MY DEAL"
      className="pointer-events-none absolute left-1/2 top-[1732px] z-50 w-[470px] -translate-x-1/2 select-none ev-cta-enter animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      aria-label="CLAIM MY DEAL"
      className="ev-cta-hit-enter absolute left-1/2 top-[1719px] z-[60] h-[152px] w-[526px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
      onClick={(event) => {
        event.stopPropagation();
        openClickthrough();
      }}
    />
  </>
);
