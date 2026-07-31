import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOnlinePokerAnimationKind,
  isCompleteOnlinePokerState,
  localizeOnlinePokerEvents,
  localizeOnlinePokerTransition,
} from '../src/onlinePokerState.js';

test('online Poker hydration rejects partial snapshots', () => {
  assert.equal(isCompleteOnlinePokerState({ phase: 'lock' }), false);
  assert.equal(isCompleteOnlinePokerState({
    phase: 'lock',
    stacks: { p1: 8, p2: 8 },
    committed: { p1: 0, p2: 0 },
    pot: 2,
    ante: 1,
    hand: 1,
    locked: {},
  }), true);
});

test('online Poker transitions localize every player-keyed value', () => {
  const localized = localizeOnlinePokerTransition({
    actor: 'p2',
    firstLocker: 'p2',
    previous: {
      phase: 'betting',
      actor: 'p2',
      stacks: { p1: 4, p2: 8 },
      committed: { p1: 2, p2: 1 },
    },
    next: {
      phase: 'betting',
      actor: 'p1',
      stacks: { p1: 4, p2: 7 },
      committed: { p1: 2, p2: 2 },
    },
    revealedLocks: { p1: 'rock', p2: 'paper' },
  }, 'p2');

  assert.equal(localized.actor, 'p1');
  assert.equal(localized.firstLocker, 'p1');
  assert.deepEqual(localized.previous.stacks, { p2: 4, p1: 8 });
  assert.deepEqual(localized.revealedLocks, { p2: 'rock', p1: 'paper' });
});

test('online Poker transition normalization rejects mismatched payload shapes safely', () => {
  const localized = localizeOnlinePokerTransition({
    kind: 'showdown',
    previous: { stacks: { p1: 1, p2: 2 } },
  }, 'p1');

  assert.equal(localized.previous, null);
  assert.equal(localized.next, null);
});

test('online Poker events select animations and localize player identities', () => {
  const events = localizeOnlinePokerEvents([
    { type: 'BET_PLACED', player: 'p2', amount: 2 },
    { type: 'TURN_CHANGED', actor: 'p1' },
  ], 'p2');

  assert.deepEqual(events, [
    { type: 'BET_PLACED', player: 'p1', amount: 2 },
    { type: 'TURN_CHANGED', actor: 'p2' },
  ]);
  assert.equal(getOnlinePokerAnimationKind(events), 'bet');
  assert.equal(getOnlinePokerAnimationKind([{ type: 'CARDS_REVEALED' }]), 'showdown');
});
