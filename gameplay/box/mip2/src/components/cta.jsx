import cta from "../assets/img/rhoback-shop-now.webp";

// AppLovin MIP destination: window.__mip.openDestination() (defined in
// index.html's raw inline script) does the actual click-target resolution,
// mraid.open(clickTarget) guard, and try/catch — kept there so the validator-scanned
// literal text survives Vite's minifier. See CLAUDE.md before touching this.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this file (see CLAUDE.md)
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ disabled = false, entrance = true }) => (
  <>
  <img
    src={cta}
    alt="Shop Now"
    className={`pointer-events-none absolute left-1/2 top-[1645px] z-50 w-[593px] -translate-x-1/2 select-none animate-scale-pulse ${entrance ? "cta-enter" : ""}`}
    draggable="false"
  />
  <button
    type="button"
    aria-label="Shop Now"
    className="pointer-events-auto absolute left-1/2 top-[1630.6px] z-50 h-[172.8px] w-[711.6px] -translate-x-1/2 cursor-pointer cta-hit"
    data-cta=""
    data-sfx-exclude=""
    disabled={disabled}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      if (disabled) return;
      openDestination();
    }}
  />
  </>
);
