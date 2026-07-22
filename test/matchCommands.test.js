import assert from 'node:assert/strict';
import test from 'node:test';

import { createPendingContinues, createPendingMoves, getMoveDeadlineOutcome, lockContinue, lockMove } from '../src/engine/matchCommands.js';

test('move commands lock first choice and become complete after both players', () => {
  const first = lockMove(createPendingMoves(), 'p1', 'shoot', ['shoot', 'reload']);
  assert.equal(first.status, 'waiting');
  assert.equal(first.waitingPlayerId, 'p2');

  const duplicate = lockMove(first.moves, 'p1', 'reload', ['shoot', 'reload']);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.moveId, 'shoot');

  const second = lockMove(first.moves, 'p2', 'reload', ['reload']);
  assert.equal(second.status, 'complete');
});

test('continue commands wait for both players and reject duplicates', () => {
  const first = lockContinue(createPendingContinues(), 'p1');
  assert.equal(first.status, 'waiting');
  assert.equal(first.waitingPlayerId, 'p2');
  assert.equal(lockContinue(first.continues, 'p1').status, 'duplicate');
  assert.equal(lockContinue(first.continues, 'p2').status, 'complete');
});

test('move deadline outcome follows shared pending moves', () => {
  assert.deepEqual(getMoveDeadlineOutcome(createPendingMoves()), { type: 'no-contest' });
  assert.deepEqual(getMoveDeadlineOutcome({ p1: null, p2: 'stab' }), {
    type: 'timeout',
    winner: 'p2',
    loser: 'p1',
  });
  assert.deepEqual(getMoveDeadlineOutcome({ p1: 'shoot', p2: 'stab' }), { type: 'resolve' });
});
