import assert from 'node:assert/strict';
import test from 'node:test';

import { OnlineFlowDirector } from '../src/presentation/onlineFlowDirector.js';
import { interpretOnlineSnapshot } from '../src/presentation/onlineFlowSequences.js';

function createDirector(log) {
  const curtain = { isConnected: true, remove() {} };
  return new OnlineFlowDirector({
    closeCurtains: async () => { log.push('close'); return curtain; },
    openCurtains: async () => { log.push('open'); },
    reattachCurtain: () => log.push('reattach'),
    spikeWipe: async (stage) => log.push(`spike:${stage}`),
    waitBeats: async (beats) => log.push(`wait:${beats}`),
    commit: () => log.push('commit'),
    show: (stage) => log.push(`show:${stage}`),
    openingCues: () => log.push('cues'),
    disconnect: () => log.push('disconnect'),
    exitRanked: () => log.push('exit-ranked'),
  });
}

test('match-found sequence is an editable ordered choreography', async () => {
  const log = [];
  const director = createDirector(log);
  director.adoptCurtain({ isConnected: true, remove() {} });

  await director.play('MATCH_FOUND', { snapshot: {}, previousPhase: null });

  assert.deepEqual(log, [
    'commit',
    'show:match-found',
    'reattach',
    'open',
    'wait:2',
    'close',
  ]);
});

test('variants-chosen sequence owns scoreboard and spike wipe', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('VARIANTS_CHOSEN', { snapshot: {}, previousPhase: 'variantSelection' });

  assert.deepEqual(log, [
    'close',
    'commit',
    'show:scoreboard',
    'reattach',
    'open',
    'wait:5',
    'spike:playing',
    'cues',
  ]);
});

test('next variant leaves the scoreboard after both players continue', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('NEXT_VARIANT_STARTED', { snapshot: {}, previousPhase: 'roundOver' });

  assert.deepEqual(log, [
    'close',
    'commit',
    'show:playing',
    'reattach',
    'open',
    'cues',
  ]);
});

test('finished variant holds the result before opening the scoreboard', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('VARIANT_GAME_FINISHED', { snapshot: {}, previousPhase: 'revealed' });

  assert.deepEqual(log, [
    'commit',
    'show:playing',
    'wait:2',
    'close',
    'show:scoreboard',
    'reattach',
    'open',
  ]);
});

test('snapshot interpreter separates server facts from presentation events', () => {
  assert.equal(interpretOnlineSnapshot(null, { phase: 'countdown' }), 'MATCH_FOUND');
  assert.equal(
    interpretOnlineSnapshot(
      { phase: 'revealed' },
      { phase: 'gameOver', winner: 'p1', gameWins: { p1: 2, p2: 0 }, gameResults: [{}, {}] },
      'match-ended',
    ),
    'MATCH_FINISHED',
  );
  assert.equal(
    interpretOnlineSnapshot({ phase: 'variantSelection' }, { phase: 'choosing' }, 'variant-set-started'),
    'VARIANTS_CHOSEN',
  );
  assert.equal(
    interpretOnlineSnapshot({ phase: 'countdown' }, { phase: 'variantSelection' }),
    'VARIANT_SELECTION_STARTED',
  );
  assert.equal(
    interpretOnlineSnapshot(
      { phase: 'revealed' },
      { phase: 'roundOver', pendingNextVariant: true },
      'round-ended',
    ),
    'VARIANT_GAME_FINISHED',
  );
  assert.equal(
    interpretOnlineSnapshot(
      { phase: 'roundOver', pendingNextVariant: true },
      { phase: 'choosing', pendingNextVariant: false },
      'next-turn-started',
    ),
    'NEXT_VARIANT_STARTED',
  );
});

test('straight-set match disconnects after showing the match result', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('MATCH_FINISHED', { snapshot: {}, previousPhase: 'revealed' });

  assert.deepEqual(log, ['commit', 'spike:playing', 'disconnect']);
});

test('match-result continue curtain-wipes to the final scoreboard', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('FINAL_SCOREBOARD', { snapshot: {}, previousPhase: 'gameOver' });

  assert.deepEqual(log, ['close', 'show:scoreboard', 'reattach', 'open']);
});

test('main menu curtain-wipes from scoreboard to title', async () => {
  const log = [];
  const director = createDirector(log);

  await director.play('RETURN_TO_TITLE', { snapshot: {}, previousPhase: 'gameOver' });

  assert.deepEqual(log, ['close', 'exit-ranked', 'show:title', 'reattach', 'open']);
});
