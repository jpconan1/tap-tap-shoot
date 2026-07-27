import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAlertSequence } from '../src/alertSystem.js';
import { TUTORIAL_INTRO_ALERTS, TUTORIAL_VARIANT_ID } from '../src/tutorial.js';
import { VARIANT_IDS } from '../src/engine/moves.js';

test('tutorial opens Gun Knife Fist with two valid intro slides', () => {
  assert.equal(TUTORIAL_VARIANT_ID, VARIANT_IDS.gunKnifeFist);
  assert.equal(normalizeAlertSequence(TUTORIAL_INTRO_ALERTS).length, 2);
});
