import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameState, playRound } from '../src/engine/gameState.js';
import { chooseRivalMove } from '../src/engine/rivalAi.js';
import { resolveRound } from '../src/engine/resolveRound.js';

test('reload grants AP and ties with free defense moves', () => {
  const block = resolveRound({ p1Move: 'reload', p2Move: 'block', p1Ap: 0, p2Ap: 0 });
  assert.equal(block.ok, true);
  assert.equal(block.isTie, true);
  assert.equal(block.p1Ap, 1);
  assert.equal(block.p2Ap, 0);

  const counterstab = resolveRound({ p1Move: 'reload', p2Move: 'counterstab', p1Ap: 0, p2Ap: 0 });
  assert.equal(counterstab.ok, true);
  assert.equal(counterstab.isTie, true);
  assert.equal(counterstab.p1Ap, 1);
});

test('shoot beats stab, counterstab, and reload', () => {
  for (const p2Move of ['stab', 'counterstab', 'reload']) {
    const result = resolveRound({ p1Move: 'shoot', p2Move, p1Ap: 1, p2Ap: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Hit, 'shot');
  }
});

test('stab beats block and reload', () => {
  for (const p2Move of ['block', 'reload']) {
    const result = resolveRound({ p1Move: 'stab', p2Move, p1Ap: 1, p2Ap: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Hit, 'stabbed');
  }
});

test('listed ties do not end game', () => {
  const ties = [
    ['shoot', 'shoot', 1, 1],
    ['shoot', 'block', 1, 0],
    ['stab', 'stab', 1, 1],
    ['stab', 'counterstab', 1, 0],
    ['block', 'counterstab', 0, 0],
  ];

  for (const [p1Move, p2Move, p1Ap, p2Ap] of ties) {
    const result = resolveRound({ p1Move, p2Move, p1Ap, p2Ap });
    assert.equal(result.ok, true);
    assert.equal(result.winner, null);
    assert.equal(result.isGameOver, false);
  }
});

test('moves with AP costs are illegal without AP', () => {
  const result = resolveRound({ p1Move: 'shoot', p2Move: 'reload', p1Ap: 0, p2Ap: 0 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 cannot afford shoot']);
});

test('game state advances on ties and freezes on win', () => {
  let state = createGameState();
  let turn = playRound(state, 'reload', 'reload');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.round, 1);
  assert.equal(turn.state.players.p1.ap, 2);
  assert.equal(turn.state.players.p2.ap, 2);

  state = turn.state;
  turn = playRound(state, 'shoot', 'stab');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.status, 'finished');
  assert.equal(turn.state.round, 1);
  assert.equal(turn.state.winner, 'p1');
});

test('rival AI uses weighted neutral policy from 1-1', () => {
  const state = createStateWithAp(1, 1);

  assert.equal(chooseRivalMove(state, fixedRoll(0)), 'shoot');
  assert.equal(chooseRivalMove(state, fixedRoll(0.44)), 'shoot');
  assert.equal(chooseRivalMove(state, fixedRoll(0.45)), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.79)), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.8)), 'stab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.94)), 'stab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.95)), 'reload');
});

test('rival AI always reloads from 0-0', () => {
  const state = createStateWithAp(0, 0);

  assert.equal(chooseRivalMove(state, fixedRoll(0)), 'reload');
  assert.equal(chooseRivalMove(state, fixedRoll(0.99)), 'reload');
});

test('rival AI filters illegal moves at 0 AP', () => {
  const state = createStateWithAp(0, 1);

  assert.equal(chooseRivalMove(state, fixedRoll(0)), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.44)), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.45)), 'counterstab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.89)), 'counterstab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.9)), 'reload');
});

test('rival AI maps larger AP matchups onto strategy buckets', () => {
  assert.equal(chooseRivalMove(createStateWithAp(3, 0), fixedRoll(0)), 'shoot');
  assert.equal(chooseRivalMove(createStateWithAp(0, 3), fixedRoll(0)), 'block');
  assert.equal(chooseRivalMove(createStateWithAp(4, 4), fixedRoll(0)), 'shoot');
  assert.equal(chooseRivalMove(createStateWithAp(3, 2), fixedRoll(0.43)), 'block');
  assert.equal(chooseRivalMove(createStateWithAp(2, 3), fixedRoll(0.61)), 'shoot');
});

test('named rival AIs use distinct opening strategies', () => {
  assert.equal(chooseRivalMove(createStateWithAp(1, 1), 'olJoe', fixedRoll(0)), 'shoot');
  assert.equal(chooseRivalMove(createStateWithAp(1, 1), 'mackTheKnife', fixedRoll(0)), 'stab');
  assert.equal(chooseRivalMove(createStateWithAp(1, 1), 'blastinDan', fixedRoll(0.69)), 'shoot');
  assert.equal(chooseRivalMove(createStateWithAp(1, 1), 'katheyClever', fixedRoll(0.32)), 'block');
});

test('Kathey Clever reacts to the player last move', () => {
  const state = {
    ...createStateWithAp(1, 1),
    history: [{ p1Move: 'stab' }],
  };

  assert.equal(chooseRivalMove(state, 'katheyClever', fixedRoll(0)), 'counterstab');
  assert.equal(chooseRivalMove(state, 'katheyClever', fixedRoll(0.56)), 'block');
});

function createStateWithAp(rivalAp, playerAp) {
  return {
    players: {
      p1: { ap: playerAp },
      p2: { ap: rivalAp },
    },
  };
}

function fixedRoll(value) {
  return () => value;
}
