import { useLayoutEffect, useRef } from "react";

export default function useScaleUI(baseW = 1080, baseH = 1920) {
  const appRef = useRef(null);
  const wrapperRef = useRef(null);

  useLayoutEffect(() => {
    const app = appRef.current;
    const wrapper = wrapperRef.current;
    if (!app || !wrapper) return;

    // Keep base dimensions in sync with the hook arguments.
    app.style.width = `${baseW}px`;
    app.style.height = `${baseH}px`;

    let frameId = null;

    const applyScale = () => {
      frameId = null;

      const { width: viewportW, height: viewportH } =
        wrapper.getBoundingClientRect();

      if (!viewportW || !viewportH) return;

      const rawScale = Math.min(viewportW / baseW, viewportH / baseH);

      // Round the rendered size to whole pixels first, then re-derive scale
      // from that so the inner content still fills it exactly. This avoids
      // a fractional leftover between `left + renderedWidth` and the
      // opposite edge that browsers round asymmetrically (seen as a
      // one-sided hairline seam in AppLovin's WebView).
      const renderedWidth = Math.round(baseW * rawScale);
      const renderedHeight = Math.round(baseH * rawScale);
      const scale = renderedWidth / baseW;

      const left = Math.round((viewportW - renderedWidth) / 2);
      const top = Math.round((viewportH - renderedHeight) / 2);

      wrapper.style.setProperty("--ui-scale", scale.toString());
      wrapper.style.setProperty("--ui-left", `${left}px`);
      wrapper.style.setProperty("--ui-top", `${top}px`);
      wrapper.style.setProperty("--ui-width", `${renderedWidth}px`);
      wrapper.style.setProperty("--ui-height", `${renderedHeight}px`);
    };

    const scheduleScale = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(applyScale);
    };

    // Establish the canvas size before the first paint, including on reload.
    applyScale();

    const ro = new ResizeObserver(scheduleScale);
    ro.observe(wrapper);

    window.addEventListener("orientationchange", scheduleScale);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      ro.disconnect();
      window.removeEventListener("orientationchange", scheduleScale);
    };
  }, [baseW, baseH]);

  return { appRef, wrapperRef };
}
