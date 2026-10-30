export const PAIR_COUNT = 3;

// Unique card IDs, exactly two cards for each product.
export function createGame(random = Math.random, previousLayout = null) {
  const cards = [0, 0, 1, 1, 2, 2].map((product, id) => ({ id, product }));
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  if (cards.map(card => card.product).join(",") === previousLayout) {
    cards.push(cards.shift());
  }
  return { cards, selected: [], matched: [], phase: "loading", hintVisible: false, activity: 0 };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case "assets-ready":
      return state.phase === "loading" ? { ...state, phase: "intro" } : state;
    case "start":
      return state.phase === "intro" ? { ...state, phase: "entering" } : state;
    case "board-ready":
      return state.phase === "entering" ? { ...state, phase: "preview" } : state;
    case "hide-preview":
      return state.phase === "preview" ? { ...state, phase: "preview-closing" } : state;
    case "interact":
      return ["ready", "first"].includes(state.phase)
        ? { ...state, hintVisible: false, activity: state.activity + 1 } : state;
    case "hint":
      return ["ready", "first"].includes(state.phase) && action.activity === state.activity
        ? { ...state, hintVisible: true } : state;
    case "select": {
      if (
        !["ready", "first"].includes(state.phase) ||
        state.selected.includes(action.id) ||
        state.matched.includes(action.id) ||
        !state.cards.some((card) => card.id === action.id)
      ) return state;
      const selected = [...state.selected, action.id];
      return { ...state, selected, hintVisible: false, activity: state.activity + 1, phase: selected.length === 2 ? "second" : "first" };
    }
    case "evaluate":
      return state.phase === "second" ? { ...state, phase: "checking" } : state;
    case "check": {
      if (state.phase !== "checking") return state;
      const [first, second] = state.selected.map((id) => state.cards.find((card) => card.id === id));
      if (first.product !== second.product) return { ...state, phase: "mismatch" };
      const matched = [...state.matched, ...state.selected];
      return {
        ...state, matched, selected: [],
        phase: matched.length === PAIR_COUNT * 2 ? "won" : "matched",
      };
    }
    case "close":
      return state.phase === "mismatch" ? { ...state, phase: "closing" } : state;
    case "unlock":
      return state.phase === "closing" || state.phase === "matched" || state.phase === "preview-closing"
        ? { ...state, selected: [], phase: "ready", hintVisible: state.phase === "preview-closing" } : state;
    case "complete":
      return state.phase === "won" ? { ...state, phase: "complete" } : state;
    default:
      return state;
  }
}

export function getHintPair(state) {
  if (!["ready", "first"].includes(state.phase)) return [];
  const available = state.cards.filter(card => !state.matched.includes(card.id));
  const first = state.selected.length
    ? available.find(card => card.id === state.selected[0])
    : available[0];
  if (!first) return [];
  const mate = available.find(card => card.id !== first.id && card.product === first.product);
  if (!mate) return [];
  return state.selected.length ? [mate.id] : [first.id, mate.id];
}

