import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { MAX_BULLETS, MOVE_IDS, VARIANT_IDS, getLegalMoves, getVariantMoveIds } from '../src/engine/moves.js';
import { RIVALS, chooseRivalMove } from '../src/engine/rivalAi.js';
import { resolveTurn } from '../src/engine/resolveTurn.js';
import { getVariantStagePresentation } from '../src/renderer.js';

test('reload grants bullets and ties with defense', () => {
  const result = resolveTurn({ p1Move: 'reload', p2Move: 'duck', p1Bullets: 0, p2Bullets: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.isTie, true);
  assert.equal(result.p1Bullets, 1);
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
  const duck = resolveTurn({ p1Move: 'stab', p2Move: 'duck', p1Bullets: 0, p2Bullets: 1 });
  assert.equal(duck.ok, true);
  assert.equal(duck.winner, 'p1');
  assert.equal(duck.p1Hit, 'stabbed');

  const reload = resolveTurn({ p1Move: 'stab', p2Move: 'reload', p1Bullets: 0, p2Bullets: 1 });
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
    ['reload', 'stab', 1, 0],
    ['duck', 'duck', 0, 1],
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

test('shoot stab duck uses four button moves', () => {
  const state = createStateWithBullets(0, 1, VARIANT_IDS.shootStabDuck);

  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.shootStabDuck), ['reload', 'shoot', 'stab', 'duck']);
  assert.equal(getLegalMoves(0, 1, VARIANT_IDS.shootStabDuck).includes('stab'), true);
  assert.equal(getPlayerLegalMoves(state, 'p1').includes('counterstab'), false);

  const result = resolveTurn({
    p1Move: 'counterstab',
    p2Move: 'reload',
    p1Bullets: 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.shootStabDuck,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 picked unknown move: counterstab']);
});

test('shoot stab duck shows shoot-duck dodge scene', () => {
  const p1Shoots = getVariantStagePresentation(
    { p1Hit: null, p2Hit: null },
    'shoot',
    'duck',
    { variantId: VARIANT_IDS.shootStabDuck },
  );
  assert.deepEqual(p1Shoots, {
    kind: 'doodle',
    name: 'shoot-stab-duck/shoot-duck',
    flip: false,
  });

  const p2Shoots = getVariantStagePresentation(
    { p1Hit: null, p2Hit: null },
    'duck',
    'shoot',
    { variantId: VARIANT_IDS.shootStabDuck },
  );
  assert.deepEqual(p2Shoots, {
    kind: 'doodle',
    name: 'shoot-stab-duck/shoot-duck',
    flip: true,
  });
});

test('rock paper scissors has no resource and resolves classic wins', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.rps });
  assert.equal(state.players.p1.bullets, 0);
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.rps), ['rock', 'paper', 'scissors']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['rock', 'paper', 'scissors']);

  const win = resolveTurn({ p1Move: 'rock', p2Move: 'scissors', p1Bullets: 0, p2Bullets: 0, variantId: VARIANT_IDS.rps });
  assert.equal(win.ok, true);
  assert.equal(win.winner, 'p1');

  const tie = resolveTurn({ p1Move: 'paper', p2Move: 'paper', p1Bullets: 0, p2Bullets: 0, variantId: VARIANT_IDS.rps });
  assert.equal(tie.ok, true);
  assert.equal(tie.winner, null);
});

test('charge block fireball starts at one bar and fireball beats charge', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.chargeBlockFireball });
  assert.equal(state.players.p1.bullets, 1);
  assert.equal(state.players.p2.bullets, 1);
  assert.deepEqual(getLegalMoves(0, 0, VARIANT_IDS.chargeBlockFireball), ['charge', 'block']);

  const blockAtZero = resolveTurn({
    p1Move: 'block',
    p2Move: 'charge',
    p1Bullets: 0,
    p2Bullets: 0,
    variantId: VARIANT_IDS.chargeBlockFireball,
  });
  assert.equal(blockAtZero.ok, true);
  assert.equal(blockAtZero.winner, null);

  const charge = resolveTurn({
    p1Move: 'charge',
    p2Move: 'block',
    p1Bullets: 0,
    p2Bullets: 1,
    variantId: VARIANT_IDS.chargeBlockFireball,
  });
  assert.equal(charge.ok, true);
  assert.equal(charge.p1Bullets, 1);
  assert.equal(charge.winner, null);

  const fireball = resolveTurn({
    p1Move: 'fireball',
    p2Move: 'charge',
    p1Bullets: 1,
    p2Bullets: 0,
    variantId: VARIANT_IDS.chargeBlockFireball,
  });
  assert.equal(fireball.ok, true);
  assert.equal(fireball.winner, 'p1');
});

test('charge block fireball wins at three charges unless fireball hits first', () => {
  const chargeWin = resolveTurn({
    p1Move: 'charge',
    p2Move: 'block',
    p1Bullets: MAX_BULLETS - 1,
    p2Bullets: 1,
    variantId: VARIANT_IDS.chargeBlockFireball,
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
    variantId: VARIANT_IDS.chargeBlockFireball,
  });
  assert.equal(fireballFirst.ok, true);
  assert.equal(fireballFirst.p2Bullets, MAX_BULLETS);
  assert.equal(fireballFirst.winner, 'p1');

  const bothCharged = resolveTurn({
    p1Move: 'charge',
    p2Move: 'charge',
    p1Bullets: MAX_BULLETS - 1,
    p2Bullets: MAX_BULLETS - 1,
    variantId: VARIANT_IDS.chargeBlockFireball,
  });
  assert.equal(bothCharged.ok, true);
  assert.equal(bothCharged.p1Bullets, MAX_BULLETS - 1);
  assert.equal(bothCharged.p2Bullets, MAX_BULLETS - 1);
  assert.equal(bothCharged.winner, null);
  assert.equal(bothCharged.isRoundOver, false);
});

test('tap tap shoot adds counterstab to the four move rules', () => {
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.tapTapShoot), ['reload', 'shoot', 'stab', 'duck', 'counterstab']);

  const result = resolveTurn({
    p1Move: 'counterstab',
    p2Move: 'stab',
    p1Bullets: 0,
    p2Bullets: 1,
    variantId: VARIANT_IDS.tapTapShoot,
  });
  assert.equal(result.ok, true);
  assert.equal(result.winner, 'p1');
});

test('punch stab shoot uses health damage before round win', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.punchStabShoot });
  assert.equal(state.players.p1.bullets, 3);
  assert.equal(state.players.p2.bullets, 3);
  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.punchStabShoot), ['punch', 'stab', 'shoot']);

  const punchDamage = resolveTurn({
    p1Move: 'punch',
    p2Move: 'shoot',
    p1Bullets: 3,
    p2Bullets: 3,
    variantId: VARIANT_IDS.punchStabShoot,
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
    variantId: VARIANT_IDS.punchStabShoot,
  });
  assert.equal(stabKill.ok, true);
  assert.equal(stabKill.p2Bullets, 0);
  assert.equal(stabKill.winner, 'p1');

  const draw = resolveTurn({
    p1Move: 'shoot',
    p2Move: 'shoot',
    p1Bullets: 3,
    p2Bullets: 3,
    variantId: VARIANT_IDS.punchStabShoot,
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

test('rival configs only use known moves with valid weights', () => {
  for (const rival of Object.values(RIVALS)) {
    assert.equal(typeof rival.id, 'string');
    assert.equal(typeof rival.name, 'string');
    assert.equal(typeof rival.buttonDoodle, 'string');
    assert.equal(typeof rival.crossedDoodle, 'string');

    for (const [matchup, policy] of Object.entries(rival.matchups)) {
      assert.match(matchup, /^\d-\d$/);

      for (const [moveId, weight] of Object.entries(policy)) {
        assert.ok(MOVE_IDS.includes(moveId), `${rival.id} ${matchup} has unknown move ${moveId}`);
        assert.equal(Number.isFinite(weight), true, `${rival.id} ${matchup} ${moveId} weight must be finite`);
        assert.ok(weight >= 0, `${rival.id} ${matchup} ${moveId} weight must be non-negative`);
      }
    }
  }
});

test('rival AI only chooses legal moves across bullet matchups', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999];

  for (const rival of Object.values(RIVALS)) {
    for (let rivalBullets = 0; rivalBullets <= MAX_BULLETS; rivalBullets += 1) {
      for (let playerBullets = 0; playerBullets <= MAX_BULLETS; playerBullets += 1) {
        const legalMoves = getLegalMoves(rivalBullets, playerBullets);

        for (const roll of rolls) {
          const move = chooseRivalMove(createStateWithBullets(rivalBullets, playerBullets), rival.id, fixedRoll(roll));
          assert.ok(
            legalMoves.includes(move),
            `${rival.id} picked illegal ${move} at ${rivalBullets}-${playerBullets}`,
          );
        }
      }
    }
  }
});

test('rival AI chooses legal charge block fireball moves', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999];

  for (let rivalBullets = 0; rivalBullets <= MAX_BULLETS; rivalBullets += 1) {
    for (let playerBullets = 0; playerBullets <= MAX_BULLETS; playerBullets += 1) {
      const legalMoves = getLegalMoves(rivalBullets, playerBullets, VARIANT_IDS.chargeBlockFireball);

      for (const roll of rolls) {
        const move = chooseRivalMove(
          createStateWithBullets(rivalBullets, playerBullets, VARIANT_IDS.chargeBlockFireball),
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
