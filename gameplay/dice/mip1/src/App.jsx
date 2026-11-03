import { useCallback, useEffect, useRef, useState } from "react";
import handIcon from "./assets/img/Hand.webp";
import logo from "./assets/img/logo.webp";
import rollButton from "./assets/img/roll-button.webp";
import stopButton from "./assets/img/stop-button.webp";
import background from "./assets/img/bg.png";
import clickSfx from "./assets/sfx/click.mp3?inline";
import correctSfx from "./assets/sfx/Correct 2.mp3?inline";
import scanSfx from "./assets/sfx/scan.mp3?inline";
import popPrizeSfx from "./assets/sfx/Pop Prize 3.mp3?inline";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { bindSoundGestures, handleUnlockGesture, playSound, stopSound, waitForSoundCompletion } from "./hooks/useSound";

import diceIcon from "./assets/img/dice-icon.webp";
import textTutorial from "./assets/img/text-tutorial.webp";
import congrats from "./assets/img/congrats.webp";
import diceRolling from "./assets/img/dice-rolling.webp";
import diceReveal from "./assets/img/dice-reveal.webp";
import rollingText from "./assets/img/rolling-text.webp";
import textTutorial2 from "./assets/img/text-tutorial2.webp";


const scene1Sources = [diceIcon, textTutorial];
const scene2Sources = [congrats, diceRolling, diceReveal, rollingText, textTutorial2];
const palette = ["#38BDF8", "#94A3B8", "#0EA5E9", "#CBD5E1"];
const pieces = Array.from({ length: 72 }, (_, index) => {
  const angle = index * 5;
  const distance = 270 + (index % 9) * 41;
  return {
    "--x": `${Math.cos(angle * Math.PI / 180) * distance}px`,
    "--y": `${Math.sin(angle * Math.PI / 180) * distance}px`,
    "--rotate": `${angle * 1.8 + (index % 5) * 14}deg`,
    "--size": `${index % 4 === 0 ? 36 : 28}px`,
    "--color": palette[index % 4],
    "--duration": `${0.72 + (index % 4) * 0.07}s`,
    "--delay": "0s",
  };
});

function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const [scene, setScene] = useState(1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isActionPressed, setIsActionPressed] = useState(false);
  const [showEndScene, setShowEndScene] = useState(false);
  const [endVisible, setEndVisible] = useState(false);
  const [showHandHint, setShowHandHint] = useState(true);
  const clickPool = useSound(clickSfx, { backend: "media", poolSize: 1 });
  const correctPool = useSound(correctSfx, { backend: "media", poolSize: 1, overflow: "drop-new" });
  const scanPool = useSound(scanSfx, { backend: "media", poolSize: 1 });
  const endPool = useSound(popPrizeSfx, { backend: "media", poolSize: 1, overflow: "drop-new" });
  const timers = useRef(new Set());
  const actionLock = useRef(false);
  const scanHandle = useRef(null);
  const clickHandle = useRef(null);
  const completion = useRef(null);
  const revealStarted = useRef(0);
  const scene1Ready = useSceneReady(scene1Sources, scene === 1);
  const scene2Ready = useSceneReady(scene2Sources, scene === 2);
  const [burst, setBurst] = useState(false);
  const rollingStarted = useRef(false);

  useEffect(() => bindSoundGestures(wrapperRef.current, { keyboard: true }), [wrapperRef]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
      stopSound(scanHandle.current);
      stopSound(clickHandle.current);
      completion.current?.();
    };
  }, []);
  const later = (callback, ms) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, ms);
    timers.current.add(timer);
  };
  const handleRollStop = event => {
    if (actionLock.current || isStopped || showEndScene) return;
    actionLock.current = true;
    handleUnlockGesture(event.nativeEvent);
    clickHandle.current = playSound(clickPool, { volume: 0.3, pendingMs: 250 });
    setIsActionPressed(true);
    later(() => setIsActionPressed(false), 190);
    later(() => {
      if (scene === 1) {
        setScene(2);
        setShowHandHint(false);
        actionLock.current = false;
        later(() => setShowHandHint(true), 2000);
      } else {
        setIsStopped(true);
        later(() => {
          stopSound(scanHandle.current);
          revealStarted.current = performance.now();
          setIsRevealed(true);
        }, 700);
      }
    }, 310);
  };
  const handleRollingStart = useCallback(() => {
    scanHandle.current = playSound(scanPool, { volume: 0.3, loop: true });
  }, [scanPool]);
  const handleConfettiBurst = useCallback(() => {
    stopSound(scanHandle.current);
    stopSound(clickHandle.current);
    const cue = playSound(correctPool, { volume: 0.3 });
    completion.current = waitForSoundCompletion(cue, {
      minimumMs: Math.max(0, 2500 - (performance.now() - revealStarted.current)),
      onComplete: () => setShowEndScene(true),
    });
  }, [correctPool]);
  useEffect(() => {
    if (scene !== 2 || !scene2Ready || rollingStarted.current) return;
    rollingStarted.current = true;
    handleRollingStart();
  }, [scene, scene2Ready, handleRollingStart]);
  useEffect(() => {
    if (scene !== 2 || !scene2Ready || !isRevealed || !isStopped) return;
    const timer = setTimeout(() => {
      setBurst(true);
      handleConfettiBurst();
    }, 680);
    const cleanup = setTimeout(() => setBurst(false), 1610);
    return () => { clearTimeout(timer); clearTimeout(cleanup); };
  }, [scene, scene2Ready, isRevealed, isStopped, handleConfettiBurst]);
  const handleEndReady = useCallback(() => setEndVisible(true), []);

  return (
    <div ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none">
      <img
        src={background}
        alt=""
        className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover"
        draggable="false"
      />
      <div className={`absolute left-[var(--ui-left)] top-[var(--ui-top)] h-[var(--ui-height)] w-[var(--ui-width)] ${endVisible ? "gameplay-hidden" : ""}`} inert={showEndScene}>
        <div ref={appRef} className="relative h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]">
          <img
            src={logo}
            alt="Logo"
            className="pointer-events-none absolute left-1/2 top-[70px] z-10 w-[450px] -translate-x-1/2 select-none"
            draggable="false"
          />
          {scene === 1 ? (
            <>
              <img
                src={diceIcon}
                alt="Dice Icon"
                className={`pointer-events-none absolute left-1/2 top-[436.515625px] z-10 w-[270px] -translate-x-1/2 select-none scene-one-enter ${scene1Ready ? "is-ready" : ""}`}
                draggable="false"
              />
              <img
                src={textTutorial}
                alt="Text Tutorial"
                className={`pointer-events-none absolute left-1/2 top-[786.109375px] z-10 w-[650px] -translate-x-1/2 select-none scene-one-enter ${scene1Ready ? "is-ready" : ""}`}
                draggable="false"
              />
            </>
          ) : (
            <>
              <div className="pointer-events-none absolute left-1/2 top-[282.515625px] z-0 h-[220px] w-[5000px] max-w-none -translate-x-1/2 bg-[#BEDFF7]" />
              {isRevealed ? (
                <img
                  src={congrats}
                  alt="Congratulations"
                  className="pointer-events-none absolute left-1/2 top-[362.515625px] z-10 w-[864px] -translate-x-1/2 select-none"
                  draggable="false"
                />
              ) : (
                <>
                  <img
                    src={rollingText}
                    alt="Rolling Text"
                    className={`pointer-events-none absolute left-1/2 top-[322.515625px] z-10 w-[237.6px] -translate-x-1/2 select-none rolling-label ${isStopped ? "is-stopped" : ""}`}
                    draggable="false"
                  />
                  <img
                    src={textTutorial2}
                    alt="Text Tutorial 2"
                    className="pointer-events-none absolute left-1/2 top-[379.140625px] z-10 w-[756px] -translate-x-1/2 select-none"
                    draggable="false"
                  />
                </>
              )}
              <img
                src={diceRolling}
                alt="Dice Rolling"
                className={`pointer-events-none absolute left-1/2 z-0 w-[930px] -translate-x-1/2 select-none dice-rolling ${isRevealed ? "top-[490.359375px] is-revealed" : "top-[541.375px]"} ${scene2Ready ? "is-ready" : ""}`}
                draggable="false"
              />
              <img
                src={diceReveal}
                alt="Dice Reveal"
                className={`pointer-events-none absolute left-[55px] z-0 w-[930px] select-none dice-reveal ${isRevealed ? "top-[490.359375px] is-revealed" : "top-[541.375px]"} ${scene2Ready ? "is-ready" : ""}`}
                draggable="false"
              />
              {burst && (
                <div className="pointer-events-none absolute left-[540px] top-[947.2109375px] z-30 h-0 w-0 overflow-visible" aria-hidden="true">
                  {pieces.map((style, index) => <div key={index} className="confetti-piece" style={style} />)}
                </div>
              )}
            </>
          )}
          <img
            src={scene === 2 ? stopButton : rollButton}
            alt={scene === 2 ? "Stop Button" : "Roll Button"}
            className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 select-none action-art ${scene === 2 ? "top-[1397.875px] w-[500px]" : "top-[1120.421875px] w-[600px]"} ${isActionPressed ? "is-pressed" : ""} ${isStopped ? "is-stopped" : ""}`}
            draggable="false"
          />
          <button
            type="button"
            aria-label={scene === 2 ? "Stop dice" : "Roll dice"}
            className={`absolute left-1/2 z-10 -translate-x-1/2 cursor-pointer bg-transparent focus-visible:outline-2 ${scene === 2 ? "top-[1397.875px] h-[156.125px] w-[500px]" : "top-[1120.421875px] h-[143.578125px] w-[600px]"}`}
            onClick={handleRollStop}
            disabled={isStopped}
          />
          {!isStopped && showHandHint && (
            <img
              src={handIcon}
              alt="Hand"
              className={`pointer-events-none absolute z-20 w-[140px] select-none hand-hint ${scene === 2 ? "left-[590px] top-[1486.109375px]" : "left-[640px] top-[1196.109375px]"}`}
              draggable="false"
            />
          )}
          <Cta />
        </div>
      </div>
      {showEndScene && <EndScene soundPool={endPool} onReady={handleEndReady} />}
    </div>
  );
}

function useSceneReady(sources, enabled = true) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    let first;
    let second;
    Promise.allSettled(sources.map(src => {
      const image = new Image();
      image.src = src;
      return prepareImage(image, 1800, controller.signal);
    })).then(() => {
      if (cancelled) return;
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          if (!cancelled) setReady(true);
        });
      });
    });
    return () => {
      cancelled = true;
      controller.abort();
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [sources, enabled]);
  return ready;
}

function prepareImage(image, timeoutMs = 1800, signal) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", finish);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const decode = () => {
      if (typeof image.decode !== "function") { finish(); return; }
      try { Promise.resolve(image.decode()).then(finish, finish); }
      catch { finish(); }
    };
    const timer = setTimeout(finish, timeoutMs);
    image.addEventListener("load", decode, { once: true });
    image.addEventListener("error", finish, { once: true });
    signal?.addEventListener("abort", finish, { once: true });
    if (signal?.aborted) finish();
    else if (image.complete) decode();
  });
}

export default App;
