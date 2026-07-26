import { getForcedMove as getVariantForcedMove, getMove as getVariantMove, isBlockedByResourceCap } from './variants/shared.js';
import { createFireballWarVariant } from './variants/fireballWar.js';
import { createGunKnifeFistVariant } from './variants/gunKnifeFist.js';
import { createRockPaperScissorsVariant } from './variants/rockPaperScissors.js';
import { createRpsDragonSpearVariant } from './variants/rpsDragonSpear.js';
import { createRpsMinusOneVariant } from './variants/rpsMinusOne.js';
import { createKitchenSinkVariant } from './variants/kitchenSink.js';
import { createRpsRpgVariant } from './variants/rpsRpg.js';
import { createRpsPokerVariant } from './variants/rpsPoker.js';
import { createTapTapShootYVariant } from './variants/tapTapShootY.js';
import { createTapTapShootXVariant } from './variants/tapTapShootX.js';

export const VARIANT_IDS = Object.freeze({
  rockPaperScissors: 'rockPaperScissors',
  fireballWar: 'fireballWar',
  tapTapShootY: 'tapTapShootY',
  gunKnifeFist: 'gunKnifeFist',
  tapTapShootX: 'tapTapShootX',
  rpsDragonSpear: 'rpsDragonSpear',
  rpsMinusOne: 'rpsMinusOne',
  kitchenSink: 'kitchenSink',
  rpsRpg: 'rpsRpg',
  rpsPoker: 'rpsPoker',
});

export const DEFAULT_VARIANT_ID = VARIANT_IDS.tapTapShootY;
export const LEGACY_VARIANT_IDS = Object.freeze({
  fourMove: DEFAULT_VARIANT_ID,
  counterstab: VARIANT_IDS.tapTapShootX,
  rps: VARIANT_IDS.rockPaperScissors,
  chargeBlockFireball: VARIANT_IDS.fireballWar,
  shootStabDuck: VARIANT_IDS.tapTapShootY,
  punchStabShoot: VARIANT_IDS.gunKnifeFist,
  tapTapShoot: VARIANT_IDS.tapTapShootX,
  'rock-paper-scissors': VARIANT_IDS.rockPaperScissors,
  'charge-block-fireball': VARIANT_IDS.fireballWar,
  'fireball-war': VARIANT_IDS.fireballWar,
  'shoot-stab-duck': VARIANT_IDS.tapTapShootY,
  'tap-tap-shoot-y': VARIANT_IDS.tapTapShootY,
  'punch-stab-shoot': VARIANT_IDS.gunKnifeFist,
  'gun-knife-fist': VARIANT_IDS.gunKnifeFist,
  'tap-tap-shoot': VARIANT_IDS.tapTapShootX,
  'tap-tap-shoot-x': VARIANT_IDS.tapTapShootX,
  'rps-dragon-spear': VARIANT_IDS.rpsDragonSpear,
  'rps-minus-one': VARIANT_IDS.rpsMinusOne,
  'kitchen-sink': VARIANT_IDS.kitchenSink,
  'rps-rpg': VARIANT_IDS.rpsRpg,
  'rps-poker': VARIANT_IDS.rpsPoker,
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
  dragon: Object.freeze({
    id: 'dragon',
    label: 'Dragon',
    cost: 0,
    gain: 0,
  }),
  spear: Object.freeze({
    id: 'spear',
    label: 'Spear',
    cost: 0,
    gain: 0,
  }),
  rockPaper: Object.freeze({ id: 'rockPaper', label: 'Rock + Paper', cost: 0, gain: 0 }),
  paperScissors: Object.freeze({ id: 'paperScissors', label: 'Paper + Scissors', cost: 0, gain: 0 }),
  scissorsRock: Object.freeze({ id: 'scissorsRock', label: 'Scissors + Rock', cost: 0, gain: 0 }),
  strike: Object.freeze({ id: 'strike', label: 'Strike', cost: 0, gain: 0 }),
  advance: Object.freeze({ id: 'advance', label: 'Advance', cost: 0, gain: 0 }),
  bait: Object.freeze({ id: 'bait', label: 'Bait', cost: 0, gain: 0 }),
  super: Object.freeze({ id: 'super', label: 'Super', cost: 0, gain: 0 }),
  poweredStrike: Object.freeze({ id: 'poweredStrike', label: 'Powered Strike', cost: 0, gain: 0 }),
  reversal: Object.freeze({ id: 'reversal', label: 'Reversal', cost: 0, gain: 0 }),
  wait: Object.freeze({ id: 'wait', label: 'Wait', cost: 0, gain: 0 }),
  str: Object.freeze({ id: 'str', label: 'STR', cost: 0, gain: 0 }),
  int: Object.freeze({ id: 'int', label: 'INT', cost: 0, gain: 0 }),
  dex: Object.freeze({ id: 'dex', label: 'DEX', cost: 0, gain: 0 }),
  sword: Object.freeze({ id: 'sword', label: 'Sword', cost: 0, gain: 0 }),
  staff: Object.freeze({ id: 'staff', label: 'Staff', cost: 0, gain: 0 }),
  bow: Object.freeze({ id: 'bow', label: 'Bow', cost: 0, gain: 0 }),
  check: Object.freeze({ id: 'check', label: 'Check', cost: 0, gain: 0 }),
  bet: Object.freeze({ id: 'bet', label: 'Bet', cost: 0, gain: 0 }),
  fold: Object.freeze({ id: 'fold', label: 'Fold', cost: 0, gain: 0 }),
  call: Object.freeze({ id: 'call', label: 'Call', cost: 0, gain: 0 }),
  raise: Object.freeze({ id: 'raise', label: 'Raise', cost: 0, gain: 0 }),
});

export const MOVE_IDS = Object.freeze(Object.keys(MOVES));
export const MAX_BULLETS = 3;
export const MAX_RESOURCE = MAX_BULLETS;
export const DEFAULT_TARGET_ROUND_WINS = 3;
export const VARIANT_ORDER = Object.freeze([
  VARIANT_IDS.rockPaperScissors,
  VARIANT_IDS.fireballWar,
  VARIANT_IDS.tapTapShootY,
  VARIANT_IDS.gunKnifeFist,
  VARIANT_IDS.tapTapShootX,
]);

const HEALTH_START = 3;

export const VARIANTS = Object.freeze({
  [VARIANT_IDS.rockPaperScissors]: createRockPaperScissorsVariant({ id: VARIANT_IDS.rockPaperScissors, moves: MOVES }),
  [VARIANT_IDS.fireballWar]: createFireballWarVariant({
    id: VARIANT_IDS.fireballWar,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
  }),
  [VARIANT_IDS.tapTapShootY]: createTapTapShootYVariant({
    id: VARIANT_IDS.tapTapShootY,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
  }),
  [VARIANT_IDS.gunKnifeFist]: createGunKnifeFistVariant({
    id: VARIANT_IDS.gunKnifeFist,
    moves: MOVES,
    startHealth: HEALTH_START,
  }),
  [VARIANT_IDS.tapTapShootX]: createTapTapShootXVariant({
    id: VARIANT_IDS.tapTapShootX,
    moves: MOVES,
    maxResource: MAX_RESOURCE,
  }),
  [VARIANT_IDS.rpsDragonSpear]: createRpsDragonSpearVariant({
    id: VARIANT_IDS.rpsDragonSpear,
    moves: MOVES,
  }),
  [VARIANT_IDS.rpsMinusOne]: createRpsMinusOneVariant({
    id: VARIANT_IDS.rpsMinusOne,
    moves: MOVES,
  }),
  [VARIANT_IDS.kitchenSink]: createKitchenSinkVariant({
    id: VARIANT_IDS.kitchenSink,
    moves: MOVES,
  }),
  [VARIANT_IDS.rpsRpg]: createRpsRpgVariant({
    id: VARIANT_IDS.rpsRpg,
    moves: MOVES,
  }),
  [VARIANT_IDS.rpsPoker]: createRpsPokerVariant({
    id: VARIANT_IDS.rpsPoker,
    moves: MOVES,
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

export function getVariantTargetRoundWins(variantId = DEFAULT_VARIANT_ID) {
  return getVariant(variantId).targetRoundWins ?? DEFAULT_TARGET_ROUND_WINS;
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
    .filter((moveId) => (
      canAfford(moveId, resource, variantId)
      && !isBlockedByResourceCap(getVariant(variantId), moveId, resource)
      && !getVariant(variantId).isMoveDisabled?.(moveId, resource, opponentResource)
    ));
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
