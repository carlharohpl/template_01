import { useCallback, useEffect, useRef, useState } from "react";
import winSceneSfx from "./Assets/sound/Correct 1.mp3";
import lossSceneSfx from "./Assets/sound/wrong3.mp3";
import endSceneSfx from "./Assets/sound/Pop Prize 3.wav";
import logo from "./Assets/img/logo.webp";
import headline from "./Assets/img/subtitle1.webp";
import bg from "./Assets/img/bg.webp";
import tryAgainBackground from "./Assets/img/tryagainbg.webp";
import { Cta } from "./components/cta";
import Scene2 from "./components/Scene2";
import EndScene from "./components/endscene";
import { SlotMachine } from "./components/SlotMachine";
import useScaleUI from "./hooks/useScaleUI";
import { useSound } from "./hooks/useSound";
import { calendarClock, holidayText, subscribeCalendarClock } from "./hooks/calendarClock";

const LOSS_SCENE_DELAY = 1200;
const RETRY_DELAY = 2000;
const END_SCENE_DELAY = 2500;
const END_SCENE_DATES = [{ startDate: "2026-11-17", endDate: "2026-11-30", text: "dh" }];

function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const [ready, setReady] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState("entrance");
  const [result, setResult] = useState(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [showEndScene, setShowEndScene] = useState(false);
  const [endSceneVisible, setEndSceneVisible] = useState(false);
  const [endCard, setEndCard] = useState(() => holidayText(calendarClock, END_SCENE_DATES, "default"));
  const timer = useRef(null);
  const resultStarted = useRef(false);
  const completionHandled = useRef(false);
  const endSceneStarted = useRef(false);
  const playWinSceneSfx = useSound(winSceneSfx, 0.8);
  const playLossSceneSfx = useSound(lossSceneSfx, 0.8);
  const playEndSceneSfx = useSound(endSceneSfx, 0.8);

  useEffect(() => subscribeCalendarClock(calendarClock, () => {
    setEndCard(holidayText(calendarClock, END_SCENE_DATES, "default"));
  }), []);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;
    let frame1;
    let frame2;
    let ctaTimer;
    const images = [];
    const start = () => {
      if (cancelled || scheduled) return;
      scheduled = true;
      clearTimeout(fallback);
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (cancelled) return;
          setReady(true);
          setPhase("idle");
          ctaTimer = window.setTimeout(() => setCtaReady(true), 1200);
        });
      });
    };
    const fallback = window.setTimeout(start, 1500);
    const sources = [...new Set([...wrapperRef.current.querySelectorAll("img")].map(image => image.src))];
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
    }))).then(start);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      clearTimeout(ctaTimer);
      clearTimeout(timer.current);
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      images.forEach(image => { image.onload = image.onerror = null; });
    };
  }, [wrapperRef]);

  const handleComplete = useCallback(won => {
    if (completionHandled.current) return;
    completionHandled.current = true;
    setPhase("settling");
    timer.current = window.setTimeout(() => {
      setResult(won);
      setPhase(won ? "win" : "loss");
    }, won ? 0 : LOSS_SCENE_DELAY);
  }, []);

  const handleSettled = useCallback(() => setPhase("settling"), []);

  const handleResultReady = useCallback(won => {
    if (resultStarted.current) return;
    resultStarted.current = true;
    setResultVisible(true);
    if (won) {
      playWinSceneSfx(END_SCENE_DELAY).then(() => setShowEndScene(true));
      return;
    }
    playLossSceneSfx(RETRY_DELAY).then(() => {
        setResult(null);
        setResultVisible(false);
        setPhase("retry");
        // Let the blur clear before the next spin becomes interactive.
        timer.current = window.setTimeout(() => {
          completionHandled.current = false;
          resultStarted.current = false;
          setAttempt(current => current + 1);
          setPhase("idle");
        }, 500);
    });
  }, [playWinSceneSfx, playLossSceneSfx]);

  const handleEndSceneReady = useCallback(() => {
    setEndSceneVisible(true);
    setPhase("end");
    if (endSceneStarted.current) return;
    endSceneStarted.current = true;
    playEndSceneSfx();
  }, [playEndSceneSfx]);

  return (
    <>
      <div
        ref={wrapperRef}
        className={`relative h-dvh w-full overflow-hidden overscroll-none bg-[#bbaa8b] ${ready ? "" : "scene-preparing"} ${endSceneVisible ? "scene-inactive" : ""}`}
        data-phase={phase}
        inert={endSceneVisible}
        aria-hidden={endSceneVisible || undefined}
      >
        <img
          src={bg}
          alt=""
          className={`pointer-events-none absolute inset-0 z-0 h-full w-full object-cover portrait:top-[-1.35%] portrait:h-[106.2%] portrait:object-[98%_50%] select-none background-treatment ${resultVisible ? "has-result" : ""}`}
          draggable="false"
        />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-10 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            className={`absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] gameplay-treatment ${resultVisible ? "has-result" : ""}`}
          >
            <div className="pointer-events-none absolute left-1/2 top-[234px] z-30 h-[210px] w-[calc((var(--viewport-width,1080px)+2px)/var(--ui-scale,1))] max-w-none -translate-x-1/2 bg-[#0F0F0F] entrance-asset banner-entrance" />
            <img
              src={headline}
              alt="Spin for your perfect shade"
              className="pointer-events-none absolute left-1/2 top-[279px] z-40 w-[551px] -translate-x-1/2 select-none entrance-asset headline-entrance"
              draggable="false"
            />
            <SlotMachine
              key={attempt}
              initialEntry={attempt === 0}
              ready={ready && (phase === "idle" || phase === "spinning")}
              onSpin={() => setPhase("spinning")}
              onComplete={handleComplete}
              onSettled={handleSettled}
            />
          </div>
        </div>
        <img
          src={tryAgainBackground}
          alt=""
          className={`pointer-events-none absolute inset-0 z-20 h-full w-full object-cover select-none result-shade ${resultVisible ? "is-visible" : ""}`}
          draggable="false"
        />
        <div className="pointer-events-none absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-30 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]">
            <img
              src={logo}
              alt="Jones Road"
              className="pointer-events-none absolute left-1/2 top-[55px] z-30 w-[682px] -translate-x-1/2 select-none entrance-asset logo-entrance"
              draggable="false"
            />
            {result !== null && <Scene2 won={result} onReady={handleResultReady} />}
            <Cta ready={ctaReady} active={!endSceneVisible} />
          </div>
        </div>
      </div>
      {showEndScene && <EndScene key={endCard} variant={endCard} onReady={handleEndSceneReady} />}
    </>
  );
}

export default App;
