export function freezeHitTable(table) {
  return Object.freeze(Object.fromEntries(
    Object.entries(table).map(([moveId, outcomes]) => [moveId, Object.freeze(outcomes)]),
  ));
}

export function resolveHitTableTurn({ variant, p1Move, p2Move, p1Resource, p2Resource }) {
  const p1 = validateChoice(variant, 'p1', p1Move, p1Resource, p2Resource);
  const p2 = validateChoice(variant, 'p2', p2Move, p2Resource, p1Resource);

  if (!p1.ok || !p2.ok) {
    return invalidResult(p1.error, p2.error);
  }

  const p1Hit = variant.hitTable[p1Move]?.[p2Move] ?? null;
  const p2Hit = variant.hitTable[p2Move]?.[p1Move] ?? null;
  const winner = p1Hit && !p2Hit ? 'p1' : p2Hit && !p1Hit ? 'p2' : null;
  const p1ResourceAfter = spendAndGain(variant, p1Resource, p1Move);
  const p2ResourceAfter = spendAndGain(variant, p2Resource, p2Move);

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

export function validateChoice(variant, player, moveId, resource, opponentResource) {
  const move = getMove(variant, moveId);

  if (!move) {
    return { ok: false, error: `${player} picked unknown move: ${moveId}` };
  }

  const forcedMove = getForcedMove(variant, resource, opponentResource);

  if (forcedMove && moveId !== forcedMove) {
    return { ok: false, error: `${player} must ${forcedMove} at 0-0` };
  }

  if (isBlockedByResourceCap(variant, moveId, resource)) {
    return { ok: false, error: `${player} cannot ${moveId} at ${variant.resourceMax}` };
  }

  if (resource < move.cost) {
    return { ok: false, error: `${player} cannot afford ${moveId}` };
  }

  return { ok: true };
}

export function getMove(variant, moveId) {
  return variant.moveIds.includes(moveId) ? variant.moves[moveId] ?? null : null;
}

export function getForcedMove(variant, resource, opponentResource) {
  return variant.forcedMoveAtNoResource
    && resource === 0
    && opponentResource === 0
    ? variant.forcedMoveAtNoResource
    : null;
}

export function isBlockedByResourceCap(variant, moveId, resource) {
  const move = getMove(variant, moveId);
  return Boolean(move) && move.gain > 0 && resource >= variant.resourceMax;
}

export function spendAndGain(variant, resource, moveId) {
  const move = getMove(variant, moveId);
  return Math.min(variant.resourceMax, resource - move.cost + move.gain);
}

export function invalidResult(...errors) {
  return {
    ok: false,
    errors: errors.filter(Boolean),
  };
}

export function turnResult({ variant, p1Move, p2Move, p1Resource, p2Resource, p1Hit, p2Hit, winner }) {
  return {
    ok: true,
    variantId: variant.id,
    p1Move,
    p2Move,
    p1Resource,
    p2Resource,
    resources: {
      p1: p1Resource,
      p2: p2Resource,
    },
    p1Bullets: p1Resource,
    p2Bullets: p2Resource,
    p1Hit,
    p2Hit,
    winner,
    isRoundOver: winner !== null,
    isTie: winner === null,
  };
}
