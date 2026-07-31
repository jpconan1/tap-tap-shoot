import { PLAYERS, appendEvent, basePresentation, otherPlayer, simultaneousReducer, title } from '../sessionCore.js';
import { complete } from './shared.js';

export const kitchenSinkDefinition = {
  id: 'kitchenSink',
  createState: () => ({
    variantId: 'kitchenSink', variantName: 'Kitchen Sink', status: 'playing',
    phase: 'choose', activePlayers: [...PLAYERS], prompt: 'Both players choose.',
    pending: {}, events: [], round: 1, scores: { p1: 0, p2: 0 },
    hp: { p1: 3, p2: 3 }, bars: { p1: 0, p2: 0 },
    position: 'neutral', punished: null,
  }),
  getLegalActions(state, playerId) {
    const actions = ['strike', 'advance', 'bait'];
    actions.push(state.bars[playerId] === 3 ? 'super' : 'charge');
    if (state.bars[playerId] > 0) actions.push(getSpecialName(state, playerId));
    return actions;
  },
  reduce(state, command) {
    if (state.phase === 'free-move') return resolveFreeMove(state, command);
    return simultaneousReducer({
      state, command,
      resolve: (clean, picks) => resolveTurn(clean, picks),
    });
  },
  present(state) {
    return basePresentation(state, state.scene ?? 'Neutral. Both players at 3 HP and 0 bars.', [
      `Rounds: ${state.scores.p1}-${state.scores.p2}`,
      `HP: P1 ${state.hp.p1}, P2 ${state.hp.p2}`,
      `Bars: P1 ${state.bars.p1}, P2 ${state.bars.p2}`,
      `Position: ${state.position}`,
      ...(state.punished ? [`Punished: ${state.punished}`] : []),
    ]);
  },
};

export function getSpecialName(state, playerId) {
  if (state.position === 'neutral') return 'fireball';
  return state.position === `${playerId}-center` ? 'powered-strike' : 'reversal';
}

function resolveTurn(state, picks) {
  const next = {
    ...state, hp: { ...state.hp }, bars: { ...state.bars }, pending: {},
    activePlayers: [...PLAYERS], prompt: 'Both players choose.',
  };
  for (const player of PLAYERS) {
    if (['fireball', 'powered-strike', 'reversal'].includes(picks[player])) next.bars[player]--;
    if (picks[player] === 'super') next.bars[player] = 0;
  }
  const outcome = state.position === 'neutral'
    ? resolveNeutralKitchen(next, picks)
    : resolvePositionKitchen(next, picks, state.position.startsWith('p1') ? 'p1' : 'p2');
  outcome.events = appendEvent(state, outcome.scene);
  if (outcome.punished) {
    const actor = otherPlayer(outcome.punished);
    return {
      ...outcome, phase: 'free-move', activePlayers: [actor],
      prompt: `${actor} takes a free move.`,
    };
  }
  return settleRound(outcome);
}

export function resolveNeutralKitchen(state, picks) {
  const [p1Move, p2Move] = [picks.p1, picks.p2];
  const scene = `${title(p1Move)} versus ${title(p2Move)}.`;
  if (p1Move === p2Move) {
    if (p1Move === 'charge') {
      state.bars.p1 = Math.min(3, state.bars.p1 + 1);
      state.bars.p2 = Math.min(3, state.bars.p2 + 1);
    }
    if (p1Move === 'super') {
      if (state.hp.p1 === state.hp.p2) {
        state.hp.p1 = 1;
        state.hp.p2 = 1;
      } else {
        const lowerPlayer = state.hp.p1 > state.hp.p2 ? 'p2' : 'p1';
        state.hp[lowerPlayer] = Math.max(0, state.hp[lowerPlayer] - 3);
      }
    }
    return { ...state, scene };
  }
  for (const player of PLAYERS) {
    const foe = otherPlayer(player);
    const move = picks[player];
    const foeMove = picks[foe];
    if (move === 'charge' && !['strike', 'fireball', 'super'].includes(foeMove)) {
      state.bars[player] = Math.min(3, state.bars[player] + 1);
    }
    if (move === 'strike' && ['advance', 'charge'].includes(foeMove)) state.hp[foe]--;
    if (move === 'fireball' && ['strike', 'advance', 'charge'].includes(foeMove)) state.hp[foe]--;
    if (move === 'super') state.hp[foe] -= foeMove === 'bait' ? 1 : 3;
  }
  if ((p1Move === 'advance' && ['bait', 'charge'].includes(p2Move))
    || (p1Move === 'bait' && ['strike', 'charge'].includes(p2Move))) state.position = 'p1-center';
  if ((p2Move === 'advance' && ['bait', 'charge'].includes(p1Move))
    || (p2Move === 'bait' && ['strike', 'charge'].includes(p1Move))) state.position = 'p2-center';
  return { ...state, scene };
}

export function resolvePositionKitchen(state, picks, center) {
  const corner = otherPlayer(center);
  const centerMove = picks[center];
  const cornerMove = picks[corner];
  const scene = `${center} ${title(centerMove)} versus ${corner} ${title(cornerMove)}.`;
  const damage = (player, amount) => { state.hp[player] = Math.max(0, state.hp[player] - amount); };
  const reset = () => { state.position = 'neutral'; };
  const gain = (player) => { state.bars[player] = Math.min(3, state.bars[player] + 1); };
  const rows = {
    strike: {
      strike: () => damage(corner, 1),
      advance: () => damage(corner, 1),
      bait: reset,
      charge: () => damage(corner, 1),
      reversal: () => { damage(center, 1); reset(); },
      super: () => damage(center, 3),
    },
    advance: {
      strike: () => damage(center, 1),
      advance: () => {},
      bait: () => damage(corner, 1),
      charge: () => damage(corner, 1),
      reversal: () => { damage(center, 1); reset(); },
      super: () => damage(center, 3),
    },
    bait: {
      strike: () => { state.punished = corner; },
      advance: reset,
      bait: () => {},
      charge: () => gain(corner),
      reversal: () => { state.punished = corner; },
      super: () => { damage(center, 1); reset(); },
    },
    charge: {
      strike: () => damage(center, 1),
      advance: () => { gain(center); reset(); },
      bait: () => gain(center),
      charge: () => { gain(center); gain(corner); },
      reversal: () => { damage(center, 1); reset(); },
      super: () => damage(center, 3),
    },
    'powered-strike': {
      strike: () => damage(corner, 2),
      advance: () => damage(corner, 2),
      bait: () => {},
      charge: () => damage(corner, 2),
      reversal: () => { damage(center, 1); reset(); },
      super: () => damage(center, 3),
    },
    super: {
      strike: () => damage(corner, 3),
      advance: () => damage(corner, 3),
      bait: () => damage(corner, 1),
      charge: () => damage(corner, 3),
      reversal: () => damage(corner, 3),
      super: () => {
        if (state.hp.p1 === state.hp.p2) damage(corner, 3);
        else damage(state.hp.p1 > state.hp.p2 ? 'p2' : 'p1', 3);
      },
    },
  };
  rows[centerMove][cornerMove]();
  return { ...state, scene };
}

function resolveFreeMove(state, command) {
  const actor = command.playerId;
  const foe = otherPlayer(actor);
  const next = { ...state, hp: { ...state.hp }, bars: { ...state.bars }, punished: null };
  const action = command.actionId;
  if (action === 'strike') next.hp[foe]--;
  if (action === 'charge') next.bars[actor] = Math.min(3, next.bars[actor] + 1);
  if (action === 'powered-strike') { next.bars[actor]--; next.hp[foe] -= 2; }
  if (action === 'fireball') { next.bars[actor]--; next.hp[foe]--; }
  if (action === 'reversal') { next.bars[actor]--; next.hp[foe]--; next.position = 'neutral'; }
  if (action === 'super') { next.bars[actor] = 0; next.hp[foe] -= 3; }
  next.scene = `${actor} takes free ${title(action)}.`;
  next.events = appendEvent(state, next.scene);
  return settleRound(next);
}

function settleRound(state) {
  const winner = state.hp.p1 <= 0 ? 'p2' : state.hp.p2 <= 0 ? 'p1' : null;
  if (!winner) {
    return { ...state, phase: 'choose', activePlayers: [...PLAYERS], prompt: 'Both players choose.' };
  }
  const scores = { ...state.scores, [winner]: state.scores[winner] + 1 };
  if (scores[winner] >= 2) return complete({ ...state, scores }, winner, state.scene);
  return {
    ...state, scores, hp: { p1: 3, p2: 3 }, position: 'neutral', punished: null,
    phase: 'choose', activePlayers: [...PLAYERS], prompt: 'Both players choose.',
    round: state.round + 1, scene: `${state.scene} ${winner} wins round.`,
  };
}
