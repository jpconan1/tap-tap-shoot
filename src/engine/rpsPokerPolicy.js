import pokerPolicy from '../../assets/rps-poker/poker_policy.json' with { type: 'json' };
import { getRpsPokerStrength } from './variants/rpsPokerRules.js';

const STRENGTH_NAMES = Object.freeze(['low', 'middle', 'high']);
const RPS_MOVES = Object.freeze(['rock', 'paper', 'scissors']);

export function getRpsPokerNashDistribution(state, playerId) {
  if (state.phase === 'lock') {
    return Object.fromEntries(RPS_MOVES.map((move) => [move, pokerPolicy.strength_deal?.low ?? (1 / 3)]));
  }
  if (state.phase !== 'betting' || state.actor !== playerId) return null;

  const policy = pokerPolicy.policies[getMatchKey(state)];
  if (!policy) return null;
  if (policy.all_in_poker) return policy.all_in_poker;

  const playerNumber = playerId === 'p1' ? 0 : 1;
  const strength = STRENGTH_NAMES[getRpsPokerStrength(state.locked[playerId], state.community)];
  const history = state.bettingHistory?.length ? state.bettingHistory.join('.') : 'start';
  const solverMix = policy[`p${playerNumber}|${strength}|${history}`];
  return solverMix ? translateActions(solverMix) : null;
}

export function chooseRpsPokerNashMove(state, playerId, rng = Math.random) {
  const distribution = getRpsPokerNashDistribution(state, playerId);
  if (!distribution) return null;
  const legalMoves = new Set(getPolicyLegalMoves(state, playerId));
  const weighted = Object.entries(distribution)
    .filter(([move, weight]) => legalMoves.has(move) && weight > 0);
  if (!weighted.length) return null;

  let roll = rng() * weighted.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [move, weight] of weighted) {
    if (roll < weight) return move;
    roll -= weight;
  }
  return weighted.at(-1)[0];
}

function getMatchKey(state) {
  const ante = state.ante;
  const phase = state.hand % 2 === 1 ? 1 : 2;
  const chips = state.stacks.p1 + (state.committed?.p1 ?? 0) + Math.min(ante, 9);
  const first = state.firstActor === 'p1' ? 0 : 1;
  return `a${ante}|h${phase}|c${chips}|first${first}`;
}

function translateActions(mix) {
  return Object.fromEntries(Object.entries(mix).map(([action, weight]) => {
    if (action === 'x') return ['check', weight];
    if (action === 'f') return ['fold', weight];
    if (action === 'c') return ['call', weight];
    if (action.startsWith('b')) return [`bet:${action.slice(1)}`, weight];
    if (action.startsWith('r')) return [`raise:${action.slice(1)}`, weight];
    return [action, weight];
  }));
}

function getPolicyLegalMoves(state, playerId) {
  if (state.phase === 'lock') return RPS_MOVES;
  if (state.actor !== playerId) return [];
  const foe = playerId === 'p1' ? 'p2' : 'p1';
  const toCall = state.committed[foe] - state.committed[playerId];
  const maxTotal = state.committed[playerId]
    + Math.min(state.stacks[playerId], state.stacks[foe] + Math.max(0, toCall));
  if (toCall > 0) {
    const moves = ['fold', 'call'];
    if (maxTotal > state.committed[foe]) {
      const min = Math.min(maxTotal, state.committed[foe] + state.minRaise);
      for (let amount = min; amount <= maxTotal; amount++) moves.push(`raise:${amount}`);
    }
    return moves;
  }
  const moves = ['check'];
  const max = Math.min(state.stacks.p1, state.stacks.p2);
  for (let amount = 1; amount <= max; amount++) moves.push(`bet:${amount}`);
  return moves;
}
