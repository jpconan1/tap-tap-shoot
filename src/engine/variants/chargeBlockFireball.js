import {
  freezeHitTable,
  invalidResult,
  spendAndGain,
  turnResult,
  validateChoice,
} from './shared.js';

export function createChargeBlockFireballVariant({ id, moves, maxResource }) {
  const variant = {
    id,
    label: 'Fireball War',
    isRanked: true,
    moveIds: Object.freeze(['charge', 'block', 'fireball']),
    moves,
    resourceMax: maxResource,
    startResource: 1,
    hitTable: freezeHitTable({
      fireball: { charge: 'fireballed' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveChargeBlockFireballTurn(variant, turn),
  });
}

function resolveChargeBlockFireballTurn(variant, { p1Move, p2Move, p1Resource, p2Resource }) {
  const p1 = validateChoice(variant, 'p1', p1Move, p1Resource, p2Resource);
  const p2 = validateChoice(variant, 'p2', p2Move, p2Resource, p1Resource);

  if (!p1.ok || !p2.ok) {
    return invalidResult(p1.error, p2.error);
  }

  const p1Hit = variant.hitTable[p1Move]?.[p2Move] ?? null;
  const p2Hit = variant.hitTable[p2Move]?.[p1Move] ?? null;
  const hitWinner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;
  let p1ResourceAfter = spendAndGain(variant, p1Resource, p1Move);
  let p2ResourceAfter = spendAndGain(variant, p2Resource, p2Move);
  let winner = hitWinner;

  if (!winner) {
    const p1ReachedMax = p1Resource < variant.resourceMax && p1ResourceAfter === variant.resourceMax;
    const p2ReachedMax = p2Resource < variant.resourceMax && p2ResourceAfter === variant.resourceMax;

    if (p1ReachedMax && !p2ReachedMax) {
      winner = 'p1';
    } else if (p2ReachedMax && !p1ReachedMax) {
      winner = 'p2';
    } else if (p1ReachedMax && p2ReachedMax) {
      p1ResourceAfter = variant.resourceMax - 1;
      p2ResourceAfter = variant.resourceMax - 1;
    }
  }

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
