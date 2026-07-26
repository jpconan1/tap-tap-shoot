import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves } from '../src/engine/gameState.js';
import { resolveMatchTurn, resolveRoundTimeout, startNextRound } from '../src/engine/matchEngine.js';
import { VARIANT_IDS } from '../src/engine/moves.js';

const variantId = VARIANT_IDS.rpsRpg;

test('RPS RPG levels stats then switches to weapons', () => {
  const state = createRoundState({ variantId });
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['str', 'int', 'dex']);
  assert.deepEqual(state.stats, {
    p1: { str: 1, int: 1, dex: 1 },
    p2: { str: 1, int: 1, dex: 1 },
  });

  const leveled = turn(state, { p1: 0, p2: 0 }, 'str', 'int');
  assert.equal(leveled.turn.state.phase, 'move');
  assert.deepEqual(leveled.turn.state.stats, {
    p1: { str: 2, int: 1, dex: 1 },
    p2: { str: 1, int: 2, dex: 1 },
  });
  assert.deepEqual(getPlayerLegalMoves(leveled.turn.state, 'p1'), ['sword', 'staff', 'bow']);
});

test('equal weapons use their associated stat', () => {
  const leveled = turn(createRoundState({ variantId }), { p1: 0, p2: 0 }, 'str', 'int');
  const fight = turn(leveled.turn.state, leveled.roundWins, 'sword', 'sword');
  assert.equal(fight.turn.result.winner, 'p1');
  assert.equal(fight.turn.state.winner, null);
  assert.equal(fight.turn.state.status, 'playing');
  assert.equal(fight.turn.state.phase, 'level');
  assert.deepEqual(fight.roundWins, { p1: 1, p2: 0 });
});

test('equal-stat weapon ties repeat combat without leveling', () => {
  let state = turn(createRoundState({ variantId }), { p1: 0, p2: 0 }, 'dex', 'dex').turn.state;
  state = turn(state, { p1: 0, p2: 0 }, 'bow', 'bow').turn.state;
  assert.equal(state.phase, 'move');
  assert.deepEqual(state.stats.p1, { str: 1, int: 1, dex: 2 });
});

test('RPS RPG ends only on the fourth score', () => {
  const leveled = turn(createRoundState({ variantId }), { p1: 3, p2: 0 }, 'str', 'int');
  leveled.turn.state.rpgScores = { p1: 3, p2: 0 };
  const finish = turn(leveled.turn.state, { p1: 3, p2: 0 }, 'sword', 'staff');
  assert.equal(finish.turn.state.status, 'finished');
  assert.equal(finish.gameWinner, 'p1');
  assert.deepEqual(finish.roundWins, { p1: 4, p2: 0 });
});

test('level-up timeout preserves stats and advances RPG score', () => {
  const state = createRoundState({ variantId });
  state.stats.p1.str = 3;
  const timeout = resolveRoundTimeout({
    roundState: state,
    roundWins: { p1: 1, p2: 1 },
    loser: 'p1',
    variantId,
  });
  assert.deepEqual(timeout.roundWins, { p1: 1, p2: 2 });
  assert.deepEqual(timeout.roundState.rpgScores, { p1: 0, p2: 1 });

  const next = startNextRound({
    variantId,
    roundState: timeout.roundState,
    roundWins: timeout.roundWins,
  });
  assert.equal(next.roundState.phase, 'level');
  assert.equal(next.roundState.stats.p1.str, 3);
  assert.deepEqual(next.roundState.rpgScores, { p1: 0, p2: 1 });
});

function turn(state, roundWins, p1Move, p2Move) {
  return resolveMatchTurn({ roundState: state, roundWins, p1Move, p2Move, variantId });
}
