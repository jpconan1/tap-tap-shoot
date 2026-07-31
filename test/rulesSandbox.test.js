import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizeGameLayout } from '../src/layoutLoader.js';
import {
  RULES_SANDBOX_VARIANTS,
  __test,
  createRulesSandboxSession,
} from '../src/rulesSandbox/variants.js';
import { renderRulesSandboxPicker, renderRulesSandboxState } from '../src/rulesSandbox/ui.js';

function submitBoth(session, p1, p2) {
  session.submit({ playerId: 'p1', actionId: p1 });
  return session.submit({ playerId: 'p2', actionId: p2 });
}

test('sandbox registers the nine-target lineup', () => {
  assert.deepEqual(RULES_SANDBOX_VARIANTS.map(({ id }) => id), [
    'rockPaperScissors', 'fireballWar', 'gunKnifeFist', 'tapTapShootX',
    'rpsMinusOne', 'rpsRpg', 'rpsPoker', 'kitchenSink', 'rpsDragonSpear',
  ]);
});

test('phased session conceals submitted choices and rejects illegal commands', () => {
  const session = createRulesSandboxSession('rpsMinusOne');
  session.submit({ playerId: 'p1', actionId: 'rockPaper' });
  assert.equal(session.getView().pending.p1, 'concealed');
  assert.equal(session.getView('p2').pending.p1, 'concealed');
  assert.throws(() => session.submit({ playerId: 'p1', actionId: 'paperScissors' }), /not active/);
  assert.throws(() => session.submit({ playerId: 'p2', actionId: 'dragon' }), /Illegal action/);
});

test('RPS Minus One skips matching pairs, scores pips, and enters 6-6 sudden death', () => {
  const session = createRulesSandboxSession('rpsMinusOne');
  for (let index = 0; index < 6; index++) submitBoth(session, 'rockPaper', 'rockPaper');
  const state = session.getState();
  assert.deepEqual(state.scores, { p1: 6, p2: 6 });
  assert.equal(state.phase, 'sudden-death');
  submitBoth(session, 'rock', 'scissors');
  assert.equal(session.getState().winner, 'p1');
});

test('RPS Minus One differing pairs reveal keep phase and award two pips', () => {
  const session = createRulesSandboxSession('rpsMinusOne');
  submitBoth(session, 'rockPaper', 'paperScissors');
  assert.equal(session.getState().phase, 'keep');
  submitBoth(session, 'rock', 'scissors');
  assert.deepEqual(session.getState().scores, { p1: 2, p2: 0 });
});

test('RPS RPG persists levels, resolves stat ties, and repeats equal ties without leveling', () => {
  const session = createRulesSandboxSession('rpsRpg');
  submitBoth(session, 'str', 'int');
  assert.equal(session.getState().phase, 'move');
  submitBoth(session, 'sword', 'sword');
  assert.deepEqual(session.getState().scores, { p1: 1, p2: 0 });
  assert.equal(session.getState().phase, 'level');
  submitBoth(session, 'dex', 'dex');
  submitBoth(session, 'bow', 'bow');
  assert.equal(session.getState().phase, 'move');
  assert.deepEqual(session.getState().stats.p1, { str: 1, int: 0, dex: 1 });
});

test('Dragon Spear matchup matrix and Dragon permadeath', () => {
  const moves = ['rock', 'paper', 'scissors', 'dragon', 'spear'];
  for (const p1 of moves) {
    for (const p2 of moves) {
      const session = createRulesSandboxSession('rpsDragonSpear');
      assert.doesNotThrow(() => submitBoth(session, p1, p2));
    }
  }
  const session = createRulesSandboxSession('rpsDragonSpear');
  submitBoth(session, 'dragon', 'spear');
  assert.equal(session.getState().dragonAvailable.p1, false);
  assert.equal(session.getState().legalActions.p1.some(({ id }) => id === 'dragon'), false);
  submitBoth(session, 'spear', 'rock');
  assert.deepEqual(session.getState().scores, { p1: 0, p2: 2 });
});

test('Kitchen Sink exposes all 36 positional matchups and representative effects', () => {
  const centerMoves = ['strike', 'advance', 'bait', 'charge', 'powered-strike', 'super'];
  const cornerMoves = ['strike', 'advance', 'bait', 'charge', 'reversal', 'super'];
  for (const centerMove of centerMoves) {
    for (const cornerMove of cornerMoves) {
      const state = {
        hp: { p1: 3, p2: 3 }, bars: { p1: 2, p2: 2 },
        position: 'p1-center', punished: null,
      };
      if (centerMove === 'super') state.bars.p1 = 0;
      if (cornerMove === 'super') state.bars.p2 = 0;
      assert.doesNotThrow(() => __test.resolvePositionKitchen(state, { p1: centerMove, p2: cornerMove }, 'p1'));
    }
  }
  const advanceBait = {
    hp: { p1: 3, p2: 3 }, bars: { p1: 0, p2: 0 },
    position: 'p1-center', punished: null,
  };
  __test.resolvePositionKitchen(advanceBait, { p1: 'advance', p2: 'bait' }, 'p1');
  assert.equal(advanceBait.hp.p2, 2);
  assert.equal(advanceBait.position, 'p1-center');

  const session = createRulesSandboxSession('kitchenSink');
  submitBoth(session, 'bait', 'charge');
  assert.equal(session.getState().position, 'p1-center');
  assert.equal(session.getState().bars.p2, 1);
  submitBoth(session, 'bait', 'strike');
  assert.equal(session.getState().phase, 'free-move');
  assert.deepEqual(session.getState().activePlayers, ['p1']);
  session.submit({ playerId: 'p1', actionId: 'strike' });
  assert.equal(session.getState().hp.p2, 2);
});

test('Kitchen Sink Strike hurts neutral Charge and denies its bar gain', () => {
  const session = createRulesSandboxSession('kitchenSink');
  submitBoth(session, 'strike', 'charge');
  assert.deepEqual(session.getState().bars, { p1: 0, p2: 0 });
  assert.equal(session.getState().hp.p2, 2);
  submitBoth(session, 'bait', 'charge');
  submitBoth(session, 'charge', 'bait');
  assert.equal(session.getState().bars.p1, 1);
  assert.equal(session.getState().position, 'p1-center');
  submitBoth(session, 'powered-strike', 'bait');
  assert.equal(session.getState().bars.p1, 0);
  assert.equal(session.getState().hp.p2, 2);
});

test('Nine-stack Poker injects deterministic dealer, validates bets, and conceals locks', () => {
  const session = createRulesSandboxSession('rpsPoker', { random: () => 0 });
  assert.deepEqual(session.getState().stacks, { p1: 8, p2: 8 });
  submitBoth(session, 'rock', 'scissors');
  let state = session.getState();
  assert.equal(state.community, 'rock');
  assert.equal(state.actor, 'p1');
  assert.equal(session.getView('p1').locked.p2, 'concealed');
  assert.throws(() => session.submit({ playerId: 'p1', actionId: 'bet', amount: 9 }), /Amount/);
  session.submit({ playerId: 'p1', actionId: 'bet', amount: 2 });
  state = session.getState();
  assert.equal(state.minRaise, 2);
  assert.equal(state.pot, 4);
  session.submit({ playerId: 'p2', actionId: 'fold' });
  assert.equal(session.getState().hand, 2);
  assert.deepEqual(session.getState().stacks, { p1: 9, p2: 7 });
});

test('Nine-stack Poker check-check showdowns split ties and alternate first actor', () => {
  const session = createRulesSandboxSession('rpsPoker', { random: () => 0 });
  submitBoth(session, 'rock', 'rock');
  session.submit({ playerId: 'p1', actionId: 'check' });
  session.submit({ playerId: 'p2', actionId: 'check' });
  const state = session.getState();
  assert.equal(state.hand, 2);
  assert.equal(state.firstActor, 'p2');
  assert.deepEqual(state.stacks, { p1: 8, p2: 8 });
  assert.equal(state.ante, 1);
});

test('Nine-stack Poker enforces a full raise and resolves an all-in call', () => {
  const session = createRulesSandboxSession('rpsPoker', { random: () => 0 });
  submitBoth(session, 'rock', 'scissors');
  session.submit({ playerId: 'p1', actionId: 'bet', amount: 2 });
  const raise = session.getState().legalActions.p2.find(({ id }) => id === 'raise');
  assert.deepEqual(raise.amount, { min: 4, max: 8 });
  session.submit({ playerId: 'p2', actionId: 'raise', amount: 8 });
  const response = session.getState().legalActions.p1;
  assert.equal(response.some(({ id }) => id === 'raise'), false);
  session.submit({ playerId: 'p1', actionId: 'call' });
  assert.equal(session.getState().status, 'complete');
  assert.equal(session.getState().winner, 'p1');
  assert.deepEqual(session.getState().stacks, { p1: 18, p2: 0 });
});

test('Nine-stack Poker ends when the short stack cannot pay the ante', () => {
  const session = createRulesSandboxSession('rpsPoker', {
    random: () => 0,
    initialState: {
      stacks: { p1: 2, p2: 16 },
      hand: 4,
      firstActor: 'p1',
    },
  });
  assert.equal(session.getState().status, 'complete');
  assert.equal(session.getState().winner, 'p2');
  assert.deepEqual(session.getState().stacks, { p1: 2, p2: 16 });
});

test('sandbox markup uses three generic sheets, concealed copy, amount controls, and navigation', () => {
  const picker = renderRulesSandboxPicker();
  assert.match(picker, /button_bg_generic1/);
  assert.match(picker, /button_bg_generic2/);
  assert.match(picker, /button_bg_generic3/);
  assert.equal((picker.match(/data-sandbox-action="pick-variant"/g) ?? []).length, 9);

  const session = createRulesSandboxSession('rpsPoker', { random: () => 0 });
  session.submit({ playerId: 'p1', actionId: 'rock' });
  let markup = renderRulesSandboxState(session.getView());
  assert.match(markup, /Choice concealed/);
  assert.match(markup, /data-sandbox-action="picker"/);
  assert.match(markup, /data-sandbox-action="restart"/);

  session.submit({ playerId: 'p2', actionId: 'paper' });
  markup = renderRulesSandboxState(session.getView());
  assert.match(markup, /type="number"/);
  assert.match(markup, /data-value="bet"/);
});

test('new version-3 layouts normalize with required landscape and portrait slots', async () => {
  const folders = ['rps-minus-one', 'rps-rpg', 'rps-poker', 'kitchen-sink', 'rps-dragon-spear'];
  const required = ['scene', 'p1-state', 'p2-state', 'score', 'phase-prompt', 'actions', 'cpu-odds'];
  for (const folder of folders) {
    const payload = JSON.parse(await readFile(new URL(`../assets/${folder}/${folder}-layout.json`, import.meta.url)));
    const layout = normalizeGameLayout(payload);
    const state = layout.states.get('playing.default');
    for (const key of required) {
      assert.equal(state.slots.has(key), true, `${folder} landscape ${key}`);
      assert.equal(state.portraitSlots.has(key), true, `${folder} portrait ${key}`);
    }
  }
});
