import cta from '../assets/img/cta.webp';

// eslint-disable-next-line react-refresh/only-export-components -- shared destination helper
export const openDestination = () => {
  console.log('CTA clicked');
  window.__mip.openDestination();
};

export const Cta = ({ entranceReady = true, disabled = false }) => (
  <>
    <img
      src={cta}
      alt="Shop Now"
      className={`pointer-events-none absolute left-1/2 top-[1687px] z-[60] w-[630px] -translate-x-1/2 select-none cta-entrance animate-scale-pulse ${entranceReady ? '' : 'scene-asset-pending'}`}
      draggable="false"
    />
    <button
      type="button"
      aria-label="Shop Now"
      disabled={!entranceReady || disabled}
      data-cta=""
      className={`absolute left-1/2 top-[1671.5px] z-[65] h-[186px] w-[756px] -translate-x-1/2 touch-manipulation cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-black ${entranceReady ? '' : 'scene-control-pending'}`}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (!disabled && entranceReady) openDestination(); }}
    />
  </>
);


