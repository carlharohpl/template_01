import cta from "../assets/img/cta.webp";

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
    alt="Claim Your Halloween Deal"
    className={`pointer-events-none absolute left-1/2 top-[1667px] z-50 w-[732px] -translate-x-1/2 select-none animate-scale-pulse ${entrance ? "cta-enter" : ""}`}
    draggable="false"
  />
  <button
    type="button"
    aria-label="Claim Your Halloween Deal"
    className="pointer-events-auto absolute left-1/2 top-[1653.5px] z-50 h-[162px] w-[878.4px] -translate-x-1/2 cursor-pointer cta-hit"
    data-cta=""
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
