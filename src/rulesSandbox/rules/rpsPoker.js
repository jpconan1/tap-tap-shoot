import {
  PLAYERS,
  appendEvent,
  basePresentation,
  otherPlayer,
  rpsWinner,
  simultaneousReducer,
  title,
} from '../sessionCore.js';
import { complete, continuePhase } from './shared.js';

export const rpsPokerDefinition = {
  id: 'rpsPoker',
  createState({ random, initialState = null }) {
    if (initialState) {
      return beginHand({
        variantId: 'rpsPoker', variantName: 'RPS Poker', status: 'playing',
        events: [], winner: null, ...initialState,
      }, random);
    }
    const firstActor = random() < 0.5 ? 'p1' : 'p2';
    return beginHand({
      variantId: 'rpsPoker', variantName: 'RPS Poker', status: 'playing',
      events: [], stacks: { p1: 9, p2: 9 }, hand: 0, firstActor, winner: null,
    }, random);
  },
  getLegalActions(state, playerId) {
    if (state.phase === 'lock' || state.phase === 'forced-rps') return ['rock', 'paper', 'scissors'];
    if (state.phase !== 'betting' || state.actor !== playerId) return [];
    const foe = otherPlayer(playerId);
    const toCall = state.committed[foe] - state.committed[playerId];
    const maxTotal = state.committed[playerId]
      + Math.min(state.stacks[playerId], state.stacks[foe] + Math.max(0, toCall));
    if (toCall > 0) {
      const actions = ['fold', 'call'];
      const minTotal = Math.min(maxTotal, state.committed[foe] + state.minRaise);
      if (maxTotal > state.committed[foe]) {
        actions.push({ id: 'raise', label: 'Raise to', amount: { min: minTotal, max: maxTotal } });
      }
      return actions;
    }
    return [
      'check',
      { id: 'bet', label: 'Bet', amount: { min: 1, max: Math.min(state.stacks.p1, state.stacks.p2) } },
    ];
  },
  reduce(state, command, { random }) {
    if (state.phase === 'lock') {
      return simultaneousReducer({
        state, command,
        resolve: (clean, picks) => {
          const community = randomRps(random);
          return {
            ...clean, locked: picks, community, phase: 'betting',
            activePlayers: [clean.firstActor], actor: clean.firstActor,
            prompt: `${clean.firstActor} acts first.`,
            scene: `Community: ${title(community)}. Locked moves stay private.`,
            events: appendEvent(clean, 'Moves locked. Community dealt.'),
          };
        },
      });
    }
    if (state.phase === 'forced-rps') {
      return simultaneousReducer({
        state, command,
        resolve: (clean, picks) => {
          const winner = rpsWinner(picks.p1, picks.p2);
          if (!winner) return continuePhase(clean, 'forced-rps', picks, 'Forced all-in ties. Choose again.');
          clean.stacks[winner] += clean.pot;
          clean.pot = 0;
          return clean.stacks[otherPlayer(winner)] === 0
            ? complete(clean, winner, `${winner} wins forced all-in.`)
            : beginHand(clean, random);
        },
      });
    }
    return reduceBetting(state, command, random);
  },
  present(state) {
    return basePresentation(state, state.scene ?? 'Nine-stack Poker.', [
      `Hand ${state.hand}; ante ${state.ante}`,
      `Stacks: P1 ${state.stacks.p1}, P2 ${state.stacks.p2}`,
      `Pot: ${state.pot}`,
      `Committed: P1 ${state.committed?.p1 ?? 0}, P2 ${state.committed?.p2 ?? 0}`,
      ...(state.community ? [`Community: ${title(state.community)}`] : []),
      ...(state.actor ? [`Actor: ${state.actor}; minimum raise ${state.minRaise}`] : []),
    ]);
  },
};

function randomRps(random) {
  return ['rock', 'paper', 'scissors'][Math.min(2, Math.floor(random() * 3))];
}

function beginHand(state, random) {
  const hand = state.hand + 1;
  const ante = hand;
  const paid = Math.min(ante, state.stacks.p1, state.stacks.p2);
  const stacks = { p1: state.stacks.p1 - paid, p2: state.stacks.p2 - paid };
  const base = {
    ...state, hand, ante, stacks, pot: paid * 2, committed: { p1: 0, p2: 0 },
    locked: {}, community: null, checkedOnce: false, minRaise: 1, actor: null, pending: {},
    firstActor: hand === 1 ? state.firstActor : otherPlayer(state.firstActor),
  };
  if (stacks.p1 === 0 || stacks.p2 === 0) {
    return {
      ...base, phase: 'forced-rps', activePlayers: [...PLAYERS],
      prompt: 'Forced all-in: choose RPS.', scene: `Both post ${paid}. Forced all-in.`,
    };
  }
  return {
    ...base, phase: 'lock', activePlayers: [...PLAYERS],
    prompt: 'Lock an RPS move.', scene: `Both post ante ${paid}.`,
  };
}

function reduceBetting(state, command, random) {
  const player = command.playerId;
  const foe = otherPlayer(player);
  if (command.actionId === 'fold') {
    const stacks = { ...state.stacks, [foe]: state.stacks[foe] + state.pot };
    const next = {
      ...state, stacks, pot: 0,
      events: appendEvent(state, `${player} folds. ${foe} takes pot.`),
      scene: `${player} folds. Locked moves stay concealed.`,
    };
    return stacks[player] === 0 ? complete(next, foe, next.scene) : beginHand(next, random);
  }
  if (command.actionId === 'check') {
    if (state.checkedOnce) return showdown(state, random);
    return {
      ...state, checkedOnce: true, actor: foe, activePlayers: [foe],
      prompt: `${foe} acts.`, events: appendEvent(state, `${player} checks.`),
      scene: `${player} checks.`,
    };
  }
  if (command.actionId === 'call') {
    const amount = state.committed[foe] - state.committed[player];
    return showdown({
      ...state,
      stacks: { ...state.stacks, [player]: state.stacks[player] - amount },
      committed: { ...state.committed, [player]: state.committed[player] + amount },
      pot: state.pot + amount,
    }, random);
  }
  const oldTarget = state.committed[foe];
  const add = command.amount - state.committed[player];
  const increment = command.amount - oldTarget;
  return {
    ...state,
    stacks: { ...state.stacks, [player]: state.stacks[player] - add },
    committed: { ...state.committed, [player]: command.amount },
    pot: state.pot + add, minRaise: Math.max(1, increment),
    actor: foe, activePlayers: [foe], checkedOnce: false, prompt: `${foe} responds.`,
    scene: `${player} ${command.actionId}s to ${command.amount}.`,
    events: appendEvent(state, `${player} ${command.actionId}s to ${command.amount}.`),
  };
}

function showdown(state, random) {
  const strength = (move) => {
    if (move === state.community) return 1;
    return rpsWinner(move, state.community) === 'p1' ? 2 : 0;
  };
  const p1Strength = strength(state.locked.p1);
  const p2Strength = strength(state.locked.p2);
  const stacks = { ...state.stacks };
  let scene;
  if (p1Strength === p2Strength) {
    stacks.p1 += state.pot / 2;
    stacks.p2 += state.pot / 2;
    scene = 'Showdown ties. Pot splits.';
  } else {
    const winner = p1Strength > p2Strength ? 'p1' : 'p2';
    stacks[winner] += state.pot;
    scene = `${winner} wins showdown and pot ${state.pot}.`;
  }
  const next = { ...state, stacks, pot: 0, scene, events: appendEvent(state, scene) };
  const winner = stacks.p1 === 0 ? 'p2' : stacks.p2 === 0 ? 'p1' : null;
  return winner ? complete(next, winner, scene) : beginHand(next, random);
}
