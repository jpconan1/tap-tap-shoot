import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { startNextRound } from '../src/engine/matchEngine.js';
import { VARIANT_IDS } from '../src/engine/moves.js';
import { resolveTurn } from '../src/engine/resolveTurn.js';
import { resolveScene } from '../src/sceneResolver.js';
import { getGameFlowPolicy } from '../src/presentation/gameFlowPolicies.js';

const variantId = VARIANT_IDS.rpsDragonSpear;

test('RPS Dragon Spear exposes five moves and resolves its outer relationship', () => {
  const state = createRoundState({ variantId });
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['dragon', 'rock', 'paper', 'scissors', 'spear']);

  assert.equal(resolve('dragon', 'rock').winner, 'p1');
  assert.equal(resolve('dragon', 'paper').winner, 'p1');
  assert.equal(resolve('dragon', 'scissors').winner, 'p1');
  assert.equal(resolve('spear', 'dragon').winner, 'p1');
  assert.equal(resolve('spear', 'rock').winner, 'p2');
  assert.equal(resolve('paper', 'spear').winner, 'p1');
});

test('a speared Dragon stays dead between rounds', () => {
  const state = createRoundState({ variantId });
  const turn = playTurn(state, 'dragon', 'spear');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.players.p1.resource, 0);

  const next = startNextRound({
    variantId,
    roundState: turn.state,
    roundWins: { p1: 0, p2: 1 },
  });
  assert.equal(next.roundState.players.p1.resource, 0);
  assert.equal(getPlayerLegalMoves(next.roundState, 'p1').includes('dragon'), false);
  assert.equal(getPlayerLegalMoves(next.roundState, 'p2').includes('dragon'), true);
});

test('Dragon Spear scenes use stateful text placeholders', () => {
  const result = resolve('spear', 'dragon');
  const scene = resolveScene({ variantId, p1Move: 'spear', p2Move: 'dragon', result });

  assert.equal(scene.kind, 'placeholder');
  assert.equal(scene.title, 'DRAGON DEAD!');
  assert.deepEqual(scene.lines, ['YOUR DRAGON: ALIVE', 'RIVAL DRAGON: DEAD']);
});

test('Dragon Spear skips ordinary round result screens', () => {
  const policy = getGameFlowPolicy(variantId);
  assert.equal(policy.autoAdvanceRound, true);
  assert.equal(policy.roundResult, 'persist-reveal');
});

function resolve(p1Move, p2Move) {
  return resolveTurn({ variantId, p1Move, p2Move, p1Resource: 1, p2Resource: 1 });
}
