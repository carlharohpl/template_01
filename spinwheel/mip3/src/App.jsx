import { useCallback, useEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logoblack from "./assets/img/newassets/logoblack.webp";
import logowhite from "./assets/img/newassets/logowhite.webp";
import bg from "./assets/img/newassets/bg.webp";
import subtitle1 from "./assets/img/newassets/subtitle1.webp";
import wheel from "./assets/img/newassets/wheel.webp";
import pointer from "./assets/img/newassets/pointer.webp";
import playbutton from "./assets/img/newassets/playbutton.webp";
import hand from "./assets/img/hand.webp";
import ctablack from "./assets/img/newassets/ctablack.webp";
import ctawhite from "./assets/img/newassets/ctawhite.webp";
import congratulations from "./assets/img/newassets/congratulations.webp";
import item1 from "./assets/img/newassets/item1.webp";
import item2 from "./assets/img/newassets/item2.webp";
import item3 from "./assets/img/newassets/item3.webp";
import item4 from "./assets/img/newassets/item4.webp";
import spinSound from "./assets/sounds/spin.mp3";
import offerSound from "./assets/sounds/gamewin2.mp3";
import wrongSound from "./assets/sounds/wrong3.mp3";

const ASSETS = [bg, logoblack, logowhite, subtitle1, wheel, pointer, playbutton, hand, ctablack, ctawhite, congratulations, item1, item2, item3, item4];
const CONFETTI_COLORS = ["#FFB800", "#F59A00", "#FFD044"];
const RESULT_HOLD_MS = 1000;
const WIN_CHANCE = 0.7;
const END_SCENE_DELAY_MS = 2500;

function createConfettiPieces() {
  return Array.from({ length: 48 }, (_, id) => {
    return {
      id,
      color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
      width: 7 + Math.random() * 15,
      height: 13 + Math.random() * 22,
      delay: -Math.random() * 8,
      duration: 6 + Math.random() * 4,
      rotate: (Math.random() - 0.5) * 900,
      x: Math.random() * 1080,
    };
  });
}

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const wheelRef = useRef(null);
  const spinButtonRef = useRef(null);
  const spinAudioRef = useRef(null);
  const offerSoundPool = useSound(offerSound);
  const offerAudioRef = useRef(null);
  const offerSoundPlayedRef = useRef(false);
  const wrongSoundPool = useSound(wrongSound);
  const wrongAudioRef = useRef(null);
  const viewableRef = useRef(true);
  const phaseRef = useRef("loading");
  const [phase, setPhase] = useState("loading");
  const [offerReady, setOfferReady] = useState(false);
  const [confettiPieces] = useState(createConfettiPieces);
  const spinRef = useRef({ from: 0, to: 0, attempt: 0, result: null });
  const [spin, setSpin] = useState({ from: 0, to: 0, attempt: 0, result: null });
  const showEndScene = phase === "complete" || phase === "endscene";
  const hasWon = phase === "won" || showEndScene;
  const canSpin = phase === "idle" || phase === "retry";

  const changePhase = useCallback((next) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ASSETS.map((src) => new Promise((resolve) => {
      const asset = new Image();
      asset.onload = () => {
        if (asset.decode) asset.decode().catch(() => {}).then(resolve);
        else resolve();
      };
      asset.onerror = resolve;
      asset.src = src;
    }))).then(() => {
      // Fast Refresh reruns effects; only initial loading may reset gameplay.
      if (!cancelled && phaseRef.current === "loading") changePhase("idle");
    });
    return () => { cancelled = true; };
  }, [changePhase]);

  useEffect(() => {
    if (!hasWon) return;
    let secondFrame;
    // Let WebKit paint the prepared image layers before releasing their CSS entrances.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setOfferReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [hasWon]);

  const stopAllAudio = useCallback(() => {
    stopSound(spinAudioRef.current);
    // Rewind during the result hold so the next tap reuses a ready audio player.
    if (spinAudioRef.current?.readyState > 0 && spinAudioRef.current.currentTime !== 0) {
      spinAudioRef.current.currentTime = 0;
    }
    stopSound(wrongAudioRef.current);
    stopSound(offerAudioRef.current);
    wrongAudioRef.current = null;
    offerAudioRef.current = null;
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
    if (!["idle", "retry"].includes(phaseRef.current) || !wheelRef.current) return;
    stopAllAudio();
    handleUnlockGesture();
    const from = spinRef.current.to;
    const attempt = spinRef.current.attempt + 1;
    // Six 60-degree segments: 0 centers FREE TRIAL, 60 centers TRY AGAIN.
    // Choose once per accepted tap, then animate to that segment's exact center.
    const result = Math.random() < WIN_CHANCE ? "free-trial" : "try-again";
    const target = result === "try-again" ? 60 : 0;
    const to = from + 5 * 360 + ((target - (from % 360) + 360) % 360);
    spinRef.current = { from, to, attempt, result };
    changePhase("spinning");
    setSpin(spinRef.current);
    // First construct inside a real gesture, then reuse the unlocked player on retries.
    if (!document.hidden && viewableRef.current) {
      const audio = spinAudioRef.current || new Audio(spinSound);
      spinAudioRef.current = audio;
      audio.play().catch((error) => {
        if (error.name !== "AbortError") console.warn("Spin sound could not start", error);
      });
    }
  }, [changePhase, stopAllAudio]);

  useEffect(() => {
    // Play and unlock directly on the tapped element, within its native gesture.
    const button = spinButtonRef.current;
    button.addEventListener("click", startSpin);
    return () => button.removeEventListener("click", startSpin);
  }, [startSpin]);

  const finishSpin = useCallback(() => {
    if (phaseRef.current !== "spinning") return;
    stopAllAudio();
    if (spinRef.current.result === "try-again") {
      changePhase("retry-settling");
      if (!document.hidden && viewableRef.current) {
        wrongAudioRef.current = playSound(wrongSoundPool);
      }
      return;
    }
    changePhase("won");
  }, [changePhase, stopAllAudio, wrongSoundPool]);

  useEffect(() => {
    let timer;
    if (phase === "spinning") {
      // Read CSS timing so suppressed animation events cannot strand gameplay.
      const durations = getComputedStyle(wheelRef.current).animationDuration.split(",");
      const duration = Math.max(...durations.map((value) => Number.parseFloat(value) * 1000));
      const checkFinished = () => {
        // A paused/background animation must finish before revealing the result.
        const active = wheelRef.current?.getAnimations?.().some((animation) =>
          ["running", "paused"].includes(animation.playState));
        if (active) timer = window.setTimeout(checkFinished, 200);
        else finishSpin();
      };
      timer = window.setTimeout(checkFinished, duration + 300);
    } else if (phase === "retry-settling") {
      timer = window.setTimeout(() => {
        if (phaseRef.current === "retry-settling") changePhase("retry");
      }, RESULT_HOLD_MS);
    } else if (phase === "won" && offerReady) {
      if (!offerSoundPlayedRef.current) {
        offerSoundPlayedRef.current = true;
        if (!document.hidden && viewableRef.current) {
          offerAudioRef.current = playSound(offerSoundPool);
        }
      }
      timer = window.setTimeout(() => {
        if (phaseRef.current === "won") changePhase("complete");
      }, END_SCENE_DELAY_MS);
    }
    return () => window.clearTimeout(timer);
  }, [phase, finishSpin, changePhase, offerSoundPool, offerReady]);

  const handleEndSceneReady = useCallback(() => {
    stopAllAudio();
    changePhase("endscene");
  }, [stopAllAudio, changePhase]);

  const wheelMotion = phase === "spinning" ? "wheel-spinning" : phase === "idle" || phase === "loading" ? "wheel-idle" : "wheel-stopped";

  return (
    <main className="relative h-dvh w-full overflow-visible overscroll-none bg-[#fcf0ee]" data-phase={phase} data-result={spin.result} data-offer-ready={offerReady}>
      <div
        ref={wrapperRef}
        inert={phase === "endscene"}
        aria-hidden={phase === "endscene"}
        className="relative h-dvh w-full overflow-hidden overscroll-none touch-none select-none bg-[#fcf0ee]"
        onContextMenu={(event) => event.preventDefault()}
      >
        <img
          src={bg}
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover select-none ${hasWon ? "scale-[1.04] blur-[8px]" : ""}`}
          draggable="false"
        />
        <div className={`pointer-events-none absolute inset-x-[-20px] top-[calc(var(--ui-top,0px)_+_338px_*_var(--ui-scale,1))] h-[calc(164px_*_var(--ui-scale,1))] bg-[#1d1c1c] ${hasWon ? "blur-[8px]" : ""}`} />
        {hasWon && <div className="pointer-events-none absolute inset-0 z-[1] bg-[#292625]/65 result-shade" />}
        <div
          className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-[3] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]"
        >
          <div
            ref={appRef}
            className={`absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible ${phase === "loading" ? "creative-loading" : ""}`}
          >
            {hasWon ? (
              <img
                src={logowhite}
                alt="Laura Geller"
                className="pointer-events-none absolute left-1/2 top-[117px] z-[65] w-[256px] -translate-x-1/2 select-none result-logo-enter"
                draggable="false"
              />
            ) : (
              <img
                src={logoblack}
                alt="Laura Geller"
                className="pointer-events-none absolute left-1/2 top-[117px] z-[65] w-[256px] -translate-x-1/2 select-none scene-entrance logo-enter"
                draggable="false"
              />
            )}
            <img
              src={subtitle1}
              alt="Tap to spin"
              className={`pointer-events-none absolute left-1/2 top-[381px] z-10 w-[435px] -translate-x-1/2 select-none scene-entrance headline-enter ${hasWon ? "invisible" : ""}`}
              draggable="false"
            />
            <img
              src={wheel}
              alt="Prize wheel with alternating FREE TRIAL and TRY AGAIN segments"
              className={`pointer-events-none absolute left-1/2 top-[634px] z-20 w-[990px] -translate-x-1/2 select-none origin-center offer-wheel scene-entrance ${wheelMotion} ${hasWon ? "blur-[28px] opacity-[0.08]" : ""}`}
              draggable="false"
              ref={wheelRef}
              style={{ "--spin-from": `${spin.from}deg`, "--spin-to": `${spin.to}deg` }}
              onAnimationEnd={(event) => {
                if (event.animationName === "wheel-spin" || event.animationName === "wheel-spin-reduced") finishSpin();
              }}
            />
            <img
              src={pointer}
              alt="Pink pointer"
              className={`pointer-events-none absolute left-1/2 top-[584px] z-30 w-[148px] -translate-x-1/2 select-none scene-entrance ${phase === "spinning" ? "pointer-spinning" : phase === "idle" || phase === "loading" ? "pointer-enter" : "pointer-settled"} ${hasWon ? "invisible" : ""}`}
              draggable="false"
            />
            <img
              src={playbutton}
              alt="Play button"
              className={`pointer-events-none absolute left-1/2 top-[978px] z-30 w-[300px] -translate-x-1/2 select-none scene-entrance center-enter ${hasWon ? "invisible" : ""}`}
              draggable="false"
            />
            <button
              ref={spinButtonRef}
              type="button"
              aria-label="Spin the wheel"
              aria-busy={phase === "spinning"}
              disabled={!canSpin}
              tabIndex={-1}
              className="absolute left-1/2 top-[634px] z-40 h-[990px] w-[990px] -translate-x-1/2 touch-none cursor-pointer rounded-full border-0 bg-transparent disabled:cursor-default scene-entrance spin-hit-area"
            />
            {(canSpin || phase === "spinning") && (
              <img
                src={hand}
                alt="Hand cursor"
                className={`pointer-events-none absolute left-[647px] top-[1110px] z-50 w-[200px] -translate-x-1/2 select-none scene-entrance ${canSpin ? "hand-click" : "hand-exit"}`}
                draggable="false"
                aria-hidden="true"
              />
            )}
            <Cta won={hasWon} />
            {hasWon && (
              <>
                <img
                  src={item1}
                  alt="Laura Geller product one"
                  className="pointer-events-none absolute left-[250px] top-[65px] z-[60] w-[870px] -translate-x-1/2 select-none product-one"
                  draggable="false"
                />
                <img
                  src={item2}
                  alt="Laura Geller product two"
                  className="pointer-events-none absolute left-[450px] top-[65px] z-[60] w-[870px] -translate-x-1/2 select-none product-two"
                  draggable="false"
                />
                <img
                  src={item3}
                  alt="Laura Geller product three"
                  className="pointer-events-none absolute left-[650px] top-[65px] z-[60] w-[870px] -translate-x-1/2 select-none product-three"
                  draggable="false"
                />
                <img
                  src={item4}
                  alt="Laura Geller product four"
                  className="pointer-events-none absolute left-[850px] top-[65px] z-[60] w-[870px] -translate-x-1/2 select-none product-four"
                  draggable="false"
                />
                <img
                  src={congratulations}
                  alt="Congratulations! You Just Got Access to Try Laura Geller At Home for $0. Try for $0. 14-Day Free Trial. Love It? Keep It! Or Return for Free."
                  className="pointer-events-none absolute left-1/2 top-[496px] z-[70] w-[933px] -translate-x-1/2 select-none offer-enter"
                  draggable="false"
                />
              </>
            )}
            <p className="sr-only" role="status" aria-live="polite">
              {hasWon ? "FREE TRIAL! Try Laura Geller at home for $0." : phase === "retry" || phase === "retry-settling" ? "TRY AGAIN. Tap the wheel for another spin." : phase === "spinning" ? "The wheel is spinning." : "Tap to spin."}
            </p>
          </div>
        </div>
        {hasWon && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
          >
            {confettiPieces.map((piece) => (
              <div
                key={piece.id}
                className="absolute top-0 result-confetti"
                style={{
                  width: `max(2px, ${piece.width}px * var(--ui-scale, 1))`,
                  height: `max(3px, ${piece.height}px * var(--ui-scale, 1))`,
                  backgroundColor: piece.color,
                  left: `${piece.x / 1080 * 100}%`,
                  "--rotate": `${piece.rotate}deg`,
                  "--duration": `${piece.duration}s`,
                  "--delay": `${piece.delay}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <EndScene active={showEndScene} onReady={handleEndSceneReady} />
    </main>
  );
};

export default App;
