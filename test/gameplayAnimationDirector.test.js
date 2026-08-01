import assert from 'node:assert/strict';
import test from 'node:test';

import { GameplayAnimationDirector, waitForAnimation } from '../src/presentation/gameplayAnimationDirector.js';
import { buildGameplayTimeline, buildPokerTimeline } from '../src/presentation/gameplayTimelines.js';

function transition(id, revision, beats) {
  return { id, revision, variantId: 'test', events: [], before: {}, after: {}, perspective: 'p1', beats };
}

test('gameplay director runs declarative beats in order', async () => {
  const log = [];
  const director = new GameplayAnimationDirector({
    effects: { log: async (beat) => log.push(beat.value) },
  });
  const result = await director.enqueue(transition('one', 1, [
    { type: 'log', value: 'a' },
    { type: 'log', value: 'b' },
  ]));
  assert.equal(result.status, 'completed');
  assert.deepEqual(log, ['a', 'b']);
  assert.equal(director.isPresenting(), false);
});

test('gameplay director deduplicates and rejects stale transitions', async () => {
  const director = new GameplayAnimationDirector({ effects: {} });
  await director.enqueue(transition('new', 4, []));
  assert.equal((await director.enqueue(transition('new', 4, []))).status, 'duplicate');
  assert.equal((await director.enqueue(transition('old', 3, []))).status, 'stale');
});

test('gameplay director cancellation aborts managed waits', async () => {
  const director = new GameplayAnimationDirector({
    effects: { wait: (beat, _transition, signal) => waitForAnimation(beat.duration, signal) },
  });
  const running = director.enqueue(transition('wait', 1, [{ type: 'wait', duration: 10_000 }]));
  director.cancel('screen-changed');
  const result = await running;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.reason, 'screen-changed');
});

test('Poker timeline is identical for equivalent local and online events', () => {
  const events = [
    { type: 'poker.community-revealed', community: 'rock' },
    { type: 'poker.bet', action: 'check' },
    { type: 'poker.showdown', cards: { p1: 'rock', p2: 'paper' } },
    { type: 'poker.payout', winner: 'p2' },
    { type: 'hand.started' },
  ];
  const local = buildPokerTimeline({ events });
  const online = buildGameplayTimeline({ variantId: 'rpsPoker', events });
  assert.deepEqual(online, local);
  assert.deepEqual(local.map((beat) => beat.type), [
    'pokerCommunity',
    'pokerBet',
    'pokerShowdown',
    'pokerPayout',
    'pokerDeal',
  ]);
});

test('Fireball super remains before final result', () => {
  const timeline = buildGameplayTimeline({
    variantId: 'fireballWar',
    events: [{ type: 'super.played', animation: { frames: [] } }],
    after: { roundFinished: true, resultLevel: 'match' },
  });
  assert.deepEqual(timeline.map((beat) => beat.type), ['playSuper', 'showResult']);
});
