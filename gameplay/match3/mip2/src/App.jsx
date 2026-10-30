import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import useSound, { handleUnlockGesture, playSound, stopSound, waitForSoundCompletion } from "./hooks/useSound";
import useScaleUI from "./hooks/useScaleUI";
import useMemoryMatch from "./hooks/useMemoryMatch";
import { Cta } from "./components/cta";
import EndScene from "./components/endscene";
import background from "./assets/img/mainbg.webp";
import holidayBackground from "./assets/img/bg.webp";
import logo from "./assets/img/logo.webp";
import title from "./assets/img/subtitle1.webp";
import subtitle from "./assets/img/subtitle2.webp";
import instructions from "./assets/img/subtitle3.webp";
import itemCover from "./assets/img/cover.webp";
import chocolate from "./assets/img/item1.webp";
import caramel from "./assets/img/item2.webp";
import cocoa from "./assets/img/item3.webp";
import hand from "./assets/img/hand.webp";
import cta from "./assets/img/cta.webp";
import throwingCards from "./assets/sounds/throwingcards.mp3";
import cardPop from "./assets/sounds/pop1.mp3";
import correctMatch from "./assets/sounds/correct1.mp3";
import wrongMatch from "./assets/sounds/wrong3.mp3";
import endSceneSound from "./assets/sounds/endscene3.wav";
import gameWin from "./assets/sounds/gamewin5.mp3";

const PRODUCTS = [chocolate, caramel, cocoa];
const CARD_SOURCES = [background, holidayBackground, logo, title, subtitle, instructions, itemCover, hand, cta, ...PRODUCTS];
const PRODUCT_NAMES = ["Chocolate curls", "Caramel squares", "Chocolate cup"];
const POSITIONS = [
  "left-[92px] top-[630px]", "left-[416px] top-[630px]", "left-[740px] top-[630px]",
  "left-[92px] top-[1074px]", "left-[416px] top-[1074px]", "left-[740px] top-[1074px]",
];
const CARD_ENTRANCES = [
  "card-deal-one", "card-deal-two", "card-deal-three",
  "card-deal-four", "card-deal-five", "card-deal-six",
];
const HAND_POSITIONS = [
  "left-[204px] top-[814px]", "left-[528px] top-[814px]", "left-[852px] top-[814px]",
  "left-[204px] top-[1258px]", "left-[528px] top-[1258px]", "left-[852px] top-[1258px]",
];

export default function App({ onComplete }) {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const { game, hintPair, selectCard, startGame, finishEntrance, finishWin } = useMemoryMatch(onComplete, CARD_SOURCES);
  const throwingAudio = useSound(throwingCards);
  const correctAudio = useSound(correctMatch);
  const wrongAudio = useSound(wrongMatch);
  const endSceneAudio = useSound(endSceneSound);
  const winAudio = useSound(gameWin);
  const endSoundStarted = useRef(false);
  const feedbackSource = useRef(null);
  const dealSoundStarted = useRef(false);
  const dealSource = useRef(null);
  const activePops = useRef(new Set());
  const [confetti] = useState(() => Array.from({ length: 320 }, (_, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 450 + Math.random() * 1150;
    return {
      id, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance + 200 + Math.random() * 300,
      rotation: (Math.random() - 0.5) * 360,
      width: 12 + Math.random() * 14,
      height: 20 + Math.random() * 20,
      duration: 1.3 + Math.random() * 0.1,
      color: ["#FFFFFF", "#F1CE85", "#042A42"][id % 3],
      delay: Math.random() * 0.08,
    };
  }));
  const intro = game.phase === "loading" || game.phase === "intro";
  const openingPreview = ["entering", "preview", "preview-closing"].includes(game.phase);

  // Prime delayed deal and pair cues on the actual touched element for mobile hosts.
  useEffect(() => {
    const controls = wrapperRef.current?.querySelectorAll("[data-start-game], [data-card-id]") ?? [];
    const events = ["pointerdown", "pointermove", "pointerup", "touchstart", "keydown"];
    controls.forEach(control => events.forEach(type => control.addEventListener(type, handleUnlockGesture)));
    return () => controls.forEach(control => events.forEach(type => control.removeEventListener(type, handleUnlockGesture)));
  }, [intro, wrapperRef]);

  useEffect(() => {
    if (game.phase !== "entering") stopSound(dealSource.current);
  }, [game.phase]);

  // A phase transition resolves one pair, independently of the two image animations.
  useEffect(() => {
    if (game.phase === "complete") {
      stopSound(feedbackSource.current);
      return;
    }
    const pool = game.phase === "mismatch" ? wrongAudio
      : game.phase === "matched" ? correctAudio
      : game.phase === "won" ? winAudio : null;
    if (!pool) return;
    stopSound(feedbackSource.current);
    if (game.phase === "won") {
      activePops.current.forEach(audio => audio.pause());
      activePops.current.clear();
      stopSound(dealSource.current);
    }
    feedbackSource.current = playSound(pool);
    if (game.phase === "won") return waitForSoundCompletion(feedbackSource.current, { minimumMs: 2500, onComplete: finishWin });
  }, [game.phase, correctAudio, wrongAudio, winAudio, finishWin]);

  useEffect(() => {
    const pops = activePops.current;
    return () => {
      pops.forEach(audio => audio.pause());
      pops.clear();
      stopSound(dealSource.current);
      stopSound(feedbackSource.current);
    };
  }, []);

  const playCardPop = () => {
    stopSound(feedbackSource.current);
    // Construct and play inside the accepted tap; blocked taps stay silent.
    const audio = new Audio(cardPop);
    activePops.current.add(audio);
    const release = () => activePops.current.delete(audio);
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
    audio.play()?.catch(release);
  };

  const handleCardTap = (event, id) => {
    if (selectCard(id)) playCardPop();
  };

  const handleEndSceneReady = useCallback(() => {
    if (endSoundStarted.current) return;
    endSoundStarted.current = true;
    stopSound(feedbackSource.current);
    stopSound(dealSource.current);
    activePops.current.forEach(audio => audio.pause());
    activePops.current.clear();
    playSound(endSceneAudio);
  }, [endSceneAudio]);

  const hintStart = game.cards.findIndex(card => card.id === hintPair[0]);
  const matches = game.matched.length / 2;
  const entranceClass = (name) => `${name} ${game.phase === "loading" ? "scene-asset-pending" : ""}`;

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden overscroll-none select-none" onContextMenu={(event) => event.preventDefault()}>
      <div ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#490300]">
        <img
          src={background}
          alt="Red holiday background"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover brightness-[0.72]"
          draggable="false"
        />
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div ref={appRef} className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible" data-game-phase={game.phase}>
            <img
              src={holidayBackground}
              alt="Gold holiday stars"
              className="pointer-events-none absolute left-0 top-0 z-0 w-[1080px] select-none"
              draggable="false"
            />
            <img
              src={logo}
              alt="Liquid I.V."
              className={`${entranceClass("logo-entrance")} pointer-events-none absolute left-1/2 top-[102px] z-10 w-[311px] -translate-x-1/2 select-none`}
              draggable="false"
            />
            <img
              src={title}
              alt="Holiday Series"
              className={`${entranceClass("title-entrance")} pointer-events-none absolute left-1/2 top-[201px] z-10 w-[719px] -translate-x-1/2 select-none`}
              draggable="false"
            />
            <img
              src={subtitle}
              alt="Limited-edition"
              className={`${entranceClass("subtitle-entrance")} pointer-events-none absolute left-1/2 top-[379px] z-10 w-[375px] -translate-x-1/2 select-none`}
              draggable="false"
            />
            <div role="status" aria-live="polite" className="sr-only" data-match-count={matches}>
              {matches} of 3 pairs matched
            </div>
            {intro ? (
              <>
                <img
                  src={instructions}
                  alt="Match 3 images and get Limited-edition Holiday Series"
                  className={`${entranceClass("holiday-instructions-entrance")} pointer-events-none absolute left-1/2 top-[527px] z-10 w-[740px] -translate-x-1/2 select-none`}
                  draggable="false"
                />
                <img
                  src={itemCover}
                  alt="Holiday card back"
                  className={`${entranceClass("holiday-intro-card-entrance holiday-card-attention")} pointer-events-none absolute left-1/2 top-[1246px] z-20 w-[216px] -translate-x-1/2 select-none`}
                  draggable="false"
                />
                <button
                  type="button"
                  aria-label="Start matching cards"
                  data-start-game=""
                  disabled={game.phase !== "intro"}
                  className="absolute left-1/2 top-[1250px] z-30 h-[328px] w-[216px] -translate-x-1/2 touch-none cursor-pointer rounded-[20px] border-0 bg-transparent p-0"
                  onClick={(event) => {
                    handleUnlockGesture(event);
                    if (startGame()) playCardPop();
                  }}
                />
                {game.phase === "intro" && (
                  <img
                    src={hand}
                    alt="Tap the card to start"
                    className="holiday-intro-hand-entrance holiday-hand-tap pointer-events-none absolute left-[552px] top-[1380px] z-50 w-[150px] select-none"
                    draggable="false"
                    aria-hidden="true"
                  />
                )}
              </>
            ) : game.cards.map((card, index) => {
              const matched = game.matched.includes(card.id);
              const selected = game.selected.includes(card.id);
              const faceUp = game.phase === "preview" || matched || (selected && game.phase !== "closing");
              const justMatched = matched && ["matched", "won"].includes(game.phase) && game.matched.slice(-2).includes(card.id);
              const tapping = selected && ["first", "second", "checking"].includes(game.phase);
              const feedbackClass = justMatched ? "card-pair-correct"
                : selected && game.phase === "mismatch" ? "card-pair-wrong"
                : tapping ? "card-tap" : "";
              const disabled = !["ready", "first"].includes(game.phase) || matched || selected;
              const position = POSITIONS[index];
              return (
                <Fragment key={card.id}>
                  <img
                    src={PRODUCTS[card.product]}
                    alt={PRODUCT_NAMES[card.product]}
                    className={`memory-card card-front ${openingPreview ? "card-preview-flip" : ""} ${feedbackClass} pointer-events-none absolute ${position} z-20 w-[252px] select-none ${faceUp ? "is-revealed" : ""}`}
                    draggable="false"
                    aria-hidden={!faceUp}
                  />
                  <img
                    src={itemCover}
                    alt="Holiday card back"
                    className={`memory-card card-back ${openingPreview ? "card-preview-flip" : ""} ${tapping ? "card-tap" : ""} ${game.phase === "entering" ? `card-deal ${CARD_ENTRANCES[index]}` : ""} pointer-events-none absolute ${position} z-20 w-[252px] select-none ${faceUp ? "is-revealed" : ""}`}
                    draggable="false"
                    aria-hidden={faceUp}
                    onAnimationStart={(event) => {
                      if (index !== 0 || event.animationName !== "card-one-deal" || game.phase !== "entering" || dealSoundStarted.current) return;
                      dealSoundStarted.current = true;
                      dealSource.current = playSound(throwingAudio);
                    }}
                    onAnimationEnd={(event) => {
                      if (index === 5 && event.animationName === "card-six-deal") finishEntrance();
                    }}
                  />
                  <button
                    type="button"
                    aria-label={faceUp ? `${PRODUCT_NAMES[card.product]}${matched ? ", matched" : ""}` : `Reveal card ${index + 1}`}
                    aria-pressed={faceUp}
                    disabled={disabled}
                    data-card-id={card.id}
                    data-matched={matched}
                    className={`card-hit-area absolute ${position} z-30 h-[383px] w-[252px] touch-none rounded-[20px] border-0 bg-transparent p-0 outline-none select-none enabled:cursor-pointer`}
                    onClick={(event) => handleCardTap(event, card.id)}
                  />
                </Fragment>
              );
            })}
            {!intro && hintStart >= 0 && (
              <img
                src={hand}
                alt="Tap a card"
                className={`holiday-hand-tap pointer-events-none absolute ${HAND_POSITIONS[hintStart]} z-50 w-[150px] select-none`}
                draggable="false"
                aria-hidden="true"
              />
            )}
            {game.phase === "won" && (
              <div data-completion-confetti="" className="pointer-events-none absolute inset-0 z-50 overflow-visible" aria-hidden="true">
                {confetti.map(piece => (
                  <div
                    key={piece.id}
                    className="holiday-confetti absolute left-[540px] top-[990px] h-[var(--confetti-height)] w-[var(--confetti-width)] bg-[var(--confetti-color)]"
                    style={{
                      "--x": `${piece.x}px`, "--y": `${piece.y}px`,
                      "--rotate": `${piece.rotation}deg`, "--delay": `${piece.delay}s`,
                      "--confetti-color": piece.color,
                      "--confetti-width": `${piece.width}px`, "--confetti-height": `${piece.height}px`,
                      "--duration": `${piece.duration}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <Cta gameplay entranceReady={game.phase !== "loading"} />
          </div>
        </div>
        {game.phase === "complete" && <EndScene onReady={handleEndSceneReady} />}
      </div>
    </main>
  );
}




