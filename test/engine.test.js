import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { MOVE_IDS, VARIANT_IDS, getLegalMoves, getVariantMoveIds } from '../src/engine/moves.js';
import { RIVALS, chooseRivalMove } from '../src/engine/rivalAi.js';
import { resolveTurn } from '../src/engine/resolveTurn.js';

test('reload grants AP and ties with free defense moves', () => {
  const block = resolveTurn({ p1Move: 'reload', p2Move: 'block', p1Ap: 0, p2Ap: 1 });
  assert.equal(block.ok, true);
  assert.equal(block.isTie, true);
  assert.equal(block.p1Ap, 1);
  assert.equal(block.p2Ap, 1);

  const counterstab = resolveTurn({ p1Move: 'reload', p2Move: 'counterstab', p1Ap: 0, p2Ap: 1 });
  assert.equal(counterstab.ok, true);
  assert.equal(counterstab.isTie, true);
  assert.equal(counterstab.p1Ap, 1);
});

test('0-0 forces both players to reload', () => {
  const state = createStateWithAp(0, 0);
  assert.deepEqual(getLegalMoves(0, 0), ['reload']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['reload']);
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['reload']);

  const result = resolveTurn({ p1Move: 'block', p2Move: 'reload', p1Ap: 0, p2Ap: 0 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 must reload at 0-0']);
});

test('shoot beats stab, counterstab, and reload', () => {
  for (const p2Move of ['stab', 'counterstab', 'reload']) {
    const result = resolveTurn({ p1Move: 'shoot', p2Move, p1Ap: 1, p2Ap: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Hit, 'shot');
  }
});

test('stab beats block and reload', () => {
  for (const p2Move of ['block', 'reload']) {
    const result = resolveTurn({ p1Move: 'stab', p2Move, p1Ap: 1, p2Ap: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Hit, 'stabbed');
  }
});

test('listed ties do not end game', () => {
  const ties = [
    ['shoot', 'shoot', 1, 1],
    ['shoot', 'block', 1, 0],
    ['stab', 'stab', 1, 1],
    ['stab', 'counterstab', 1, 0],
    ['block', 'counterstab', 0, 1],
  ];

  for (const [p1Move, p2Move, p1Ap, p2Ap] of ties) {
    const result = resolveTurn({ p1Move, p2Move, p1Ap, p2Ap });
    assert.equal(result.ok, true);
    assert.equal(result.winner, null);
    assert.equal(result.isRoundOver, false);
  }
});

test('moves with AP costs are illegal without AP', () => {
  const result = resolveTurn({ p1Move: 'shoot', p2Move: 'reload', p1Ap: 0, p2Ap: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['p1 cannot afford shoot']);
});

test('4 AP blocks reload and caps AP gain', () => {
  const state = createStateWithAp(1, 4);
  assert.equal(getLegalMoves(4, 1).includes('reload'), false);
  assert.equal(getPlayerLegalMoves(state, 'p1').includes('reload'), false);

  const blocked = resolveTurn({ p1Move: 'reload', p2Move: 'block', p1Ap: 4, p2Ap: 1 });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.errors, ['p1 cannot reload at 4']);

  const capped = resolveTurn({ p1Move: 'reload', p2Move: 'block', p1Ap: 3, p2Ap: 1 });
  assert.equal(capped.ok, true);
  assert.equal(capped.p1Ap, 4);
});

test('4 Move variant excludes counterstab and makes stab free', () => {
  const state = createStateWithAp(0, 1, VARIANT_IDS.fourMove);

  assert.deepEqual(getVariantMoveIds(VARIANT_IDS.fourMove), ['reload', 'shoot', 'stab', 'block']);
  assert.equal(getLegalMoves(0, 1, VARIANT_IDS.fourMove).includes('stab'), true);
  assert.equal(getPlayerLegalMoves(state, 'p1').includes('counterstab'), false);
});

test('4 Move variant stab misses reload', () => {
  const result = resolveTurn({
    p1Move: 'stab',
    p2Move: 'reload',
    p1Ap: 0,
    p2Ap: 1,
    variantId: VARIANT_IDS.fourMove,
  });

  assert.equal(result.ok, true);
  assert.equal(result.winner, null);
  assert.equal(result.isRoundOver, false);
  assert.equal(result.p1Ap, 0);
  assert.equal(result.p2Ap, 2);
});

test('4 Move variant shoot beats stab and reload', () => {
  for (const p2Move of ['stab', 'reload']) {
    const result = resolveTurn({
      p1Move: 'shoot',
      p2Move,
      p1Ap: 1,
      p2Ap: 0,
      variantId: VARIANT_IDS.fourMove,
    });

    assert.equal(result.ok, true);
    assert.equal(result.winner, 'p1');
    assert.equal(result.p1Ap, 0);
  }
});

test('round state advances on ties and freezes on round win', () => {
  let state = createRoundState();
  let turn = playTurn(state, 'reload', 'reload');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.turn, 1);
  assert.equal(turn.state.players.p1.ap, 2);
  assert.equal(turn.state.players.p2.ap, 2);

  state = turn.state;
  turn = playTurn(state, 'shoot', 'stab');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.status, 'finished');
  assert.equal(turn.state.turn, 1);
  assert.equal(turn.state.winner, 'p1');
});

test('rival AI always reloads from 0-0', () => {
  const state = createStateWithAp(0, 0);

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

test('rival AI only chooses legal moves across AP matchups', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999];

  for (const rival of Object.values(RIVALS)) {
    for (let rivalAp = 0; rivalAp <= 4; rivalAp += 1) {
      for (let playerAp = 0; playerAp <= 4; playerAp += 1) {
        const legalMoves = getLegalMoves(rivalAp, playerAp);

        for (const roll of rolls) {
          const move = chooseRivalMove(createStateWithAp(rivalAp, playerAp), rival.id, fixedRoll(roll));
          assert.ok(
            legalMoves.includes(move),
            `${rival.id} picked illegal ${move} at ${rivalAp}-${playerAp}`,
          );
        }
      }
    }
  }
});

function createStateWithAp(rivalAp, playerAp, variantId) {
  return {
    variantId,
    players: {
      p1: { ap: playerAp },
      p2: { ap: rivalAp },
    },
  };
}

function fixedRoll(value) {
  return () => value;
}
