import { VARIANT_IDS, getLegalMoves, normalizeVariantId } from './moves.js';
import { getPlayerLegalMoves, getPlayerResource } from './gameState.js';
import tapTapShootXPolicy from './tap_tap_shoot_policy.json' with { type: 'json' };

export const RIVAL_DIFFICULTIES = Object.freeze({
  easy: 'easy',
  hard: 'hard',
});

const HARD_VARIANT_POLICIES = Object.freeze({
  [VARIANT_IDS.tapTapShootY]: getTapTapShootPolicy('Tap Tap Shoot Y'),
  [VARIANT_IDS.tapTapShootX]: getTapTapShootPolicy('Tap Tap Shoot X'),
  [VARIANT_IDS.fireballWar]: freezePolicyTable({
    '0-1': { charge: 65, fireball: 35 },
    '0-2': { charge: 100 },
    '1-0': { charge: 65, block: 35 },
    '1-1': { charge: 31, block: 47, fireball: 22 },
    '1-2': { charge: 22, block: 53, fireball: 25 },
    '2-0': { charge: 50, block: 50 },
    '2-1': { charge: 30, block: 44, fireball: 26 },
    '2-2': { charge: 19, block: 40, fireball: 40 },
  }),
  [VARIANT_IDS.gunKnifeFist]: freezePolicyTable({
    '1-1': { punch: 33, stab: 33, shoot: 33 },
    '1-2': { punch: 30, stab: 18, shoot: 52 },
    '1-3': { punch: 44, stab: 16, shoot: 40 },
    '2-1': { punch: 52, stab: 18, shoot: 30 },
    '2-2': { punch: 44, stab: 11, shoot: 44 },
    '2-3': { punch: 55, stab: 11, shoot: 35 },
    '3-1': { punch: 57, stab: 23, shoot: 20 },
    '3-2': { punch: 52, stab: 16, shoot: 32 },
    '3-3': { punch: 59, stab: 14, shoot: 28 },
  }),
});

export function chooseRivalMove(state, rng = Math.random, difficulty = RIVAL_DIFFICULTIES.hard) {
  const ownResource = getPlayerResource(state.players.p2);
  const enemyResource = getPlayerResource(state.players.p1);
  const variantId = normalizeVariantId(state.variantId);
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const stateLegalMoves = getPlayerLegalMoves(state, 'p2', variantId);

  if (normalizedDifficulty === RIVAL_DIFFICULTIES.easy || variantId === VARIANT_IDS.rockPaperScissors) {
    return chooseRandomMove(stateLegalMoves, rng);
  }

  const hardPolicy = getHardVariantPolicy(enemyResource, ownResource, variantId);
  if (hardPolicy) {
    return chooseWeightedLegalMove(ownResource, enemyResource, hardPolicy, rng, variantId);
  }

  return chooseRandomMove(stateLegalMoves, rng);
}

function normalizeDifficulty(difficulty) {
  return difficulty === RIVAL_DIFFICULTIES.easy ? RIVAL_DIFFICULTIES.easy : RIVAL_DIFFICULTIES.hard;
}

function getHardVariantPolicy(enemyResource, ownResource, variantId) {
  return HARD_VARIANT_POLICIES[variantId]?.[`${enemyResource}-${ownResource}`] ?? null;
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

function chooseRandomLegalMove(ownBullets, enemyBullets, rng, variantId) {
  const legalMoves = getLegalMoves(ownBullets, enemyBullets, variantId);
  return chooseRandomMove(legalMoves, rng);
}

function chooseRandomMove(legalMoves, rng) {
  return legalMoves[Math.min(Math.floor(rng() * legalMoves.length), legalMoves.length - 1)];
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

function freezePolicyTable(table) {
  return Object.freeze(Object.fromEntries(
    Object.entries(table).map(([key, policy]) => [key, Object.freeze(policy)]),
  ));
}

function getTapTapShootPolicy(variantName) {
  const policy = tapTapShootXPolicy.find(({ variant }) => variant === variantName);

  if (!policy) {
    throw new Error(`Missing rival policy for ${variantName}`);
  }

  return freezePolicyTable(Object.fromEntries(
    Object.entries(policy.states).map(([state, analysis]) => [
      state.replace(',', '-'),
      analysis.opponent_mix,
    ]),
  ));
}
