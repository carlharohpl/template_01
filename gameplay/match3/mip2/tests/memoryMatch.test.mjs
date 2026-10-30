import test from "node:test";
import assert from "node:assert/strict";
import { createGame, gameReducer, getHintPair } from "../src/game/memoryMatch.js";

const apply = (state, type, id) => gameReducer(state, { type, id });
const select = (state, ...ids) => {
  const next = ids.reduce((current, id) => apply(current, "select", id), state);
  return next.phase === "second" ? apply(next, "evaluate") : next;
};
const readyGame = () => ["assets-ready", "start", "board-ready", "hide-preview", "unlock"].reduce((game, action) => apply(game, action), createGame());

test("every shuffled deck contains six unique cards and exactly three pairs", () => {
  for (let i = 0; i < 100; i += 1) {
    const game = createGame();
    assert.equal(new Set(game.cards.map(c => c.id)).size, 6);
    assert.deepEqual([0, 1, 2].map(p => game.cards.filter(c => c.product === p).length), [2, 2, 2]);
    assert.equal(game.phase, "loading");
  }
});

test("repeated, invalid, and third taps cannot add extra selections", () => {
  const first = select(readyGame(), 0);
  assert.strictEqual(select(first, 0), first);
  assert.strictEqual(select(first, 999), first);
  const checking = select(first, 2);
  assert.deepEqual(checking.selected, [0, 2]);
  assert.strictEqual(select(checking, 4), checking);
  assert.strictEqual(apply(checking, "unlock"), checking);
});

test("mismatches stay locked through viewing and the entire closing flip", () => {
  let game = apply(select(readyGame(), 0, 2), "check");
  assert.equal(game.phase, "mismatch");
  assert.equal(game.matched.length, 0);
  assert.strictEqual(select(game, 4), game);
  assert.strictEqual(apply(game, "unlock"), game);
  game = apply(game, "close");
  assert.equal(game.phase, "closing");
  assert.strictEqual(select(game, 4), game);
  game = apply(game, "unlock");
  assert.equal(game.phase, "ready");
  assert.deepEqual(game.selected, []);
  assert.deepEqual(select(game, 0).selected, [0]);
});

test("matched cards stay revealed, are counted once, and cannot be replayed", () => {
  let game = apply(select(readyGame(), 0, 1), "check");
  assert.equal(game.phase, "matched");
  assert.deepEqual(game.matched, [0, 1]);
  assert.strictEqual(apply(game, "check"), game);
  game = apply(game, "unlock");
  assert.strictEqual(select(game, 0), game);
  game = apply(select(game, 2, 3), "check");
  assert.equal(game.matched.length / 2, 2);
});

test("the third pair wins once and completed games reject all later actions", () => {
  let game = readyGame();
  for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) {
    game = apply(select(game, a, b), "check");
    game = apply(game, "unlock");
  }
  assert.equal(game.phase, "won");
  assert.equal(game.matched.length / 2, 3);
  assert.strictEqual(apply(game, "check"), game);
  game = apply(game, "complete");
  assert.equal(game.phase, "complete");
  for (const type of ["select", "check", "close", "unlock", "complete"]) {
    assert.strictEqual(apply(game, type, 0), game);
  }
});

test("arbitrary input bursts preserve selection and match invariants", () => {
  const actions = ["select", "select", "select", "evaluate", "check", "close", "unlock", "complete"];
  for (let run = 0; run < 100; run += 1) {
    let game = readyGame();
    for (let step = 0; step < 200; step += 1) {
      game = apply(game, actions[Math.floor(Math.random() * actions.length)], Math.floor(Math.random() * 8));
      assert.ok(game.selected.length <= 2);
      assert.equal(new Set(game.selected).size, game.selected.length);
      assert.equal(new Set(game.matched).size, game.matched.length);
      assert.equal(game.matched.length % 2, 0);
      assert.ok(game.matched.length <= 6);
      assert.ok(game.selected.every(id => !game.matched.includes(id)));
    }
  }
});


test("intro waits for a tap, previews once, and locks through the return flip", () => {
  let game = createGame();
  assert.strictEqual(select(game, 0), game);
  game = apply(game, "assets-ready");
  assert.equal(game.phase, "intro");
  assert.strictEqual(select(game, 0), game);
  game = apply(game, "start");
  assert.equal(game.phase, "entering");
  assert.strictEqual(apply(game, "start"), game);
  assert.strictEqual(select(game, 0), game);
  game = apply(game, "board-ready");
  assert.equal(game.phase, "preview");
  assert.strictEqual(select(game, 0, 1), game);
  assert.strictEqual(apply(game, "check"), game);
  assert.strictEqual(apply(game, "unlock"), game);
  assert.strictEqual(apply(game, "board-ready"), game);
  assert.equal(game.hintVisible, false);
  game = apply(game, "hide-preview");
  assert.equal(game.phase, "preview-closing");
  assert.strictEqual(select(game, 0), game);
  game = apply(game, "unlock");
  assert.equal(game.phase, "ready");
  assert.equal(game.hintVisible, true);
  assert.deepEqual(game.selected, []);
  assert.deepEqual(game.matched, []);
  assert.strictEqual(apply(game, "board-ready"), game);
  assert.strictEqual(apply(game, "assets-ready"), game);
  assert.strictEqual(apply(game, "hide-preview"), game);
});

test("first and second selections are explicit and second locks immediately", () => {
  let game = apply(readyGame(), "select", 0);
  assert.equal(game.phase, "first");
  assert.strictEqual(apply(game, "select", 0), game);
  game = apply(game, "select", 1);
  assert.equal(game.phase, "second");
  assert.strictEqual(apply(game, "select", 2), game);
  assert.strictEqual(apply(game, "check"), game);
  game = apply(game, "evaluate");
  assert.equal(game.phase, "checking");
  assert.strictEqual(apply(game, "evaluate"), game);
});

test("guidance follows actual pairs and the selected card's mate", () => {
  for (let i = 0; i < 100; i++) {
    let game = readyGame();
    const [first, second] = getHintPair(game);
    assert.notEqual(first, second);
    assert.equal(game.cards.find(c => c.id === first).product, game.cards.find(c => c.id === second).product);
    game = select(game, first);
    assert.deepEqual(getHintPair(game), [second]);
    game = select(game, second);
    assert.deepEqual(getHintPair(game), []);
    game = apply(apply(game, "check"), "unlock");
    assert.ok(getHintPair(game).every(id => !game.matched.includes(id)));
  }
});

test("interaction dismisses guidance and rejects stale idle timers", () => {
  let game = readyGame();
  const oldActivity = game.activity;
  game = gameReducer(game, { type: "hint", activity: oldActivity });
  assert.equal(game.hintVisible, true);
  game = apply(game, "interact");
  assert.equal(game.hintVisible, false);
  assert.strictEqual(gameReducer(game, { type: "hint", activity: oldActivity }), game);
  game = gameReducer(game, { type: "hint", activity: game.activity });
  assert.equal(game.hintVisible, true);
  game = select(game, 0);
  assert.equal(game.hintVisible, false);
});

test("a new shuffle cannot repeat the preceding stored layout", () => {
  const previous = createGame(() => 0.5).cards.map(c => c.product).join(",");
  const next = createGame(() => 0.5, previous);
  assert.notEqual(next.cards.map(c => c.product).join(","), previous);
  assert.deepEqual([0,1,2].map(p => next.cards.filter(c => c.product === p).length), [2,2,2]);
});
