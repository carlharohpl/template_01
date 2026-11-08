import { useEffect, useState } from "react";
import ctaArtwork from "../assets/img/cta.webp";
import { copy, direction, language, prepareTypography } from "../localization";

// AppLovin MIP navigation: window.__mip.openDestination() (defined in
// index.html's raw inline script) does the actual click-target resolution,
// mraid.open(destinationUrl) guard, and try/catch — kept there so the validator-scanned
// literal text survives Vite's minifier. See CLAUDE.md before touching this.
// eslint-disable-next-line react-refresh/only-export-components -- reused outside this file (see CLAUDE.md)
export const openDestination = () => {
  console.log("CTA clicked");
  window.__mip.openDestination();
};

export const Cta = ({ scene = "gameplay" }) => {
  const [fontSize, setFontSize] = useState(58.38);
  useEffect(() => {
    let cancelled = false;
    prepareTypography().then(sizes => { if (!cancelled) setFontSize(sizes.cta); });
    return () => { cancelled = true; };
  }, []);
  const activate = event => {
    event.stopPropagation();
    openDestination();
  };
  if (scene === "end") return (
    <>
      <img
        src={ctaArtwork}
        alt=""
        className="pointer-events-none absolute left-[calc(var(--end-left)+177.5px*var(--end-scale))] top-[calc(var(--end-top)+425px*var(--end-scale))] z-30 w-[calc(113px*var(--end-scale))] -translate-x-1/2 select-none landscape:left-[calc(var(--end-left)+356.5px*var(--end-scale))] landscape:top-[calc(var(--end-top)+236px*var(--end-scale))] cta-entrance animate-scale-pulse"
        draggable="false"
      />
      <p
        className="pointer-events-none absolute left-[calc(var(--end-left)+177.5px*var(--end-scale))] top-[calc(var(--end-top)+439.22px*var(--end-scale))] z-30 m-0 w-[calc(96.74px*var(--end-scale))] -translate-x-1/2 -translate-y-1/2 select-none font-['Inter'] text-[length:calc(var(--cta-font-size)*0.19349315*var(--end-scale))] leading-[1.2] font-bold whitespace-nowrap text-center text-white landscape:left-[calc(var(--end-left)+356.5px*var(--end-scale))] landscape:top-[calc(var(--end-top)+250.22px*var(--end-scale))] cta-entrance animate-scale-pulse"
        style={{ "--cta-font-size": `${fontSize}px` }}
        lang={language}
        dir={direction}
        aria-hidden="true"
      >
        {copy.cta}
      </p>
      <button
        type="button"
        data-sfx-exclude=""
        data-cta=""
        aria-label={copy.cta}
        className="absolute left-[calc(var(--end-left)+177.5px*var(--end-scale))] top-[calc(var(--end-top)+422.16px*var(--end-scale))] z-40 h-[calc(34.13px*var(--end-scale))] w-[calc(135.6px*var(--end-scale))] -translate-x-1/2 cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:outline-[#8618ff] landscape:left-[calc(var(--end-left)+356.5px*var(--end-scale))] landscape:top-[calc(var(--end-top)+233.16px*var(--end-scale))] cta-hit"
        onClick={activate}
      />
    </>
  );
  return (
  <>
  <img
    src={ctaArtwork}
    alt=""
    className="pointer-events-none absolute left-1/2 top-[1680px] z-30 w-[584px] -translate-x-1/2 select-none cta-entrance animate-scale-pulse"
    draggable="false"
  />
  <p
    className="pointer-events-none absolute left-1/2 top-[1753.5px] z-30 m-0 w-[500px] -translate-x-1/2 -translate-y-1/2 select-none font-['Inter'] text-[length:var(--cta-font-size)] leading-[1.2] font-bold whitespace-nowrap text-center text-white cta-entrance animate-scale-pulse"
    style={{ "--cta-font-size": `${fontSize}px` }}
    lang={language}
    dir={direction}
    aria-hidden="true"
  >
    {copy.cta}
  </p>
  <button
    type="button"
    data-sfx-exclude=""
    data-cta=""
    aria-label={copy.cta}
    className="absolute left-1/2 top-[1665.3px] z-40 h-[176.4px] w-[700.8px] -translate-x-1/2 cursor-pointer bg-transparent focus-visible:outline-4 focus-visible:outline-[#8618ff] cta-hit"
    onClick={activate}
  />
  </>
  );
};
