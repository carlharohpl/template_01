import hand from "../assets/img/spin-hand.webp";
import reelProduct from "../assets/img/reel-bedding.webp";
import tryAgainSlot from "../assets/img/reel-try-again.webp";
import reelBackground from "../assets/img/spinslotbg.webp";
import machine from "../assets/img/slot-machine.webp";
import spinButton from "../assets/img/spin-button.webp";

const SYMBOLS = [tryAgainSlot, reelProduct, tryAgainSlot];
const STEP = 210;
const LEFTS = [323, 540, 757];
const INITIAL_OFFSETS = [-70, -15, 35];
const LOSS = [
  [reelProduct, tryAgainSlot, reelProduct],
  [tryAgainSlot, reelProduct, tryAgainSlot],
  [reelProduct, tryAgainSlot, reelProduct],
];
const WIN = [tryAgainSlot, reelProduct, tryAgainSlot];
const STRIPS = [0, 1].map(attempt => LOSS.map((initial, index) => [
  ...(attempt ? WIN : LOSS[index]),
  ...Array.from({ length: 6 }, () => SYMBOLS).flat(),
  ...initial,
]));

// Presentation only: spin ownership, result order, timers, and audio live in App.
export function SlotMachine({ attempt, phase, stopped, interactive, onSpin, onStopped }) {
  const spinning = phase === "spinning";
  const settled = !["entrance", "idle", "spinning"].includes(phase);
  return (
    <>
      <img
        src={reelBackground}
        alt="Reel background"
        className="pointer-events-none absolute left-1/2 top-[800px] z-0 w-[722px] -translate-x-1/2 select-none entrance-asset reel-background-entrance"
        draggable="false"
      />
      {STRIPS[attempt].map((strip, index) => {
        const start = -21 * STEP + (attempt ? 0 : INITIAL_OFFSETS[index]);
        const reelSettled = stopped.includes(index) || settled;
        return (
          <div
            key={index}
            className={`pointer-events-none absolute inset-0 z-10 reel-window reel-window-${index} ${spinning && !reelSettled ? "reel-spinning" : ""} ${reelSettled ? "reel-settled" : ""}`}
            aria-hidden="true"
          >
            {strip.map((symbol, position) => {
              const product = symbol === reelProduct;
              const width = product ? 200 : 160;
              const height = product ? 200 : 85;
              return (
                <img
                  src={symbol}
                  alt={product ? "Bedding reel symbol" : "Try again reel symbol"}
                  className={`pointer-events-none absolute left-[var(--symbol-left)] top-[var(--symbol-top)] z-10 w-[var(--symbol-width)] -translate-x-1/2 select-none reel-symbol ${attempt === 0 && !spinning && !settled ? `entrance-asset reel-entrance-${index}` : ""} ${["loss-feedback", "win-feedback"].includes(phase) && position === 1 ? "symbol-feedback" : ""}`}
                  draggable="false"
                  key={position}
                  style={{
                    "--symbol-left": `${LEFTS[index] - (index === 0 ? 12 : 0)}px`,
                    "--symbol-top": `${1015 + (position - 1) * STEP - height / 2}px`,
                    "--symbol-width": `${width}px`,
                    "--reel-start": `${start}px`,
                    "--reel-accelerate": `${start + 420}px`,
                    "--reel-brake": "-1050px",
                  }}
                  onAnimationEnd={position === 0 ? event => {
                    if (event.animationName === "reel-spin") onStopped(index);
                  } : undefined}
                />
              );
            })}
          </div>
        );
      })}
      <img
        src={machine}
        alt="Metallic navy three reel slot machine"
        className={`pointer-events-none absolute left-1/2 top-[440px] z-20 w-[1080px] -translate-x-1/2 select-none entrance-asset machine-entrance`}
        draggable="false"
      />
      <img
        src={spinButton}
        alt="Spin"
        className={`pointer-events-none absolute left-1/2 top-[1325px] z-30 w-[480px] -translate-x-1/2 select-none ${phase === "entrance" ? "entrance-asset spin-entrance" : "spin-control"} ${spinning ? "spin-click" : ""} ${interactive ? "spin-demo" : ""}`}
        draggable="false"
      />
      <button
        type="button"
        aria-label="Spin"
        disabled={!interactive}
        tabIndex={-1}
        onPointerDown={onSpin}
        onTouchStart={onSpin}
        className="pointer-events-auto absolute left-1/2 top-[1360px] z-40 h-[160px] w-[450px] -translate-x-1/2 cursor-pointer touch-manipulation rounded-full bg-transparent disabled:pointer-events-none"
      />
      {interactive && (
        <img
          src={hand}
          alt="Hand pointing to Spin"
          className="pointer-events-none absolute left-[660px] top-[1440px] z-50 w-[150px] select-none hand-guidance"
          draggable="false"
        />
      )}
    </>
  );
}
