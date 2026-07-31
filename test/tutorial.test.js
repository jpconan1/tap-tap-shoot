import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAlertSequence } from '../src/alertSystem.js';
import { createRoundState } from '../src/engine/gameState.js';
import { resolveLocalTurn } from '../src/engine/localMatch.js';
import {
  getLocalStartingRoundWins,
  getTutorialForcedOpponentMove,
  TUTORIAL_INTRO_ALERTS,
  TUTORIAL_VARIANT_ID,
} from '../src/tutorial.js';
import { VARIANT_IDS } from '../src/engine/moves.js';

test('tutorial opens Gun Knife Fist with four valid intro slides', () => {
  assert.equal(TUTORIAL_VARIANT_ID, VARIANT_IDS.gunKnifeFist);
  const slides = normalizeAlertSequence(TUTORIAL_INTRO_ALERTS);
  assert.equal(slides.length, 4);
  assert.equal(slides[0].body[3].parts[1].tone, 'red');
  assert.equal(slides[0].body[3].parts[3].tone, 'red');
});

test('damage slide uses move and HP artwork in its four rules', () => {
  const damageSlide = normalizeAlertSequence(TUTORIAL_INTRO_ALERTS)[1];
  assert.equal(damageSlide.body.length, 6);
  assert.deepEqual(
    damageSlide.body.filter((line) => line.aside).map((line) => line.aside.filter((part) => part.doodle).map((part) => part.doodle)),
    [
      ['gun-knife-fist/fist_button', 'tutorial/hp1'],
      ['gun-knife-fist/knife_button', 'tutorial/hp2'],
      ['gun-knife-fist/gun_button', 'tutorial/hp3'],
    ],
  );
  assert.equal(damageSlide.body[0].text, 'Rules');
  assert.equal(damageSlide.body[1].style, 'body-left');
  assert.equal(damageSlide.body[4].text, 'Gun is a one-hit KO (3 damage).');
  assert.equal(damageSlide.body[5].text, 'First to win three rounds wins the game.');
});

test('CPU odds slide highlights the odds display in both viewport modes', () => {
  const oddsSlide = normalizeAlertSequence(TUTORIAL_INTRO_ALERTS)[2];
  assert.equal(oddsSlide.mode, 'guided');
  assert.equal(oddsSlide.body[0].text, "You're playing an easy bot. It'll pick between the three moves equally. This might work in RPS but isn't smart in this game.");
  assert.deepEqual(oddsSlide.highlights[0], {
    x: 810,
    y: 438,
    width: 138,
    height: 76,
    portrait: { x: 388, y: 486, width: 138, height: 76 },
    padding: 5,
  });
  assert.equal(oddsSlide.box.x + oddsSlide.box.width < oddsSlide.highlights[0].x, true);
  assert.equal(
    oddsSlide.box.portrait.x + oddsSlide.box.portrait.width < oddsSlide.highlights[0].portrait.x,
    true,
  );
});

test('pick-a-move slide highlights the full move triangle', () => {
  const moveSlide = normalizeAlertSequence(TUTORIAL_INTRO_ALERTS)[3];
  assert.equal(moveSlide.mode, 'guided');
  assert.deepEqual(moveSlide.body, [
    { text: 'Try to beat the bot!', style: 'subheader' },
    { text: 'Hint: pick the strongest move!', style: 'body' },
  ]);
  assert.deepEqual(moveSlide.highlights[0], {
    x: 248,
    y: 314,
    width: 469,
    height: 208,
    portrait: { x: 25, y: 610, width: 490, height: 226 },
    padding: 7,
  });
  assert.equal(moveSlide.box.y + moveSlide.box.height < moveSlide.highlights[0].y, true);
  assert.equal(
    moveSlide.box.portrait.y + moveSlide.box.portrait.height < moveSlide.highlights[0].portrait.y,
    true,
  );
});

test('tutorial starts at 2-0 while standard local games start at 0-0', () => {
  assert.deepEqual(getLocalStartingRoundWins('tutorial'), { p1: 2, p2: 0 });
  assert.deepEqual(getLocalStartingRoundWins('standard'), { p1: 0, p2: 0 });
});

test('tutorial final-round policy forces the CPU move that loses to each player move', () => {
  const context = {
    sessionKind: 'tutorial',
    variantId: TUTORIAL_VARIANT_ID,
    roundWins: { p1: 2, p2: 2 },
  };
  assert.equal(getTutorialForcedOpponentMove({ ...context, playerMove: 'punch' }), 'shoot');
  assert.equal(getTutorialForcedOpponentMove({ ...context, playerMove: 'stab' }), 'punch');
  assert.equal(getTutorialForcedOpponentMove({ ...context, playerMove: 'shoot' }), 'stab');
});

test('tutorial move policy stays inactive before 2-2 and outside the tutorial', () => {
  const base = {
    sessionKind: 'tutorial',
    variantId: TUTORIAL_VARIANT_ID,
    playerMove: 'punch',
  };
  assert.equal(getTutorialForcedOpponentMove({ ...base, roundWins: { p1: 2, p2: 0 } }), undefined);
  assert.equal(getTutorialForcedOpponentMove({ ...base, roundWins: { p1: 2, p2: 1 } }), undefined);
  assert.equal(getTutorialForcedOpponentMove({
    ...base,
    sessionKind: 'standard',
    roundWins: { p1: 2, p2: 2 },
  }), undefined);
});

test('protected 2-2 round records forced moves and guarantees the tutorial win', () => {
  let state = createRoundState({ variantId: TUTORIAL_VARIANT_ID });
  let roundWins = { p1: 2, p2: 2 };
  let resolved;

  for (let turn = 0; turn < 3; turn += 1) {
    resolved = resolveLocalTurn({
      state,
      roundWins,
      queuedPlayerMove: 'punch',
      queuedOpponentMove: 'stab',
      getForcedOpponentMove: (playerMove) => getTutorialForcedOpponentMove({
        sessionKind: 'tutorial',
        variantId: TUTORIAL_VARIANT_ID,
        roundWins,
        playerMove,
      }),
      chooseOpponentMove: () => 'stab',
    });
    state = resolved.turn.state;
    roundWins = resolved.roundWins;
    assert.deepEqual(resolved.moves, { p1: 'punch', p2: 'shoot' });
    assert.equal(state.history[0].p2Move, 'shoot');
    assert.equal(state.players.p1.resource, 3);
  }

  assert.equal(resolved.gameWinner, 'p1');
  assert.deepEqual(roundWins, { p1: 3, p2: 2 });
});
