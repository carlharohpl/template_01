import { useCallback, useEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./hooks/useSound";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/logo.webp";
import subtitle1 from "./assets/img/subtitle1.webp";
import subtitle2 from "./assets/img/subtitle2.webp";
import subtitle3 from "./assets/img/subtitle3.webp";
import box1 from "./assets/img/box1.webp";
import box2 from "./assets/img/box2.webp";
import fairy1 from "./assets/img/fairy1.webp";
import fairy3 from "./assets/img/fairy3.webp";
import fairy4 from "./assets/img/fairy4.webp";
import owl from "./assets/img/owl1.webp";
import hand from "./assets/img/hand.webp";
import cta from "./assets/img/cta.webp";
import background from "./assets/img/bg.webp";
import selectionSound from "./assets/sounds/click.mp3";
import tapSound from "./assets/sounds/pop1.mp3";
import rewardSound from "./assets/sounds/endscene3.wav";

const assets = [background, logo, subtitle1, subtitle2, subtitle3, box1, box2, fairy1, fairy3, fairy4, owl, hand, cta];
const initialGame = { phase: "preparing", selected: null, taps: 0, complete: false, guidedGift: 0 };
const nextPhase = {
  "select-enter": "select-idle",
  selecting: "select-exit",
  "select-exit": "unpack-ready",
  "unpack-enter": "unpack-idle",
  "unpack-tapping": "unpack-idle",
  completing: "reward-ready",
  "reward-reveal": "reward-complete",
};

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const selectionPool = useSound(selectionSound);
  const tapPool = useSound(tapSound, { poolSize: 5 });
  const rewardPool = useSound(rewardSound);
  const rewardPlayback = useRef(null);
  const [game, setGame] = useState(initialGame);
  const current = useRef(initialGame);
  const commit = useCallback((patch) => {
    current.current = { ...current.current, ...patch };
    setGame(current.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanups = [];
    Promise.all(assets.map((src) => new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve();
      };
      const timeout = setTimeout(finish, 4000);
      image.onload = () => {
        if (typeof image.decode === "function") image.decode().catch(() => {}).then(finish);
        else finish();
      };
      image.onerror = finish;
      image.src = src;
      if (image.complete) image.onload();
      cleanups.push(finish);
    }))).then(() => {
      if (!cancelled) commit({ phase: "select-ready" });
    });
    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [commit]);

  useEffect(() => {
    const controls = appRef.current?.querySelectorAll(".gift-hit") ?? [];
    const unlock = (event) => {
      if (event.currentTarget.disabled) return;
      handleUnlockGesture(event);
    };
    const events = ["pointerdown", "pointermove", "pointerup"];
    controls.forEach((control) => events.forEach((type) => control.addEventListener(type, unlock)));
    return () => {
      controls.forEach((control) => events.forEach((type) => control.removeEventListener(type, unlock)));
    };
  }, [game.phase, appRef]);

  useEffect(() => {
    const phase = game.phase;
    let firstFrame;
    let secondFrame;
    let fallback;
    let target;
    let finished = false;
    const advance = () => {
      if (finished || current.current.phase !== phase || current.current.taps !== game.taps) return;
      finished = true;
      if (phase === "select-exit") selectionPool.current?.elements.forEach(stopSound);
      commit({ phase: nextPhase[phase] });
    };
    const onEnd = (event) => {
      if (event.target === target) advance();
    };
    if (phase.endsWith("-ready")) {
      const destination = phase === "select-ready" ? "select-enter" : phase === "unpack-ready" ? "unpack-enter" : "reward-reveal";
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (current.current.phase !== phase) return;
          commit({ phase: destination });
          if (destination === "reward-reveal") {
            selectionPool.current?.elements.forEach(stopSound);
            tapPool.current?.elements.forEach(stopSound);
            rewardPlayback.current = playSound(rewardPool);
          }
        });
      });
    } else if (nextPhase[phase]) {
      target = appRef.current?.querySelector('[data-phase-end="true"]');
      if (target) {
        target.addEventListener("animationend", onEnd);
        // Follow CSS timing if a host drops the animation completion event.
        const styles = getComputedStyle(target);
        const durations = styles.animationDuration.split(",").map(parseFloat);
        const delays = styles.animationDelay.split(",").map(parseFloat);
        const longest = Math.max(...durations.map((duration, i) => duration + delays[i % delays.length]));
        fallback = setTimeout(advance, longest * 1000 + 150);
      }
    }
    return () => {
      finished = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      clearTimeout(fallback);
      target?.removeEventListener("animationend", onEnd);
    };
  }, [game.phase, game.taps, appRef, commit, selectionPool, tapPool, rewardPool]);

  useEffect(() => {
    if (game.phase !== "reward-complete") return;
    const source = rewardPlayback.current;
    let minimumElapsed = false;
    let soundFinished = !source || source.ended;
    let handedOff = false;
    let progressTimer;
    let lastPosition = source?.currentTime ?? 0;
    let lastProgress = performance.now();
    const handoff = () => {
      if (handedOff || !minimumElapsed || !soundFinished || current.current.phase !== "reward-complete") return;
      handedOff = true;
      stopSound(source);
      commit({ phase: "end-enter" });
    };
    const onEnded = () => {
      soundFinished = true;
      clearTimeout(progressTimer);
      handoff();
    };
    const onFailure = () => {
      stopSound(source);
      onEnded();
    };
    const checkProgress = () => {
      if (soundFinished || handedOff) return;
      const position = source.currentTime;
      if (position > lastPosition + 0.01) {
        lastPosition = position;
        lastProgress = performance.now();
      }
      // Only stalled/blocked playback times out; progressing audio can finish.
      if (source.error || performance.now() - lastProgress >= 2000) onFailure();
      else progressTimer = setTimeout(checkProgress, 250);
    };
    source?.addEventListener("ended", onEnded);
    source?.addEventListener("error", onFailure);
    const minimumTimer = setTimeout(() => {
      minimumElapsed = true;
      handoff();
    }, 2000);
    if (!soundFinished) progressTimer = setTimeout(checkProgress, 250);
    return () => {
      handedOff = true;
      clearTimeout(minimumTimer);
      clearTimeout(progressTimer);
      source?.removeEventListener("ended", onEnded);
      source?.removeEventListener("error", onFailure);
      stopSound(source);
    };
  }, [game.phase, commit]);

  const finishEndReveal = useCallback(() => {
    if (current.current.phase === "end-enter") commit({ phase: "end-complete" });
  }, [commit]);

  const selectGift = (event, selected) => {
    event.stopPropagation();
    if (!event.isTrusted || !event.isPrimary || event.button !== 0 || current.current.phase !== "select-idle") return;
    event.preventDefault();
    playSound(selectionPool);
    commit({ selected, phase: "selecting" });
  };
  const tapGift = (event) => {
    event.stopPropagation();
    const active = current.current;
    if (!event.isTrusted || !event.isPrimary || event.button !== 0 || !["unpack-idle", "unpack-tapping"].includes(active.phase) || active.complete) return;
    event.preventDefault();
    const taps = active.taps + 1;
    playSound(tapPool);
    commit({ taps, complete: taps === 5, phase: taps === 5 ? "completing" : "unpack-tapping" });
  };

  const { phase, selected, taps, guidedGift } = game;
  const endActive = phase.startsWith("end-");
  const scene = phase.startsWith("reward") || endActive ? 3 : phase.startsWith("unpack") || phase === "completing" ? 2 : 1;
  const paused = phase === "preparing" || phase.endsWith("-ready");
  const entering = paused || phase.endsWith("-enter") || phase === "reward-reveal";
  const exiting = phase === "select-exit";
  const guidance = phase === "select-idle" || phase === "unpack-idle";
  const ctaEnabled = ["select-idle", "unpack-idle", "unpack-tapping", "reward-complete"].includes(phase);
  const supportMotion = exiting || phase === "completing" ? "support-exit" : entering ? `character-enter ${paused ? "foreground-paused" : ""}` : "character-float";
  const smallGiftMotion = (id) => {
    if (phase === "selecting" && id === selected) return "gift-selected";
    if (exiting) return id === selected ? "selected-exit" : "gift-exit";
    if (entering) return `gift-enter ${paused ? "foreground-paused" : ""}`;
    return guidance && id === guidedGift ? "guide-gift" : "";
  };
  const largeGiftMotion = phase === "completing" ? "final-wiggle" : phase === "unpack-tapping" ? taps % 2 ? "tap-a" : "tap-b" : guidance ? "guide-gift guide-fast" : `unpack-enter ${paused ? "foreground-paused" : ""}`;

  return (
    <main className="relative h-dvh w-full overflow-visible overscroll-none">
      <div
        ref={wrapperRef}
        className="relative h-dvh w-full overflow-hidden overscroll-none"
      >
        <img
          src={background}
          alt=""
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
          draggable="false"
          aria-hidden="true"
        />
        <div className={`pointer-events-none absolute left-0 top-[calc(var(--ui-top,0px)+276px*var(--ui-scale,1))] z-10 h-[calc(224px*var(--ui-scale,1))] w-full instruction-banner banner-enter ${phase === "preparing" || phase === "select-ready" ? "foreground-paused" : ""}`} />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-20 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
            data-phase={phase}
            data-scene={scene}
            data-taps={taps}
            data-selected={selected}
            data-complete={game.complete}
            data-started={phase !== "preparing" && phase !== "select-ready"}
          >
            <img
              src={logo}
              alt="Memowrite"
              className="pointer-events-none absolute left-1/2 top-[115px] z-20 w-[482px] -translate-x-1/2 select-none logo-enter"
              draggable="false"
            />
            <img
              key={`subtitle-${scene}`}
              src={scene === 1 ? subtitle1 : scene === 2 ? subtitle2 : subtitle3}
              alt={scene === 1 ? "Tap one of the boxes to reveal your gift" : scene === 2 ? "Keep tapping to unpack your gift" : "Congrats! Here is your special offer"}
              className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 select-none ${scene === 1 ? "top-[340px] w-[697px]" : scene === 2 ? "top-[340px] w-[584px]" : "top-[325px] w-[704px]"} ${exiting || phase === "completing" ? "support-exit" : scene === 3 ? "reward-banner" : "subtitle-enter"} ${paused ? "foreground-paused" : ""}`}
              draggable="false"
            />
            {scene === 1 && <>
              <img
                src={box1}
                alt="Upper-left orange gift"
                className={`pointer-events-none absolute left-[122px] top-[603px] z-20 w-[388px] select-none ${smallGiftMotion(0)}`}
                draggable="false"
                data-phase-end={(phase === "selecting" || exiting) && selected === 0}
              />
              <img
                src={box1}
                alt="Upper-right orange gift"
                className={`pointer-events-none absolute left-[568px] top-[603px] z-20 w-[388px] select-none ${smallGiftMotion(1)} ${entering ? "gift-two" : ""}`}
                draggable="false"
                data-phase-end={(phase === "selecting" || exiting) && selected === 1}
              />
              <img
                src={box1}
                alt="Lower-left orange gift"
                className={`pointer-events-none absolute left-[122px] top-[1111px] z-20 w-[388px] select-none ${smallGiftMotion(2)} ${entering ? "gift-three" : ""}`}
                draggable="false"
                data-phase-end={(phase === "selecting" || exiting) && selected === 2}
              />
              <img
                src={box1}
                alt="Lower-right orange gift"
                className={`pointer-events-none absolute left-[568px] top-[1111px] z-20 w-[388px] select-none ${smallGiftMotion(3)} ${entering ? "gift-four" : ""}`}
                draggable="false"
                data-phase-end={phase === "select-enter" || ((phase === "selecting" || exiting) && selected === 3)}
              />
              <button type="button" aria-label="Select upper-left gift" tabIndex={-1} className="absolute left-[122px] top-[603px] z-30 h-[442px] w-[388px] cursor-pointer gift-hit" disabled={phase !== "select-idle"} onPointerDown={(event) => selectGift(event, 0)} />
              <button type="button" aria-label="Select upper-right gift" tabIndex={-1} className="absolute left-[568px] top-[603px] z-30 h-[442px] w-[388px] cursor-pointer gift-hit" disabled={phase !== "select-idle"} onPointerDown={(event) => selectGift(event, 1)} />
              <button type="button" aria-label="Select lower-left gift" tabIndex={-1} className="absolute left-[122px] top-[1111px] z-30 h-[442px] w-[388px] cursor-pointer gift-hit" disabled={phase !== "select-idle"} onPointerDown={(event) => selectGift(event, 2)} />
              <button type="button" aria-label="Select lower-right gift" tabIndex={-1} className="absolute left-[568px] top-[1111px] z-30 h-[442px] w-[388px] cursor-pointer gift-hit" disabled={phase !== "select-idle"} onPointerDown={(event) => selectGift(event, 3)} />
            </>}
            {(scene === 2 || phase === "reward-ready" || phase === "reward-reveal") && <img
              src={box1}
              alt="Selected orange gift"
              className={`pointer-events-none absolute left-1/2 top-[640px] z-20 w-[750px] -translate-x-1/2 select-none ${scene === 3 ? `closed-opening ${paused ? "foreground-paused" : ""}` : largeGiftMotion}`}
              draggable="false"
              data-phase-end={scene === 2}
            />}
            {scene === 2 && <button type="button" aria-label="Tap to unpack your gift" tabIndex={-1} className="absolute left-1/2 top-[640px] z-30 h-[854px] w-[750px] -translate-x-1/2 cursor-pointer gift-hit" disabled={phase !== "unpack-idle" && phase !== "unpack-tapping"} onPointerDown={tapGift} />}
            {scene === 3 && <img
              src={box2}
              alt="Opened gift: up to 64% off, plus 2 free book copies"
              className={`pointer-events-none absolute left-[54px] top-[580px] z-25 w-[1000px] select-none reward-enter ${paused ? "foreground-paused" : ""}`}
              draggable="false"
              data-phase-end={phase === "reward-reveal"}
            />}
            <img
              key={`fairy4-${scene}`}
              src={fairy4}
              alt="Glasses-wearing Halloween flyer"
              className={`pointer-events-none absolute z-40 select-none flyer-glasses ${scene === 1 ? "left-[0px] top-[522px] w-[325px]" : scene === 2 ? "left-[40px] top-[535px] w-[325px]" : "left-[500px] top-[1285px] w-[360px]"} ${supportMotion}`}
              draggable="false"
            />
            <img
              key={`fairy3-${scene}`}
              src={fairy3}
              alt="Blonde Halloween flyer"
              className={`pointer-events-none absolute z-40 select-none flyer-blonde ${scene === 1 ? "left-[740px] top-[560px] w-[340px]" : scene === 2 ? "left-[720px] top-[630px] w-[335px]" : "left-[710px] top-[1100px] w-[330px]"} ${supportMotion} ${!entering && !exiting ? "float-blonde" : ""}`}
              draggable="false"
            />
            <img
              key={`fairy1-${scene}`}
              src={fairy1}
              alt="Red-haired Halloween flyer"
              className={`pointer-events-none absolute z-40 select-none flyer-red ${scene === 1 ? "left-[710px] top-[1340px] w-[360px]" : scene === 2 ? "left-[680px] top-[1300px] w-[360px]" : "left-[100px] top-[1200px] w-[340px]"} ${supportMotion} ${!entering && !exiting ? "float-red" : ""}`}
              draggable="false"
            />
            <img
              key={`owl-${scene}`}
              src={owl}
              alt="White flying Halloween owl"
              className={`pointer-events-none absolute z-40 select-none flyer-owl ${scene === 1 ? "left-[15px] top-[1385px] w-[300px]" : scene === 2 ? "left-[80px] top-[1370px] w-[290px]" : "left-[100px] top-[730px] w-[300px]"} ${supportMotion} ${!entering && !exiting ? "float-owl" : ""}`}
              draggable="false"
            />
            {guidance && <img
              key={`guide-${scene}-${guidedGift}`}
              src={hand}
              alt=""
              className={`pointer-events-none absolute z-50 w-[180px] select-none guide-hand ${scene === 2 ? "left-[565px] top-[1090px] guide-fast" : guidedGift === 0 ? "left-[306px] top-[811px]" : guidedGift === 1 ? "left-[752px] top-[811px]" : guidedGift === 2 ? "left-[306px] top-[1319px]" : "left-[752px] top-[1319px]"}`}
              draggable="false"
              aria-hidden="true"
              onAnimationIteration={() => {
                if (current.current.phase === "select-idle") {
                  commit({ guidedGift: (current.current.guidedGift + 1) % 4 });
                }
              }}
            />}
            {!endActive && <Cta disabled={!ctaEnabled} />}
          </div>
        </div>
        <EndScene active={endActive} onReady={finishEndReveal} />
      </div>
    </main>
  );
};

export default App;
