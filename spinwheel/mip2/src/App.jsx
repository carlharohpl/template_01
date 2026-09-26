import { useCallback, useEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import { Cta, openClickthrough } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/logo.webp";
import bg from "./assets/img/bg.webp";
import subtitle1 from "./assets/img/subtitle1.webp";
import subtitle2 from "./assets/img/subtitle2.webp";
import subtitle3 from "./assets/img/subtitle3.webp";
import subtitle4 from "./assets/img/subtitle4.webp";
import subtitle5 from "./assets/img/subtitle5.webp";
import wheel from "./assets/img/wheel.webp";
import pointer from "./assets/img/arrow.webp";
import playbutton from "./assets/img/playbutton.webp";
import hand from "./assets/img/hand.webp";
import cta from "./assets/img/cta.webp";
import items from "./assets/img/items.webp";
import discount from "./assets/img/discount.webp";
import discount2 from "./assets/img/discount2.webp";
import line from "./assets/img/line.webp";
import spinSound from "./assets/sounds/spin.mp3";
import offerSound from "./assets/sounds/gamewin2.mp3";
import wrongSound from "./assets/sounds/wrong3.mp3";
import endSceneSound from "./assets/sounds/endscene1.mp3";

const ASSETS = [bg, logo, subtitle1, subtitle2, subtitle3, subtitle4, subtitle5, wheel, pointer, playbutton, hand, cta, items, discount, discount2, line];
const CONFETTI_COLORS = ["#FFB800", "#F59A00", "#FFD044"];
const RESULT_HOLD_MS = 1000;
const WIN_CHANCE = 0.7;
const END_SCENE_DELAY_MS = 2500;
const PRODUCT_REVEAL_HOLD_MS = 2500;
const END_SCENE_ENABLED = false;
const IS_SIP = import.meta.env.MODE === "sip3";

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
  const offerSoundPool = useSound(IS_SIP ? null : offerSound);
  const offerAudioRef = useRef(null);
  const offerSoundPlayedRef = useRef(false);
  const endSceneSoundPool = useSound(IS_SIP ? null : endSceneSound);
  const endSceneAudioRef = useRef(null);
  const endSceneSoundPlayedRef = useRef(false);
  const wrongSoundPool = useSound(IS_SIP ? null : wrongSound);
  const wrongAudioRef = useRef(null);
  const viewableRef = useRef(true);
  const phaseRef = useRef("loading");
  const [phase, setPhase] = useState("loading");
  const [offerReady, setOfferReady] = useState(false);
  const [offerDate, setOfferDate] = useState("");
  const [confettiPieces] = useState(createConfettiPieces);
  const spinRef = useRef({ from: 0, to: 0, attempt: 0, result: null });
  const [spin, setSpin] = useState({ from: 0, to: 0, attempt: 0, result: null });
  const showEndScene = phase === "complete" || phase === "endscene";
  const showOfferPanel = phase === "offer" || showEndScene;
  const hasWon = phase === "won" || showOfferPanel;
  const canSpin = phase === "idle" || phase === "retry";

  const changePhase = useCallback((next) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.load('700 68px "Brandon Grotesque"').catch(() => {});
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
      if (!cancelled && phaseRef.current === "loading") {
        if (IS_SIP) setOfferDate(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase());
        changePhase(IS_SIP ? "offer" : "idle");
      }
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
    stopSound(endSceneAudioRef.current);
    wrongAudioRef.current = null;
    offerAudioRef.current = null;
    endSceneAudioRef.current = null;
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
    if (IS_SIP) return;
    // A completed pointer click grants audio activation for mouse, touch, and pen.
    if (event.detail === 0 || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (!["idle", "retry"].includes(phaseRef.current) || !wheelRef.current) return;
    stopAllAudio();
    handleUnlockGesture();
    // Snapshot the CSS idle angle before switching animation ownership.
    const from = Number.parseFloat(getComputedStyle(wheelRef.current).rotate) || spinRef.current.to;
    const attempt = spinRef.current.attempt + 1;
    // Preserve the existing outcome odds. Each outcome has an exact stop angle:
    // six 60-degree segments, with the promotion at 0 and TRY AGAIN at 60.
    const result = Math.random() < WIN_CHANCE ? "promotion" : "try-again";
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
        if (phaseRef.current !== "won") return;
        setOfferDate(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase());
        changePhase("offer");
      }, PRODUCT_REVEAL_HOLD_MS);
    } else if (phase === "offer") {
      if (!IS_SIP && !endSceneSoundPlayedRef.current) {
        endSceneSoundPlayedRef.current = true;
        stopAllAudio();
        if (!document.hidden && viewableRef.current) {
          endSceneAudioRef.current = playSound(endSceneSoundPool);
        }
      }
      if (END_SCENE_ENABLED) {
        timer = window.setTimeout(() => {
          if (phaseRef.current === "offer") changePhase("complete");
        }, END_SCENE_DELAY_MS);
      }
    }
    return () => window.clearTimeout(timer);
  }, [phase, finishSpin, changePhase, offerSoundPool, offerReady, endSceneSoundPool, stopAllAudio]);

  const handleEndSceneReady = useCallback(() => {
    stopAllAudio();
    changePhase("endscene");
  }, [stopAllAudio, changePhase]);

  const wheelMotion = phase === "spinning" ? "wheel-spinning" : phase === "idle" || phase === "loading" ? "wheel-idle" : phase === "retry" ? "wheel-retry-idle" : "wheel-stopped";

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
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover select-none ${hasWon ? "scale-[1.04] blur-[20px]" : ""}`}
          draggable="false"
        />
        {!IS_SIP && <div className={`pointer-events-none absolute inset-x-[-20px] top-[calc(var(--ui-top,0px)_+_390px_*_var(--ui-scale,1))] h-[calc(164px_*_var(--ui-scale,1))] bg-[#1d1c1c] ${showOfferPanel ? "invisible" : hasWon ? "blur-[8px]" : ""}`} />}
        {hasWon && <div className="pointer-events-none absolute inset-0 z-[1] bg-[#FFEDED]/75 result-shade" />}
        <div
          className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-[3] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]"
        >
          <div
            ref={appRef}
            className={`absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible ${phase === "loading" ? "creative-loading" : ""}`}
          >
            {hasWon ? (
              <img
                src={logo}
                alt="Laura Geller"
                className="pointer-events-none absolute left-1/2 top-[58px] z-[65] w-[208px] -translate-x-1/2 select-none result-logo-enter"
                draggable="false"
              />
            ) : (
              <img
                src={logo}
                alt="Laura Geller"
                className="pointer-events-none absolute left-1/2 top-[58px] z-[65] w-[208px] -translate-x-1/2 select-none scene-entrance logo-enter"
                draggable="false"
              />
            )}
            <img
              src={subtitle1}
              alt="End of season sale"
              className={`pointer-events-none absolute left-1/2 top-[230px] z-10 w-[918px] -translate-x-1/2 select-none ${showOfferPanel ? "invisible" : hasWon ? "blur-[28px] opacity-[0.10]" : "scene-entrance sale-title-enter"}`}
              draggable="false"
            />
            <img
              src={subtitle2}
              alt="Tap to spin"
              className={`pointer-events-none absolute left-1/2 top-[426px] z-10 w-[444px] -translate-x-1/2 select-none ${showOfferPanel ? "invisible" : hasWon ? "blur-[28px] opacity-[0.14]" : "scene-entrance headline-enter"}`}
              draggable="false"
            />
            <div
              className={`pointer-events-none absolute left-[537.5px] top-0 z-20 h-[2202px] w-[1635px] max-w-none -translate-x-1/2 ${hasWon ? "" : "[mask-image:linear-gradient(to_bottom,#000_1430px,transparent_1640px)] [-webkit-mask-image:linear-gradient(to_bottom,#000_1430px,transparent_1640px)]"}`}
            >
              <img
                src={wheel}
                alt="Prize wheel with alternating up to 60% off plus an extra 10% off and TRY AGAIN segments"
                className={`pointer-events-none absolute left-1/2 top-[647px] z-20 w-[1475px] max-w-none -translate-x-1/2 select-none origin-[50.1695%_50.034%] offer-wheel scene-entrance ${wheelMotion} ${showOfferPanel ? "invisible" : hasWon ? "blur-[28px] opacity-[0.22]" : ""}`}
                draggable="false"
                ref={wheelRef}
                style={{ "--spin-from": `${spin.from}deg`, "--spin-to": `${spin.to}deg` }}
                onAnimationEnd={(event) => {
                  if (event.animationName === "wheel-spin" || event.animationName === "wheel-spin-reduced") finishSpin();
                }}
              />
            </div>
            {!hasWon && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[537.5px] top-0 z-[24] h-[2202px] w-[1635px] max-w-none -translate-x-1/2 [mask-image:linear-gradient(to_bottom,transparent_1430px,#000_1640px)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_1430px,#000_1640px)]"
              >
                {/* A stationary mask keeps the regular image blur below the rotating wheel's center. */}
                <img
                  src={wheel}
                  alt=""
                  className={`pointer-events-none absolute left-1/2 top-[647px] z-20 w-[1475px] max-w-none -translate-x-1/2 select-none origin-[50.1695%_50.034%] blur-[10px] offer-wheel wheel-blur-copy scene-entrance ${wheelMotion}`}
                  draggable="false"
                  style={{ "--spin-from": `${spin.from}deg`, "--spin-to": `${spin.to}deg` }}
                />
              </div>
            )}
            {!hasWon && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[1440px] z-[25] h-[calc((100dvh_-_var(--ui-top,0px))_/_var(--ui-scale,1)_-_1375px_+_2px)] w-[calc(100dvw_/_var(--ui-scale,1)_+_160px)] max-w-none -translate-x-1/2 bg-[linear-gradient(to_bottom,#ffffff00_0%,#bdabaa80_50%,#7b5755_100%)] [mask-image:linear-gradient(to_bottom,transparent_0%,#000_35%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_35%)]"
              />
            )}
            <img
              src={pointer}
              alt="Dark wheel pointer"
              className={`pointer-events-none absolute left-1/2 top-[579px] z-30 w-[140px] -translate-x-1/2 select-none scene-entrance ${phase === "idle" || phase === "loading" ? "pointer-enter pointer-idle" : phase === "retry" ? "pointer-idle" : phase === "spinning" ? "pointer-spinning" : "pointer-settled"} ${showOfferPanel ? "invisible" : hasWon ? "blur-[28px] opacity-[0.18]" : ""}`}
              draggable="false"
            />
            <img
              src={playbutton}
              alt="Play button"
              className={`pointer-events-none absolute left-1/2 top-[1074px] z-30 w-[602px] -translate-x-1/2 select-none ${showOfferPanel ? "invisible" : hasWon ? "blur-[28px] opacity-[0.18]" : "scene-entrance center-enter"}`}
              draggable="false"
            />
            <button
              ref={spinButtonRef}
              type="button"
              aria-label="Spin the wheel"
              aria-busy={phase === "spinning"}
              disabled={!canSpin}
              tabIndex={-1}
              className="absolute left-1/2 top-[1152px] z-40 h-[446px] w-[446px] -translate-x-1/2 touch-none cursor-pointer rounded-full border-0 bg-transparent disabled:cursor-default scene-entrance spin-hit-area"
            />
            {(canSpin || phase === "spinning") && (
              <img
                src={hand}
                alt="Hand cursor"
                className={`pointer-events-none absolute left-[630px] top-[1350px] z-50 w-[231px] -translate-x-1/2 select-none scene-entrance ${canSpin ? "hand-click" : "hand-exit"}`}
                draggable="false"
                aria-hidden="true"
              />
            )}
            <Cta won={hasWon} offerPanel={showOfferPanel} />
            {hasWon && (
              <>
                <img
                  src={subtitle3}
                  alt="Congratulations!"
                  className={`pointer-events-none absolute left-1/2 top-[244px] z-[70] w-[880px] -translate-x-1/2 select-none ${showOfferPanel ? "blur-[10px] opacity-[0.22]" : "winning-title"}`}
                  draggable="false"
                />
                <img
                  src={subtitle4}
                  alt="You've got"
                  className={`pointer-events-none absolute left-1/2 top-[353px] z-[70] w-[519px] -translate-x-1/2 select-none ${showOfferPanel ? "blur-[10px] opacity-[0.22]" : "benefit-enter"}`}
                  draggable="false"
                />
                <img
                  src={items}
                  alt="Laura Geller Cult Classic Kit product collection"
                  className={`pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2 select-none ${showOfferPanel ? "top-[685px] w-[840px] blur-[10px] opacity-[0.35]" : "top-[516px] w-[960px] kit-card-enter"}`}
                  draggable="false"
                />
                <img
                  src={subtitle5}
                  alt="Cult Classic Kit"
                  className={`pointer-events-none absolute left-1/2 z-[70] w-[717px] -translate-x-1/2 select-none ${showOfferPanel ? "top-[540px] blur-[10px] opacity-[0.22]" : "top-[1095px] kit-title-enter"}`}
                  draggable="false"
                />
                <img
                  src={discount}
                  alt="Up to 60% off sitewide plus an extra 10% off. Code: D15"
                  className={`pointer-events-none absolute left-1/2 top-[1227px] z-[70] w-[775px] -translate-x-1/2 select-none ${showOfferPanel ? "invisible" : "discount-enter"}`}
                  draggable="false"
                />
              </>
            )}
            {showOfferPanel && (
              <>
                <div className="pointer-events-none absolute left-1/2 top-[1034px] z-[75] h-[200%] w-[1080px] max-w-none -translate-x-1/2 rounded-t-[60px] bg-[#8F605C] offer-panel-enter" />
                <img
                  src={discount2}
                  alt="Up to 60% off sitewide plus an extra 10% off. Code: D15"
                  className="pointer-events-none absolute left-1/2 top-[1072px] z-[76] w-[775px] -translate-x-1/2 select-none offer-panel-discount"
                  draggable="false"
                />
                <img
                  src={line}
                  alt="Offer divider"
                  className="pointer-events-none absolute left-1/2 top-[1410px] z-[76] w-[812px] -translate-x-1/2 select-none offer-panel-line"
                  draggable="false"
                />
                <p
                  className="pointer-events-none absolute left-1/2 top-[1460px] z-[76] w-[850px] -translate-x-1/2 select-none font-['Brandon_Grotesque'] text-[68px] font-bold leading-[1] tracking-[0px] text-center text-white offer-panel-date"
                >
                  OFFER ENDS ON<br />{offerDate}
                </p>
              </>
            )}
            <p className="sr-only" role="status" aria-live="polite">
              {hasWon ? "Congratulations! You've got Cult Classic Kit. Up to 60% off sitewide plus an extra 10% off. Code: D15." : phase === "retry" || phase === "retry-settling" ? "TRY AGAIN. Tap the play button for another spin." : phase === "spinning" ? "The wheel is spinning." : "Tap to spin."}
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
      {showOfferPanel && !showEndScene && (
        <button
          type="button"
          aria-label="Open offer"
          tabIndex={-1}
          className="absolute inset-0 z-[90] h-full w-full touch-none cursor-pointer border-0 bg-transparent"
          onClick={(event) => {
            event.stopPropagation();
            if (event.detail === 0 || event.button !== 0) return;
            openClickthrough();
          }}
        />
      )}
      {!IS_SIP && END_SCENE_ENABLED && <EndScene active={showEndScene} onReady={handleEndSceneReady} />}
    </main>
  );
};

export default App;
