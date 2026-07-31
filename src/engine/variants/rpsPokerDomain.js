import {
  distributeRpsPokerPot,
  getRpsPokerAnte,
  getRpsPokerAnteLoser,
  getRpsPokerAntePayment,
  getRpsPokerShowdownWinner,
  RPS_POKER_MOVES,
} from './rpsPokerRules.js';

export const RPS_POKER_COMMANDS = Object.freeze({
  lockCard: 'LOCK_CARD',
  check: 'CHECK',
  bet: 'BET',
  fold: 'FOLD',
  call: 'CALL',
  raise: 'RAISE',
});

export function createRpsPokerState({ random = Math.random } = {}) {
  return beginHand({
    stacks: { p1: 9, p2: 9 },
    hand: 0,
    firstActor: random() < 0.5 ? 'p1' : 'p2',
  });
}

export function getRpsPokerLegalCommands(state, player) {
  if (state.phase === 'lock') {
    return state.locked[player] ? [] : RPS_POKER_MOVES.map((card) => ({
      type: RPS_POKER_COMMANDS.lockCard,
      card,
    }));
  }
  if (state.phase !== 'betting' || state.actor !== player) return [];

  const foe = other(player);
  const toCall = state.committed[foe] - state.committed[player];
  const maxTotal = state.committed[player]
    + Math.min(state.stacks[player], state.stacks[foe] + Math.max(0, toCall));
  if (toCall > 0) {
    const commands = [
      { type: RPS_POKER_COMMANDS.fold },
      { type: RPS_POKER_COMMANDS.call },
    ];
    if (maxTotal > state.committed[foe]) {
      const min = Math.min(maxTotal, state.committed[foe] + state.minRaise);
      for (let amount = min; amount <= maxTotal; amount += 1) {
        commands.push({ type: RPS_POKER_COMMANDS.raise, amount });
      }
    }
    return commands;
  }

  const commands = [{ type: RPS_POKER_COMMANDS.check }];
  const max = Math.min(state.stacks.p1, state.stacks.p2);
  for (let amount = 1; amount <= max; amount += 1) {
    commands.push({ type: RPS_POKER_COMMANDS.bet, amount });
  }
  return commands;
}

export function decideRpsPokerCommand(state, player, command, { random = Math.random } = {}) {
  const normalized = normalizeRpsPokerCommand(command);
  const legal = getRpsPokerLegalCommands(state, player);
  if (!normalized || !legal.some((candidate) => sameCommand(candidate, normalized))) {
    return { ok: false, error: `illegal poker command for ${player}` };
  }

  if (normalized.type === RPS_POKER_COMMANDS.lockCard) {
    const locked = { ...state.locked, [player]: normalized.card };
    const events = [{ type: 'CARD_LOCKED', player }];
    if (!locked.p1 || !locked.p2) {
      return { ok: true, state: { ...copyState(state), locked }, events };
    }
    const community = randomCard(random);
    return {
      ok: true,
      state: {
        ...copyState(state),
        locked,
        community,
        phase: 'betting',
        actor: state.firstActor,
        bettingHistory: [],
      },
      events: [
        ...events,
        { type: 'BOTH_CARDS_LOCKED' },
        { type: 'COMMUNITY_REVEALED', card: community },
        { type: 'BETTING_STARTED', actor: state.firstActor },
      ],
    };
  }

  return decideBettingCommand(state, player, normalized);
}

export function normalizeRpsPokerCommand(command) {
  if (!command || typeof command !== 'object') return null;
  const type = String(command.type ?? '').toUpperCase();
  if (type === RPS_POKER_COMMANDS.lockCard && RPS_POKER_MOVES.includes(command.card)) {
    return { type, card: command.card };
  }
  if ([RPS_POKER_COMMANDS.bet, RPS_POKER_COMMANDS.raise].includes(type)) {
    const amount = Number(command.amount);
    return Number.isInteger(amount) ? { type, amount } : null;
  }
  if ([RPS_POKER_COMMANDS.check, RPS_POKER_COMMANDS.fold, RPS_POKER_COMMANDS.call].includes(type)) {
    return { type };
  }
  return null;
}

export function pokerCommandFromMove(moveId) {
  const [action, amountText] = String(moveId).split(':');
  if (RPS_POKER_MOVES.includes(action)) {
    return { type: RPS_POKER_COMMANDS.lockCard, card: action };
  }
  const types = {
    check: RPS_POKER_COMMANDS.check,
    bet: RPS_POKER_COMMANDS.bet,
    fold: RPS_POKER_COMMANDS.fold,
    call: RPS_POKER_COMMANDS.call,
    raise: RPS_POKER_COMMANDS.raise,
  };
  const type = types[action];
  if (!type) return null;
  return amountText === undefined ? { type } : { type, amount: Number(amountText) };
}

export function pokerMoveFromCommand(command) {
  const normalized = normalizeRpsPokerCommand(command);
  if (!normalized) return null;
  if (normalized.type === RPS_POKER_COMMANDS.lockCard) return normalized.card;
  const action = normalized.type.toLowerCase();
  return normalized.amount === undefined ? action : `${action}:${normalized.amount}`;
}

function decideBettingCommand(state, player, command) {
  const foe = other(player);
  const history = [...state.bettingHistory, encodePolicyAction(command)];

  if (command.type === RPS_POKER_COMMANDS.fold) {
    const stacks = { ...state.stacks, [foe]: state.stacks[foe] + state.pot };
    const events = [
      { type: 'PLAYER_FOLDED', player },
      { type: 'POT_AWARDED', player: foe, amount: state.pot },
    ];
    return finishOrBeginHand(state, stacks, foe, events);
  }

  if (command.type === RPS_POKER_COMMANDS.check) {
    if (!state.checkedOnce) {
      return {
        ok: true,
        state: { ...copyState(state), bettingHistory: history, checkedOnce: true, actor: foe },
        events: [{ type: 'PLAYER_CHECKED', player }, { type: 'TURN_CHANGED', actor: foe }],
      };
    }
    return resolveShowdown({ ...copyState(state), bettingHistory: history });
  }

  if (command.type === RPS_POKER_COMMANDS.call) {
    const amount = state.committed[foe] - state.committed[player];
    return resolveShowdown({
      ...copyState(state),
      bettingHistory: history,
      stacks: { ...state.stacks, [player]: state.stacks[player] - amount },
      committed: { ...state.committed, [player]: state.committed[player] + amount },
      pot: state.pot + amount,
    }, [{ type: 'BET_CALLED', player, amount }]);
  }

  const oldTarget = state.committed[foe];
  const added = command.amount - state.committed[player];
  const eventType = command.type === RPS_POKER_COMMANDS.bet ? 'BET_PLACED' : 'BET_RAISED';
  return {
    ok: true,
    state: {
      ...copyState(state),
      bettingHistory: history,
      stacks: { ...state.stacks, [player]: state.stacks[player] - added },
      committed: { ...state.committed, [player]: command.amount },
      pot: state.pot + added,
      minRaise: Math.max(1, command.amount - oldTarget),
      actor: foe,
      checkedOnce: false,
    },
    events: [
      { type: eventType, player, amount: command.amount, added },
      { type: 'TURN_CHANGED', actor: foe },
    ],
  };
}

function resolveShowdown(state, prefixEvents = []) {
  const winner = getRpsPokerShowdownWinner(state.locked, state.community);
  const stacks = distributeRpsPokerPot(state.stacks, state.pot, winner);
  const events = [
    ...prefixEvents,
    { type: 'CARDS_REVEALED', cards: { ...state.locked } },
    { type: 'SHOWDOWN_RESOLVED', winner },
    ...(winner
      ? [{ type: 'POT_AWARDED', player: winner, amount: state.pot }]
      : [{ type: 'POT_SPLIT', amount: state.pot }]),
  ];
  return finishOrBeginHand(state, stacks, winner, events);
}

function finishOrBeginHand(state, stacks, handWinner, events) {
  const winner = stacks.p1 === 0 ? 'p2' : stacks.p2 === 0 ? 'p1' : null;
  if (winner) {
    return {
      ok: true,
      state: { ...copyState(state), stacks, pot: 0, winner, phase: 'anteLoss' },
      events: [...events, { type: 'MATCH_WON', player: winner }],
    };
  }
  const next = beginHand({ ...copyState(state), stacks, pot: 0 });
  const nextEvents = next.winner
    ? [{ type: 'MATCH_WON', player: next.winner, reason: 'ANTE' }]
    : [{
      type: 'HAND_STARTED',
      hand: next.hand,
      ante: next.ante,
      firstActor: next.firstActor,
      stacks: { ...next.stacks },
      pot: next.pot,
    }];
  return { ok: true, state: next, events: [...events, ...nextEvents], handWinner };
}

function beginHand(state) {
  const hand = state.hand + 1;
  const ante = getRpsPokerAnte(hand);
  const anteLoser = getRpsPokerAnteLoser(state.stacks, ante);
  if (anteLoser) {
    return {
      ...copyState(state),
      hand,
      ante,
      actor: null,
      winner: other(anteLoser),
      phase: 'anteLoss',
    };
  }
  const paid = getRpsPokerAntePayment(state.stacks, ante);
  return {
    ...copyState(state),
    hand,
    ante,
    stacks: { p1: state.stacks.p1 - paid, p2: state.stacks.p2 - paid },
    pot: paid * 2,
    committed: { p1: 0, p2: 0 },
    locked: {},
    community: null,
    checkedOnce: false,
    minRaise: 1,
    bettingHistory: [],
    actor: null,
    winner: null,
    firstActor: hand === 1 ? state.firstActor : other(state.firstActor),
    phase: 'lock',
  };
}

function copyState(state) {
  return {
    ...state,
    stacks: { ...state.stacks },
    committed: { ...state.committed },
    locked: { ...state.locked },
    bettingHistory: [...(state.bettingHistory ?? [])],
  };
}

function sameCommand(left, right) {
  return left.type === right.type
    && left.card === right.card
    && left.amount === right.amount;
}

function randomCard(random) {
  return RPS_POKER_MOVES[Math.floor(random() * RPS_POKER_MOVES.length)];
}

function other(player) {
  return player === 'p1' ? 'p2' : 'p1';
}

function encodePolicyAction(command) {
  if (command.type === RPS_POKER_COMMANDS.check) return 'x';
  if (command.type === RPS_POKER_COMMANDS.fold) return 'f';
  if (command.type === RPS_POKER_COMMANDS.call) return 'c';
  if (command.type === RPS_POKER_COMMANDS.bet) return `b${command.amount}`;
  return `r${command.amount}`;
}
