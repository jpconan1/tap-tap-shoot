import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseRivalMove,
  getRivalMoveDistribution,
  RIVAL_DIFFICULTIES,
} from '../src/engine/rivalAi.js';
import {
  chooseRpsPokerNashMove,
  getRpsPokerNashDistribution,
} from '../src/engine/rpsPokerPolicy.js';

function pokerState(overrides = {}) {
  return {
    variantId: 'rpsPoker',
    phase: 'betting',
    actor: 'p2',
    ante: 1,
    hand: 1,
    stacks: { p1: 8, p2: 8 },
    committed: { p1: 0, p2: 0 },
    firstActor: 'p2',
    locked: { p1: 'rock', p2: 'rock' },
    community: 'rock',
    bettingHistory: [],
    minRaise: 1,
    players: { p1: { resource: 0 }, p2: { resource: 0 } },
    ...overrides,
  };
}

test('RPS Poker policy finds the current information set and translates actions', () => {
  const mix = getRpsPokerNashDistribution(pokerState(), 'p2');
  assert.ok(mix.check > 0.5);
  assert.ok(mix['bet:1'] > 0);
  assert.equal(mix.x, undefined);
  assert.equal(mix.b1, undefined);
});

test('hard RPS Poker bot samples its JSON Nash distribution', () => {
  const state = pokerState();
  const distribution = getRivalMoveDistribution(state, RIVAL_DIFFICULTIES.hard);
  assert.ok(distribution.some(({ moveId }) => moveId === 'bet:1'));
  assert.ok(distribution.some(({ moveId }) => moveId === 'check'));
  assert.ok(Math.abs(distribution.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 1e-12);
  assert.equal(chooseRivalMove(state, () => 0, RIVAL_DIFFICULTIES.hard), 'bet:1');
  assert.equal(chooseRivalMove(state, () => 0.99, RIVAL_DIFFICULTIES.hard), 'check');
});

test('RPS Poker policy follows betting history for later decisions', () => {
  const state = pokerState({
    stacks: { p1: 7, p2: 8 },
    committed: { p1: 1, p2: 0 },
    firstActor: 'p1',
    bettingHistory: ['b1'],
  });
  const mix = getRpsPokerNashDistribution(state, 'p2');
  assert.ok(mix);
  assert.ok(Object.keys(mix).every((move) => ['fold', 'call', ...Array.from({ length: 7 }, (_, i) => `raise:${i + 2}`)].includes(move)));
  assert.ok(['fold', 'call', 'raise:2', 'raise:3', 'raise:4', 'raise:5', 'raise:6', 'raise:7', 'raise:8']
    .includes(chooseRpsPokerNashMove(state, 'p2', () => 0.5)));
});
