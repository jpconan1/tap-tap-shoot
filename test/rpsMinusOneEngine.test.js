import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves } from '../src/engine/gameState.js';
import { resolveMatchTurn } from '../src/engine/matchEngine.js';
import { VARIANT_IDS } from '../src/engine/moves.js';
import { chooseRivalMove } from '../src/engine/rivalAi.js';

const variantId = VARIANT_IDS.rpsMinusOne;

test('Minus One reveals different pairs then restricts each keep choice', () => {
  const state = createRoundState({ variantId });
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['rockPaper', 'paperScissors', 'scissorsRock']);

  const pairs = turn(state, { p1: 0, p2: 0 }, 'rockPaper', 'paperScissors');
  assert.equal(pairs.turn.state.status, 'playing');
  assert.equal(pairs.turn.state.phase, 'keep');
  assert.deepEqual(getPlayerLegalMoves(pairs.turn.state, 'p1'), ['rock', 'paper']);
  assert.deepEqual(getPlayerLegalMoves(pairs.turn.state, 'p2'), ['paper', 'scissors']);

  const kept = turn(pairs.turn.state, pairs.roundWins, 'rock', 'scissors');
  assert.equal(kept.turn.state.status, 'finished');
  assert.equal(kept.turn.state.winner, 'p1');
  assert.deepEqual(kept.roundWins, { p1: 2, p2: 0 });
});

test('matching pairs end the round and award one pip each', () => {
  const state = createRoundState({ variantId });
  const result = turn(state, { p1: 2, p2: 3 }, 'scissorsRock', 'scissorsRock');
  assert.equal(result.turn.state.status, 'finished');
  assert.equal(result.turn.state.winner, null);
  assert.deepEqual(result.roundWins, { p1: 3, p2: 4 });
});

test('six-six enters sudden death and its winner takes the game', () => {
  const state = createRoundState({ variantId });
  const tied = turn(state, { p1: 5, p2: 5 }, 'rockPaper', 'rockPaper');
  assert.equal(tied.turn.state.status, 'playing');
  assert.equal(tied.turn.state.phase, 'suddenDeath');
  assert.equal(tied.gameWinner, null);
  assert.deepEqual(getPlayerLegalMoves(tied.turn.state, 'p1'), ['rock', 'paper', 'scissors']);

  const finish = turn(tied.turn.state, tied.roundWins, 'paper', 'rock');
  assert.equal(finish.gameWinner, 'p1');
  assert.deepEqual(finish.roundWins, { p1: 7, p2: 6 });
});

test('CPU always picks from its current Minus One phase', () => {
  const pairs = turn(
    createRoundState({ variantId }),
    { p1: 0, p2: 0 },
    'rockPaper',
    'paperScissors',
  );

  assert.equal(chooseRivalMove(pairs.turn.state, () => 0), 'paper');
  assert.equal(chooseRivalMove(pairs.turn.state, () => 0.999), 'scissors');
});

function turn(state, roundWins, p1Move, p2Move) {
  return resolveMatchTurn({ roundState: state, roundWins, p1Move, p2Move, variantId });
}
