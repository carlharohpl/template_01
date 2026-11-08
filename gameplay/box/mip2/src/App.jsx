import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import useScaleUI from "./hooks/useScaleUI";
import { calendarClock, holidayText, subscribeCalendarClock } from "./hooks/calendarClock";
import useSound, { bindSoundGestures, playSound, stopSound } from "./hooks/useSound";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import logo from "./assets/img/rhoback-logo.webp";
import instruction from "./assets/img/rhoback-instruction.webp";
import congratulations from "./assets/img/rhoback-congratulations.webp";
import gift from "./assets/img/navy-gift.webp";
import reward from "./assets/img/reward-20-percent.webp";
import tryAgain from "./assets/img/try-again-small.webp";
import tryOverlay from "./assets/img/try-again-overlay.webp";
import offer from "./assets/img/black-friday-offer.webp";
import defaultOffer from "./assets/img/default-sitewide-offer.webp";
import earlyAccess from "./assets/img/black-friday-early-access.webp";
import weekend from "./assets/img/black-friday-weekend.webp";
import cyberMonday from "./assets/img/cyber-monday.webp";
import youveGot from "./assets/img/youve-got.webp";
import hand from "./assets/img/rhoback-hand.webp";
import cta from "./assets/img/rhoback-shop-now.webp";
import selectionSound from "./assets/sounds/pop1.mp3?inline";
import revealSound from "./assets/sounds/reveal1.mp3?inline";
import wrongSound from "./assets/sounds/wrong3.mp3?inline";
import tryRevealSound from "./assets/sounds/wrong1.mp3?inline";
import finalSound from "./assets/sounds/gamewin5.mp3?inline";

// Annual heading schedule; the fixed gameplay reward is independent of this content.
const dynamicPromo = {
  defaultHeading: "",
  annualRanges: [
    { start: "11-11", end: "11-26", text: "early-access" },
    { start: "11-27", end: "11-29", text: "weekend" },
    { start: "11-30", end: "11-30", text: "cyber-monday" },
  ],
};
const promoArtwork = {
  "early-access": { src: earlyAccess, alt: "Black Friday Early Access" },
  weekend: { src: weekend, alt: "Black Friday Weekend" },
  "cyber-monday": { src: cyberMonday, alt: "Cyber Monday Last Chance" },
};
function resolvePromoHeading() {
  const year = String(calendarClock.now().getFullYear()).padStart(4, "0");
  const ranges = dynamicPromo.annualRanges.map(({ start, end, text }) => ({
    startDate: year + "-" + start,
    endDate: year + "-" + end,
    text,
  }));
  return promoArtwork[holidayText(calendarClock, ranges, dynamicPromo.defaultHeading)] ?? null;
}
const assets = [logo, instruction, congratulations, gift, reward, tryAgain, tryOverlay, offer, defaultOffer, earlyAccess, weekend, cyberMonday, youveGot, hand, cta];
const outcomes = ["20-percent", "try-again", "try-again", "20-percent"];
const initialGame = { phase: "preparing", selected: null, outcome: null, complete: false, dismissed: [], retried: false, guidedGift: 0, handActive: false };
const nextPhase = {
  "select-enter": "select-idle",
  "try-reveal": "try-reveal-hold",
  "try-overlay": "try-hold",
  "try-exit": "try-reset",
  "try-reset": "select-idle",
  "win-reveal": "win-hold",
  "win-exit": "final-ready",
  "final-enter": "final-idle",
};

const App = () => {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const selectionPool = useSound(selectionSound, { backend: "web", poolSize: 5, channel: "gameplay" });
  const revealPool = useSound(revealSound, { backend: "web", overflow: "drop-new", channel: "gameplay" });
  const wrongPool = useSound(wrongSound, { backend: "web", overflow: "drop-new", channel: "gameplay" });
  const tryRevealPool = useSound(tryRevealSound, { backend: "web", overflow: "drop-new", channel: "gameplay" });
  const finalPool = useSound(finalSound, { backend: "web", overflow: "drop-new", channel: "gameplay" });
  const outcomePlayback = useRef(null);
  const idleTimer = useRef(null);
  const [game, setGame] = useState(initialGame);
  const [promoHeading, setPromoHeading] = useState(resolvePromoHeading);
  const current = useRef(initialGame);
  const commit = useCallback((patch) => {
    current.current = { ...current.current, ...patch };
    setGame(current.current);
  }, []);

  useEffect(() => subscribeCalendarClock(calendarClock, () => {
    setPromoHeading(resolvePromoHeading());
  }), []);

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

  useEffect(() => bindSoundGestures(appRef.current, { keyboard: true }), [appRef]);

  // Animation events drive the existing phase flow; CSS-derived fallbacks cover lost events.
  useEffect(() => {
    const phase = game.phase;
    let firstFrame;
    let secondFrame;
    let fallback;
    let target;
    let finished = false;
    const advance = () => {
      if (finished || current.current.phase !== phase) return;
      finished = true;
      const destination = phase === "selecting" ? (current.current.outcome === "try-again" ? "try-reveal" : "win-reveal") : nextPhase[phase];
      if (phase === "selecting") {
        outcomePlayback.current = playSound(destination === "win-reveal" ? revealPool : tryRevealPool, { replace: true });
      }
      commit({ phase: destination, ...(destination === "try-reset" ? { dismissed: [...current.current.dismissed, current.current.selected] } : {}), ...(phase === "try-reset" ? { selected: null, outcome: null, retried: true } : {}), ...(destination === "final-idle" ? { complete: true } : {}) });
    };
    const onEnd = (event) => {
      if (event.target === target) advance();
    };
    if (phase === "select-ready" || phase === "final-ready") {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (finished || current.current.phase !== phase) return;
          commit({ phase: phase === "select-ready" ? "select-enter" : "final-enter" });
          if (phase === "final-ready") outcomePlayback.current = playSound(finalPool, { replace: true });
        });
      });
    } else if (nextPhase[phase] || phase === "selecting") {
      target = appRef.current?.querySelector('[data-phase-end="true"]');
      if (target) {
        target.addEventListener("animationend", onEnd);
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
  }, [game.phase, appRef, commit, selectionPool, revealPool, tryRevealPool, finalPool]);

  useEffect(() => {
    if (game.phase !== "select-idle") return;
    idleTimer.current = setTimeout(() => {
      if (current.current.phase === "select-idle") commit({ handActive: true, guidedGift: [0, 1, 2, 3].find((index) => !current.current.dismissed.includes(index)) });
    }, game.retried ? 2000 : 0);
    return () => clearTimeout(idleTimer.current);
  }, [game.phase, game.retried, commit]);

  // The backend settles handles on natural completion, cancellation, or failure.
  useEffect(() => {
    const phase = game.phase;
    if (!["win-hold", "try-hold", "try-reveal-hold", "final-idle"].includes(phase)) return;
    const source = outcomePlayback.current;
    let minimumElapsed = false;
    let soundFinished = !source;
    let handedOff = false;
    const handoff = () => {
      if (handedOff || !minimumElapsed || !soundFinished || current.current.phase !== phase) return;
      handedOff = true;
      stopSound(source);
      if (phase === "try-reveal-hold") outcomePlayback.current = playSound(wrongPool, { replace: true });
      commit({ phase: phase === "final-idle" ? "end-ready" : phase === "win-hold" ? "win-exit" : phase === "try-reveal-hold" ? "try-overlay" : "try-exit" });
    };
    source?.finished.then(({ status }) => {
      if (handedOff || current.current.phase !== phase) return;
      // Cancellation/failure takes the failure path and cannot retry later.
      if (status !== "ended") stopSound(source);
      soundFinished = true;
      handoff();
    });
    const minimumTimer = setTimeout(() => {
      minimumElapsed = true;
      handoff();
    }, phase === "final-idle" ? 3000 : phase === "win-hold" ? 900 : 0);
    return () => {
      handedOff = true;
      clearTimeout(minimumTimer);
      stopSound(source);
    };
  }, [game.phase, commit, wrongPool]);

  const selectGift = (event, selected) => {
    event.stopPropagation();
    const pointer = event.type === "pointerdown";
    if (!event.isTrusted || current.current.phase !== "select-idle" || current.current.dismissed.includes(selected) || (pointer ? !event.isPrimary || event.button !== 0 : event.detail !== 0)) return;
    if (pointer) event.preventDefault();
    clearTimeout(idleTimer.current);
    commit({ selected, outcome: outcomes[selected], phase: "selecting", handActive: false });
    playSound(selectionPool, { replace: true });
  };

  const { phase, selected, guidedGift, handActive } = game;
  const final = phase.startsWith("final-") || phase.startsWith("end-");
  const onEndReady = useCallback(() => {
    if (current.current.phase === "end-ready") commit({ phase: "end-idle" });
  }, [commit]);
  const initialEntrance = ["preparing", "select-ready", "select-enter"].includes(phase);
  const guidance = handActive && phase === "select-idle";
  const showingResult = ["try-reveal", "try-reveal-hold", "try-overlay", "try-hold", "try-exit", "win-reveal", "win-hold", "win-exit"].includes(phase);
  const giftMotion = (index) => {
    if (game.dismissed.includes(index)) return "gift-dismissed";
    if (initialEntrance) return `gift-enter gift-${index + 1}`;
    if (phase === "selecting" && selected === index) return "gift-selected";
    if (phase === "try-reset") return "gift-reset";
    if (showingResult && selected === index) return "gift-opened";
    if (phase === "win-exit") return "support-exit";
    return guidance && guidedGift === index ? "guide-gift" : "";
  };

  useLayoutEffect(() => {
    if (!guidance) return;
    const canvas = appRef.current;
    const target = canvas?.querySelector(`[data-gift="${guidedGift}"]`);
    const guide = canvas?.querySelector(".guide-hand");
    if (!target || !guide) return;
    canvas.style.setProperty("--guide-x", `${target.offsetLeft + target.offsetWidth * .50 - guide.offsetWidth * .12}px`);
    canvas.style.setProperty("--guide-y", `${target.offsetTop + target.offsetHeight * .65 - guide.offsetHeight * .12}px`);
  }, [guidance, guidedGift, appRef]);

  return (
    <main className="relative h-dvh w-full overflow-visible overscroll-none bg-white">
      <div ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none">
        {final && <div className={`pointer-events-none absolute inset-x-0 z-0 congratulations-background ${promoHeading ? "" : "congratulations-default-background"}`} aria-hidden="true" />}
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] z-20 h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
            data-phase={phase}
            data-selected={selected}
            data-outcome={game.outcome}
            data-dismissed={game.dismissed.join(",")}
            data-complete={game.complete}
            data-guided-gift={guidance ? guidedGift : ""}
            data-started={phase !== "preparing" && phase !== "select-ready"}
          >
            <img
              src={logo}
              alt="Rhoback - Crave Activity"
              className="pointer-events-none absolute left-1/2 top-[88px] z-20 w-[368px] -translate-x-1/2 select-none logo-enter"
              draggable="false"
            />
            {!final && <>
              <img
                src={instruction}
                alt="Tap a gift box to reveal your offer"
                className={`pointer-events-none absolute left-1/2 top-[270px] z-20 w-[816px] -translate-x-1/2 select-none instruction-enter ${phase === "win-exit" ? "support-exit" : ""}`}
                draggable="false"
              />
              <img
                src={gift}
                alt="Top-left navy gift"
                className={`pointer-events-none absolute left-[91px] top-[570px] z-20 w-[398px] select-none gift-art ${giftMotion(0)}`}
                draggable="false"
                data-gift="0"
                data-phase-end={phase === "selecting" && selected === 0}
              />
              <img
                src={gift}
                alt="Top-right navy gift"
                className={`pointer-events-none absolute left-[591px] top-[570px] z-20 w-[398px] select-none gift-art ${giftMotion(1)}`}
                draggable="false"
                data-gift="1"
                data-phase-end={phase === "selecting" && selected === 1}
              />
              <img
                src={gift}
                alt="Bottom-left navy gift"
                className={`pointer-events-none absolute left-[91px] top-[1080px] z-20 w-[398px] select-none gift-art ${giftMotion(2)}`}
                draggable="false"
                data-gift="2"
                data-phase-end={phase === "selecting" && selected === 2}
              />
              <img
                src={gift}
                alt="Bottom-right navy gift"
                className={`pointer-events-none absolute left-[591px] top-[1080px] z-20 w-[398px] select-none gift-art ${giftMotion(3)}`}
                draggable="false"
                data-gift="3"
                data-phase-end={phase === "select-enter" || phase === "try-reset" || (phase === "selecting" && selected === 3)}
              />
              <button type="button" aria-label="Select top-left gift" className="absolute left-[91px] top-[570px] z-30 h-[425px] w-[398px] cursor-pointer gift-hit" disabled={phase !== "select-idle" || game.dismissed.includes(0)} onPointerDown={(event) => selectGift(event, 0)} onClick={(event) => selectGift(event, 0)} />
              <button type="button" aria-label="Select top-right gift" className="absolute left-[591px] top-[570px] z-30 h-[425px] w-[398px] cursor-pointer gift-hit" disabled={phase !== "select-idle" || game.dismissed.includes(1)} onPointerDown={(event) => selectGift(event, 1)} onClick={(event) => selectGift(event, 1)} />
              <button type="button" aria-label="Select bottom-left gift" className="absolute left-[91px] top-[1080px] z-30 h-[425px] w-[398px] cursor-pointer gift-hit" disabled={phase !== "select-idle" || game.dismissed.includes(2)} onPointerDown={(event) => selectGift(event, 2)} onClick={(event) => selectGift(event, 2)} />
              <button type="button" aria-label="Select bottom-right gift" className="absolute left-[591px] top-[1080px] z-30 h-[425px] w-[398px] cursor-pointer gift-hit" disabled={phase !== "select-idle" || game.dismissed.includes(3)} onPointerDown={(event) => selectGift(event, 3)} onClick={(event) => selectGift(event, 3)} />
            </>}
            {["try-reveal", "try-reveal-hold", "try-overlay", "try-hold", "try-exit"].includes(phase) && <img
              src={tryAgain}
              alt="Try again"
              className={`pointer-events-none absolute z-25 w-[290px] -translate-x-1/2 select-none try-result ${!["try-reveal", "try-reveal-hold"].includes(phase) ? "try-result-covered" : ""} ${selected === 2 ? "left-[290px] top-[1234px]" : "left-[790px] top-[724px]"}`}
              draggable="false"
              data-phase-end={phase === "try-reveal"}
            />}
            {["try-overlay", "try-hold", "try-exit"].includes(phase) && <>
              <svg
                className={`pointer-events-none absolute z-35 retry-veil ${phase === "try-exit" ? "retry-veil-exit" : ""}`}
                viewBox="0 0 1080 690"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <filter id="retry-soften" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="52" />
                  </filter>
                </defs>
                {selected !== 0 && !game.dismissed.includes(0) && <image href={gift} x="91" y="-120" width="398" height="425" filter="url(#retry-soften)" className="retry-blur-gift" />}
                {selected !== 1 && !game.dismissed.includes(1) && <image href={gift} x="591" y="-120" width="398" height="425" filter="url(#retry-soften)" className="retry-blur-gift" />}
                {selected !== 2 && !game.dismissed.includes(2) && <image href={gift} x="91" y="390" width="398" height="425" filter="url(#retry-soften)" className="retry-blur-gift" />}
                {selected !== 3 && !game.dismissed.includes(3) && <image href={gift} x="591" y="390" width="398" height="425" filter="url(#retry-soften)" className="retry-blur-gift" />}
              </svg>
              <img
                src={tryOverlay}
                alt="Try again"
                className={`pointer-events-none absolute left-1/2 top-[813px] z-40 w-[791px] -translate-x-1/2 select-none retry-overlay ${phase === "try-exit" ? "retry-overlay-exit" : ""}`}
                draggable="false"
                data-phase-end={phase === "try-overlay" || phase === "try-exit"}
              />
            </>}
            {["win-reveal", "win-hold", "win-exit"].includes(phase) && <img
              src={reward}
              alt="20% off sitewide"
              className={`pointer-events-none absolute z-25 w-[303px] -translate-x-1/2 select-none reward-enter ${selected === 0 ? "left-[290px] top-[670px]" : "left-[790px] top-[1180px]"} ${phase === "win-exit" ? "reward-exit" : ""}`}
              draggable="false"
              data-phase-end={phase === "win-reveal" || phase === "win-exit"}
            />}
            {final && <>
              <img
                src={congratulations}
                alt="Congratulations!"
                className={`pointer-events-none absolute left-1/2 ${promoHeading ? "top-[296px]" : "top-[347px]"} z-20 w-[914px] -translate-x-1/2 select-none congratulations-enter`}
                draggable="false"
              />
              <img
                src={youveGot}
                alt="You've got"
                className={`pointer-events-none absolute left-1/2 ${promoHeading ? "top-[416px]" : "top-[499px]"} z-20 w-[463px] -translate-x-1/2 select-none youve-got-enter`}
                draggable="false"
              />
              <img
                src={promoHeading ? offer : defaultOffer}
                alt="20% off sitewide promotional offer"
                className={`pointer-events-none absolute left-1/2 ${promoHeading ? "top-[548px]" : "top-[654px]"} z-20 w-[962px] -translate-x-1/2 select-none offer-enter`}
                draggable="false"
                data-phase-end={phase === "final-enter"}
              />
              {promoHeading && <img
                src={promoHeading.src}
                alt={promoHeading.alt}
                className="pointer-events-none absolute left-1/2 top-[607px] z-25 w-[760px] -translate-x-1/2 select-none promo-heading-enter"
                draggable="false"
              />}
            </>}
            {guidance && <img
              key={`guide-${guidedGift}`}
              src={hand}
              alt="Hand demonstrating a gift tap"
              className="pointer-events-none absolute left-[var(--guide-x)] top-[var(--guide-y)] z-40 w-[200px] select-none guide-hand"
              draggable="false"
              aria-hidden="true"
              onAnimationIteration={() => {
                if (current.current.phase !== "select-idle" || !current.current.handActive) return;
                const available = [1, 2, 3, 4].map((step) => (current.current.guidedGift + step) % 4);
                commit({ guidedGift: available.find((index) => !current.current.dismissed.includes(index)) });
              }}
            />}
            <Cta disabled={phase !== "select-idle" && phase !== "final-idle"} />
          </div>
        </div>
        <EndScene active={phase.startsWith("end-")} onReady={onEndReady} />
      </div>
    </main>
  );
};

export default App;
