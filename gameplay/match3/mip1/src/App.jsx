import { Fragment, useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useGameSounds } from './hooks/useSound';
import useScaleUI from './hooks/useScaleUI';
import { calendarClock, holidayText, subscribeCalendarClock } from './hooks/calendarClock';
import { Cta } from './components/cta';
import EndScene from './components/endscene';
import hand from './assets/img/hand.webp';
import background from './assets/img/hirelief-background.webp';
import headline from './assets/img/find-five-tiles.webp';
import logo from './assets/img/hirelief-logo.webp';
import products from './assets/img/hirelief-products.webp';
import discountMessage from './assets/img/discount-message.webp';
import discountPanel from './assets/img/discount-panel.webp';
import cta from './assets/img/cta.webp';
import lightning from './assets/img/tile-lightning.webp';
import energy from './assets/img/tile-energy.webp';
import circular from './assets/img/tile-circular.webp';
import bowl from './assets/img/tile-bowl.webp';
import plant from './assets/img/tile-plant.webp';
import foot from './assets/img/tile-foot.webp';
import torso from './assets/img/tile-torso.webp';
import arm from './assets/img/tile-arm.webp';
import palm from './assets/img/tile-hand.webp';
import cell from './assets/img/tile-cell.webp';
import targetLightning from './assets/img/target-lightning.webp';
import targetEnergy from './assets/img/target-energy.webp';
import targetCircular from './assets/img/target-circular.webp';
import targetBowl from './assets/img/target-bowl.webp';
import targetPlant from './assets/img/target-plant.webp';

const SYMBOLS = [
  { name: 'Lightning', tile: lightning, target: targetLightning },
  { name: 'Energy', tile: energy, target: targetEnergy },
  { name: 'Circular target', tile: circular, target: targetCircular },
  { name: 'Bowl and leaf', tile: bowl, target: targetBowl },
  { name: 'Plant', tile: plant, target: targetPlant },
  { name: 'Foot and ankle', tile: foot },
  { name: 'Torso and spine', tile: torso },
  { name: 'Flexed arm', tile: arm },
  { name: 'Hand and palm', tile: palm },
  { name: 'Cell and dots', tile: cell },
];
const CARD_SOURCES = [background, headline, hand, logo, cta, ...SYMBOLS.flatMap(symbol => [symbol.tile, symbol.target].filter(Boolean))];
const REWARD_SOURCES = [logo, products, discountMessage, discountPanel];
const POSITIONS = [
  'left-[220px] top-[770px]', 'left-[380px] top-[770px]', 'left-[540px] top-[770px]', 'left-[700px] top-[770px]',
  'left-[220px] top-[980px]', 'left-[380px] top-[980px]', 'left-[540px] top-[980px]', 'left-[700px] top-[980px]',
  'left-[220px] top-[1190px]', 'left-[380px] top-[1190px]', 'left-[540px] top-[1190px]', 'left-[700px] top-[1190px]',
  'left-[220px] top-[1400px]', 'left-[380px] top-[1400px]', 'left-[540px] top-[1400px]', 'left-[700px] top-[1400px]',
];
const TARGET_POSITIONS = ['left-[257px]', 'left-[375px]', 'left-[493px]', 'left-[611px]', 'left-[729px]'];
const MATCH_COUNT = 5;
const MATCH_SIZE = 2;
// Supplied fixed-year, inclusive ranges; gaps use the authorized month-name sale.
const PROMOTION_RANGES = [
  { startDate: '2026-01-01', endDate: '2026-01-04', text: 'New Year Sale' },
  { startDate: '2026-01-05', endDate: '2026-01-15', text: 'Winter Sale' },
  { startDate: '2026-01-16', endDate: '2026-01-19', text: 'MLK Day Sale' },
  { startDate: '2026-01-20', endDate: '2026-02-10', text: 'Winter Sale' },
  { startDate: '2026-02-11', endDate: '2026-02-15', text: 'Valentine’s Day Sale' },
  { startDate: '2026-02-16', endDate: '2026-02-22', text: 'Presidents Day Sale' },
  { startDate: '2026-02-23', endDate: '2026-03-13', text: 'Winter Sale' },
  { startDate: '2026-03-14', endDate: '2026-03-17', text: 'St. Paddy’s Day Sale' },
  { startDate: '2026-03-18', endDate: '2026-03-19', text: 'Winter Sale' },
  { startDate: '2026-03-20', endDate: '2026-04-01', text: 'Spring Sale' },
  { startDate: '2026-04-02', endDate: '2026-04-05', text: 'Easter Sale' },
  { startDate: '2026-04-06', endDate: '2026-05-05', text: 'Spring Sale' },
  { startDate: '2026-05-06', endDate: '2026-05-10', text: 'Mother’s Day Sale' },
  { startDate: '2026-05-11', endDate: '2026-05-20', text: 'Spring Sale' },
  { startDate: '2026-05-21', endDate: '2026-05-25', text: 'Memorial Day Sale' },
  { startDate: '2026-05-26', endDate: '2026-06-19', text: 'Spring Sale' },
  { startDate: '2026-06-20', endDate: '2026-06-21', text: 'Father’s Day Sale' },
  { startDate: '2026-06-22', endDate: '2026-06-30', text: 'Summer Sale' },
  { startDate: '2026-07-01', endDate: '2026-07-05', text: 'July 4 Sale' },
  { startDate: '2026-07-06', endDate: '2026-08-30', text: 'Summer Sale' },
  { startDate: '2026-08-31', endDate: '2026-09-07', text: 'Labor Day Sale' },
  { startDate: '2026-09-08', endDate: '2026-09-21', text: 'Summer Sale' },
  { startDate: '2026-09-22', endDate: '2026-10-25', text: 'Fall Sale' },
  { startDate: '2026-10-26', endDate: '2026-10-31', text: 'Halloween Sale' },
  { startDate: '2026-11-01', endDate: '2026-11-22', text: 'Fall Sale' },
  { startDate: '2026-11-23', endDate: '2026-11-30', text: 'Thanksgiving, Black Friday & Cyber Monday Sale' },
  { startDate: '2026-12-01', endDate: '2026-12-20', text: 'Fall Sale' },
  { startDate: '2026-12-21', endDate: '2026-12-25', text: 'Christmas Sale' },
  { startDate: '2026-12-26', endDate: '2026-12-31', text: 'Winter Sale' },
  { startDate: '2027-01-01', endDate: '2027-01-03', text: 'New Year Sale' },
  { startDate: '2027-01-04', endDate: '2027-01-14', text: 'Winter Sale' },
  { startDate: '2027-01-15', endDate: '2027-01-18', text: 'MLK Day Sale' },
  { startDate: '2027-01-19', endDate: '2027-02-09', text: 'Winter Sale' },
  { startDate: '2027-02-10', endDate: '2027-02-14', text: 'Valentine’s Day Sale' },
  { startDate: '2027-02-15', endDate: '2027-02-21', text: 'Presidents Day Sale' },
  { startDate: '2027-02-22', endDate: '2027-03-13', text: 'Winter Sale' },
  { startDate: '2027-03-14', endDate: '2027-03-17', text: 'St. Paddy’s Day Sale' },
  { startDate: '2027-03-18', endDate: '2027-03-19', text: 'Winter Sale' },
  { startDate: '2027-03-20', endDate: '2027-03-24', text: 'Spring Sale' },
  { startDate: '2027-03-25', endDate: '2027-03-28', text: 'Easter Sale' },
  { startDate: '2027-03-29', endDate: '2027-05-05', text: 'Spring Sale' },
  { startDate: '2027-05-06', endDate: '2027-05-09', text: 'Mother’s Day Sale' },
  { startDate: '2027-05-10', endDate: '2027-05-20', text: 'Spring Sale' },
  { startDate: '2027-05-21', endDate: '2027-05-31', text: 'Memorial Day Sale' },
  { startDate: '2027-06-01', endDate: '2027-06-19', text: 'Spring Sale' },
  { startDate: '2027-06-20', endDate: '2027-06-20', text: 'Father’s Day Sale' },
  { startDate: '2027-06-21', endDate: '2027-06-30', text: 'Summer Sale' },
  { startDate: '2027-07-01', endDate: '2027-07-05', text: 'July 4 Sale' },
  { startDate: '2027-07-06', endDate: '2027-08-29', text: 'Summer Sale' },
  { startDate: '2027-08-30', endDate: '2027-09-06', text: 'Labor Day Sale' },
  { startDate: '2027-09-07', endDate: '2027-09-21', text: 'Summer Sale' },
  { startDate: '2027-09-22', endDate: '2027-10-25', text: 'Fall Sale' },
  { startDate: '2027-10-26', endDate: '2027-10-31', text: 'Halloween Sale' },
  { startDate: '2027-11-01', endDate: '2027-11-21', text: 'Fall Sale' },
  { startDate: '2027-11-22', endDate: '2027-11-29', text: 'Thanksgiving, Black Friday & Cyber Monday Sale' },
  { startDate: '2027-11-30', endDate: '2027-12-20', text: 'Fall Sale' },
  { startDate: '2027-12-21', endDate: '2027-12-26', text: 'Christmas Sale' },
  { startDate: '2027-12-27', endDate: '2027-12-31', text: 'Winter Sale' },
];

function shuffle(values, random) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function createGame(random = Math.random, previousLayout = null) {
  // Keep all five target pairs and choose three distinct filler pairs per game.
  const fillers = shuffle([5, 6, 7, 8, 9], random).slice(0, 3);
  const inventory = [0, 1, 2, 3, 4, ...fillers].flatMap(product => [product, product]);
  const cards = shuffle(inventory
    .map((product, id) => ({ id, product })), random);
  if (cards.map(card => card.product).join(',') === previousLayout) cards.push(cards.shift());
  return {
    cards: cards.map((card, slot) => ({ ...card, slot })),
    finalLayout: cards.map(card => card.product).join(','),
    selected: [], matched: [], targets: [], feedback: [], activeTarget: null,
    phase: 'loading', outcome: null, winHoldFinished: false, winSoundFinished: false,
    rewardHoldFinished: false, rewardSoundFinished: false,
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'assets-ready':
      return state.phase === 'loading' ? { ...state, phase: 'entering' } : state;
    case 'board-ready':
      return state.phase === 'entering' ? { ...state, phase: 'ready' } : state;
    case 'select': {
      if (!['ready', 'first'].includes(state.phase) || state.selected.includes(action.id)
        || state.matched.includes(action.id) || !state.cards.some(card => card.id === action.id)) return state;
      const selected = [...state.selected, action.id];
      return { ...state, selected, phase: selected.length === MATCH_SIZE ? 'checking' : 'first' };
    }
    case 'check': {
      if (state.phase !== 'checking') return state;
      const symbols = state.selected.map(id => state.cards.find(card => card.id === id).product);
      if (symbols[0] !== symbols[1]) return { ...state, phase: 'mismatch' };
      const newTarget = symbols[0] < MATCH_COUNT && !state.targets.includes(symbols[0]);
      const targets = newTarget ? [...state.targets, symbols[0]] : state.targets;
      return {
        ...state, matched: [...state.matched, ...state.selected], targets,
        feedback: state.selected, selected: [], activeTarget: newTarget ? symbols[0] : null,
        phase: 'matched', outcome: targets.length === MATCH_COUNT ? 'win' : null,
      };
    }
    case 'match-finished':
      return state.phase === 'matched'
        ? { ...state, feedback: [], activeTarget: null, phase: state.outcome === 'win' ? 'won' : 'ready' } : state;
    case 'unlock':
      return state.phase === 'mismatch' ? { ...state, selected: [], phase: 'ready' } : state;
    case 'hold-finished':
    case 'win-sound-ended': {
      if (state.phase !== 'won') return state;
      const next = { ...state, [action.type === 'hold-finished' ? 'winHoldFinished' : 'winSoundFinished']: true };
      return { ...next, phase: next.winHoldFinished && next.winSoundFinished ? 'leaving' : 'won' };
    }
    case 'show-reward':
      return state.phase === 'leaving' ? { ...state, phase: 'reward-preparing' } : state;
    case 'reward-assets-ready':
      return state.phase === 'reward-preparing' ? { ...state, phase: 'reward-entering' } : state;
    case 'reward-ready':
      return state.phase === 'reward-entering' ? { ...state, phase: 'reward' } : state;
    case 'reward-hold-finished':
    case 'reward-sound-ended': {
      if (!['reward-entering', 'reward'].includes(state.phase)) return state;
      const next = { ...state, [action.type === 'reward-hold-finished' ? 'rewardHoldFinished' : 'rewardSoundFinished']: true };
      return { ...next, phase: next.rewardHoldFinished && next.rewardSoundFinished ? 'complete' : state.phase };
    }
    default: return state;
  }
}

const PHASES = {
  entering: { delay: 1000, action: 'board-ready' },
  checking: { delay: 120, action: 'check' },
  mismatch: { delay: 320, action: 'unlock' },
  matched: { delay: 370, action: 'match-finished' },
  // 600ms celebration followed by a 700ms full-board hold, also gated by the existing win cue.
  won: { delay: 1300, action: 'hold-finished' },
  leaving: { delay: 280, action: 'show-reward' },
  'reward-entering': { delay: 950, action: 'reward-ready' },
  reward: { delay: 3000, action: 'reward-hold-finished' },
};

function initializeGame() {
  let previousLayout = null;
  try { previousLayout = window.sessionStorage.getItem('hirelief-previous-layout'); } catch { /* Optional host storage. */ }
  return createGame(Math.random, previousLayout);
}

// Mount paused foregrounds first; failures settle and all starts use two rendering opportunities.
function prepareForeground(sources, onReady) {
  let cancelled = false;
  const frames = [];
  const cleanups = [];
  const preparation = sources.map(src => new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      image.onload = image.onerror = null;
      resolve();
    };
    const decode = () => {
      if (typeof image.decode !== 'function') { settle(); return; }
      try { Promise.resolve(image.decode()).then(settle, settle); } catch { settle(); }
    };
    const fallback = window.setTimeout(settle, 1800);
    cleanups.push(settle);
    image.onload = decode;
    image.onerror = settle;
    image.src = src;
    if (image.complete) decode();
  }));
  preparation.push(new Promise(resolve => {
    const fallback = window.setTimeout(resolve, 1800);
    const settle = () => { clearTimeout(fallback); resolve(); };
    cleanups.push(settle);
    Promise.allSettled([
      document.fonts?.load('700 70px "Roboto Condensed"'),
      document.fonts?.load('700 42px "Roboto"'),
    ]).then(settle);
  }));
  Promise.allSettled(preparation).then(() => {
    if (cancelled) return;
    frames.push(requestAnimationFrame(() => {
      frames.push(requestAnimationFrame(() => { if (!cancelled) onReady(); }));
    }));
  });
  return () => {
    cancelled = true;
    cleanups.forEach(cleanup => cleanup());
    frames.forEach(cancelAnimationFrame);
  };
}

export default function App() {
  const { appRef, wrapperRef } = useScaleUI(1080, 1920);
  const [game, dispatch] = useReducer(gameReducer, undefined, initializeGame);
  const inputState = useRef(game);
  const promoHeadlineRef = useRef(null);
  const alive = useRef(false);
  const completionSent = useRef(false);
  const idleTimer = useRef(null);
  const lastInteraction = useRef(null);
  const [interaction, setInteraction] = useState(0);
  const [guidedGame, setGuidedGame] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => calendarClock.now());
  useLayoutEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useLayoutEffect(() => { inputState.current = game; }, [game]);
  const sendAction = useCallback(action => {
    if (!alive.current) return false;
    const current = inputState.current;
    const next = gameReducer(current, action);
    if (next === current) return false;
    inputState.current = next;
    dispatch(action);
    return true;
  }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem('hirelief-previous-layout', game.finalLayout); } catch { /* Optional host storage. */ }
  }, [game.finalLayout]);
  useEffect(() => prepareForeground(CARD_SOURCES, () => sendAction({ type: 'assets-ready' })), [sendAction]);
  useEffect(() => {
    if (game.phase !== 'reward-preparing') return;
    return prepareForeground(REWARD_SOURCES, () => sendAction({ type: 'reward-assets-ready' }));
  }, [game.phase, sendAction]);
  useEffect(() => {
    const next = PHASES[game.phase];
    if (!next) return;
    const timer = window.setTimeout(() => sendAction({ type: next.action }), next.delay);
    return () => window.clearTimeout(timer);
  }, [game.phase, sendAction]);
  useEffect(() => subscribeCalendarClock(calendarClock, setCalendarDate), []);
  useEffect(() => {
    if (game.phase !== 'reward' || completionSent.current) return;
    completionSent.current = true;
    window.dispatchEvent(new CustomEvent('mip:gameplay-complete', {
      detail: { matches: game.matched.length / MATCH_SIZE, targets: game.targets.length, outcome: 'win' },
    }));
  }, [game.phase, game.matched.length, game.targets.length]);

  const handleWinSoundEnded = useCallback(() => sendAction({ type: 'win-sound-ended' }), [sendAction]);
  const handleRewardSoundEnded = useCallback(() => sendAction({ type: 'reward-sound-ended' }), [sendAction]);
  const playCardPop = useGameSounds(game, wrapperRef, handleWinSoundEnded, handleRewardSoundEnded);
  const playable = ['ready', 'first'].includes(game.phase);
  const rewardVisible = game.phase.startsWith('reward') || game.phase === 'complete';
  const finalBoard = ['won', 'leaving'].includes(game.phase) || rewardVisible;
  const dealing = ['loading', 'entering'].includes(game.phase);
  const pending = game.phase === 'loading' ? 'scene-asset-pending' : '';
  const exit = game.phase === 'leaving' ? 'gameplay-leave' : rewardVisible ? 'gameplay-hidden' : '';
  const rewardPending = game.phase === 'reward-preparing' ? 'scene-asset-pending' : '';

  const available = game.cards.filter(card => !game.matched.includes(card.id));
  const selectedCard = game.cards.find(card => card.id === game.selected[0]);
  const guideStart = selectedCard ?? available.find(card => card.product < MATCH_COUNT && !game.targets.includes(card.product)
    && available.some(other => other.id !== card.id && other.product === card.product))
    ?? available.find(card => available.some(other => other.id !== card.id && other.product === card.product));
  const guideEnd = guideStart && available.find(card => card.id !== guideStart.id && card.product === guideStart.product);
  const guidePair = guideEnd ? (selectedCard ? [guideEnd] : [guideStart, guideEnd]) : [];

  useEffect(() => {
    if (!['ready', 'first'].includes(game.phase)) return;
    const delay = lastInteraction.current === null ? 0 : Math.max(0, 2000 - (performance.now() - lastInteraction.current));
    idleTimer.current = window.setTimeout(() => setGuidedGame(game), delay);
    return () => window.clearTimeout(idleTimer.current);
  }, [game, interaction]);

  const hideGuidance = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    lastInteraction.current = performance.now();
    setGuidedGame(null);
    setInteraction(value => value + 1);
  }, []);
  const handleCardTap = (event, id) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    hideGuidance();
    if (sendAction({ type: 'select', id })) playCardPop();
  };
  const promoHeadline = holidayText(calendarClock, PROMOTION_RANGES, `${calendarDate.toLocaleDateString('en-US', { month: 'long' })} Sale`);
  const endDateLabel = 'Last Call on ' + calendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  useLayoutEffect(() => {
    let cancelled = false;
    const align = () => {
      if (cancelled || !promoHeadlineRef.current) return;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.font = '700 58px "Roboto"';
      const fontSize = Math.min(58, 58 * 1010 / Math.max(1, context.measureText(promoHeadline).width));
      context.font = '700 ' + fontSize + 'px "Roboto"';
      promoHeadlineRef.current.style.setProperty('--promo-font-size', fontSize + 'px');
      const metrics = context.measureText(promoHeadline);
      const offset = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent
        - metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) / 2;
      promoHeadlineRef.current.style.setProperty('--promo-optical-offset', Number.isFinite(offset) ? offset + 'px' : '0px');
    };
    Promise.resolve(document.fonts?.ready).then(align);
    return () => { cancelled = true; };
  }, [promoHeadline]);

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden overscroll-none select-none" onContextMenu={event => event.preventDefault()}>
      <div ref={wrapperRef} className="relative h-dvh w-full overflow-hidden overscroll-none bg-white">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={background}
            alt="HiRelief green gradient background"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
            draggable="false"
          />
        </div>
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-[calc(140px*var(--ui-scale,1))] w-full bg-white" data-promo-bar="">
          <div className="absolute left-[var(--ui-left,0px)] top-0 h-[140px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)]">
            <p
              className={`pointer-events-none absolute left-1/2 top-[calc(50%+var(--promo-optical-offset,0px))] z-20 w-[1010px] -translate-x-1/2 -translate-y-1/2 select-none font-['Roboto'] text-[length:var(--promo-font-size,58px)] font-bold leading-[1.15] text-center text-[#242424] reward-header-entrance ${pending}`}
              ref={promoHeadlineRef}
              data-promo-headline=""
            >
              {promoHeadline}
            </p>
          </div>
        </div>
        <div className="absolute left-[var(--ui-left,0px)] top-[var(--ui-top,0px)] h-[var(--ui-height,1920px)] w-[var(--ui-width,1080px)]">
          <div
            ref={appRef}
            className="absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left scale-[var(--ui-scale,1)] overflow-visible"
            data-game-phase={game.phase}
            data-match-count={game.matched.length / MATCH_SIZE}
            data-target-count={game.targets.length}
            onPointerDown={event => { if (event.target.closest('[data-card-id]')) hideGuidance(); }}
          >
            {!rewardVisible && (
              <img
                src={logo}
                alt="HiRelief"
                className={`pointer-events-none absolute left-1/2 top-[222px] z-20 w-[267px] -translate-x-1/2 select-none logo-entrance ${pending} ${exit}`}
                draggable="false"
              />
            )}
            <img
              src={headline}
              alt="FIND THESE 5 TILES / TO CLAIM YOUR OFFER"
              className={`pointer-events-none absolute left-1/2 top-[415px] z-20 w-[965px] -translate-x-1/2 select-none instruction-entrance ${pending} ${exit}`}
              draggable="false"
            />
            {SYMBOLS.slice(0, MATCH_COUNT).map((symbol, index) => {
              const completed = game.targets.includes(index);
              const motion = exit || (dealing ? `target-entrance ${pending}`
                : game.phase === 'won' ? 'targets-celebrate'
                  : game.activeTarget === index ? 'target-wiggle' : '');
              return (
                <Fragment key={symbol.name}>
                  <img
                    src={symbol.target}
                    alt={symbol.name + ' objective'}
                    className={`pointer-events-none absolute ${TARGET_POSITIONS[index]} top-[598px] z-20 w-[98px] select-none target-face ${completed ? '' : 'is-active'} ${motion}`}
                    draggable="false"
                    style={{ '--target-index': index }}
                    aria-hidden={completed}
                  />
                  <img
                    src={symbol.tile}
                    alt={symbol.name + ' objective completed'}
                    className={`pointer-events-none absolute ${TARGET_POSITIONS[index]} top-[598px] z-20 w-[98px] select-none target-face ${completed ? 'is-active' : ''} ${motion}`}
                    draggable="false"
                    style={{ '--target-index': index }}
                    aria-hidden={!completed}
                    data-target={index}
                    data-completed={completed}
                  />
                </Fragment>
              );
            })}
            {game.cards.map(card => {
              const matched = game.matched.includes(card.id);
              const selected = game.selected.includes(card.id);
              const complete = matched || finalBoard;
              const motion = exit || (dealing ? `tile-entrance ${pending}`
                : game.phase === 'won' ? 'tile-celebrate'
                  : game.feedback.includes(card.id) ? 'tile-correct'
                    : selected ? (game.phase === 'mismatch' ? 'tile-wrong' : 'tile-selected') : '');
              return (
                <Fragment key={card.id}>
                  <img
                    src={SYMBOLS[card.product].tile}
                    alt={SYMBOLS[card.product].name + ' tile'}
                    className={`pointer-events-none absolute ${POSITIONS[card.slot]} z-20 w-[159px] select-none matching-tile ${complete ? 'is-completed' : selected ? 'is-selected' : ''} ${motion}`}
                    draggable="false"
                    style={{ '--tile-row': Math.floor(card.slot / 4), '--tile-column': card.slot % 4 }}
                    data-card-face-id={card.id}
                    data-completed={complete}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={SYMBOLS[card.product].name + ' tile ' + (card.slot + 1)}
                    aria-pressed={selected || matched}
                    disabled={!playable || matched || selected}
                    data-card-id={card.id}
                    data-slot={card.slot}
                    data-symbol={card.product}
                    data-matched={matched}
                    className={`absolute ${POSITIONS[card.slot]} z-30 h-[209px] w-[159px] touch-none border-0 bg-transparent p-0 outline-none enabled:cursor-pointer`}
                    onPointerDown={event => handleCardTap(event, card.id)}
                  />
                </Fragment>
              );
            })}
            {playable && guidedGame === game && guidePair.map((card, index) => (
              <img
                key={card.id}
                src={hand}
                alt="Matching tile guide"
                className={`pointer-events-none absolute ${POSITIONS[card.slot]} z-40 w-[120px] translate-x-[72px] translate-y-[100px] select-none guide-hand ${index === 1 ? 'guide-hand-second' : ''} ${selectedCard ? 'guide-hand-single' : ''}`}
                draggable="false"
                aria-hidden="true"
                data-guide-card={card.id}
              />
            ))}
            {rewardVisible && (
              <>
                <img
                  src={logo}
                  alt="HiRelief"
                  className={`pointer-events-none absolute left-1/2 top-[220px] z-20 w-[270px] -translate-x-1/2 select-none logo-entrance ${rewardPending}`}
                  draggable="false"
                />
                <img
                  src={products}
                  alt="Three HiRelief Total Relief containers"
                  className={`pointer-events-none absolute left-1/2 top-[405px] z-20 w-[950px] -translate-x-1/2 select-none products-entrance ${rewardPending}`}
                  draggable="false"
                />
                <img
                  src={discountMessage}
                  alt="You've Got a Discount!"
                  className={`pointer-events-none absolute left-1/2 top-[997px] z-20 w-[815px] -translate-x-1/2 select-none reward-message-entrance ${rewardPending}`}
                  draggable="false"
                />
                <img
                  src={discountPanel}
                  alt="UP TO 67% OFF"
                  className={`pointer-events-none absolute left-1/2 top-[1135px] z-20 w-[855px] -translate-x-1/2 select-none discount-entrance ${rewardPending}`}
                  draggable="false"
                />
                <p
                  className={`pointer-events-none absolute left-1/2 top-[1465px] z-20 w-[950px] -translate-x-1/2 select-none font-['Roboto_Condensed'] text-[70px] font-bold leading-[1.15] text-center text-white reward-date-entrance ${rewardPending}`}
                >
                  Get yours today!
                </p>
                <p
                  className={`pointer-events-none absolute left-1/2 top-[1542px] z-20 w-[950px] -translate-x-1/2 select-none font-['Roboto_Condensed'] text-[69.85px] font-bold leading-[1.15] text-center text-white reward-date-entrance ${rewardPending}`}
                  data-promo-date=""
                >
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </>
            )}
            <Cta
              entranceReady={game.phase !== 'loading'}
              disabled={dealing || ['leaving', 'reward-preparing', 'reward-entering', 'complete'].includes(game.phase)}
            />
          </div>
        </div>
        <EndScene active={game.phase === 'complete'} promoHeadline={promoHeadline} dateLabel={endDateLabel} />
      </div>
    </main>
  );
}






