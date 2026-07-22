import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState } from '../src/engine/gameState.js';
import { resolveLocalTurn } from '../src/engine/localMatch.js';
import { awardRoundWin, createVariantGame, getResultLevel, resolveRoundTimeout, startNextRound } from '../src/engine/matchEngine.js';

test('local match resolution validates queued move and uses selected opponent move', () => {
  const state = createRoundState({ variantId: 'tapTapShootY' });
  const resolved = resolveLocalTurn({
    state,
    queuedPlayerMove: 'shoot',
    queuedOpponentMove: 'stab',
    chooseOpponentMove: () => 'reload',
  });

  assert.deepEqual(resolved.moves, { p1: 'shoot', p2: 'stab' });
  assert.equal(resolved.turn.state.winner, 'p1');
});

test('timeout uses shared round and score transition', () => {
  const timeout = resolveRoundTimeout({
    roundState: createRoundState({ variantId: 'tapTapShootY' }),
    roundWins: { p1: 2, p2: 0 },
    loser: 'p2',
  });
  assert.equal(timeout.roundState.status, 'finished');
  assert.equal(timeout.winner, 'p1');
  assert.deepEqual(timeout.roundWins, { p1: 3, p2: 0 });
  assert.equal(timeout.gameWinner, 'p1');
});

test('next round resets turn state while preserving variant game score', () => {
  const game = createVariantGame({ variantId: 'fireballWar', roundWins: { p1: 1, p2: 0 } });
  game.roundState.turn = 4;
  const next = startNextRound(game);
  assert.equal(next.roundState.turn, 0);
  assert.equal(next.roundState.variantId, 'fireballWar');
  assert.deepEqual(next.roundWins, { p1: 1, p2: 0 });
});

test('local match resolution falls back when queued move is illegal', () => {
  const state = createRoundState({ variantId: 'tapTapShootY' });
  state.players.p1.resource = 0;
  state.players.p1.bullets = 0;
  const resolved = resolveLocalTurn({
    state,
    queuedPlayerMove: 'shoot',
    forcedOpponentMove: 'reload',
    chooseOpponentMove: () => 'stab',
  });

  assert.equal(resolved.moves.p1, 'reload');
});

test('round award and result level stay independent from presentation', () => {
  const wins = awardRoundWin({ p1: 1, p2: 0 }, 'p1');
  assert.deepEqual(wins, { p1: 2, p2: 0 });
  assert.equal(getResultLevel({ p1: 3, p2: 0 }, 'p1', 'tapTapShootY'), 'game');
});
