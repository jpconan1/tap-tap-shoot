import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves } from '../src/engine/gameState.js';
import { resolveMatchTurn, startNewGame, startNextRound } from '../src/engine/matchEngine.js';
import { getVariantTargetRoundWins, VARIANT_IDS } from '../src/engine/moves.js';

const variantId = VARIANT_IDS.kitchenSink;

test('Kitchen Sink is first to two rounds', () => {
  assert.equal(getVariantTargetRoundWins(variantId), 2);
});

test('Kitchen Sink tracks HP, bars, and center position', () => {
  let state = createRoundState({ variantId });
  assert.deepEqual(state.hp, { p1: 3, p2: 3 });
  assert.equal(state.position, 'neutral');

  let resolved = turn(state, 'bait', 'charge');
  state = resolved.turn.state;
  assert.equal(state.position, 'p1-center');
  assert.equal(state.players.p2.resource, 1);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['strike', 'advance', 'bait', 'charge']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['strike', 'advance', 'bait', 'charge', 'reversal']);

  resolved = turn(state, 'charge', 'bait');
  assert.equal(resolved.turn.state.players.p1.resource, 1);
});

test('Kitchen Sink neutral Strike damages Charge and denies its bar gain', () => {
  const state = turn(createRoundState({ variantId }), 'strike', 'charge').turn.state;
  assert.equal(state.hp.p2, 2);
  assert.equal(state.players.p2.resource, 0);
  assert.equal(state.position, 'neutral');
});

test('Kitchen Sink Center Advance damages Corner Bait and holds position', () => {
  const state = createRoundState({ variantId });
  state.position = 'p2-center';
  const resolved = turn(state, 'bait', 'advance').turn.state;
  assert.equal(resolved.hp.p1, 2);
  assert.equal(resolved.position, 'p2-center');
});

test('Kitchen Sink punish grants one-sided free move', () => {
  let state = turn(createRoundState({ variantId }), 'bait', 'charge').turn.state;
  state = turn(state, 'bait', 'strike').turn.state;
  assert.equal(state.phase, 'freeMove');
  assert.equal(state.freeMoveActor, 'p1');
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['wait']);

  const free = turn(state, 'strike', 'wait');
  assert.equal(free.turn.state.phase, 'choose');
  assert.equal(free.turn.state.hp.p2, 2);
});

test('Kitchen Sink hidden wait is a defined engine move', () => {
  const state = turn(
    turn(createRoundState({ variantId }), 'bait', 'charge').turn.state,
    'bait',
    'strike',
  ).turn.state;
  assert.equal(getPlayerLegalMoves(state, 'p2')[0], 'wait');
});

test('Kitchen Sink bars persist while HP and position reset next round', () => {
  const state = createRoundState({ variantId });
  state.players.p1.resource = 2;
  state.hp.p2 = 0;
  state.status = 'finished';
  state.winner = 'p1';
  state.position = 'p1-center';

  const next = startNextRound({ variantId, roundState: state, roundWins: { p1: 1, p2: 0 } });
  assert.equal(next.roundState.players.p1.resource, 2);
  assert.deepEqual(next.roundState.hp, { p1: 3, p2: 3 });
  assert.equal(next.roundState.position, 'neutral');
});

test('entering Kitchen Sink from another variant starts at zero bars', () => {
  const previous = createRoundState({ variantId: VARIANT_IDS.tapTapShootY });
  assert.equal(previous.players.p1.resource, 1);

  const kitchen = startNextRound({
    variantId,
    roundState: previous,
    roundWins: { p1: 0, p2: 0 },
  });
  assert.equal(kitchen.roundState.players.p1.resource, 0);
  assert.equal(kitchen.roundState.players.p2.resource, 0);
});

test('starting a new Kitchen Sink game resets carried bars', () => {
  const finished = createRoundState({ variantId });
  finished.players.p1.resource = 3;
  finished.players.p2.resource = 2;

  const next = startNewGame({ variantId });

  assert.equal(next.roundState.players.p1.resource, 0);
  assert.equal(next.roundState.players.p2.resource, 0);
});

function turn(state, p1Move, p2Move) {
  return resolveMatchTurn({
    roundState: state,
    roundWins: { p1: 0, p2: 0 },
    p1Move,
    p2Move,
    variantId,
  });
}
