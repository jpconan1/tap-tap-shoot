import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRpsPokerState,
  decideRpsPokerCommand,
  getRpsPokerLegalCommands,
  RPS_POKER_COMMANDS,
} from '../src/engine/variants/rpsPokerDomain.js';

test('poker domain accepts independent hidden locks then emits reveal events', () => {
  let state = createRpsPokerState({ random: () => 0 });
  const first = decideRpsPokerCommand(state, 'p1', {
    type: RPS_POKER_COMMANDS.lockCard,
    card: 'rock',
  });
  assert.equal(first.ok, true);
  assert.deepEqual(first.events, [{ type: 'CARD_LOCKED', player: 'p1' }]);
  assert.equal(first.state.phase, 'lock');
  state = first.state;

  const second = decideRpsPokerCommand(state, 'p2', {
    type: RPS_POKER_COMMANDS.lockCard,
    card: 'paper',
  }, { random: () => 0.5 });
  assert.equal(second.ok, true);
  assert.equal(second.state.phase, 'betting');
  assert.equal(second.state.community, 'scissors');
  assert.deepEqual(second.events.map((event) => event.type), [
    'CARD_LOCKED',
    'BOTH_CARDS_LOCKED',
    'COMMUNITY_REVEALED',
    'BETTING_STARTED',
  ]);
});

test('poker domain rejects out-of-turn betting and emits semantic bet events', () => {
  let state = createRpsPokerState({ random: () => 0 });
  state = decideRpsPokerCommand(state, 'p1', { type: 'LOCK_CARD', card: 'rock' }).state;
  state = decideRpsPokerCommand(
    state,
    'p2',
    { type: 'LOCK_CARD', card: 'paper' },
    { random: () => 0 },
  ).state;

  assert.equal(decideRpsPokerCommand(state, 'p2', { type: 'BET', amount: 2 }).ok, false);
  const bet = decideRpsPokerCommand(state, 'p1', { type: 'BET', amount: 2 });
  assert.equal(bet.ok, true);
  assert.deepEqual(bet.events, [
    { type: 'BET_PLACED', player: 'p1', amount: 2, added: 2 },
    { type: 'TURN_CHANGED', actor: 'p2' },
  ]);
  assert.equal(bet.state.actor, 'p2');
  assert.equal(bet.state.pot, 4);
});

test('poker legal commands contain structured raise amounts', () => {
  let state = createRpsPokerState({ random: () => 0 });
  state = decideRpsPokerCommand(state, 'p1', { type: 'LOCK_CARD', card: 'rock' }).state;
  state = decideRpsPokerCommand(state, 'p2', { type: 'LOCK_CARD', card: 'paper' }).state;
  state = decideRpsPokerCommand(state, 'p1', { type: 'BET', amount: 2 }).state;

  const commands = getRpsPokerLegalCommands(state, 'p2');
  assert.ok(commands.some((command) => command.type === 'CALL'));
  assert.ok(commands.some((command) => command.type === 'RAISE' && command.amount === 4));
});
