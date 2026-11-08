import { useEffect, useRef, useState } from "react";
import cta from "../assets/img/cta.webp";

// eslint-disable-next-line react-refresh/only-export-components -- shared destination entry point
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ ready = true }) => {
  const imageRef = useRef(null);
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let frame;
    const image = imageRef.current;
    const finish = () => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", finish);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { if (!cancelled) setPrepared(true); });
      });
    };
    const decode = () => {
      try { Promise.resolve(image.decode?.()).then(finish, finish); }
      catch { finish(); }
    };
    const timer = setTimeout(finish, 1800);
    image.addEventListener("load", decode);
    image.addEventListener("error", finish);
    if (image.complete) decode();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", finish);
    };
  }, []);
  return (
    <>
      <img
        ref={imageRef}
        src={cta}
        alt="Shop Now"
        className="pointer-events-none absolute left-1/2 top-[1668px] z-30 w-[576px] -translate-x-1/2 select-none holiday-cta-enter animate-scale-pulse"
        draggable="false"
        data-cta-ready={ready && prepared}
      />
      <button
        type="button"
        data-sfx-exclude=""
        data-cta-ready={ready && prepared}
        data-cta="true"
        aria-label="Shop Now"
        className="holiday-cta-hit absolute left-1/2 top-[1649.8px] z-40 h-[182.4px] w-[691.2px] -translate-x-1/2 cursor-pointer rounded-[18px] bg-transparent focus-visible:outline-4 focus-visible:outline-offset-4"
        onClick={(event) => { event.stopPropagation(); openDestination(); }}
      />
    </>
  );
};
