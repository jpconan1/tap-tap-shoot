import { DEFAULT_VARIANT_ID, MAX_AP, getMove, isBlockedByApCap, isForcedReload, normalizeVariantId } from './moves.js';

const HIT_TABLES = Object.freeze({
  counterstab: Object.freeze({
    shoot: Object.freeze({
      stab: 'shot',
      counterstab: 'shot',
      reload: 'shot',
    }),
    stab: Object.freeze({
      block: 'stabbed',
      reload: 'stabbed',
    }),
  }),
  fourMove: Object.freeze({
    shoot: Object.freeze({
      stab: 'shot',
      reload: 'shot',
    }),
    stab: Object.freeze({
      block: 'stabbed',
    }),
  }),
});

export function resolveTurn({ p1Move, p2Move, p1Ap, p2Ap, variantId = DEFAULT_VARIANT_ID }) {
  const variant = normalizeVariantId(variantId);
  const p1 = validateChoice('p1', p1Move, p1Ap, p2Ap, variant);
  const p2 = validateChoice('p2', p2Move, p2Ap, p1Ap, variant);

  if (!p1.ok || !p2.ok) {
    return {
      ok: false,
      errors: [p1.error, p2.error].filter(Boolean),
    };
  }

  const hitTable = HIT_TABLES[variant];
  const p1Hit = hitTable[p1Move]?.[p2Move] ?? null;
  const p2Hit = hitTable[p2Move]?.[p1Move] ?? null;
  const winner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;

  return {
    ok: true,
    p1Move,
    p2Move,
    p1Ap: spendAndGain(p1Ap, p1Move, variant),
    p2Ap: spendAndGain(p2Ap, p2Move, variant),
    p1Hit,
    p2Hit,
    winner,
    isRoundOver: winner !== null,
    isTie: winner === null,
  };
}

function validateChoice(player, moveId, ap, opponentAp, variantId) {
  const move = getMove(moveId, variantId);

  if (!move) {
    return { ok: false, error: `${player} picked unknown move: ${moveId}` };
  }

  if (isForcedReload(ap, opponentAp) && moveId !== 'reload') {
    return { ok: false, error: `${player} must reload at 0-0` };
  }

  if (isBlockedByApCap(moveId, ap)) {
    return { ok: false, error: `${player} cannot reload at ${MAX_AP}` };
  }

  if (ap < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

function spendAndGain(ap, moveId, variantId) {
  const move = getMove(moveId, variantId);
  return Math.min(MAX_AP, ap - move.cost + move.gain);
}
