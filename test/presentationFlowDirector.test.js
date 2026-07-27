import assert from 'node:assert/strict';
import test from 'node:test';

import { LOCAL_FLOW_SEQUENCE } from '../src/presentation/localFlowSequences.js';
import { PresentationFlowDirector } from '../src/presentation/presentationFlowDirector.js';

test('local tutorial flow swaps the screen before mounting its alert', async () => {
  const log = [];
  const director = new PresentationFlowDirector({
    sequences: LOCAL_FLOW_SEQUENCE,
    effects: {
      prepare: async (step) => log.push(`prepare:${step.action}`),
      starburstSwap: async (step) => log.push(`starburst:${step.action}`),
      showAlert: async (step) => log.push(`alert:${step.alert}`),
      unlockInput: async () => log.push('unlock'),
      openingCues: async () => log.push('cues'),
    },
  });

  await director.play('START_TUTORIAL');

  assert.deepEqual(log, [
    'prepare:prepareTutorial',
    'starburst:enterTutorial',
    'alert:tutorialIntro',
    'unlock',
    'cues',
  ]);
});

test('presentation flow cancellation prevents later sequence effects', async () => {
  let release;
  const log = [];
  const director = new PresentationFlowDirector({
    sequences: {
      FLOW: [
        { type: 'hold' },
        { type: 'finish' },
      ],
    },
    effects: {
      hold: () => new Promise((resolve) => { release = resolve; }),
      finish: () => log.push('finish'),
    },
  });

  const playing = director.play('FLOW');
  director.cancel();
  release();

  assert.equal(await playing, false);
  assert.deepEqual(log, []);
});

test('practice selection uses the shared curtain choreography', async () => {
  const log = [];
  const director = new PresentationFlowDirector({
    sequences: LOCAL_FLOW_SEQUENCE,
    effects: {
      curtainSwap: async (step) => log.push(step.action),
    },
  });

  await director.play('OPEN_PRACTICE_SELECT');

  assert.deepEqual(log, ['enterPracticeSelect']);
});

test('offline variant confirmation swaps under its owned curtain before reveal', async () => {
  const log = [];
  const director = new PresentationFlowDirector({
    sequences: LOCAL_FLOW_SEQUENCE,
    effects: {
      prepare: async (step) => log.push(`prepare:${step.action}`),
      commit: async (step) => log.push(`commit:${step.action}`),
      revealCurtain: async () => log.push('reveal'),
      unlockInput: async () => log.push('unlock'),
      openingCues: async () => log.push('cues'),
    },
  });

  await director.play('CONFIRM_LOCAL_VARIANT');

  assert.deepEqual(log, [
    'prepare:prepareLocalGame',
    'commit:enterLocalGame',
    'reveal',
    'unlock',
    'cues',
  ]);
});
