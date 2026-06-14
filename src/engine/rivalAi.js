import { getLegalMoves } from './moves.js';
import { RIVAL_CONFIG } from './rivalConfig.js';

export const RIVALS = RIVAL_CONFIG.rivals;
export const DEFAULT_RIVAL_ID = RIVAL_CONFIG.defaultRivalId;

export function chooseRivalMove(state, rivalId = DEFAULT_RIVAL_ID, rng = Math.random) {
  if (typeof rivalId === 'function') {
    rng = rivalId;
    rivalId = DEFAULT_RIVAL_ID;
  }

  const rival = RIVALS[rivalId] ?? RIVALS[DEFAULT_RIVAL_ID];
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;
  const policyKey = getPolicyKey(ownAp, enemyAp);
  const fallbackPolicyKey = getFallbackPolicyKey(ownAp, enemyAp);
  const policy = rival.matchups[policyKey]
    ?? rival.matchups[fallbackPolicyKey]
    ?? RIVALS[DEFAULT_RIVAL_ID].matchups[fallbackPolicyKey];

  return chooseWeightedLegalMove(ownAp, enemyAp, policy, rng);
}

function getPolicyKey(ownAp, enemyAp) {
  if (ownAp === 0 && enemyAp === 0) {
    return '0-0';
  }

  if (ownAp === 2 && enemyAp === 0) {
    return '2-0';
  }

  return getFallbackPolicyKey(ownAp, enemyAp);
}

function getFallbackPolicyKey(ownAp, enemyAp) {
  if (ownAp > 0 && enemyAp === 0) {
    return '1-0';
  }

  if (ownAp === 0 && enemyAp > 0) {
    return '0-1';
  }

  if (ownAp > enemyAp) {
    return '2-1';
  }

  if (ownAp < enemyAp) {
    return '1-2';
  }

  return '1-1';
}

function chooseWeightedLegalMove(ownAp, enemyAp, policy, rng) {
  const legalMoves = getLegalMoves(ownAp, enemyAp);
  const weightedMoves = Object.entries(policy)
    .filter(([moveId, weight]) => legalMoves.includes(moveId) && weight > 0)
    .map(([moveId, weight]) => ({ moveId, weight }));

  if (!weightedMoves.length) {
    return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
  }

  return pickWeightedMove(weightedMoves, rng);
}

function pickWeightedMove(weightedMoves, rng) {
  const totalWeight = weightedMoves.reduce((sum, move) => sum + move.weight, 0);
  let roll = rng() * totalWeight;

  for (const move of weightedMoves) {
    if (roll < move.weight) {
      return move.moveId;
    }

    roll -= move.weight;
  }

  return weightedMoves[weightedMoves.length - 1].moveId;
}
