import { getLegalMoves } from './moves.js';

export const RIVALS = Object.freeze({
  olJoe: Object.freeze({
    id: 'olJoe',
    name: 'Ol Joe',
    buttonDoodle: 'oljoe_button',
    chooseMove: chooseOlJoeMove,
  }),
  mackTheKnife: Object.freeze({
    id: 'mackTheKnife',
    name: 'Mack the Knife',
    buttonDoodle: 'mactheknife_button',
    chooseMove: chooseMackTheKnifeMove,
  }),
  blastinDan: Object.freeze({
    id: 'blastinDan',
    name: 'Blastin Dan',
    buttonDoodle: 'blastindan_button',
    chooseMove: chooseBlastinDanMove,
  }),
  katheyClever: Object.freeze({
    id: 'katheyClever',
    name: 'Kathey Clever',
    buttonDoodle: 'katheyclever_button',
    chooseMove: chooseKatheyCleverMove,
  }),
});

export const DEFAULT_RIVAL_ID = 'olJoe';

const OL_JOE_POLICY = Object.freeze({
  '0-0': Object.freeze({ reload: 100 }),
  '1-1': Object.freeze({ shoot: 45, block: 35, stab: 15, reload: 5, counterstab: 0 }),
  '1-0': Object.freeze({ shoot: 38, stab: 38, reload: 24 }),
  '0-1': Object.freeze({ block: 45, counterstab: 45, reload: 10 }),
  '2-1': Object.freeze({ shoot: 42, block: 24, stab: 18, reload: 16 }),
  '1-2': Object.freeze({ block: 32, counterstab: 28, shoot: 25, stab: 10, reload: 5 }),
});

export function chooseRivalMove(state, rivalId = DEFAULT_RIVAL_ID, rng = Math.random) {
  if (typeof rivalId === 'function') {
    rng = rivalId;
    rivalId = DEFAULT_RIVAL_ID;
  }

  const rival = RIVALS[rivalId] ?? RIVALS[DEFAULT_RIVAL_ID];
  return rival.chooseMove(state, rng);
}

function chooseOlJoeMove(state, rng) {
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;
  return chooseWeightedLegalMove(ownAp, OL_JOE_POLICY[getPolicyKey(ownAp, enemyAp)], rng);
}

function chooseMackTheKnifeMove(state, rng) {
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;

  if (ownAp === 0) {
    return chooseWeightedLegalMove(ownAp, enemyAp > 0
      ? { counterstab: 50, block: 30, reload: 20 }
      : { reload: 100 }, rng);
  }

  return chooseWeightedLegalMove(ownAp, enemyAp > 0
    ? { stab: 50, counterstab: 25, shoot: 15, block: 10 }
    : { stab: 62, shoot: 18, reload: 20 }, rng);
}

function chooseBlastinDanMove(state, rng) {
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;

  if (ownAp === 0) {
    return 'reload';
  }

  return chooseWeightedLegalMove(ownAp, enemyAp > 0
    ? { shoot: 70, block: 15, reload: 10, stab: 5 }
    : { shoot: 72, reload: 18, stab: 10 }, rng);
}

function chooseKatheyCleverMove(state, rng) {
  const ownAp = state.players.p2.ap;
  const enemyAp = state.players.p1.ap;
  const playerLastMove = state.history?.[0]?.p1Move;

  if (enemyAp === 0) {
    return chooseWeightedLegalMove(ownAp, ownAp > 0
      ? { stab: 40, shoot: 30, reload: 30 }
      : { reload: 100 }, rng);
  }

  if (playerLastMove === 'stab') {
    return chooseWeightedLegalMove(ownAp, { counterstab: 55, block: 25, shoot: 15, reload: 5 }, rng);
  }

  if (playerLastMove === 'shoot') {
    return chooseWeightedLegalMove(ownAp, { block: 55, reload: 20, shoot: 15, counterstab: 10 }, rng);
  }

  return chooseWeightedLegalMove(ownAp, ownAp > enemyAp
    ? { shoot: 32, block: 28, counterstab: 25, stab: 10, reload: 5 }
    : { block: 36, counterstab: 34, reload: 15, shoot: 10, stab: 5 }, rng);
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

function chooseWeightedLegalMove(ownAp, policy, rng) {
  const legalMoves = getLegalMoves(ownAp);
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
