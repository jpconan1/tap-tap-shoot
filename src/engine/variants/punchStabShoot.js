import {
  freezeHitTable,
  invalidResult,
  turnResult,
  validateChoice,
} from './shared.js';

const DAMAGE_BY_MOVE = Object.freeze({
  punch: 1,
  stab: 2,
  shoot: 3,
});

export function createPunchStabShootVariant({ id, moves, startHealth }) {
  const variantMoves = Object.freeze({
    ...moves,
    shoot: Object.freeze({
      ...moves.shoot,
      cost: 0,
    }),
  });
  const variant = {
    id,
    label: 'Gun Knife Fist',
    isRanked: true,
    moveIds: Object.freeze(['punch', 'stab', 'shoot']),
    moves: variantMoves,
    resourceMax: startHealth,
    startResource: startHealth,
    resourceName: 'health',
    hitTable: freezeHitTable({
      punch: { shoot: 'punched' },
      shoot: { stab: 'shot' },
      stab: { punch: 'stabbed' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolvePunchStabShootTurn(variant, turn),
  });
}

function resolvePunchStabShootTurn(variant, { p1Move, p2Move, p1Resource, p2Resource }) {
  const p1 = validateChoice(variant, 'p1', p1Move, p1Resource, p2Resource);
  const p2 = validateChoice(variant, 'p2', p2Move, p2Resource, p1Resource);

  if (!p1.ok || !p2.ok) {
    return invalidResult(p1.error, p2.error);
  }

  const p1Hit = variant.hitTable[p1Move]?.[p2Move] ?? null;
  const p2Hit = variant.hitTable[p2Move]?.[p1Move] ?? null;
  const hitWinner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;
  let p1ResourceAfter = p1Resource;
  let p2ResourceAfter = p2Resource;

  if (hitWinner === 'p1') {
    p2ResourceAfter = Math.max(0, p2ResourceAfter - (DAMAGE_BY_MOVE[p1Move] ?? 0));
  } else if (hitWinner === 'p2') {
    p1ResourceAfter = Math.max(0, p1ResourceAfter - (DAMAGE_BY_MOVE[p2Move] ?? 0));
  }

  const winner = p2ResourceAfter <= 0 ? 'p1' : p1ResourceAfter <= 0 ? 'p2' : null;

  return turnResult({
    variant,
    p1Move,
    p2Move,
    p1Resource: p1ResourceAfter,
    p2Resource: p2ResourceAfter,
    p1Hit,
    p2Hit,
    winner,
  });
}
