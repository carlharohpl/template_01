import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { createGame, gameReducer, getHintPair } from "../game/memoryMatch";

// Preserve pair timing and keep input locked through the entire return reveal.
// Timer fallbacks also resolve when a host misses animation events.
const PHASES = {
  entering: { delay: 1550, action: "board-ready" },
  preview: { delay: 1800, action: "hide-preview" },
  "preview-closing": { delay: 420, action: "unlock" },
  second: { delay: 0, action: "evaluate" },
  checking: { delay: 420, action: "check" },
  mismatch: { delay: 800, action: "close" },
  closing: { delay: 420, action: "unlock" },
  matched: { delay: 520, action: "unlock" },
};

function initializeGame() {
  let previousLayout = null;
  try { previousLayout = window.sessionStorage.getItem("mip5-previous-layout"); } catch { /* Storage is optional in ad hosts. */ }
  return createGame(Math.random, previousLayout);
}

export default function useMemoryMatch(onComplete, cardSources) {
  const [game, dispatch] = useReducer(gameReducer, undefined, initializeGame);
  const completionSent = useRef(false);
  const inputState = useRef(game);
  useLayoutEffect(() => { inputState.current = game; }, [game]);

  // Apply the same guard synchronously, before React commits a burst of taps.
  const sendAction = useCallback((action) => {
    const next = gameReducer(inputState.current, action);
    if (next === inputState.current) return false;
    inputState.current = next;
    dispatch(action);
    return true;
  }, []);
  const selectCard = useCallback((id) => sendAction({ type: "select", id }), [sendAction]);
  const finishWin = useCallback(() => sendAction({ type: "complete" }), [sendAction]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("mip5-previous-layout", game.cards.map(card => card.product).join(","));
    } catch { /* Shuffling still works when storage is unavailable. */ }
  }, [game.cards]);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;
    const frames = [];
    const ready = () => {
      if (cancelled || scheduled) return;
      scheduled = true;
      clearTimeout(fallback);
      frames.push(requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(() => {
          if (!cancelled) sendAction({ type: "assets-ready" });
        }));
      }));
    };
    const fallback = setTimeout(ready, 1800);
    const images = cardSources.map(src => {
      const image = new Image();
      image.src = src;
      if (typeof image.decode === "function") return image.decode();
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
    });
    Promise.allSettled(images).then(ready);
    return () => { cancelled = true; clearTimeout(fallback); frames.forEach(cancelAnimationFrame); };
  }, [cardSources, sendAction]);

  useEffect(() => {
    if (!["ready", "first"].includes(game.phase)) return;
    const timer = window.setTimeout(
      () => sendAction({ type: "hint", activity: game.activity }),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [game.phase, game.activity, sendAction]);

  useEffect(() => {
    const next = PHASES[game.phase];
    if (!next) return;
    const timer = window.setTimeout(() => sendAction({ type: next.action }), next.delay);
    return () => window.clearTimeout(timer);
  }, [game.phase, sendAction]);

  useEffect(() => {
    if (game.phase !== "complete" || completionSent.current) return;
    completionSent.current = true;
    onComplete?.();
    window.dispatchEvent(new CustomEvent("mip:gameplay-complete", { detail: { matches: 3 } }));
  }, [game.phase, onComplete]);

  return {
    game,
    startGame: () => sendAction({ type: "start" }),
    finishEntrance: () => sendAction({ type: "board-ready" }),
    hintPair: game.hintVisible ? getHintPair(game) : [],
    selectCard,
    finishWin,
  };
}

