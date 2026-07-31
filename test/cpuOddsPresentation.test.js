import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWholePercentageDistribution,
  shouldShowCpuOdds,
} from '../src/presentation/cpuOddsPresentation.js';

test('CPU odds truncate independently so equal moves stay visually equal', () => {
  const percentages = getWholePercentageDistribution([
    { moveId: 'rock', probability: 1 / 3 },
    { moveId: 'paper', probability: 1 / 3 },
    { moveId: 'scissors', probability: 1 / 3 },
  ]);

  assert.deepEqual(percentages, [
    { moveId: 'rock', percentage: 33 },
    { moveId: 'paper', percentage: 33 },
    { moveId: 'scissors', percentage: 33 },
  ]);
  assert.equal(percentages.reduce((sum, entry) => sum + entry.percentage, 0), 99);
});

test('CPU odds visibility is limited to active local decisions', () => {
  assert.equal(shouldShowCpuOdds({ playMode: 'local', turnPhase: 'scene', status: 'playing' }), true);
  assert.equal(shouldShowCpuOdds({ playMode: 'online', turnPhase: 'scene', status: 'playing' }), false);
  assert.equal(shouldShowCpuOdds({ playMode: 'test', turnPhase: 'scene', status: 'playing' }), false);
  assert.equal(shouldShowCpuOdds({ playMode: 'local', turnPhase: 'round-over', status: 'finished' }), false);
});
