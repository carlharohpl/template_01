import { useCallback, useEffect, useRef } from "react";
import useSound, { handleUnlockGesture, playSound, stopSound } from "./useSound";
import pop from "../assets/sounds/pop1.mp3";
import wrong from "../assets/sounds/wrong1.mp3";
import correct from "../assets/sounds/correct1.mp3";
import win from "../assets/sounds/gamewin3.mp3";
import endScene from "../assets/sounds/endscene3.wav";

function stopPool(pool) {
  pool.current?.elements.forEach(stopSound);
}

export default function useGameSounds(game, wrapperRef, selectCard) {
  const wrongPool = useSound(wrong);
  const correctPool = useSound(correct);
  const winPool = useSound(win);
  const endScenePool = useSound(endScene);
  const activePops = useRef(new Set());

  const stopPops = useCallback(() => {
    activePops.current.forEach(audio => audio.pause());
    activePops.current.clear();
  }, []);

  const playCardPop = useCallback(() => {
    // Construct AND play on the card's native click. This keeps both operations
    // inside the actual iOS gesture, including the very first tap.
    const audio = new Audio(pop);
    audio.muted = false;
    audio.volume = 1;
    activePops.current.add(audio);
    const release = () => activePops.current.delete(audio);
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
    const promise = audio.play();
    // Click feedback is never queued for a later, unrelated gesture.
    promise?.catch(release);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const cards = Array.from(wrapper.querySelectorAll("[data-card-id]"));
    const handleCardClick = (event) => {
      const card = event.currentTarget;
      if (event.detail === 0 || card.disabled) return;
      selectCard(Number(card.dataset.cardId), playCardPop);
    };
    wrapper.addEventListener("pointerdown", handleUnlockGesture);
    cards.forEach(card => {
      card.addEventListener("click", handleCardClick);
    });
    return () => {
      wrapper.removeEventListener("pointerdown", handleUnlockGesture);
      cards.forEach(card => {
        card.removeEventListener("click", handleCardClick);
      });
      stopPops();
    };
  }, [wrapperRef, selectCard, playCardPop, stopPops]);

  useEffect(() => {
    const pool = game.phase === "mismatch" ? wrongPool
      : game.phase === "matched" ? correctPool
      : game.phase === "won" ? winPool
      : game.phase === "complete" ? endScenePool : null;
    if (!pool) return;
    stopPops();
    [wrongPool, correctPool, winPool, endScenePool].forEach(stopPool);
    // The final pair plays only the win cue; end-scene audio follows later.
    playSound(pool);
  }, [game.phase, wrongPool, correctPool, winPool, endScenePool, stopPops]);
}
