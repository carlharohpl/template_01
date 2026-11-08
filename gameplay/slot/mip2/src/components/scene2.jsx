import { useEffect, useLayoutEffect, useState } from "react";
import youWon from "../assets/img/you-won.webp";
import tryAgain from "../assets/img/try-again.webp";
import product from "../assets/img/dreamweave-bundle.webp";
import subtitle from "../assets/img/dreamweave-caption.webp";

export default function Scene2({ won, exiting, onReady }) {
  const [visibleResult, setVisibleResult] = useState(null);

  useEffect(() => {
    if (won === null) return undefined;
    let cancelled = false;
    let scheduled = false;
    let frame1;
    let frame2;
    const images = [];
    const reveal = () => {
      if (cancelled || scheduled) return;
      scheduled = true;
      clearTimeout(fallback);
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (cancelled) return;
          setVisibleResult(won);
        });
      });
    };
    const fallback = window.setTimeout(reveal, 1200);
    const sources = won ? [youWon, product, subtitle] : [tryAgain];
    Promise.allSettled(sources.map(src => new Promise(resolve => {
      const image = new Image();
      images.push(image);
      const settle = () => {
        image.onload = image.onerror = null;
        if (image.decode && image.naturalWidth) image.decode().catch(() => {}).then(resolve);
        else resolve();
      };
      image.onload = image.onerror = settle;
      image.src = src;
      if (image.complete) settle();
    }))).then(reveal);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      images.forEach(image => { image.onload = image.onerror = null; });
    };
  }, [won, onReady]);

  useLayoutEffect(() => {
    if (won !== null && visibleResult === won) onReady(won);
  }, [won, visibleResult, onReady]);

  const winVisible = won === true && visibleResult === true;
  const lossVisible = won === false && visibleResult === false;
  return (
    <>
      <img
        src={youWon}
        alt="You won!"
        className={`pointer-events-none absolute left-1/2 top-[455px] z-40 w-[678px] -translate-x-1/2 select-none result-headline ${winVisible ? "" : "result-preparing"}`}
        draggable="false"
        aria-hidden={!winVisible}
      />
      <img
        src={product}
        alt="Luxe Sateen Dreamweave bedding bundle"
        className={`pointer-events-none absolute left-1/2 top-[550px] z-40 w-[786px] -translate-x-1/2 select-none result-product ${winVisible ? "" : "result-preparing"}`}
        draggable="false"
        aria-hidden={!winVisible}
      />
      <img
        src={subtitle}
        alt="Luxe Sateen Dreamweave Hardcore Bundle"
        className={`pointer-events-none absolute left-1/2 top-[1310px] z-40 w-[700px] -translate-x-1/2 select-none result-caption ${winVisible ? "" : "result-preparing"}`}
        draggable="false"
        aria-hidden={!winVisible}
      />
      <img
        src={tryAgain}
        alt="Try again"
        className={`pointer-events-none absolute left-1/2 top-[910px] z-40 w-[572px] -translate-x-1/2 select-none result-retry ${lossVisible ? "" : "result-preparing"} ${exiting ? "result-exiting" : ""}`}
        draggable="false"
        aria-hidden={!lossVisible}
      />
    </>
  );
}
