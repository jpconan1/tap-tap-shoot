export const VARIANT_IDS = Object.freeze({
  fourMove: 'fourMove',
});

export const DEFAULT_VARIANT_ID = VARIANT_IDS.fourMove;

export const MOVES = Object.freeze({
  reload: Object.freeze({
    id: 'reload',
    label: 'Reload',
    cost: 0,
    gain: 1,
  }),
  shoot: Object.freeze({
    id: 'shoot',
    label: 'Shoot',
    cost: 1,
    gain: 0,
  }),
  stab: Object.freeze({
    id: 'stab',
    label: 'Stab',
    cost: 0,
    gain: 0,
  }),
  duck: Object.freeze({
    id: 'duck',
    label: 'Duck',
    cost: 0,
    gain: 0,
  }),
});

export const MOVE_IDS = Object.freeze(Object.keys(MOVES));
export const MAX_BULLETS = 4;

export const VARIANTS = Object.freeze({
  [VARIANT_IDS.fourMove]: Object.freeze({
    id: VARIANT_IDS.fourMove,
    isRanked: true,
    moveIds: MOVE_IDS,
    moves: MOVES,
  }),
});

export function normalizeVariantId(variantId) {
  return VARIANTS[variantId]?.id ?? DEFAULT_VARIANT_ID;
}

export function getVariant(variantId = DEFAULT_VARIANT_ID) {
  return VARIANTS[normalizeVariantId(variantId)];
}

export function getVariantMoveIds(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).moveIds;
}

export function getMove(moveId, variantId = DEFAULT_VARIANT_ID) {
  const variant = getVariant(variantId);
  return variant.moveIds.includes(moveId) ? variant.moves[moveId] ?? null : null;
}

export function canAfford(moveId, bullets, variantId = DEFAULT_VARIANT_ID) {
  const move = getMove(moveId, variantId);
  return Boolean(move) && bullets >= move.cost;
}

export function getLegalMoves(bullets, opponentBullets = null, variantId = DEFAULT_VARIANT_ID) {
  if (isForcedReload(bullets, opponentBullets)) {
    return ['reload'];
  }

  return getVariantMoveIds(variantId)
    .filter((moveId) => canAfford(moveId, bullets, variantId) && !isBlockedByBulletCap(moveId, bullets));
}

export function isForcedReload(bullets, opponentBullets) {
  return bullets === 0 && opponentBullets === 0;
}

export function isBlockedByBulletCap(moveId, bullets) {
  return moveId === 'reload' && bullets >= MAX_BULLETS;
}
