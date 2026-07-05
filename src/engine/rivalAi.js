import { VARIANT_IDS, getLegalMoves, normalizeVariantId } from './moves.js';
import { RIVAL_CONFIG } from './rivalConfig.js';

export const RIVALS = RIVAL_CONFIG.rivals;
export const DEFAULT_RIVAL_ID = RIVAL_CONFIG.defaultRivalId;

export function chooseRivalMove(state, rivalId = DEFAULT_RIVAL_ID, rng = Math.random) {
  if (typeof rivalId === 'function') {
    rng = rivalId;
    rivalId = DEFAULT_RIVAL_ID;
  }

  const rival = RIVALS[rivalId] ?? RIVALS[DEFAULT_RIVAL_ID];
  const ownBullets = state.players.p2.bullets;
  const enemyBullets = state.players.p1.bullets;
  const variantId = state.variantId;
  const policyKey = getPolicyKey(ownBullets, enemyBullets);
  const fallbackPolicyKey = getFallbackPolicyKey(ownBullets, enemyBullets);
  const policy = rival.matchups[policyKey]
    ?? rival.matchups[fallbackPolicyKey]
    ?? RIVALS[DEFAULT_RIVAL_ID].matchups[fallbackPolicyKey];

  return chooseWeightedLegalMove(ownBullets, enemyBullets, getVariantPolicy(policy, variantId), rng, variantId);
}

function getVariantPolicy(policy, variantId) {
  if (normalizeVariantId(variantId) !== VARIANT_IDS.chargeBlockFireball) {
    return policy;
  }

  return {
    charge: policy.reload ?? 0,
    block: (policy.duck ?? 0) + (policy.stab ?? 0),
    fireball: policy.shoot ?? 0,
  };
}

function getPolicyKey(ownBullets, enemyBullets) {
  if (ownBullets === 0 && enemyBullets === 0) {
    return '0-0';
  }

  if (ownBullets === 2 && enemyBullets === 0) {
    return '2-0';
  }

  return getFallbackPolicyKey(ownBullets, enemyBullets);
}

function getFallbackPolicyKey(ownBullets, enemyBullets) {
  if (ownBullets > 0 && enemyBullets === 0) {
    return '1-0';
  }

  if (ownBullets === 0 && enemyBullets > 0) {
    return '0-1';
  }

  if (ownBullets > enemyBullets) {
    return '2-1';
  }

  if (ownBullets < enemyBullets) {
    return '1-2';
  }

  return '1-1';
}

function chooseWeightedLegalMove(ownBullets, enemyBullets, policy, rng, variantId) {
  const legalMoves = getLegalMoves(ownBullets, enemyBullets, variantId);
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
