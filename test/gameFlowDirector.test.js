import assert from 'node:assert/strict';
import test from 'node:test';

import { GameFlowDirector } from '../src/presentation/gameFlowDirector.js';
import { getGameFlowPolicy } from '../src/presentation/gameFlowPolicies.js';

function createDirector(log) {
  return new GameFlowDirector({
    playSuper: async () => log.push('super'),
    waitBeats: async (beats) => log.push(`wait:${beats}`),
    showResult: async (level) => log.push(`result:${level}`),
    advanceRound: async ({ preserveReveal }) => log.push(`advance:${preserveReveal}`),
  });
}

test('default round keeps existing result choreography', async () => {
  const log = [];
  await createDirector(log).reveal({ variantId: 'tapTapShootY', roundFinished: true });
  assert.deepEqual(log, ['wait:2', 'result:round']);
});

test('RPS preserves reveal and immediately advances ordinary rounds', async () => {
  const log = [];
  await createDirector(log).reveal({ variantId: 'rockPaperScissors', roundFinished: true });
  assert.deepEqual(log, ['advance:true']);
  assert.equal(getGameFlowPolicy('rockPaperScissors').roundResult, 'persist-reveal');
});

test('RPS still shows game and match results', async () => {
  const gameLog = [];
  await createDirector(gameLog).reveal({ variantId: 'rockPaperScissors', roundFinished: true, resultLevel: 'game' });
  assert.deepEqual(gameLog, ['wait:2', 'result:game']);

  const matchLog = [];
  await createDirector(matchLog).reveal({ variantId: 'rockPaperScissors', roundFinished: true, resultLevel: 'match' });
  assert.deepEqual(matchLog, ['wait:2', 'result:match']);
});

test('Fireball super completes before result without extra hold', async () => {
  const log = [];
  await createDirector(log).reveal({
    variantId: 'fireballWar',
    superAnimation: {},
    roundFinished: true,
    resultLevel: 'match',
  });
  assert.deepEqual(log, ['super', 'result:match']);
});
