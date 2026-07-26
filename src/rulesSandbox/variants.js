import {
  PLAYERS,
  basePresentation,
  createPhasedSession,
  otherPlayer,
  rpsWinner,
  simultaneousReducer,
} from './sessionCore.js';
import { kitchenSinkDefinition, getSpecialName, resolveNeutralKitchen, resolvePositionKitchen } from './rules/kitchenSink.js';
import { rpsDragonSpearDefinition } from './rules/rpsDragonSpear.js';
import { rpsMinusOneDefinition } from './rules/rpsMinusOne.js';
import { rpsPokerDefinition } from './rules/rpsPoker.js';
import { rpsRpgDefinition } from './rules/rpsRpg.js';
import { scoreExistingRound, scoreFirstTo, stateWithResources } from './rules/shared.js';

export const RULES_SANDBOX_VARIANTS = Object.freeze([
  ['rockPaperScissors', 'Rock Paper Scissors'],
  ['fireballWar', 'Fireball War'],
  ['gunKnifeFist', 'Gun Knife Fist'],
  ['tapTapShootX', 'Tap Tap Shoot X'],
  ['rpsMinusOne', 'RPS Minus One'],
  ['rpsRpg', 'RPS RPG'],
  ['rpsPoker', 'RPS Poker'],
  ['kitchenSink', 'Kitchen Sink'],
  ['rpsDragonSpear', 'RPS Dragon Spear'],
].map(([id, name]) => Object.freeze({ id, name })));

export function createRulesSandboxSession(variantId, options = {}) {
  const definition = DEFINITIONS[variantId];
  if (!definition) throw new Error(`Unknown sandbox variant: ${variantId}`);
  return createPhasedSession(definition, options);
}

function simultaneousBase(id, name, actions, resolveRound, initial = {}) {
  return {
    id,
    createState: () => ({
      variantId: id, variantName: name, status: 'playing', phase: 'choose',
      activePlayers: [...PLAYERS], prompt: 'Both players choose.', pending: {}, events: [],
      scores: { p1: 0, p2: 0 }, round: 1, ...initial,
    }),
    getLegalActions: (state) => actions(state),
    reduce: (state, command) => simultaneousReducer({
      state,
      command,
      resolve: (clean, picks) => resolveRound(clean, picks),
    }),
    present: (state) => basePresentation(state, state.scene ?? `${name}: waiting for choices.`, state.details ?? []),
  };
}

const standardRps = simultaneousBase(
  'rockPaperScissors',
  'Rock Paper Scissors',
  () => ['rock', 'paper', 'scissors'],
  (state, picks) => scoreFirstTo(state, picks, rpsWinner(picks.p1, picks.p2), 5),
);

const fireballWar = {
  ...simultaneousBase('fireballWar', 'Fireball War', () => [], () => {}),
  createState: () => ({
    variantId: 'fireballWar', variantName: 'Fireball War', status: 'playing', phase: 'choose',
    activePlayers: [...PLAYERS], prompt: 'Both players choose.', pending: {}, events: [],
    scores: { p1: 0, p2: 0 }, bars: { p1: 1, p2: 1 }, round: 1,
  }),
  getLegalActions: (state, playerId) => [
    'charge', 'block', ...(state.bars[playerId] > 0 ? ['fireball'] : []),
  ],
  reduce: (state, command) => simultaneousReducer({
    state,
    command,
    resolve: (clean, picks) => {
      const bars = { ...clean.bars };
      for (const player of PLAYERS) if (picks[player] === 'fireball') bars[player]--;
      let winner = null;
      for (const player of PLAYERS) {
        const foe = otherPlayer(player);
        if (picks[player] === 'fireball' && picks[foe] === 'charge') winner = player;
      }
      if (!winner) {
        for (const player of PLAYERS) {
          if (picks[player] === 'charge' && picks[otherPlayer(player)] !== 'fireball') bars[player]++;
        }
        if (bars.p1 >= 3 && bars.p2 >= 3) {
          bars.p1 = 2;
          bars.p2 = 2;
        } else if (bars.p1 >= 3) winner = 'p1';
        else if (bars.p2 >= 3) winner = 'p2';
      }
      const next = winner ? { ...clean, bars } : { ...clean, bars, round: clean.round + 1 };
      return winner
        ? scoreExistingRound(next, picks, winner, { bars: { p1: 1, p2: 1 } })
        : scoreFirstTo(next, picks, null, 3);
    },
  }),
  present: stateWithResources('Bars'),
};

const gunKnifeFist = {
  ...simultaneousBase('gunKnifeFist', 'Gun Knife Fist', () => ['punch', 'stab', 'shoot'], () => {}),
  createState: () => ({
    variantId: 'gunKnifeFist', variantName: 'Gun Knife Fist', status: 'playing', phase: 'choose',
    activePlayers: [...PLAYERS], prompt: 'Both players choose.', pending: {}, events: [],
    scores: { p1: 0, p2: 0 }, hp: { p1: 3, p2: 3 }, round: 1,
  }),
  reduce: (state, command) => simultaneousReducer({
    state,
    command,
    resolve: (clean, picks) => {
      const hitWinner = rpsWinner(picks.p1, picks.p2, { punch: 'shoot', shoot: 'stab', stab: 'punch' });
      const hp = { ...clean.hp };
      if (hitWinner) {
        const damage = { punch: 1, stab: 2, shoot: 3 }[picks[hitWinner]];
        hp[otherPlayer(hitWinner)] = Math.max(0, hp[otherPlayer(hitWinner)] - damage);
      }
      const winner = hp.p1 === 0 ? 'p2' : hp.p2 === 0 ? 'p1' : null;
      return winner
        ? scoreExistingRound({ ...clean, hp }, picks, winner, { hp: { p1: 3, p2: 3 } })
        : scoreFirstTo({ ...clean, hp }, picks, null, 3);
    },
  }),
  present: stateWithResources('HP'),
};

const tapTapShootX = {
  ...simultaneousBase('tapTapShootX', 'Tap Tap Shoot X', () => [], () => {}),
  createState: () => ({
    variantId: 'tapTapShootX', variantName: 'Tap Tap Shoot X', status: 'playing', phase: 'choose',
    activePlayers: [...PLAYERS], prompt: 'Both players choose.', pending: {}, events: [],
    scores: { p1: 0, p2: 0 }, ap: { p1: 0, p2: 0 }, round: 1,
  }),
  getLegalActions: (state, playerId) => [
    'charge', 'duck', 'counterstab', ...(state.ap[playerId] > 0 ? ['shoot', 'stab'] : []),
  ],
  reduce: (state, command) => simultaneousReducer({
    state,
    command,
    resolve: (clean, picks) => {
      const ap = { ...clean.ap };
      for (const player of PLAYERS) {
        if (['shoot', 'stab'].includes(picks[player])) ap[player]--;
        if (picks[player] === 'charge') ap[player] = Math.min(3, ap[player] + 1);
      }
      const beats = { shoot: ['stab', 'counterstab', 'charge'], stab: ['duck', 'charge'] };
      const hits = PLAYERS.filter((player) => beats[picks[player]]?.includes(picks[otherPlayer(player)]));
      const winner = hits.length === 1 ? hits[0] : null;
      return winner
        ? scoreExistingRound({ ...clean, ap }, picks, winner, { ap: { p1: 0, p2: 0 } })
        : scoreFirstTo({ ...clean, ap }, picks, null, 3);
    },
  }),
  present: stateWithResources('AP'),
};

const DEFINITIONS = Object.freeze({
  rockPaperScissors: standardRps,
  fireballWar,
  gunKnifeFist,
  tapTapShootX,
  rpsMinusOne: rpsMinusOneDefinition,
  rpsRpg: rpsRpgDefinition,
  rpsPoker: rpsPokerDefinition,
  kitchenSink: kitchenSinkDefinition,
  rpsDragonSpear: rpsDragonSpearDefinition,
});

export const __test = Object.freeze({
  resolveNeutralKitchen,
  resolvePositionKitchen,
  specialName: getSpecialName,
});
