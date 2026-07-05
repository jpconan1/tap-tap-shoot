import {
  DEFAULT_VARIANT_ID,
  getVariant,
  normalizeVariantId,
} from './moves.js';

export function resolveTurn({
  p1Move,
  p2Move,
  p1Resource,
  p2Resource,
  p1Bullets,
  p2Bullets,
  variantId = DEFAULT_VARIANT_ID,
}) {
  const variant = getVariant(normalizeVariantId(variantId));

  return variant.resolveTurn({
    p1Move,
    p2Move,
    p1Resource: p1Resource ?? p1Bullets ?? 0,
    p2Resource: p2Resource ?? p2Bullets ?? 0,
  });
}
