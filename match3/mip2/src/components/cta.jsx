import cta from "../assets/img/cta.webp";


// Share one synchronous destination action across promotional controls.
// eslint-disable-next-line react-refresh/only-export-components -- shared destination helper
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ entranceReady = true, gameplay = false }) => (
  <>
    <img
      src={cta}
      alt="Shop Now"
      className={`cta-entrance animate-scale-pulse ${entranceReady ? "" : "scene-asset-pending"} pointer-events-none absolute left-1/2 top-[1672px] z-30 ${gameplay ? "w-[450px]" : "w-[712px]"} -translate-x-1/2 select-none`}
      draggable="false"
    />
    <button
      type="button"
      data-cta=""
      aria-label="Shop Now"
      disabled={!entranceReady}
      className={`cta-hit-entrance ${entranceReady ? "" : "scene-control-pending"} absolute left-1/2 z-40 ${gameplay ? "top-[1656.3px] h-[188.4px] w-[540px]" : "top-[1647.16px] h-[298.09px] w-[854.4px]"} -translate-x-1/2 touch-manipulation cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-2`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        openDestination();
      }}
    />
  </>
);



