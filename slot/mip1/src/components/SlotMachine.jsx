import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clickSfx from "../Assets/sound/click.wav";
import spinSfx from "../Assets/sound/sfx4.mp3";
import winSfx from "../Assets/sound/win.mp3";
import hand from "../Assets/img/hand.webp";
import reelProduct from "../Assets/img/spinslotproduct.webp";
import tryAgainSlot from "../Assets/img/tryagainslot.webp";
import reelBackground from "../Assets/img/spinslotbg.webp";
import machine from "../Assets/img/slotmachine.webp";
import spinButton from "../Assets/img/spinbtn.webp";
import { unlockSounds, useSound } from "../hooks/useSound";

const SYMBOLS = [tryAgainSlot, reelProduct, tryAgainSlot];
const LOOPS = 10;
const SYMBOL_STEP = 240;
const REEL_CENTER = 1005;
const REEL_DURATIONS = [1550, 1750, 1950];
const REEL_LEFTS = [315, 540, 765];
const REEL_CLIPS = [
  "inset(825px 665px 735px 215px round 12px)",
  "inset(825px 440px 735px 440px round 10px)",
  "inset(825px 215px 735px 665px round 12px)",
];

function createRandomInitialReels() {
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map(index => [
    SYMBOLS[(index + 2) % 3], SYMBOLS[index], SYMBOLS[(index + 1) % 3],
  ]);
}

function createWinningReels() {
  const reel = [tryAgainSlot, reelProduct, tryAgainSlot];
  return { won: true, reels: [reel, reel, reel] };
}

function buildStrip(initialSymbols, finalSymbols) {
  const strip = [...finalSymbols];
  for (let i = 0; i < LOOPS; i += 1) strip.push(...SYMBOLS);
  return [...strip, ...initialSymbols];
}

function Reel({ initialSymbols, finalSymbols, phase, index, initialEntry, onStopped, onStarted }) {
  const strip = useMemo(() => buildStrip(initialSymbols, finalSymbols), [initialSymbols, finalSymbols]);
  const start = -(strip.length - finalSymbols.length) * SYMBOL_STEP;
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 ${phase === "spinning" ? "reel-spinning" : phase === "settled" ? "reel-settled" : ""}`}
      style={{ clipPath: REEL_CLIPS[index] }}
      aria-hidden="true"
    >
      {strip.map((symbol, position) => {
        const product = symbol === reelProduct;
        const width = product ? 191 : 166;
        const height = product ? 197 : 118;
        return (
          <img
            src={symbol}
            alt=""
            className={`pointer-events-none absolute left-[var(--symbol-left)] top-[var(--symbol-top)] z-10 w-[var(--symbol-width)] -translate-x-1/2 select-none reel-symbol ${initialEntry && phase === "idle" ? "entrance-asset reel-entrance" : ""}`}
            draggable="false"
            key={position}
            style={{
              "--symbol-left": `${REEL_LEFTS[index]}px`,
              "--symbol-top": `${REEL_CENTER + (position - 1) * SYMBOL_STEP - height / 2}px`,
              "--symbol-width": `${width}px`,
              "--reel-start": `${start}px`,
              "--reel-accelerate": `${start * .9}px`,
              "--reel-brake": `${start * .14}px`,
              "--reel-duration": `${REEL_DURATIONS[index]}ms`,
              "--reel-delay": `${80 + index * 160}ms`,
            }}
            onAnimationStart={position === 0 && index === 0 ? event => {
              if (event.animationName === "reel-spin") onStarted();
            } : undefined}
            onAnimationEnd={position === 0 ? event => {
              if (event.animationName === "reel-spin") onStopped(index);
            } : undefined}
          />
        );
      })}
    </div>
  );
}

export function SlotMachine({ ready, initialEntry, onComplete, onSpin, onSettled }) {
  const [initialReels] = useState(createRandomInitialReels);
  const [result, setResult] = useState(createWinningReels);
  const [phase, setPhase] = useState("idle");
  const [reelsVisible, setReelsVisible] = useState(!initialEntry);
  const locked = useRef(false);
  const spinButtonRef = useRef(null);
  const stopped = useRef(new Set());
  const started = useRef(false);
  const completed = useRef(false);
  const alive = useRef(true);
  const spinPlayback = useRef(Promise.resolve());
  const timers = useRef([]);
  const playClick = useSound(clickSfx, 0.8);
  const playSpin = useSound(spinSfx, 0.8);
  const playWin = useSound(winSfx, 0.8);

  const completeSpin = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setPhase("settled");
    onSettled();
    if (result.won) {
      timers.current.push(window.setTimeout(() => {
        spinPlayback.current.then(() => {
          if (!alive.current) return;
          playWin().then(() => {
            if (alive.current) onComplete(true);
          });
        });
      }, 400));
    } else {
      onComplete(false);
    }
  }, [onComplete, onSettled, playWin, result.won]);

  useEffect(() => {
    if (!ready || !initialEntry) return undefined;
    const fallback = window.setTimeout(() => setReelsVisible(true), 1050);
    return () => window.clearTimeout(fallback);
  }, [ready, initialEntry]);

  useEffect(() => {
    if (phase !== "arming") return undefined;
    let frame2;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setPhase("spinning"));
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "spinning") return undefined;
    // Recovery if an embedded browser loses an animationend event.
    const fallback = window.setTimeout(completeSpin, 3400);
    return () => window.clearTimeout(fallback);
  }, [phase, completeSpin]);

  useEffect(() => {
    alive.current = true;
    const pendingTimers = timers.current;
    return () => {
      alive.current = false;
      pendingTimers.forEach(window.clearTimeout);
    };
  }, []);

  useEffect(() => {
    const button = spinButtonRef.current;
    const events = ["pointerdown", "pointermove", "pointerup", "touchstart"];
    events.forEach(type => button.addEventListener(type, unlockSounds));
    return () => events.forEach(type => button.removeEventListener(type, unlockSounds));
  }, []);

  const handleSpin = event => {
    event.stopPropagation();
    if (!ready || !reelsVisible || locked.current) return;
    locked.current = true;
    unlockSounds();
    playClick();
    // User-approved odds: one draw per activation; no forced winning retry.
    const won = Math.random() < 0.7;
    setResult(won ? createWinningReels() : {
      won: false,
      reels: [
        [reelProduct, tryAgainSlot, reelProduct],
        [tryAgainSlot, reelProduct, tryAgainSlot],
        [reelProduct, tryAgainSlot, reelProduct],
      ],
    });
    setPhase("arming");
    onSpin();
  };

  return (
    <>
      <img
        src={reelBackground}
        alt="Reel background"
        className={`pointer-events-none absolute left-1/2 top-[810px] z-0 w-[722px] -translate-x-1/2 select-none ${initialEntry ? "entrance-asset machine-entrance" : ""}`}
        draggable="false"
      />
      {initialReels.map((initialSymbols, index) => (
        <Reel
          key={index}
          initialSymbols={initialSymbols}
          finalSymbols={result.reels[index]}
          phase={phase}
          index={index}
          initialEntry={initialEntry}
          onStarted={() => {
            if (started.current) return;
            started.current = true;
            spinPlayback.current = playSpin();
          }}
          onStopped={reelIndex => {
            stopped.current.add(reelIndex);
            if (stopped.current.size === 3) completeSpin();
          }}
        />
      ))}
      <img
        src={machine}
        alt="Slot machine"
        className={`pointer-events-none absolute left-1/2 top-[490px] z-20 w-[940px] -translate-x-1/2 select-none ${initialEntry ? "entrance-asset machine-entrance" : ""}`}
        draggable="false"
        onAnimationEnd={event => {
          if (event.animationName === "machine-arrive") setReelsVisible(true);
        }}
      />
      <img
        src={spinButton}
        alt="Spin"
        className={`pointer-events-none absolute left-1/2 top-[1340px] z-30 w-[440px] -translate-x-1/2 select-none ${initialEntry ? "entrance-asset spin-entrance" : ""} ${phase !== "idle" ? "spin-click" : ""}`}
        draggable="false"
      />
      <button
        ref={spinButtonRef}
        type="button"
        aria-label="Spin"
        disabled={!ready || !reelsVisible || phase !== "idle"}
        onClick={handleSpin}
        className="absolute left-1/2 top-[1340px] z-40 h-[151px] w-[440px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent focus-visible:outline-4 focus-visible:outline-white disabled:cursor-default"
      />
      {phase === "idle" && initialEntry && (
        <img
          src={hand}
          alt="Hand pointing to Spin"
          className="pointer-events-none absolute left-[670px] top-[1400px] z-50 w-[150px] select-none entrance-asset hand-guidance"
          draggable="false"
        />
      )}
    </>
  );
}
