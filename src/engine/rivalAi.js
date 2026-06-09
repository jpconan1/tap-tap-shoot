import { getLegalMoves } from './moves.js';

const RIVAL_POLICY = Object.freeze({
  '0-0': Object.freeze({ reload: 100 }),
  '1-1': Object.freeze({ shoot: 45, block: 35, stab: 15, reload: 5, counterstab: 0 }),
  '1-0': Object.freeze({ shoot: 38, stab: 38, reload: 24 }),
  '0-1': Object.freeze({ block: 45, counterstab: 45, reload: 10 }),
  '2-1': Object.freeze({ shoot: 42, block: 24, stab: 18, reload: 16 }),
  '1-2': Object.freeze({ block: 32, counterstab: 28, shoot: 25, stab: 10, reload: 5 }),
});

export function chooseRivalMove(state, rng = Math.random) {
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;
  const legalMoves = getLegalMoves(ownAp);
  const policy = RIVAL_POLICY[getPolicyKey(ownAp, enemyAp)];
  const weightedMoves = Object.entries(policy)
    .filter(([moveId, weight]) => legalMoves.includes(moveId) && weight > 0)
    .map(([moveId, weight]) => ({ moveId, weight }));

  if (!weightedMoves.length) {
    return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
  }

  return pickWeightedMove(weightedMoves, rng);
}

function getPolicyKey(ownAp, enemyAp) {
  if (ownAp === 0 && enemyAp === 0) {
    return '0-0';
  }

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
