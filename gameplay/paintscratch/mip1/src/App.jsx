import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { bindSoundGestures, handleUnlockGesture, playSound, retrySound, stopSound, waitForSoundCompletion } from "./hooks/useSound";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import { copy, direction, language, prepareTypography } from "./localization";
import logo from "./assets/img/logo.webp";
import cherry from "./assets/img/cherry-pixel.webp";
import hand from "./assets/img/hand.webp";
import palette1 from "./assets/img/palette-1.webp";
import palette2 from "./assets/img/palette-2.webp";
import palette3 from "./assets/img/palette-3.webp";
import palette4 from "./assets/img/palette-4.webp";
import palette5 from "./assets/img/palette-5.webp";
import ctaArtwork from "./assets/img/cta.webp";
import clickSound from "./assets/sounds/click.mp3?inline";
import scratchSound from "./assets/sounds/Painting 01.wav?inline";
import correctSound from "./assets/sounds/correct2.mp3?inline";
import winSound from "./assets/sounds/gamewin1.mp3?inline";

const COLORS = { 1: "#95051C", 2: "#6A0105", 3: "#336C0C", 4: "#1E4A0A", 5: "#DBB1BD" };
const PALETTE = [palette1, palette2, palette3, palette4, palette5];
const SOURCES = [logo, cherry, hand, ...PALETTE, ctaArtwork];
const CHERRY_X = 96.5;
const CHERRY_Y = 425;

// Measured row extents and number assignments from the supplied 887 × 935 image.
// The original image supplies the silhouette and every numeral; no font is substituted.
const ROWS = [
  [0, 48, [[392, 456, "3"]]],
  [48, 96, [[248, 504, "33333"]]],
  [96, 144, [[152, 504, "3333333"]]],
  [144, 192, [[56, 304, "43333"], [344, 400, "3"], [448, 504, "3"]]],
  [192, 240, [[8, 304, "443333"], [344, 400, "3"], [448, 552, "33"]]],
  [240, 288, [[8, 256, "44433"], [344, 400, "3"], [448, 552, "33"]]],
  [288, 344, [[8, 256, "44444"], [296, 400, "33"], [496, 600, "33"]]],
  [344, 392, [[8, 208, "4444"], [296, 400, "33"], [496, 600, "33"]]],
  [392, 440, [[248, 352, "33"], [544, 600, "3"]]],
  [440, 488, [[144, 208, "1"], [248, 352, "33"], [544, 648, "33"], [688, 792, "22"]]],
  [488, 536, [[96, 456, "1113311"], [496, 840, "1131122"]]],
  [536, 592, [[48, 887, "11113111111111552"]]],
  [592, 640, [[0, 887, "115111111111111552"]]],
  [640, 688, [[0, 887, "115111115111111152"]]],
  [688, 744, [[0, 887, "115111115111111112"]]],
  [744, 792, [[48, 887, "11111111111111222"]]],
  [792, 840, [[72, 488, "11111111"], [488, 840, "2222222"]]],
  [840, 888, [[120, 424, "222222"], [536, 744, "2222"]]],
  [888, 935, [[184, 344, "222"], [584, 696, "22"]]],
];
// Boundaries follow the measured numeral centers, rather than evenly dividing each row.
// Rendered fills, pointer paths, and idle guides all use these same artwork coordinates.
const CELL_BOUNDS = [
  [[392,0,456,51.25]],
  [[248,48,299.75,101.75],[299.75,48,349,101.75],[349,48,398.75,101.75],[398.75,51.25,448.75,100.75],[448.75,48,504,101.75]],
  [[152,96,206.25,150.5],[206.25,96,254.75,150.5],[254.75,101.75,303,150.5],[302,101.75,349,151],[349,101.75,398.25,150.5],[398.25,100.75,448.75,149],[448.75,101.75,504,150.5]],
  [[56,144,107,199.25],[107,144,157,198.75],[157,150.5,204.5,200],[204.5,150.5,251.75,199.25],[251.75,150.5,304,199.25],[344,150.5,400,198.75],[448,150.5,504,199.25]],
  [[8,192,58,247.25],[58,199.25,107,248.25],[107,198.75,155.5,247.75],[155.5,198.75,203,247.75],[203,199.25,251.75,248.25],[251.75,199.25,304,249],[344,198.75,400,247.25],[448,199.25,498,248.25],[498,192,552,248.25]],
  [[8,247.25,58,295.5],[58,248.25,105.75,295.5],[105.75,247.75,154.25,295.5],[154.25,247.75,203,297],[203,248.25,256,297],[344,247.25,400,295.5],[448,248.25,499,297],[498.5,248.25,552,297]],
  [[8,295.5,58,343.5],[58,295.5,105.75,343],[105.75,295.5,155,343],[153.5,297,201.75,344.5],[201.75,297,256,345],[296,288,349,345.25],[349,295.5,400,344],[496,297,547.25,346.25],[547.25,288,600,346.25]],
  [[8,343.5,58,392],[58,343,105.75,392],[105.75,343,154.75,392],[154.75,344,208,392],[296,345.25,350,394.75],[349,344,400,393],[496,346.25,548,396],[547.25,346.25,600,395.25]],
  [[248,392,299.25,444],[299.25,394.75,352,443.5],[544,395.25,600,444]],
  [[144,440,208,492],[248,444,299.75,493.25],[299.75,443.5,352,492],[544,444,596.25,493.25],[596.25,440,648,493.25],[688,440,739.75,493.5],[739.75,440,792,494]],
  [[96,488,149.75,539.75],[149.75,492,199.75,541.5],[199.75,488,249.75,541.5],[249.75,493.25,299.25,542],[299.25,492,348,541.25],[348,488,397,541.5],[397,488,456,541.5],[496,488,545,542.75],[545,493.25,595,542.75],[595,493.25,644.5,542.75],[644,488,693,544],[693,493.5,741.25,543.25],[741.25,494,788,545],[788,488,840,544.5]],
  [[48,536,99.25,590.75],[99.25,539.75,149.75,584],[149.75,541.5,199.5,591],[199.5,541.5,249.5,591],[249.5,542,299,590.75],[299,541.25,347.75,590.75],[347.75,541.5,397,591],[397,541.5,446.25,591],[446.25,536,495.75,590.75],[495.75,542.75,545,592],[545,542.75,594.25,592],[594.25,542.75,643.75,592],[643.75,543.25,693,592],[693,543.25,739.75,592],[739.75,544,786.75,593],[786.75,544.5,836.5,593],[836.5,536,887,595.25]],
  [[0,592,49,644.75],[48,590.75,100,640.25],[99,584,150.25,631],[150.25,591,199.75,640.25],[199.75,591,249,640.25],[249,590.75,298.25,640.25],[298.25,590.75,347.75,640.25],[347.75,591,397,640.25],[397,591,446.25,640.5],[446.25,590.75,495.75,640.25],[495.75,592,545,641.25],[545,592,594.25,641.25],[594.25,592,643.75,641.25],[643.75,592,693,641.25],[693,592,739.75,641.25],[739.75,593,786.75,641.5],[786.75,593,836.5,641.5],[836.5,595.25,887,642.5]],
  [[0,644.75,48.25,694],[48.25,640.25,99.25,689.75],[99.25,631,150.25,684],[150.25,640.25,199.5,689.5],[199.5,640.25,248.75,689.75],[248.75,640.25,298.25,689.75],[298.25,640.25,347.75,689.5],[347.75,640.25,399,689.75],[399,640.5,448.25,689.25],[448.25,640.25,495.75,689.5],[495.75,641.25,544,690.75],[544,641.25,591,690.75],[591,641.25,638,690.75],[638,641.25,685,690.75],[685,641.25,734,690.75],[734,641.5,785.5,690.75],[785.5,641.5,836.5,690.75],[836.5,642.5,887,690.5]],
  [[0,694,48,744],[48,689.75,99,739],[99,684,150.25,739],[150.25,689.5,199.5,738.75],[199.5,689.75,248.75,739],[248.75,689.75,298.25,739],[298.25,689.5,347.75,738.75],[347.75,689.75,398.75,739],[398.75,689.25,448,738.25],[448,689.5,495.75,740],[495.75,690.75,542.25,739.5],[542.25,690.75,588.75,739.5],[588.75,690.75,638,739.5],[638,690.75,687.5,739.5],[687.5,690.75,737,739.5],[737,690.75,786,739.75],[786,690.75,836,739.75],[836,690.5,887,739.5]],
  [[48,739,95.75,792],[95.75,736.75,144.75,788.25],[144.75,738.75,194,788.25],[194,739,243.25,788.25],[243.25,739,292.75,788.25],[292.75,738.75,342,788.25],[342,739,391.25,788.25],[391.25,738.25,440.75,788.25],[440.75,738.75,490,788.25],[490,739.5,539.25,788.25],[539.25,739.5,588.75,788.25],[588.75,739.5,638,788.25],[638,739.5,687.5,788.25],[687.5,739.5,737.5,788.25],[737.5,739.75,787.25,788.5],[787.25,739.75,836.75,788.5],[836.75,739.5,887,792]],
  [[72,788.25,121,840],[121,788.25,170.25,837.5],[170.25,788.25,219.75,837.5],[219.75,788.25,269,837.5],[269,788.25,318.25,837.5],[318.25,788.25,367.75,837.5],[367.75,788.25,417,837.5],[417,788.25,479.25,840],[479.25,788.25,541.75,840],[541.75,788.25,591.25,837.5],[591.25,788.25,640.5,837.5],[640.5,788.25,689.75,837.5],[689.75,788.25,739.25,837.5],[739.25,788.5,788.5,840],[788.5,788.5,840,840]],
  [[120,837.5,170.5,888],[170.5,837.5,219.75,886],[219.75,837.5,269.25,886],[269.25,837.5,318.5,886],[318.5,837.5,367.75,886],[367.75,837.5,424,888],[536,837.5,591.25,888],[591.25,837.5,640.5,886.5],[640.5,837.5,689.75,886.5],[689.75,837.5,744,888]],
  [[184,886,240.25,935],[240.25,886,289.5,935],[289.5,886,344,935],[584,886.5,640.5,935],[640.5,886.5,696,935]],
].flat();
const CELLS = ROWS.flatMap(([, , segments], row) => segments.flatMap(([left, , numbers]) =>
  [...numbers].map((number, column) => ({
    id: `${row}-${left}-${column}`, number: Number(number), row,
  }))),
).map((cell, index) => {
  const [x, y, right, bottom] = CELL_BOUNDS[index].map(Math.round);
  return { ...cell, x, y, width: right - x, height: bottom - y };
});

// Partition the shared paint surface once, independently of selection/paint order.
// Each region has exactly one owner: no overlapping fills and no gray seam gaps.
const PAINT_BANDS = (() => {
  const xs = [...new Set([0, 887, ...CELLS.flatMap(cell => [cell.x, cell.x + cell.width])])].sort((a, b) => a - b);
  const ys = [...new Set([0, 935, ...CELLS.flatMap(cell => [cell.y, cell.y + cell.height])])].sort((a, b) => a - b);
  return ys.slice(0, -1).map((top, row) => {
    const bottom = ys[row + 1];
    const y = (top + bottom) / 2;
    const spans = [];
    for (let column = 0; column < xs.length - 1; column++) {
      const left = xs[column];
      const right = xs[column + 1];
      const x = (left + right) / 2;
      let owner;
      let bestDistance = Infinity;
      let bestCenter = Infinity;
      for (const cell of CELLS) {
        const dx = Math.max(cell.x - x, 0, x - cell.x - cell.width);
        const dy = Math.max(cell.y - y, 0, y - cell.y - cell.height);
        const distance = dx * dx + dy * dy;
        const center = (x - cell.x - cell.width / 2) ** 2 + (y - cell.y - cell.height / 2) ** 2;
        if (distance < bestDistance || (distance === bestDistance && center < bestCenter)) {
          owner = cell;
          bestDistance = distance;
          bestCenter = center;
        }
      }
      if (spans.at(-1)?.cell === owner) spans.at(-1).right = right;
      else spans.push({ left, right, cell: owner });
    }
    return { top, height: bottom - top, spans };
  });
})();

function paintSurface(canvas, painted) {
  const context = canvas?.getContext("2d");
  if (!context) return;
  // Opaque integer-pixel fills share one bitmap; scaling cannot expose strip seams.
  for (const band of PAINT_BANDS) {
    const runs = [];
    for (const span of band.spans) {
      const color = painted.has(span.cell.id) ? COLORS[span.cell.number] : "#939393";
      if (runs.at(-1)?.color === color) runs.at(-1).right = span.right;
      else runs.push({ left: span.left, right: span.right, color });
    }
    for (const run of runs) {
      context.fillStyle = run.color;
      context.fillRect(run.left, band.top, run.right - run.left, band.height);
    }
  }
}

// Segment/rectangle clipping checks the complete path, including outside-to-outside swipes.
function crossesCell(from, to, cell) {
  let entry = 0;
  let exit = 1;
  for (const [start, delta, low, high] of [
    [from.x, to.x - from.x, cell.x, cell.x + cell.width],
    [from.y, to.y - from.y, cell.y, cell.y + cell.height],
  ]) {
    if (Math.abs(delta) < 0.00001) {
      if (start < low || start > high) return false;
    } else {
      const first = (low - start) / delta;
      const last = (high - start) / delta;
      entry = Math.max(entry, Math.min(first, last));
      exit = Math.min(exit, Math.max(first, last));
      if (entry > exit) return false;
    }
  }
  return true;
}

function usefulGuide(active, painted, initial) {
  const remaining = CELLS.filter(cell => !painted.has(cell.id));
  if (!remaining.length) return null;
  const matching = remaining.filter(cell => cell.number === active);
  const number = matching.length ? active : Math.min(...remaining.map(cell => cell.number));
  const paletteX = 172 + (number - 1) * 152 + 64;
  if (!matching.length) return { mode: "select", startX: paletteX, startY: 1519 };
  let best = [];
  let run = [];
  for (const cell of matching) {
    const previous = run.at(-1);
    if (!previous || previous.row !== cell.row || Math.abs(previous.x + previous.width - cell.x) > 2) run = [];
    run.push(cell);
    if (run.length > best.length) best = [...run];
  }
  const first = best[0];
  const last = best[Math.min(best.length - 1, 5)];
  const fromX = CHERRY_X + first.x + first.width / 2;
  const fromY = CHERRY_Y + first.y + first.height / 2;
  return {
    mode: "swipe", startX: initial ? paletteX : fromX - 30,
    startY: initial ? 1519 : fromY + 75,
    fromX, fromY, toX: CHERRY_X + last.x + last.width / 2,
    toY: CHERRY_Y + last.y + last.height / 2,
  };
}

function stopSwipeSound(handleRef, idleRef) {
  clearTimeout(idleRef.current);
  idleRef.current = null;
  stopSound(handleRef.current);
  handleRef.current = null;
}

export default function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const clickPool = useSound(clickSound, { backend: "web", poolSize: 1 });
  const scratchPool = useSound(scratchSound, { backend: "media", poolSize: 1 });
  const correctPool = useSound(correctSound, { backend: "web", poolSize: 5, overflow: "drop-new" });
  const winPool = useSound(winSound, { backend: "web", poolSize: 1, overflow: "drop-new" });
  const cancelWinRef = useRef(null);
  const scratchHandleRef = useRef(null);
  const scratchIdleRef = useRef(null);
  const clickHandleRef = useRef(null);
  const completedSoundRef = useRef(new Set());
  const paletteBeatRef = useRef({ time: -Infinity, beat: 0 });
  const gridRef = useRef(null);
  const paintRef = useRef(null);
  const paintedRef = useRef(new Set());
  const strokeRef = useRef(null);
  const touchedRef = useRef(false);
  const [painted, setPainted] = useState(() => new Set());
  const [active, setActive] = useState(null);
  const [started, setStarted] = useState(false);
  const [headingSize, setHeadingSize] = useState(100);
  const [interactive, setInteractive] = useState(false);
  const [visible, setVisible] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [guide, setGuide] = useState(null);
  const [activity, setActivity] = useState(0);
  const [paletteFeedback, setPaletteFeedback] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [endScene, setEndScene] = useState(false);
  const complete = painted.size === CELLS.length;
  const completedGroups = PALETTE.map((_, index) => CELLS.every(cell => cell.number !== index + 1 || painted.has(cell.id)));

  useLayoutEffect(() => {
    paintSurface(paintRef.current, painted);
  }, [painted]);

  useEffect(() => {
    const unbind = bindSoundGestures(wrapperRef.current, { keyboard: true, exclude: 'button:disabled, .cherry-grid[data-awaiting-color="true"]' });
    return () => {
      unbind();
      cancelWinRef.current?.();
      cancelWinRef.current = null;
      stopSwipeSound(scratchHandleRef, scratchIdleRef);
    };
  }, [wrapperRef]);

  useEffect(() => {
    let cancelled = false;
    let firstFrame;
    let secondFrame;
    const disposers = [];
    const preparation = SOURCES.map(src => new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.onload = image.onerror = null;
        resolve();
      };
      const timeout = setTimeout(finish, 1800);
      disposers.push(finish);
      image.onload = () => {
        if (image.decode) image.decode().catch(() => {}).finally(finish);
        else finish();
      };
      image.onerror = finish;
      image.src = src;
      if (image.complete) image.onload();
    }));
    preparation.push(prepareTypography().then(sizes => { if (!cancelled) setHeadingSize(sizes.heading); }));
    Promise.allSettled(preparation).then(() => {
      if (cancelled) return;
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => { if (!cancelled) setStarted(true); });
      });
    });
    return () => {
      cancelled = true;
      disposers.forEach(dispose => dispose());
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    let hostVisible = true;
    let pageHidden = false;
    let removeViewable;
    const stopStroke = () => {
      stopSwipeSound(scratchHandleRef, scratchIdleRef);
      const stroke = strokeRef.current;
      strokeRef.current = null;
      if (stroke && gridRef.current?.hasPointerCapture(stroke.id)) gridRef.current.releasePointerCapture(stroke.id);
      setSwiping(false);
      setGuide(null);
      setActivity(value => value + 1);
    };
    const sync = () => {
      const next = !document.hidden && !pageHidden && hostVisible;
      setVisible(next);
      if (!next) {
        cancelWinRef.current?.();
        cancelWinRef.current = null;
        stopStroke();
      }
    };
    const hide = () => { pageHidden = true; sync(); };
    const show = () => { pageHidden = false; sync(); };
    const viewable = value => { hostVisible = Boolean(value); sync(); };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("blur", stopStroke);
    window.addEventListener("resize", stopStroke);
    try {
      if (typeof window.mraid?.isViewable === "function") hostVisible = Boolean(window.mraid.isViewable());
      if (typeof window.mraid?.addEventListener === "function" && typeof window.mraid?.removeEventListener === "function") {
        removeViewable = window.mraid.removeEventListener.bind(window.mraid, "viewableChange", viewable);
        window.mraid.addEventListener("viewableChange", viewable);
      }
    } catch { /* Standalone preview has no host lifecycle. */ }
    sync();
    return () => {
      stopSwipeSound(scratchHandleRef, scratchIdleRef);
      strokeRef.current = null;
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("blur", stopStroke);
      window.removeEventListener("resize", stopStroke);
      try { removeViewable?.(); } catch { /* Host disposed. */ }
    };
  }, []);

  useEffect(() => {
    if (!started || !visible || interactive) return;
    const timer = setTimeout(() => setInteractive(true), 1500);
    return () => clearTimeout(timer);
  }, [started, visible, interactive]);

  useEffect(() => {
    if (!interactive || !visible || swiping || complete) return;
    const timer = setTimeout(() => setGuide(usefulGuide(active, painted, !touchedRef.current)), touchedRef.current ? 2000 : 200);
    return () => clearTimeout(timer);
  }, [interactive, visible, swiping, complete, active, painted, activity]);

  function dismissGuide(event) {
    if (active === null && event?.target?.closest?.(".cherry-grid")) return;
    touchedRef.current = true;
    setGuide(null);
    setActivity(value => value + 1);
  }

  function pulsePalette(number, now, force = false) {
    if (!force && now - paletteBeatRef.current.time < 300) return;
    const beat = paletteBeatRef.current.beat + 1;
    paletteBeatRef.current = { time: now, beat };
    setPaletteFeedback({ number, phase: beat % 2 ? "a" : "b" });
  }

  function refreshSwipeSound(event, inside = true) {
    const handle = scratchHandleRef.current;
    if (!handle) return;
    clearTimeout(scratchIdleRef.current);
    handle.muted = !inside;
    if (!inside) return;
    retrySound(handle, event);
    scratchIdleRef.current = setTimeout(() => {
      if (scratchHandleRef.current === handle) handle.muted = true;
    }, 160);
  }

  function commitPaint(next, number, timeStamp) {
    paintedRef.current = next;
    setPainted(next);
    pulsePalette(number, timeStamp);
    if (!completedSoundRef.current.has(number) && CELLS.every(cell => cell.number !== number || next.has(cell.id))) {
      completedSoundRef.current.add(number);
      stopSwipeSound(scratchHandleRef, scratchIdleRef);
      if (next.size === CELLS.length) stopSound(clickHandleRef.current);
      const correctHandle = playSound(correctPool, { volume: 0.85, pendingMs: 1000 });
      if (next.size === CELLS.length) {
        cancelWinRef.current = waitForSoundCompletion(correctHandle, {
          onComplete: () => {
            cancelWinRef.current = null;
            const winHandle = playSound(winPool, { volume: 0.9, pendingMs: 1500 });
            setCelebrating(true);
            cancelWinRef.current = waitForSoundCompletion(winHandle, {
              minimumMs: 2900,
              onComplete: () => {
                cancelWinRef.current = null;
                setEndScene(true);
              },
            });
          },
        });
      }
    }
  }

  function paintPath(events) {
    const stroke = strokeRef.current;
    if (!stroke || !gridRef.current) return;
    const bounds = gridRef.current.getBoundingClientRect();
    const next = new Set(paintedRef.current);
    for (const event of events) {
      const point = { x: (event.clientX - bounds.left) * 887 / bounds.width, y: (event.clientY - bounds.top) * 935 / bounds.height };
      const from = stroke.point || point;
      for (const cell of CELLS) {
        if (cell.number === stroke.number && !next.has(cell.id) && crossesCell(from, point, cell)) next.add(cell.id);
      }
      stroke.point = point;
    }
    if (next.size !== paintedRef.current.size) {
      commitPaint(next, stroke.number, events.at(-1).timeStamp);
    }
  }

  function finishStroke(event) {
    if (strokeRef.current?.id !== event.pointerId) return;
    if (event.type === "pointerup") paintPath([event.nativeEvent]);
    stopSwipeSound(scratchHandleRef, scratchIdleRef);
    strokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setSwiping(false);
    setActivity(value => value + 1);
  }

  return (
    <main
      className="relative h-dvh w-full overflow-hidden overscroll-none bg-white select-none"
      data-started={started}
      data-interactive={interactive}
      data-visible={visible}
      data-complete={complete}
      data-celebrating={celebrating}
      data-ended={endScene}
      lang={language}
      onPointerDownCapture={dismissGuide}
      onKeyDownCapture={dismissGuide}
    >
      <div ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none">
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div ref={appRef} className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] gameplay-canvas">
            <img
              src={logo}
              alt="Simply Draw"
              className="pointer-events-none absolute left-1/2 top-[94px] z-10 w-[350px] -translate-x-1/2 select-none logo-entrance"
              draggable="false"
            />
            <h1
              className="pointer-events-none absolute left-1/2 top-[244px] z-10 m-0 w-[960px] -translate-x-1/2 select-none font-['Byrd_Simply'] text-[length:var(--heading-size)] leading-none font-extrabold whitespace-nowrap text-center text-[#8217FF] heading-entrance"
              style={{ "--heading-size": `${headingSize}px` }}
              dir={direction}
            >
              {copy.heading}
            </h1>
            <div
              ref={gridRef}
              className="absolute left-[96.5px] top-[425px] h-[935px] w-[887px] touch-none select-none cherry-grid"
              role="group"
              aria-label="Cherry color by number"
              aria-disabled={active === null || complete}
              data-awaiting-color={active === null}
              onPointerDown={event => {
                if (active === null || !started || !visible || complete || strokeRef.current || !event.isPrimary || event.button !== 0) return;
                event.preventDefault();
                strokeRef.current = { id: event.pointerId, number: active, point: null };
                handleUnlockGesture(event.nativeEvent);
                if (!completedSoundRef.current.has(active)) {
                  scratchHandleRef.current = playSound(scratchPool, { volume: 0.45, loop: true, gesture: event.nativeEvent });
                  refreshSwipeSound(event.nativeEvent);
                }
                event.currentTarget.setPointerCapture(event.pointerId);
                setSwiping(true);
                paintPath([event.nativeEvent]);
              }}
              onPointerMove={event => {
                if (strokeRef.current?.id !== event.pointerId) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                refreshSwipeSound(event.nativeEvent, event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom);
                const coalesced = event.nativeEvent.getCoalescedEvents?.() || [];
                paintPath([...coalesced, event.nativeEvent]);
              }}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onLostPointerCapture={finishStroke}
            >
              <canvas
                ref={paintRef}
                width={887}
                height={935}
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              />
              {CELLS.map((cell, index) => (
                <button
                  key={cell.id}
                  type="button"
                  className="absolute cursor-crosshair touch-none border-0 p-0 cherry-cell"
                  style={{ left: cell.x, top: cell.y, width: cell.width + 0.5, height: cell.height + 0.5, "--paint": COLORS[cell.number], "--cell-delay": `${180 + cell.row * 24 + (index % 7) * 13}ms` }}
                  data-cell={cell.id}
                  data-number={cell.number}
                  data-painted={painted.has(cell.id)}
                  aria-label={`Color ${cell.number}, cell ${index + 1}`}
                  aria-pressed={painted.has(cell.id)}
                  tabIndex={cell.number === active && !painted.has(cell.id) && started && !complete ? 0 : -1}
                  onClick={event => {
                    if (event.detail !== 0 || !started || complete || cell.number !== active || paintedRef.current.has(cell.id)) return;
                    const next = new Set(paintedRef.current).add(cell.id);
                    handleUnlockGesture(event.nativeEvent);
                    commitPaint(next, cell.number, event.timeStamp);
                    setActivity(value => value + 1);
                  }}
                />
              ))}
              <img
                src={cherry}
                alt="Numbered pixel cherry"
                className="pointer-events-none absolute left-0 top-0 z-[1] w-[887px] select-none cherry-numbers"
                draggable="false"
              />
            </div>
            {PALETTE.map((src, index) => (
              <img
                key={src}
                src={src}
                alt={`Color ${index + 1}`}
                className="pointer-events-none absolute top-[1456px] z-10 w-[128px] select-none palette-entrance"
                draggable="false"
                style={{ left: 172 + index * 152, "--palette-delay": `${650 + index * 90}ms` }}
                data-selected={active === index + 1}
                data-feedback={paletteFeedback?.number === index + 1 && active === index + 1 ? paletteFeedback.phase : undefined}
                data-group-complete={completedGroups[index]}
              />
            ))}
            {PALETTE.map((_, index) => (
              <button
                key={index}
                type="button"
                className="absolute top-[1446px] z-20 h-[148px] w-[148px] cursor-pointer touch-none bg-transparent focus-visible:outline-4 focus-visible:outline-[#8618ff] disabled:cursor-default palette-hit"
                style={{ left: 162 + index * 152 }}
                data-palette={index + 1}
                aria-label={completedGroups[index] ? `Color ${index + 1} complete` : `Select color ${index + 1}`}
                aria-pressed={active === index + 1}
                disabled={!started || completedGroups[index]}
                onClick={event => {
                  handleUnlockGesture(event.nativeEvent);
                  clickHandleRef.current = playSound(clickPool, { volume: 0.65, replace: true });
                  stopSwipeSound(scratchHandleRef, scratchIdleRef);
                  pulsePalette(index + 1, event.timeStamp, true);
                  const stroke = strokeRef.current;
                  strokeRef.current = null;
                  if (stroke && gridRef.current?.hasPointerCapture(stroke.id)) gridRef.current.releasePointerCapture(stroke.id);
                  setSwiping(false);
                  setActive(index + 1);
                  setActivity(value => value + 1);
                  dismissGuide();
                }}
              >
                {completedGroups[index] && <span className="pointer-events-none absolute inset-[6px] palette-complete" />}
              </button>
            ))}
            <Cta />
            {guide && !complete && !swiping && visible && (
              <img
                src={hand}
                alt="Swipe gesture guide"
                className="pointer-events-none absolute left-0 top-0 z-50 w-[130px] select-none hand-guide"
                draggable="false"
                aria-hidden="true"
                data-guide={guide.mode}
                style={{ "--start-x": `${guide.startX}px`, "--start-y": `${guide.startY}px`, "--from-x": `${guide.fromX || guide.startX}px`, "--from-y": `${guide.fromY || guide.startY}px`, "--to-x": `${guide.toX || guide.startX}px`, "--to-y": `${guide.toY || guide.startY}px` }}
              />
            )}
          </div>
        </div>
        <EndScene active={endScene} />
      </div>
    </main>
  );
}
