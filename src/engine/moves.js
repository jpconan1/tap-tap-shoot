export const VARIANT_IDS = Object.freeze({
  rps: 'rps',
  chargeBlockFireball: 'chargeBlockFireball',
  shootStabDuck: 'shootStabDuck',
  tapTapShoot: 'tapTapShoot',
  doubleTap: 'doubleTap',
});

export const DEFAULT_VARIANT_ID = VARIANT_IDS.shootStabDuck;
export const LEGACY_VARIANT_IDS = Object.freeze({
  fourMove: DEFAULT_VARIANT_ID,
  counterstab: VARIANT_IDS.tapTapShoot,
});

export const MOVES = Object.freeze({
  rock: Object.freeze({
    id: 'rock',
    label: 'Rock',
    cost: 0,
    gain: 0,
  }),
  paper: Object.freeze({
    id: 'paper',
    label: 'Paper',
    cost: 0,
    gain: 0,
  }),
  scissors: Object.freeze({
    id: 'scissors',
    label: 'Scissors',
    cost: 0,
    gain: 0,
  }),
  charge: Object.freeze({
    id: 'charge',
    label: 'Charge',
    cost: 0,
    gain: 1,
  }),
  block: Object.freeze({
    id: 'block',
    label: 'Block',
    cost: 0,
    gain: 0,
  }),
  fireball: Object.freeze({
    id: 'fireball',
    label: 'Fireball',
    cost: 1,
    gain: 0,
  }),
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
  counterstab: Object.freeze({
    id: 'counterstab',
    label: 'Counterstab',
    cost: 0,
    gain: 0,
  }),
  doubletap: Object.freeze({
    id: 'doubletap',
    label: 'Double Tap',
    cost: 2,
    gain: 0,
  }),
});

export const MOVE_IDS = Object.freeze(Object.keys(MOVES));
export const MAX_BULLETS = 3;
export const VARIANT_ORDER = Object.freeze([
  VARIANT_IDS.rps,
  VARIANT_IDS.chargeBlockFireball,
  VARIANT_IDS.shootStabDuck,
  VARIANT_IDS.tapTapShoot,
  VARIANT_IDS.doubleTap,
]);

const NO_RESOURCE_MAX = 0;
const AMMO_START = 1;

export const VARIANTS = Object.freeze({
  [VARIANT_IDS.rps]: Object.freeze({
    id: VARIANT_IDS.rps,
    label: 'Rock Paper Scissors',
    isRanked: true,
    moveIds: Object.freeze(['rock', 'paper', 'scissors']),
    moves: MOVES,
    resourceMax: NO_RESOURCE_MAX,
    startResource: 0,
    hitTable: freezeHitTable({
      rock: { scissors: 'smashed' },
      paper: { rock: 'covered' },
      scissors: { paper: 'cut' },
    }),
  }),
  [VARIANT_IDS.chargeBlockFireball]: Object.freeze({
    id: VARIANT_IDS.chargeBlockFireball,
    label: 'Charge Block Fireball',
    isRanked: true,
    moveIds: Object.freeze(['charge', 'block', 'fireball']),
    moves: MOVES,
    resourceMax: MAX_BULLETS,
    startResource: 0,
    forcedMoveAtNoResource: 'charge',
    hitTable: freezeHitTable({
      fireball: { charge: 'fireballed' },
    }),
  }),
  [VARIANT_IDS.shootStabDuck]: Object.freeze({
    id: VARIANT_IDS.shootStabDuck,
    label: 'Shoot Stab Duck',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck']),
    moves: MOVES,
    resourceMax: MAX_BULLETS,
    startResource: AMMO_START,
    forcedMoveAtNoResource: 'reload',
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot' },
      stab: { duck: 'stabbed' },
    }),
  }),
  [VARIANT_IDS.tapTapShoot]: Object.freeze({
    id: VARIANT_IDS.tapTapShoot,
    label: 'Tap Tap Shoot',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck', 'counterstab']),
    moves: MOVES,
    resourceMax: MAX_BULLETS,
    startResource: AMMO_START,
    forcedMoveAtNoResource: 'reload',
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot', counterstab: 'shot' },
      stab: { duck: 'stabbed' },
      counterstab: { stab: 'counterstabbed' },
    }),
  }),
  [VARIANT_IDS.doubleTap]: Object.freeze({
    id: VARIANT_IDS.doubleTap,
    label: 'Double Tap',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'doubletap', 'stab', 'duck']),
    moves: MOVES,
    resourceMax: MAX_BULLETS,
    startResource: AMMO_START,
    forcedMoveAtNoResource: 'reload',
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot', doubletap: 'shot' },
      doubletap: { duck: 'doubletapped', reload: 'doubletapped' },
      stab: { duck: 'stabbed' },
    }),
  }),
});

export function normalizeVariantId(variantId) {
  return VARIANTS[variantId]?.id ?? LEGACY_VARIANT_IDS[variantId] ?? DEFAULT_VARIANT_ID;
}

export function getVariant(variantId = DEFAULT_VARIANT_ID) {
  return VARIANTS[normalizeVariantId(variantId)];
}

export function getVariantMoveIds(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).moveIds;
}

export function getVariantLabel(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).label;
}

export function getVariantResourceMax(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).resourceMax;
}

export function getVariantStartResource(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).startResource;
}

export function getVariantHitTable(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).hitTable;
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
  const forcedMove = getForcedMove(bullets, opponentBullets, variantId);

  if (forcedMove) {
    return [forcedMove];
  }

  return getVariantMoveIds(variantId)
    .filter((moveId) => canAfford(moveId, bullets, variantId) && !isBlockedByBulletCap(moveId, bullets, variantId));
}

export function getForcedMove(bullets, opponentBullets, variantId = DEFAULT_VARIANT_ID) {
  const variant = getVariant(variantId);
  return variant.forcedMoveAtNoResource
    && bullets === 0
    && opponentBullets === 0
    ? variant.forcedMoveAtNoResource
    : null;
}

export function isForcedReload(bullets, opponentBullets, variantId = DEFAULT_VARIANT_ID) {
  return getForcedMove(bullets, opponentBullets, variantId) === 'reload';
}

export function isBlockedByBulletCap(moveId, bullets, variantId = DEFAULT_VARIANT_ID) {
  const move = getMove(moveId, variantId);
  const resourceMax = getVariantResourceMax(variantId);
  return Boolean(move) && move.gain > 0 && bullets >= resourceMax;
}

function freezeHitTable(table) {
  return Object.freeze(Object.fromEntries(
    Object.entries(table).map(([moveId, outcomes]) => [moveId, Object.freeze(outcomes)]),
  ));
}
