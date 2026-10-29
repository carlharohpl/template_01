import cta from '../assets/img/cta.webp'

// eslint-disable-next-line react-refresh/only-export-components -- shared synchronous destination
export function openDestination() {
  console.log('CTA clicked')
  window.__mip?.openDestination()
}

export function Cta({ ready = true }) {
  return <>
    <img
      src={cta}
      alt="SHOP NOW"
      className="shop-cta-art pointer-events-none absolute left-1/2 top-[1694px] z-60 w-[610px] -translate-x-1/2 select-none animate-scale-pulse"
      draggable="false"
    />
    <button
      type="button"
      className="shop-cta absolute left-1/2 top-[1677.1px] z-65 h-[202.8px] w-[732px] -translate-x-1/2 touch-manipulation cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-5 focus-visible:outline-offset-6 focus-visible:outline-black"
      data-cta=""
      aria-label="Shop now"
      disabled={!ready}
      onPointerDown={event => event.stopPropagation()}
      onTouchStart={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); openDestination() }}
    />
  </>
}
