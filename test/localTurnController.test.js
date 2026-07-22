import assert from 'node:assert/strict';
import test from 'node:test';

import { LocalTurnController } from '../src/localTurnController.js';

function createHarness() {
  const timers = [];
  const cleared = [];
  const controller = new LocalTurnController({
    setTimer(callback, duration) {
      const timer = { callback, duration };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      cleared.push(timer);
    },
  });
  return { controller, timers, cleared };
}

test('local turn controller reuses one choice for a turn and clears owned timers', () => {
  const { controller, timers, cleared } = createHarness();
  const choice = controller.getOrCreate('turn-1', { computerDelayMs: 3000, onComputerDue() {} });

  assert.equal(controller.getOrCreate('turn-1'), choice);
  controller.beginWaiting('p1', { safeDurationMs: 5000, onSafeElapsed() {} });
  controller.beginCountdown({ durationMs: 5000, onElapsed() {} });
  controller.clear();

  assert.equal(controller.choice, null);
  assert.deepEqual(cleared, timers);
});

test('countdown reports whichever player is still waiting', () => {
  const { controller, timers } = createHarness();
  let timedOutPlayer = null;
  controller.getOrCreate('turn-1');
  controller.beginWaiting('p2', { safeDurationMs: 5000, onSafeElapsed() {} });
  controller.beginCountdown({ durationMs: 5000, onElapsed: (playerId) => { timedOutPlayer = playerId; } });

  timers.at(-1).callback();
  assert.equal(timedOutPlayer, 'p1');
});
