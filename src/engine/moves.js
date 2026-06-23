export const VARIANT_IDS = Object.freeze({
  counterstab: 'counterstab',
  fourMove: 'fourMove',
});

export const DEFAULT_VARIANT_ID = VARIANT_IDS.counterstab;

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
    cost: 1,
    gain: 0,
  }),
  block: Object.freeze({
    id: 'block',
    label: 'Dodge',
    cost: 0,
    gain: 0,
  }),
  counterstab: Object.freeze({
    id: 'counterstab',
    label: 'Counterstab',
    cost: 0,
    gain: 0,
  }),
});

export const MOVE_IDS = Object.freeze(Object.keys(MOVES));
export const MAX_AP = 4;

export const VARIANTS = Object.freeze({
  [VARIANT_IDS.counterstab]: Object.freeze({
    id: VARIANT_IDS.counterstab,
    isRanked: true,
    moveIds: MOVE_IDS,
    moves: MOVES,
  }),
  [VARIANT_IDS.fourMove]: Object.freeze({
    id: VARIANT_IDS.fourMove,
    isRanked: false,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'block']),
    moves: Object.freeze({
      ...MOVES,
      stab: Object.freeze({
        ...MOVES.stab,
        cost: 0,
      }),
    }),
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

export function canAfford(moveId, ap, variantId = DEFAULT_VARIANT_ID) {
  const move = getMove(moveId, variantId);
  return Boolean(move) && ap >= move.cost;
}

export function getLegalMoves(ap, opponentAp = null, variantId = DEFAULT_VARIANT_ID) {
  if (isForcedReload(ap, opponentAp)) {
    return ['reload'];
  }

  return getVariantMoveIds(variantId)
    .filter((moveId) => canAfford(moveId, ap, variantId) && !isBlockedByApCap(moveId, ap));
}

export function isForcedReload(ap, opponentAp) {
  return ap === 0 && opponentAp === 0;
}

export function isBlockedByApCap(moveId, ap) {
  return moveId === 'reload' && ap >= MAX_AP;
}
