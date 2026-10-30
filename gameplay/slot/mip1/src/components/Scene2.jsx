import { useEffect, useState } from "react";
import youWon from "../Assets/img/youwon.webp";
import tryAgain from "../Assets/img/tryagain.webp";
import product from "../Assets/img/product.webp";
import subtitle from "../Assets/img/subtitle2.webp";

export default function Scene2({ won, onReady }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
          setVisible(true);
          onReady(won);
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

  return won ? (
    <>
      <img
        src={youWon}
        alt="You won!"
        className={`pointer-events-none absolute left-1/2 top-[396px] z-40 w-[610px] -translate-x-1/2 select-none result-headline ${visible ? "" : "result-preparing"}`}
        draggable="false"
      />
      <img
        src={product}
        alt="The Pinky Bronze Kit 2.0 product and packaging"
        className={`pointer-events-none absolute left-1/2 top-[530px] z-40 w-[770px] -translate-x-1/2 select-none result-product ${visible ? "" : "result-preparing"}`}
        draggable="false"
      />
      <img
        src={subtitle}
        alt="The Pinky Bronze Kit 2.0. If You Know You Know"
        className={`pointer-events-none absolute left-1/2 top-[1334px] z-40 w-[658px] -translate-x-1/2 select-none result-caption ${visible ? "" : "result-preparing"}`}
        draggable="false"
      />
    </>
  ) : (
    <img
      src={tryAgain}
      alt="Try again"
      className={`pointer-events-none absolute left-1/2 top-[905px] z-40 w-[638px] -translate-x-1/2 select-none result-headline ${visible ? "" : "result-preparing"}`}
      draggable="false"
    />
  );
}
