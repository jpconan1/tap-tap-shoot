import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { MAX_BULLETS, VARIANT_IDS, getLegalMoves, getVariantMoveIds } from '../src/engine/moves.js';
import {
  RIVAL_DIFFICULTIES,
  chooseRivalMove,
  getRivalMatchEquity,
  getRivalMoveDistribution,
} from '../src/engine/rivalAi.js';
import { resolveTurn } from '../src/engine/resolveTurn.js';
import { getVariantStagePresentation } from '../src/renderer.js';

test('reload grants bullets and ties with defense', () => {
  const result = resolveTurn({ p1Move: 'reload', p2Move: 'duck', p1Bullets: 1, p2Bullets: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.isTie, true);
  assert.equal(result.p1Bullets, 2);
  assert.equal(result.p2Bullets, 1);
});

test('0-0 forces both players to reload', () => {
  const state = createStateWithBullets(0, 0);
  assert.deepEqual(getLegalMoves(0, 0), ['reload']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['reload']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['reload']);

  const result = resolveTurn({ p1Move: 'duck', p2Move: 'reload', p1Bullets: 0, p2Bullets: 0 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 must reload at 0-0']);
});

test('shoot beats stab and reload', () => {
  for (const p2Move of ['stab', 'reload']) {
    const result = resolveTurn({ p1Move: 'shoot', p2Move, p1Bullets: 1, p2Bullets: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Hit, 'shot');
  }
});

test('stab beats duck but not reload', () => {
  const duck = resolveTurn({ p1Move: 'stab', p2Move: 'duck', p1Bullets: 1, p2Bullets: 1 });
  assert.equal(duck.ok, true);
  assert.equal(duck.winner, 'p1');
  assert.equal(duck.p1Hit, 'stabbed');

  const reload = resolveTurn({ p1Move: 'stab', p2Move: 'reload', p1Bullets: 1, p2Bullets: 1 });
  assert.equal(reload.ok, true);
  assert.equal(reload.winner, null);
  assert.equal(reload.isRoundOver, false);
  assert.equal(reload.p2Bullets, 2);
});

test('listed ties do not end game', () => {
  const ties = [
    ['shoot', 'shoot', 1, 1],
    ['shoot', 'duck', 1, 0],
    ['stab', 'stab', 1, 1],
    ['reload', 'stab', 1, 1],
    ['duck', 'duck', 1, 1],
  ];

  for (const [p1Move, p2Move, p1Bullets, p2Bullets] of ties) {
    const result = resolveTurn({ p1Move, p2Move, p1Bullets, p2Bullets });
    assert.equal(result.ok, true);
    assert.equal(result.winner, null);
    assert.equal(result.isRoundOver, false);
  }
});

test('moves with bullet costs are illegal without bullets', () => {
  const result = resolveTurn({ p1Move: 'shoot', p2Move: 'reload', p1Bullets: 0, p2Bullets: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 cannot afford shoot']);
});

test('max bullets blocks reload and caps bullet gain', () => {
  const state = createStateWithBullets(1, MAX_BULLETS);
  assert.equal(getLegalMoves(MAX_BULLETS, 1).includes('reload'), false);
  assert.equal(getPlayerLegalMoves(state, 'p1').includes('reload'), false);

  const blocked = resolveTurn({ p1Move: 'reload', p2Move: 'duck', p1Bullets: MAX_BULLETS, p2Bullets: 1 });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.errors, [`p1 cannot reload at ${MAX_BULLETS}`]);

  const capped = resolveTurn({ p1Move: 'reload', p2Move: 'duck', p1Bullets: MAX_BULLETS - 1, p2Bullets: 1 });
  assert.equal(capped.ok, true);
  assert.equal(capped.p1Bullets, MAX_BULLETS);
});

test('Tap Tap Shoot Y uses four button moves', () => {
  const state = createStateWithBullets(0, 1, VARIANT_IDS.tapTapShootY);

  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.tapTapShootY), ['reload', 'shoot', 'stab', 'duck']);
  assert.equal(getLegalMoves(0, 1, VARIANT_IDS.tapTapShootY).includes('stab'), false);
  assert.equal(getPlayerLegalMoves(state, 'p1').includes('counterstab'), false);

  const result = resolveTurn({
    p1Move: 'counterstab',
    p2Move: 'reload',
    p1Bullets: 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShootY,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 picked unknown move: counterstab']);
});

test('manual resource-state rules disable pointless defensive moves', () => {
  assert.equal(getLegalMoves(1, 0, VARIANT_IDS.fireballWar).includes('block'), false);
  assert.equal(getLegalMoves(1, 1, VARIANT_IDS.fireballWar).includes('block'), true);

  const tapTapShootXMoves = getLegalMoves(1, 0, VARIANT_IDS.tapTapShootX);
  assert.equal(tapTapShootXMoves.includes('duck'), false);
  assert.equal(tapTapShootXMoves.includes('counterstab'), false);
  assert.equal(getLegalMoves(1, 1, VARIANT_IDS.tapTapShootX).includes('duck'), true);

  const armedMoves = getLegalMoves(1, 0, VARIANT_IDS.tapTapShootY);
  const unarmedMoves = getLegalMoves(0, 1, VARIANT_IDS.tapTapShootY);
  assert.equal(armedMoves.includes('duck'), false);
  assert.equal(armedMoves.includes('stab'), true);
  assert.equal(unarmedMoves.includes('duck'), true);
  assert.equal(unarmedMoves.includes('stab'), false);
});

test('Tap Tap Shoot Y shows shoot-duck dodge scene', () => {
  const p1Shoots = getVariantStagePresentation(
    { p1Hit: null, p2Hit: null },
    'shoot',
    'duck',
    { variantId: VARIANT_IDS.tapTapShootY },
  );
  assert.deepEqual(p1Shoots, {
    kind: 'doodle',
    name: 'tap-tap-shoot-y/shoot-duck',
    flip: false,
  });

  const p2Shoots = getVariantStagePresentation(
    { p1Hit: null, p2Hit: null },
    'duck',
    'shoot',
    { variantId: VARIANT_IDS.tapTapShootY },
  );
  assert.deepEqual(p2Shoots, {
    kind: 'doodle',
    name: 'tap-tap-shoot-y/shoot-duck',
    flip: true,
  });
});

test('rock paper scissors has no resource and resolves classic wins', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.rockPaperScissors });
  assert.equal(state.players.p1.bullets, 0);
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.rockPaperScissors), ['rock', 'paper', 'scissors']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['rock', 'paper', 'scissors']);

  const win = resolveTurn({ p1Move: 'rock', p2Move: 'scissors', p1Bullets: 0, p2Bullets: 0, variantId: VARIANT_IDS.rockPaperScissors });
  assert.equal(win.ok, true);
  assert.equal(win.winner, 'p1');

  const tie = resolveTurn({ p1Move: 'paper', p2Move: 'paper', p1Bullets: 0, p2Bullets: 0, variantId: VARIANT_IDS.rockPaperScissors });
  assert.equal(tie.ok, true);
  assert.equal(tie.winner, null);
});

test('Fireball War starts at one bar and fireball beats charge', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.fireballWar });
  assert.equal(state.players.p1.bullets, 1);
  assert.equal(state.players.p2.bullets, 1);
  assert.deepEqual(getLegalMoves(0, 0, VARIANT_IDS.fireballWar), ['charge']);

  const blockAtZero = resolveTurn({
    p1Move: 'block',
    p2Move: 'charge',
    p1Bullets: 1,
    p2Bullets: 0,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(blockAtZero.ok, false);
  assert.deepEqual(blockAtZero.errors, ['p1 cannot block in this resource state']);

  const charge = resolveTurn({
    p1Move: 'charge',
    p2Move: 'block',
    p1Bullets: 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(charge.ok, true);
  assert.equal(charge.p1Bullets, 2);
  assert.equal(charge.winner, null);

  const fireball = resolveTurn({
    p1Move: 'fireball',
    p2Move: 'charge',
    p1Bullets: 1,
    p2Bullets: 0,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(fireball.ok, true);
  assert.equal(fireball.winner, 'p1');
});

test('Fireball War wins at three charges unless fireball hits first', () => {
  const chargeWin = resolveTurn({
    p1Move: 'charge',
    p2Move: 'block',
    p1Bullets: MAX_BULLETS - 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(chargeWin.ok, true);
  assert.equal(chargeWin.p1Bullets, MAX_BULLETS);
  assert.equal(chargeWin.winner, 'p1');
  assert.equal(chargeWin.isRoundOver, true);

  const fireballFirst = resolveTurn({
    p1Move: 'fireball',
    p2Move: 'charge',
    p1Bullets: 1,
    p2Bullets: MAX_BULLETS - 1,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(fireballFirst.ok, true);
  assert.equal(fireballFirst.p2Bullets, MAX_BULLETS);
  assert.equal(fireballFirst.winner, 'p1');

  const bothCharged = resolveTurn({
    p1Move: 'charge',
    p2Move: 'charge',
    p1Bullets: MAX_BULLETS - 1,
    p2Bullets: MAX_BULLETS - 1,
    variantId: VARIANT_IDS.fireballWar,
  });
  assert.equal(bothCharged.ok, true);
  assert.equal(bothCharged.p1Bullets, MAX_BULLETS - 1);
  assert.equal(bothCharged.p2Bullets, MAX_BULLETS - 1);
  assert.equal(bothCharged.winner, null);
  assert.equal(bothCharged.isRoundOver, false);
});

test('Tap Tap Shoot X adds counterstab to the four move rules', () => {
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.tapTapShootX), ['reload', 'shoot', 'stab', 'duck', 'counterstab']);

  const counterstabDraw = resolveTurn({
    p1Move: 'counterstab',
    p2Move: 'stab',
    p1Bullets: 0,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShootX,
  });
  assert.equal(counterstabDraw.ok, true);
  assert.equal(counterstabDraw.winner, null);

  const stabReload = resolveTurn({
    p1Move: 'stab',
    p2Move: 'reload',
    p1Bullets: 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShootX,
  });
  assert.equal(stabReload.ok, true);
  assert.equal(stabReload.winner, 'p1');
  assert.equal(stabReload.p1Bullets, 0);

  const noBulletStab = resolveTurn({
    p1Move: 'stab',
    p2Move: 'reload',
    p1Bullets: 0,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShootX,
  });
  assert.equal(noBulletStab.ok, false);
  assert.deepEqual(noBulletStab.errors, ['p1 cannot afford stab']);

  const stabDuck = resolveTurn({
    p1Move: 'stab',
    p2Move: 'duck',
    p1Bullets: 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShootX,
  });
  assert.equal(stabDuck.ok, true);
  assert.equal(stabDuck.winner, 'p1');
  assert.equal(stabDuck.p1Bullets, 0);

  const stabDuckPresentation = getVariantStagePresentation(
    stabDuck,
    'stab',
    'duck',
    { variantId: VARIANT_IDS.tapTapShootX },
  );
  assert.equal(stabDuckPresentation.name, 'tap-tap-shoot-x/stab-kill');

  const legacyStabDuckPresentation = getVariantStagePresentation(
    stabDuck,
    'stab',
    'duck',
    { variantId: 'counterstab' },
  );
  assert.equal(legacyStabDuckPresentation.name, 'tap-tap-shoot-x/stab-kill');

  const shootDuckPresentation = getVariantStagePresentation(
    { p1Hit: null, p2Hit: null, winner: null },
    'shoot',
    'duck',
    { variantId: VARIANT_IDS.tapTapShootX },
  );
  assert.equal(shootDuckPresentation.name, 'tap-tap-shoot-x/shoot-duck');
});

test('Gun Knife Fist uses health damage before round win', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.gunKnifeFist });
  assert.equal(state.players.p1.bullets, 3);
  assert.equal(state.players.p2.bullets, 3);
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.gunKnifeFist), ['punch', 'stab', 'shoot']);

  const punchDamage = resolveTurn({
    p1Move: 'punch',
    p2Move: 'shoot',
    p1Bullets: 3,
    p2Bullets: 3,
    variantId: VARIANT_IDS.gunKnifeFist,
  });
  assert.equal(punchDamage.ok, true);
  assert.equal(punchDamage.p2Bullets, 2);
  assert.equal(punchDamage.winner, null);
  assert.equal(punchDamage.isRoundOver, false);

  const stabKill = resolveTurn({
    p1Move: 'stab',
    p2Move: 'punch',
    p1Bullets: 3,
    p2Bullets: 2,
    variantId: VARIANT_IDS.gunKnifeFist,
  });
  assert.equal(stabKill.ok, true);
  assert.equal(stabKill.p2Bullets, 0);
  assert.equal(stabKill.winner, 'p1');

  const draw = resolveTurn({
    p1Move: 'shoot',
    p2Move: 'shoot',
    p1Bullets: 3,
    p2Bullets: 3,
    variantId: VARIANT_IDS.gunKnifeFist,
  });
  assert.equal(draw.ok, true);
  assert.equal(draw.p1Bullets, 3);
  assert.equal(draw.p2Bullets, 3);
  assert.equal(draw.winner, null);
});

test('round state advances on ties and freezes on round win', () => {
  let state = createRoundState();
  let turn = playTurn(state, 'reload', 'reload');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.turn, 1);
  assert.equal(turn.state.players.p1.bullets, 2);
  assert.equal(turn.state.players.p2.bullets, 2);

  state = turn.state;
  turn = playTurn(state, 'shoot', 'stab');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.status, 'finished');
  assert.equal(turn.state.turn, 1);
  assert.equal(turn.state.winner, 'p1');
});

test('rival AI always reloads from 0-0', () => {
  const state = createStateWithBullets(0, 0);

  assert.equal(chooseRivalMove(state, fixedRoll(0)), 'reload');
  assert.equal(chooseRivalMove(state, fixedRoll(0.99)), 'reload');
});

test('easy rival AI picks uniformly across legal moves', () => {
  const state = createStateWithBullets(1, 1, VARIANT_IDS.fireballWar);

  assert.deepEqual(getRivalMoveDistribution(state, RIVAL_DIFFICULTIES.easy), [
    { moveId: 'charge', probability: 1 / 3 },
    { moveId: 'block', probability: 1 / 3 },
    { moveId: 'fireball', probability: 1 / 3 },
  ]);
  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.easy), 'charge');
  assert.equal(chooseRivalMove(state, fixedRoll(0.34), RIVAL_DIFFICULTIES.easy), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.67), RIVAL_DIFFICULTIES.easy), 'fireball');
});

test('hard rival AI uses Fireball War Nash weights', () => {
  const state = createStateWithBullets(1, 1, VARIANT_IDS.fireballWar);

  assert.deepEqual(getRivalMoveDistribution(state, RIVAL_DIFFICULTIES.hard), [
    { moveId: 'charge', probability: 0.31 },
    { moveId: 'block', probability: 0.47 },
    { moveId: 'fireball', probability: 0.22 },
  ]);
  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'charge');
  assert.equal(chooseRivalMove(state, fixedRoll(0.4), RIVAL_DIFFICULTIES.hard), 'block');
  assert.equal(chooseRivalMove(state, fixedRoll(0.9), RIVAL_DIFFICULTIES.hard), 'fireball');
});

test('hard Kitchen Sink rival uses the full-state lookup policy', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.kitchenSink });
  state.roundWins = { p1: 0, p2: 0 };

  assert.deepEqual(getRivalMatchEquity(state, RIVAL_DIFFICULTIES.hard), { p1: 0.5, p2: 0.5 });
  assert.equal(getRivalMatchEquity(state, RIVAL_DIFFICULTIES.easy), null);
  assert.deepEqual(getRivalMoveDistribution(state, RIVAL_DIFFICULTIES.hard), [
    { moveId: 'strike', probability: 0.3809983902971355 },
    { moveId: 'advance', probability: 0.3809983902971355 },
    { moveId: 'bait', probability: 0.2380032194057291 },
  ]);
  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'strike');
  assert.equal(chooseRivalMove(state, fixedRoll(0.5), RIVAL_DIFFICULTIES.hard), 'advance');
});

test('easy Kitchen Sink rival remains uniform across legal moves', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.kitchenSink });

  assert.deepEqual(getRivalMoveDistribution(state, RIVAL_DIFFICULTIES.easy), [
    { moveId: 'strike', probability: 0.25 },
    { moveId: 'advance', probability: 0.25 },
    { moveId: 'bait', probability: 0.25 },
    { moveId: 'charge', probability: 0.25 },
  ]);
});

test('hard Fireball War policy indexes player charge before bot charge', () => {
  const botNearWin = createStateWithBullets(2, 1, VARIANT_IDS.fireballWar);
  const playerNearWin = createStateWithBullets(1, 2, VARIANT_IDS.fireballWar);

  assert.equal(chooseRivalMove(botNearWin, fixedRoll(0.23), RIVAL_DIFFICULTIES.hard), 'block');
  assert.equal(chooseRivalMove(playerNearWin, fixedRoll(0.23), RIVAL_DIFFICULTIES.hard), 'charge');
});

test('hard rival AI uses Gun Knife Fist Nash weights', () => {
  const state = createStateWithBullets(3, 3, VARIANT_IDS.gunKnifeFist);

  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'punch');
  assert.equal(chooseRivalMove(state, fixedRoll(0.6), RIVAL_DIFFICULTIES.hard), 'stab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.99), RIVAL_DIFFICULTIES.hard), 'shoot');
});

test('hard rival AI uses Tap Tap Shoot X Nash mix for the bot player', () => {
  const state = createStateWithBullets(1, 1, VARIANT_IDS.tapTapShootX);

  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'shoot');
  assert.equal(chooseRivalMove(state, fixedRoll(0.5), RIVAL_DIFFICULTIES.hard), 'stab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.9), RIVAL_DIFFICULTIES.hard), 'duck');
});

test('hard Tap Tap Shoot policy indexes player AP before bot AP', () => {
  const state = createStateWithBullets(2, 1, VARIANT_IDS.tapTapShootX);

  assert.equal(chooseRivalMove(state, fixedRoll(0.4), RIVAL_DIFFICULTIES.hard), 'shoot');
});

test('hard rival AI uses Tap Tap Shoot Y Nash mix for the bot player', () => {
  const state = createStateWithBullets(1, 1, VARIANT_IDS.tapTapShootY);

  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'shoot');
  assert.equal(chooseRivalMove(state, fixedRoll(0.5), RIVAL_DIFFICULTIES.hard), 'stab');
  assert.equal(chooseRivalMove(state, fixedRoll(0.9), RIVAL_DIFFICULTIES.hard), 'duck');
});

test('Rock Paper Scissors ignores difficulty and picks uniformly across legal moves', () => {
  const state = createStateWithBullets(0, 0, VARIANT_IDS.rockPaperScissors);

  assert.equal(chooseRivalMove(state, fixedRoll(0), RIVAL_DIFFICULTIES.hard), 'rock');
  assert.equal(chooseRivalMove(state, fixedRoll(0.34), RIVAL_DIFFICULTIES.hard), 'paper');
  assert.equal(chooseRivalMove(state, fixedRoll(0.67), RIVAL_DIFFICULTIES.easy), 'scissors');
});

test('rival AI only chooses legal moves across bullet matchups', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999];

  for (let rivalBullets = 0; rivalBullets <= MAX_BULLETS; rivalBullets += 1) {
    for (let playerBullets = 0; playerBullets <= MAX_BULLETS; playerBullets += 1) {
      const legalMoves = getLegalMoves(rivalBullets, playerBullets);

      for (const roll of rolls) {
        const move = chooseRivalMove(createStateWithBullets(rivalBullets, playerBullets), fixedRoll(roll));
        assert.ok(
          legalMoves.includes(move),
          `picked illegal ${move} at ${rivalBullets}-${playerBullets}`,
        );
      }
    }
  }
});

test('rival AI chooses legal Fireball War moves', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999];

  for (let rivalBullets = 0; rivalBullets <= MAX_BULLETS; rivalBullets += 1) {
    for (let playerBullets = 0; playerBullets <= MAX_BULLETS; playerBullets += 1) {
      const legalMoves = getLegalMoves(rivalBullets, playerBullets, VARIANT_IDS.fireballWar);

      for (const roll of rolls) {
        const move = chooseRivalMove(
          createStateWithBullets(rivalBullets, playerBullets, VARIANT_IDS.fireballWar),
          fixedRoll(roll),
        );
        assert.ok(
          legalMoves.includes(move),
          `picked illegal ${move} at ${rivalBullets}-${playerBullets}`,
        );
      }
    }
  }
});

test('rival distribution contains only legal positive moves and totals one', () => {
  for (let rivalBullets = 0; rivalBullets <= MAX_BULLETS; rivalBullets += 1) {
    for (let playerBullets = 0; playerBullets <= MAX_BULLETS; playerBullets += 1) {
      const state = createStateWithBullets(rivalBullets, playerBullets);
      const legalMoves = getPlayerLegalMoves(state, 'p2');
      const distribution = getRivalMoveDistribution(state);
      assert.ok(distribution.every(({ moveId, probability }) => (
        legalMoves.includes(moveId) && probability > 0
      )));
      assert.ok(Math.abs(distribution.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 1e-12);
    }
  }
});

function createStateWithBullets(rivalBullets, playerBullets, variantId) {
  return {
    variantId,
    players: {
      p1: { bullets: playerBullets },
      p2: { bullets: rivalBullets },
    },
  };
}

function fixedRoll(value) {
  return () => value;
}
