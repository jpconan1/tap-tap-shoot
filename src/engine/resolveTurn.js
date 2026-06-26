import { DEFAULT_VARIANT_ID, MAX_BULLETS, getMove, isBlockedByBulletCap, isForcedReload, normalizeVariantId } from './moves.js';

const HIT_TABLE = Object.freeze({
  shoot: Object.freeze({
    stab: 'shot',
    reload: 'shot',
  }),
  stab: Object.freeze({
    duck: 'stabbed',
  }),
});

export function resolveTurn({ p1Move, p2Move, p1Bullets, p2Bullets, variantId = DEFAULT_VARIANT_ID }) {
  const variant = normalizeVariantId(variantId);
  const p1 = validateChoice('p1', p1Move, p1Bullets, p2Bullets, variant);
  const p2 = validateChoice('p2', p2Move, p2Bullets, p1Bullets, variant);

  if (!p1.ok || !p2.ok) {
    return {
      ok: false,
      errors: [p1.error, p2.error].filter(Boolean),
    };
  }

  const p1Hit = HIT_TABLE[p1Move]?.[p2Move] ?? null;
  const p2Hit = HIT_TABLE[p2Move]?.[p1Move] ?? null;
  const winner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;

  return {
    ok: true,
    p1Move,
    p2Move,
    p1Bullets: spendAndGain(p1Bullets, p1Move, variant),
    p2Bullets: spendAndGain(p2Bullets, p2Move, variant),
    p1Hit,
    p2Hit,
    winner,
    isRoundOver: winner !== null,
    isTie: winner === null,
  };
}

function validateChoice(player, moveId, bullets, opponentBullets, variantId) {
  const move = getMove(moveId, variantId);

  if (!move) {
    return { ok: false, error: `${player} picked unknown move: ${moveId}` };
  }

  if (isForcedReload(bullets, opponentBullets) && moveId !== 'reload') {
    return { ok: false, error: `${player} must reload at 0-0` };
  }

  if (isBlockedByBulletCap(moveId, bullets)) {
    return { ok: false, error: `${player} cannot reload at ${MAX_BULLETS}` };
  }

  if (bullets < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

function spendAndGain(bullets, moveId, variantId) {
  const move = getMove(moveId, variantId);
  return Math.min(MAX_BULLETS, bullets - move.cost + move.gain);
}
