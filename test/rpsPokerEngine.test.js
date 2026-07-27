import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { VARIANT_IDS } from '../src/engine/moves.js';
import {
  distributeRpsPokerPot,
  getRpsPokerAnte,
  getRpsPokerAnteLoser,
  getRpsPokerShowdownWinner,
  getRpsPokerStrength,
  RPS_POKER_MOVES,
  shouldPlayRpsPokerTopper,
} from '../src/engine/variants/rpsPokerRules.js';
import {
  getRpsPokerWinnerPresentation,
  isRpsPokerCutawayPresentation,
  playRpsPokerDeal,
} from '../src/presentation/rpsPokerPresentation.js';

test('RPS Poker antes and locks simultaneous RPS', () => {
  const state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0 });
  assert.deepEqual(state.stacks, { p1: 8, p2: 8 });
  assert.equal(state.hand, 1);
  assert.equal(state.pot, 2);
  assert.equal(state.phase, 'lock');

  const turn = playTurn(state, 'rock', 'paper');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.phase, 'betting');
  assert.equal(turn.state.actor, 'p1');
  assert.deepEqual(turn.state.locked, { p1: 'rock', p2: 'paper' });
  assert.ok(['rock', 'paper', 'scissors'].includes(turn.state.community));
});

test('RPS Poker alternates betting actions and starts next hand after fold', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0 });
  state = playTurn(state, 'rock', 'paper').state;
  assert.deepEqual(getPlayerLegalMoves(state, 'p2'), ['wait']);

  state = playTurn(state, 'bet:2', 'wait').state;
  assert.equal(state.actor, 'p2');
  assert.equal(state.pot, 4);
  assert.equal(state.stacks.p1, 6);
  assert.deepEqual(getPlayerLegalMoves(state, 'p1'), ['wait']);

  state = playTurn(state, 'wait', 'fold').state;
  assert.equal(state.hand, 2);
  assert.equal(state.phase, 'lock');
  assert.equal(state.firstActor, 'p2');
  assert.deepEqual(state.stacks, { p1: 9, p2: 7 });
  assert.equal(state.pot, 2);
});

test('RPS Poker check-check resolves showdown and continues', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0 });
  state = playTurn(state, 'rock', 'paper').state;
  state = playTurn(state, 'check', 'wait').state;
  assert.equal(state.actor, 'p2');
  state = playTurn(state, 'wait', 'check').state;
  assert.equal(state.hand, 2);
  assert.equal(state.phase, 'lock');
  assert.equal(state.stacks.p1 + state.stacks.p2 + state.pot, 18);
});

test('RPS Poker randomly chooses the first actor, then alternates', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0.75 });
  assert.equal(state.firstActor, 'p2');

  state = playTurn(state, 'rock', 'paper').state;
  assert.equal(state.actor, 'p2');
  state = playTurn(state, 'wait', 'bet:1').state;
  state = playTurn(state, 'fold', 'wait').state;

  assert.equal(state.firstActor, 'p1');
  assert.equal(state.phase, 'lock');
});

test('RPS Poker showdown rules cover every move and community combination', () => {
  for (const community of RPS_POKER_MOVES) {
    for (const p1 of RPS_POKER_MOVES) {
      for (const p2 of RPS_POKER_MOVES) {
        const winner = getRpsPokerShowdownWinner({ p1, p2 }, community);
        const p1Strength = getRpsPokerStrength(p1, community);
        const p2Strength = getRpsPokerStrength(p2, community);
        const expected = p1Strength === p2Strength ? null : p1Strength > p2Strength ? 'p1' : 'p2';
        assert.equal(winner, expected, `${p1} vs ${p2}, community ${community}`);

        const reversed = getRpsPokerShowdownWinner({ p1: p2, p2: p1 }, community);
        assert.equal(reversed, winner === 'p1' ? 'p2' : winner === 'p2' ? 'p1' : null);
      }
    }
  }
});

test('RPS Poker pot distribution preserves all chips', () => {
  for (const winner of ['p1', 'p2', null]) {
    const stacks = distributeRpsPokerPot({ p1: 5, p2: 7 }, 6, winner);
    assert.equal(stacks.p1 + stacks.p2, 18);
  }
  assert.throws(
    () => distributeRpsPokerPot({ p1: 5, p2: 7 }, 5, null),
    /tied pot must be even/,
  );
});

test('RPS Poker winner scene faces the showdown winner', () => {
  const playerWin = getRpsPokerWinnerPresentation('p1');
  const rivalWin = getRpsPokerWinnerPresentation('p2');
  assert.equal(playerWin.flip, false);
  assert.equal(rivalWin.flip, true);
  assert.equal(isRpsPokerCutawayPresentation(playerWin), true);
  assert.equal(isRpsPokerCutawayPresentation(rivalWin), true);
});

test('RPS Poker deal sequence animates then holds the dealt card', async () => {
  const presentations = [];
  const completed = await playRpsPokerDeal({
    isActive: () => true,
    renderPresentation: (presentation) => presentations.push(presentation),
    waitMilliseconds: async () => {},
  });
  assert.equal(completed, true);
  assert.deepEqual(
    presentations.map(({ name, animateDeal }) => ({ name, animateDeal })),
    [
      { name: 'rps-poker-card-deal', animateDeal: true },
      { name: 'rps-poker-card-dealt', animateDeal: false },
    ],
  );
});

test('RPS Poker raises ante after both players act first', () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => getRpsPokerAnte(index + 1)),
    [1, 1, 2, 2, 3, 3, 4, 4],
  );
});

test('RPS Poker topper starts only when a stack cannot cover the next ante', () => {
  assert.equal(shouldPlayRpsPokerTopper({ stacks: { p1: 8, p2: 8 }, hand: 1 }), false);
  assert.equal(shouldPlayRpsPokerTopper({ stacks: { p1: 1, p2: 13 }, hand: 4 }), true);
  assert.equal(shouldPlayRpsPokerTopper({ stacks: { p1: 3, p2: 9 }, hand: 4 }), false);
});

test('RPS Poker player who cannot pay the next ante loses', () => {
  assert.equal(getRpsPokerAnteLoser({ p1: 1, p2: 17 }, 2), 'p1');
  assert.equal(getRpsPokerAnteLoser({ p1: 17, p2: 1 }, 2), 'p2');
  assert.equal(getRpsPokerAnteLoser({ p1: 1, p2: 1 }, 2), null);

  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0 });
  state = {
    ...state,
    hand: 2,
    ante: 1,
    phase: 'betting',
    actor: 'p1',
    checkedOnce: true,
    stacks: { p1: 1, p2: 17 },
    pot: 0,
    committed: { p1: 0, p2: 0 },
    locked: { p1: 'rock', p2: 'rock' },
    community: 'rock',
  };
  const turn = playTurn(state, 'check', 'wait');
  assert.equal(turn.state.status, 'finished');
  assert.equal(turn.state.winner, 'p2');
  assert.equal(turn.state.phase, 'anteLoss');
});

test('RPS Poker fold can end the game at the next ante', () => {
  let state = createRoundState({ variantId: VARIANT_IDS.rpsPoker, random: () => 0 });
  state = {
    ...state,
    hand: 2,
    ante: 1,
    phase: 'betting',
    actor: 'p1',
    stacks: { p1: 1, p2: 15 },
    pot: 2,
    committed: { p1: 0, p2: 1 },
    locked: { p1: 'rock', p2: 'paper' },
    community: 'scissors',
  };
  const turn = playTurn(state, 'fold', 'wait');
  assert.equal(turn.ok, true);
  assert.equal(turn.state.status, 'finished');
  assert.equal(turn.state.winner, 'p2');
  assert.equal(turn.state.phase, 'anteLoss');
});
