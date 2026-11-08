import { useCallback, useEffect, useRef, useState } from "react";
import clickSfx from "./assets/sound/click.wav?inline";
import spinSfx from "./assets/sound/sfx4.mp3?inline";
import reelResultSfx from "./assets/sound/reveal1.mp3?inline";
import winSceneSfx from "./assets/sound/Correct 1.mp3?inline";
import endSceneSfx from "./assets/sound/Pop Prize 3.wav?inline";
import lossSceneSfx from "./assets/sound/wrong3.mp3?inline";
import logo from "./assets/img/brooklinen-logo.webp";
import headline from "./assets/img/dream-sheets-headline.webp";
import { Cta } from "./components/cta";
import Scene2 from "./components/scene2";
import EndScene from "./components/endscene";
import { SlotMachine } from "./components/slotmachine";
import useScaleUI from "./hooks/useScaleUI";
import { bindSoundGestures, unlockSounds, useSound  } from "./hooks/useSound";

function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  useEffect(() => bindSoundGestures(wrapperRef.current), [wrapperRef]);
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState("entrance");
  const [stopped, setStopped] = useState([]);
  const [result, setResult] = useState(null);
  const [blurred, setBlurred] = useState(false);
  const [showEndScene, setShowEndScene] = useState(false);
  const [endSceneVisible, setEndSceneVisible] = useState(false);
  const endSceneStarted = useRef(false);
  const locked = useRef(true);
  const stoppedReels = useRef(new Set());
  const spinComplete = useRef(false);
  const resultStarted = useRef(false);
  const spinPlayback = useRef(Promise.resolve());
  const timers = useRef(new Set());
  const generation = useRef(0);
  const playClick = useSound(clickSfx, 0.8);
  const playSpin = useSound(spinSfx, 0.8);
  const playReelResult = useSound(reelResultSfx, 0.8);
  const playWinScene = useSound(winSceneSfx, 0.8);
  const playLossScene = useSound(lossSceneSfx, 0.8);
  const playEndScene = useSound(endSceneSfx, 0.8);

  const later = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      callback();
    }, delay);
    timers.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const entry = ++generation.current;
    let scheduled = false;
    let frame1;
    let frame2;
    const images = [];
    const pending = timers.current;
    const start = () => {
      if (generation.current !== entry || scheduled) return;
      scheduled = true;
      clearTimeout(fallback);
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (generation.current !== entry) return;
          setReady(true);
          later(() => {
            locked.current = false;
            setInteractive(true);
            setPhase("idle");
          }, 1180);
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
      generation.current = entry + 1;
      clearTimeout(fallback);
      pending.forEach(window.clearTimeout);
      pending.clear();
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      images.forEach(image => { image.onload = image.onerror = null; });
    };
  }, [later, wrapperRef]);

  const finishSpin = useCallback(() => {
    if (spinComplete.current) return;
    spinComplete.current = true;
    setStopped([0, 1, 2]);
    const won = attempt === 1;
    setPhase(won ? "win-feedback" : "loss-feedback");
    const entry = generation.current;
    // Start the result cue with the settled symbols for either outcome; retain its
    // actual completion gate before revealing the result overlay.
    const resultPlayback = playReelResult();
    later(() => {
      Promise.all([spinPlayback.current, resultPlayback]).then(() => {
        if (generation.current !== entry) return;
        setBlurred(true);
        setResult(won);
        setPhase(won ? "win" : "loss");
      });
    }, won ? 650 : 500);
  }, [attempt, later, playReelResult]);

  useEffect(() => {
    if (phase !== "spinning") return undefined;
    const fallback = window.setTimeout(finishSpin, 3500);
    return () => window.clearTimeout(fallback);
  }, [phase, finishSpin]);

  const handleStopped = index => {
    if (spinComplete.current || stoppedReels.current.has(index)) return;
    stoppedReels.current.add(index);
    setStopped([...stoppedReels.current]);
    if (stoppedReels.current.size === 3) finishSpin();
  };

  const handleSpin = event => {
    event.stopPropagation();
    const touchStart = event.type === "touchstart";
    if (locked.current || !interactive) return;
    if (touchStart ? event.touches.length !== 1 : event.button !== 0 || event.isPrimary === false) return;
    locked.current = true;
    unlockSounds(event.nativeEvent);
    playClick();
    setPhase("spinning");
    setStopped([]);
    stoppedReels.current.clear();
    spinComplete.current = false;
    spinPlayback.current = playSpin();
  };

  const handleResultReady = useCallback(won => {
    if (resultStarted.current) return;
    resultStarted.current = true;
    const entry = generation.current;
    if (won) {
      playWinScene(2500).then(() => {
        if (generation.current === entry) setShowEndScene(true);
      });
      return;
    }
    playLossScene(2000).then(() => {
      if (generation.current !== entry) return;
      setPhase("loss-exit");
      later(() => {
        setResult(null);
        setBlurred(false);
        setPhase("clearing");
        later(() => {
          resultStarted.current = false;
          setAttempt(1);
          setStopped([]);
          locked.current = false;
          setPhase("idle");
        }, 450);
      }, 350);
    });
  }, [later, playLossScene, playWinScene]);

  const handleEndSceneReady = useCallback(() => {
    if (endSceneStarted.current) return;
    endSceneStarted.current = true;
    setEndSceneVisible(true);
    setPhase("end");
    playEndScene();
  }, [playEndScene]);

  return (
    <>
    <div
      ref={wrapperRef}
      className={`relative h-dvh w-full overflow-hidden overscroll-none bg-white ${ready ? "" : "scene-preparing"} ${endSceneVisible ? "scene-inactive" : ""}`}
      inert={endSceneVisible}
      aria-hidden={endSceneVisible || undefined}
      data-phase={phase}
      data-attempt={attempt + 1}
    >
      <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-10 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
        <div
          ref={appRef}
          className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]"
        >
          <div className={`pointer-events-none absolute inset-0 gameplay-treatment ${blurred ? "has-result" : ""}`}>
            <div className="pointer-events-none absolute left-1/2 top-[230px] z-30 h-[215px] w-[calc((var(--viewport-width,1080px)+2px)/var(--ui-scale,1))] max-w-none -translate-x-1/2 bg-[#283456] entrance-asset banner-entrance" />
            <img
              src={headline}
              alt="Spin for your dream sheets"
              className="pointer-events-none absolute left-1/2 top-[268px] z-40 w-[574px] -translate-x-1/2 select-none entrance-asset headline-entrance"
              draggable="false"
            />
            <SlotMachine
              attempt={attempt}
              phase={phase}
              stopped={stopped}
              interactive={interactive && phase === "idle"}
              onSpin={handleSpin}
              onStopped={handleStopped}
            />
          </div>
          <img
            src={logo}
            alt="Brooklinen"
            className="pointer-events-none absolute left-1/2 top-[65px] z-30 w-[444px] -translate-x-1/2 select-none entrance-asset logo-entrance"
            draggable="false"
          />
          <Scene2 won={result} exiting={phase === "loss-exit"} onReady={handleResultReady} />
          <Cta ready={interactive} active={!endSceneVisible} />
        </div>
      </div>
    </div>
    {showEndScene && <EndScene onReady={handleEndSceneReady} />}
    </>
  );
}

export default App;
