import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { VARIANT_IDS } from '../src/engine/moves.js';

test('RPS Poker antes and locks simultaneous RPS', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.rpsPoker });
  assert.deepEqual(state.stacks, { p1: 8, p2: 8 });
  assert.equal(state.hand, 1);
  assert.equal(state.pot, 2);
  assert.equal(state.phase, 'lock');

  const turn = playTurn(state, 'rock', 'paper');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.phase, 'betting');
  assert.equal(turn.state.actor, 'p1');
  assert.deepEqual(turn.state.locked, { p1: 'rock', p2: 'paper' });
  assert.ok(['rock', 'paper', 'scissors'].includes(turn.state.community));
});

test('RPS Poker alternates betting actions and starts next hand after fold', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker });
  state = playTurn(state, 'rock', 'paper').state;
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['wait']);

  state = playTurn(state, 'bet:2', 'wait').state;
  assert.equal(state.actor, 'p2');
  assert.equal(state.pot, 4);
  assert.equal(state.stacks.p1, 6);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['wait']);

  state = playTurn(state, 'wait', 'fold').state;
  assert.equal(state.hand, 2);
  assert.equal(state.phase, 'lock');
  assert.equal(state.firstActor, 'p2');
  assert.deepEqual(state.stacks, { p1: 8, p2: 6 });
  assert.equal(state.pot, 4);
});

test('RPS Poker check-check resolves showdown and continues', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker });
  state = playTurn(state, 'rock', 'paper').state;
  state = playTurn(state, 'check', 'wait').state;
  assert.equal(state.actor, 'p2');
  state = playTurn(state, 'wait', 'check').state;
  assert.equal(state.hand, 2);
  assert.equal(state.phase, 'lock');
  assert.equal(state.stacks.p1 + state.stacks.p2 + state.pot, 18);
});
