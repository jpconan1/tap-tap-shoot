import { getForcedMove as getVariantForcedMove, getMove as getVariantMove, isBlockedByResourceCap } from './variants/shared.js';
import { createChargeBlockFireballVariant } from './variants/chargeBlockFireball.js';
import { createPunchStabShootVariant } from './variants/punchStabShoot.js';
import { createRpsVariant } from './variants/rps.js';
import { createShootStabDuckVariant } from './variants/shootStabDuck.js';
import { createTapTapShootVariant } from './variants/tapTapShoot.js';

export const VARIANT_IDS = Object.freeze({
  rps: 'rps',
  chargeBlockFireball: 'chargeBlockFireball',
  shootStabDuck: 'shootStabDuck',
  punchStabShoot: 'punchStabShoot',
  tapTapShoot: 'tapTapShoot',
});

export const DEFAULT_VARIANT_ID = VARIANT_IDS.shootStabDuck;
export const LEGACY_VARIANT_IDS = Object.freeze({
  fourMove: DEFAULT_VARIANT_ID,
  counterstab: VARIANT_IDS.tapTapShoot,
  'rock-paper-scissors': VARIANT_IDS.rps,
  'charge-block-fireball': VARIANT_IDS.chargeBlockFireball,
  'shoot-stab-duck': VARIANT_IDS.shootStabDuck,
  'punch-stab-shoot': VARIANT_IDS.punchStabShoot,
  'tap-tap-shoot': VARIANT_IDS.tapTapShoot,
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
  punch: Object.freeze({
    id: 'punch',
    label: 'Punch',
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
});

export const MOVE_IDS = Object.freeze(Object.keys(MOVES));
export const MAX_BULLETS = 3;
export const MAX_RESOURCE = MAX_BULLETS;
export const VARIANT_ORDER = Object.freeze([
  VARIANT_IDS.rps,
  VARIANT_IDS.chargeBlockFireball,
  VARIANT_IDS.shootStabDuck,
  VARIANT_IDS.punchStabShoot,
  VARIANT_IDS.tapTapShoot,
]);

const HEALTH_START = 3;

export const VARIANTS = Object.freeze({
  [VARIANT_IDS.rps]: createRpsVariant({ id: VARIANT_IDS.rps, moves: MOVES }),
  [VARIANT_IDS.chargeBlockFireball]: createChargeBlockFireballVariant({
    id: VARIANT_IDS.chargeBlockFireball,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
  }),
  [VARIANT_IDS.shootStabDuck]: createShootStabDuckVariant({
    id: VARIANT_IDS.shootStabDuck,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
  }),
  [VARIANT_IDS.punchStabShoot]: createPunchStabShootVariant({
    id: VARIANT_IDS.punchStabShoot,
    moves: MOVES,
    startHealth: HEALTH_START,
  }),
  [VARIANT_IDS.tapTapShoot]: createTapTapShootVariant({
    id: VARIANT_IDS.tapTapShoot,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
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
  return getVariantMove(getVariant(variantId), moveId);
}

export function canAfford(moveId, resource, variantId = DEFAULT_VARIANT_ID) {
  const move = getMove(moveId, variantId);
  return Boolean(move) && resource >= move.cost;
}

export function getLegalMoves(resource, opponentResource = null, variantId = DEFAULT_VARIANT_ID) {
  const forcedMove = getForcedMove(resource, opponentResource, variantId);

  if (forcedMove) {
    return [forcedMove];
  }

  return getVariantMoveIds(variantId)
    .filter((moveId) => canAfford(moveId, resource, variantId) && !isBlockedByResourceCap(getVariant(variantId), moveId, resource));
}

export function getForcedMove(resource, opponentResource, variantId = DEFAULT_VARIANT_ID) {
  return getVariantForcedMove(getVariant(variantId), resource, opponentResource);
}

export function isForcedReload(resource, opponentResource, variantId = DEFAULT_VARIANT_ID) {
  return getForcedMove(resource, opponentResource, variantId) === 'reload';
}

export function isBlockedByBulletCap(moveId, resource, variantId = DEFAULT_VARIANT_ID) {
  return isBlockedByResourceCap(getVariant(variantId), moveId, resource);
}

export function isBlockedByResourceCapForMove(moveId, resource, variantId = DEFAULT_VARIANT_ID) {
  return isBlockedByResourceCap(getVariant(variantId), moveId, resource);
}
