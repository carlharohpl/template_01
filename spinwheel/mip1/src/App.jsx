import { useCallback, useEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/newassets/logo.webp";
import subtitle1 from "./assets/img/newassets/subtitle1.webp";
import wheel from "./assets/img/newassets/wheel.webp";
import shadow from "./assets/img/newassets/shadow.webp";
import clickhere from "./assets/img/newassets/clickhere.webp";
import hand from "./assets/img/newassets/hand.webp";
import cta from "./assets/img/newassets/cta.webp";
import spinSound from "./assets/sounds/spin.mp3";
import gamewinSound from "./assets/sounds/gamewin1.mp3";

const ASSETS = [logo, subtitle1, wheel, shadow, clickhere, hand, cta];
const CONFETTI_COLORS = ["#4D523C", "#323429", "#2A2A2A", "#FFFFFF"];
const WIN_HOLD_MS = 3000;

function createConfettiPieces() {
  return Array.from({ length: 320 }, (_, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 520 + Math.random() * 1690;
    return {
      id,
      color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
      width: 19.2 + Math.random() * 12.8,
      height: 25.6 + Math.random() * 19.2,
      delay: Math.random() * 0.2,
      // Finish every piece within the three-second result hold.
      duration: 2.6 + Math.random() * 0.2,
      rotate: (Math.random() - 0.5) * 900,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance + 200 + Math.random() * 300,
    };
  });
}

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const wheelRef = useRef(null);
  const spinButtonRef = useRef(null);
  const spinAudioRef = useRef(null);
  const winSoundPool = useSound(gamewinSound);
  const winAudioRef = useRef(null);
  const viewableRef = useRef(true);
  const phaseRef = useRef("loading");
  const [phase, setPhase] = useState("loading");
  const [confettiPieces] = useState(createConfettiPieces);
  const [spin, setSpin] = useState({ from: 20, to: 2160 });
  const showEndScene = phase === "complete" || phase === "endscene";
  const hasWon = phase === "won" || showEndScene;

  const changePhase = useCallback((next) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ASSETS.map((src) => new Promise((resolve) => {
      const asset = new Image();
      asset.onload = resolve;
      asset.onerror = resolve;
      asset.src = src;
    }))).then(() => {
      if (!cancelled) changePhase("idle");
    });
    return () => { cancelled = true; };
  }, [changePhase]);

  const stopAllAudio = useCallback(() => {
    stopSound(spinAudioRef.current);
    stopSound(winAudioRef.current);
    spinAudioRef.current = null;
    winAudioRef.current = null;
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stopAllAudio();
    };
    const onViewableChange = (viewable) => {
      viewableRef.current = Boolean(viewable);
      if (!viewable) stopAllAudio();
    };
    // React is mounted only after the existing MRAID readiness guard.
    const mraid = window.mraid;
    try {
      viewableRef.current = mraid?.isViewable?.() ?? true;
    } catch {
      // Preview bridges may not expose viewability.
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    mraid?.addEventListener?.("viewableChange", onViewableChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      mraid?.removeEventListener?.("viewableChange", onViewableChange);
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const startSpin = useCallback((event) => {
    // A completed pointer click grants audio activation for mouse, touch, and pen.
    if (event.detail === 0 || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (phaseRef.current !== "idle" || !wheelRef.current) return;
    handleUnlockGesture();
    // Read once before replacing the CSS idle animation, preserving its exact pose.
    const rotation = Number.parseFloat(getComputedStyle(wheelRef.current).rotate);
    const from = Number.isFinite(rotation) ? rotation : 20;
    // Whole turns place the supplied 60% OFF segment beneath the fixed top pointer.
    const to = Math.ceil((from + 5 * 360) / 360) * 360;
    changePhase("spinning");
    setSpin({ from, to });
    // Construct within the real gesture; preserve the original cue's playback speed.
    if (!document.hidden && viewableRef.current) {
      const audio = new Audio(spinSound);
      spinAudioRef.current = audio;
      audio.play().catch((error) => {
        if (error.name !== "AbortError") console.warn("Spin sound could not start", error);
      });
    }
  }, [changePhase]);

  useEffect(() => {
    // Play and unlock directly on the tapped element, within its native gesture.
    const button = spinButtonRef.current;
    button.addEventListener("click", startSpin);
    return () => button.removeEventListener("click", startSpin);
  }, [startSpin]);

  const finishSpin = useCallback(() => {
    if (phaseRef.current !== "spinning") return;
    stopAllAudio();
    changePhase("won");
    if (!document.hidden && viewableRef.current) {
      winAudioRef.current = playSound(winSoundPool);
    }
  }, [changePhase, stopAllAudio, winSoundPool]);

  useEffect(() => {
    let timer;
    if (phase === "spinning") {
      // Read CSS timing so suppressed animation events cannot strand gameplay.
      const durations = getComputedStyle(wheelRef.current).animationDuration.split(",");
      const duration = Math.max(...durations.map((value) => Number.parseFloat(value) * 1000));
      timer = window.setTimeout(finishSpin, duration + 300);
    } else if (phase === "won") {
      // Hold the locked result and confetti before loading the supplied end scene.
      timer = window.setTimeout(() => changePhase("complete"), WIN_HOLD_MS);
    }
    return () => window.clearTimeout(timer);
  }, [phase, finishSpin, changePhase]);

  const handleEndSceneReady = useCallback(() => {
    stopAllAudio();
    changePhase("endscene");
  }, [stopAllAudio, changePhase]);

  const wheelMotion = phase === "idle" ? "wheel-idle" : phase === "spinning" ? "wheel-spinning" : hasWon ? "wheel-stopped" : "";

  return (
    <main className="relative h-dvh w-full overflow-visible overscroll-none bg-[#292929]" data-phase={phase}>
      <div
        ref={wrapperRef}
        inert={phase === "endscene"}
        aria-hidden={phase === "endscene"}
        className="relative h-dvh w-full overflow-hidden overscroll-none touch-none select-none bg-[linear-gradient(to_bottom,#F9F7F2_0%,#4D523C_100%)]"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(var(--ui-top,0px)_+_1321px_*_var(--ui-scale,1))] bg-white" />
        <div
          className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]"
        >
          <div
            ref={appRef}
            className={`absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible ${phase === "loading" ? "creative-loading" : ""}`}
          >
            <img
              src={logo}
              alt="Prose"
              className="pointer-events-none absolute left-1/2 top-[74px] z-10 w-[245px] -translate-x-1/2 select-none scene-entrance logo-enter"
              draggable="false"
            />
            <img
              src={subtitle1}
              alt="Spin to reveal your special offer"
              className="pointer-events-none absolute left-1/2 top-[220px] z-10 w-[930px] -translate-x-1/2 select-none scene-entrance headline-enter"
              draggable="false"
            />
            <img
              src={shadow}
              alt="Wheel shadow"
              className="pointer-events-none absolute left-1/2 top-[1370px] z-10 w-[930px] -translate-x-1/2 select-none scene-entrance shadow-enter"
              draggable="false"
            />
            <img
              src={wheel}
              alt="Prize wheel with 60% OFF, FREE WELCOME KIT, and TRY AGAIN segments"
              className={`pointer-events-none absolute left-1/2 top-[535px] z-20 w-[1030px] -translate-x-1/2 select-none offer-wheel scene-entrance ${wheelMotion}`}
              draggable="false"
              ref={wheelRef}
              style={{ "--spin-from": `${spin.from}deg`, "--spin-to": `${spin.to}deg` }}
              onAnimationEnd={(event) => {
                if (event.animationName === "wheel-spin" || event.animationName === "wheel-spin-reduced") finishSpin();
              }}
            />
            <img
              src={clickhere}
              alt="Click here"
              className="pointer-events-none absolute left-1/2 top-[870px] z-30 w-[300px] -translate-x-1/2 select-none scene-entrance center-enter"
              draggable="false"
            />
            <button
              ref={spinButtonRef}
              type="button"
              aria-label="Spin the wheel"
              aria-busy={phase === "spinning"}
              disabled={phase !== "idle"}
              tabIndex={-1}
              className="absolute left-1/2 top-[895px] z-40 h-[250px] w-[250px] -translate-x-1/2 touch-none cursor-pointer rounded-full border-0 bg-transparent disabled:cursor-default scene-entrance spin-hit-area"
            />
            {(phase === "idle" || phase === "spinning") && (
              <img
                src={hand}
                alt="Hand cursor"
                className={`pointer-events-none absolute left-[615px] top-[1090px] z-50 w-[182px] -translate-x-1/2 select-none scene-entrance ${phase === "idle" ? "hand-click" : "hand-exit"}`}
                draggable="false"
                aria-hidden="true"
              />
            )}
            <Cta />
            {phase === "won" && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[60] overflow-visible"
              >
                {confettiPieces.map((piece) => (
                  <div
                    key={piece.id}
                    className="absolute left-[540px] top-[1050px] animate-confetti-burst"
                    style={{
                      width: piece.width,
                      height: piece.height,
                      backgroundColor: piece.color,
                      "--x": `${piece.x}px`,
                      "--y": `${piece.y}px`,
                      "--rotate": `${piece.rotate}deg`,
                      "--duration": `${piece.duration}s`,
                      "--delay": `${piece.delay}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <p className="sr-only" role="status" aria-live="polite">
              {hasWon ? "60% OFF with a FREE WELCOME KIT." : phase === "spinning" ? "The wheel is spinning." : "Spin to reveal your special offer."}
            </p>
          </div>
        </div>
      </div>
      <EndScene active={showEndScene} onReady={handleEndSceneReady} />
    </main>
  );
};

export default App;
