import {
  DEFAULT_VARIANT_ID,
  doesVariantWinAtResourceMax,
  getForcedMove,
  getMove,
  getVariantHitTable,
  getVariantResourceMax,
  isBlockedByBulletCap,
  normalizeVariantId,
} from './moves.js';

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

  const hitTable = getVariantHitTable(variant);
  const p1Hit = hitTable[p1Move]?.[p2Move] ?? null;
  const p2Hit = hitTable[p2Move]?.[p1Move] ?? null;
  const hitWinner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;
  const p1BulletsAfter = spendAndGain(p1Bullets, p1Move, variant);
  const p2BulletsAfter = spendAndGain(p2Bullets, p2Move, variant);
  const resourceTieBullets = getResourceTieBullets(p1Bullets, p2Bullets, p1BulletsAfter, p2BulletsAfter, variant);
  const resourceWinner = hitWinner
    ? null
    : getResourceWinner(p1Bullets, p2Bullets, p1BulletsAfter, p2BulletsAfter, variant);
  const winner = hitWinner ?? resourceWinner;

  return {
    ok: true,
    p1Move,
    p2Move,
    p1Bullets: resourceTieBullets?.p1 ?? p1BulletsAfter,
    p2Bullets: resourceTieBullets?.p2 ?? p2BulletsAfter,
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

  const forcedMove = getForcedMove(bullets, opponentBullets, variantId);

  if (forcedMove && moveId !== forcedMove) {
    return { ok: false, error: `${player} must ${forcedMove} at 0-0` };
  }

  if (isBlockedByBulletCap(moveId, bullets, variantId)) {
    return { ok: false, error: `${player} cannot ${moveId} at ${getVariantResourceMax(variantId)}` };
  }

  if (bullets < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

function spendAndGain(bullets, moveId, variantId) {
  const move = getMove(moveId, variantId);
  return Math.min(getVariantResourceMax(variantId), bullets - move.cost + move.gain);
}

function getResourceWinner(p1BulletsBefore, p2BulletsBefore, p1BulletsAfter, p2BulletsAfter, variantId) {
  const resourceMax = getVariantResourceMax(variantId);
  const p1ReachedMax = p1BulletsBefore < resourceMax && p1BulletsAfter === resourceMax;
  const p2ReachedMax = p2BulletsBefore < resourceMax && p2BulletsAfter === resourceMax;

  if (!doesVariantWinAtResourceMax(variantId) || resourceMax <= 0 || !p1ReachedMax && !p2ReachedMax) {
    return null;
  }

  if (p1ReachedMax && !p2ReachedMax) {
    return 'p1';
  }

  if (p2ReachedMax && !p1ReachedMax) {
    return 'p2';
  }

  return null;
}

function getResourceTieBullets(p1BulletsBefore, p2BulletsBefore, p1BulletsAfter, p2BulletsAfter, variantId) {
  const resourceMax = getVariantResourceMax(variantId);
  const p1ReachedMax = p1BulletsBefore < resourceMax && p1BulletsAfter === resourceMax;
  const p2ReachedMax = p2BulletsBefore < resourceMax && p2BulletsAfter === resourceMax;

  if (!doesVariantWinAtResourceMax(variantId) || resourceMax <= 0 || !p1ReachedMax || !p2ReachedMax) {
    return null;
  }

  return {
    p1: resourceMax - 1,
    p2: resourceMax - 1,
  };
}
