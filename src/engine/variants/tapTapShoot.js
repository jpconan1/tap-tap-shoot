import { freezeHitTable, resolveHitTableTurn } from './shared.js';

export function createTapTapShootVariant({ id, moves, maxResource }) {
  const variantMoves = Object.freeze({
    ...moves,
    stab: Object.freeze({
      ...moves.stab,
      cost: 1,
    }),
  });
  const variant = {
    id,
    label: 'Tap Tap Shoot X',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck', 'counterstab']),
    moves: variantMoves,
    resourceMax: maxResource,
    startResource: 1,
    forcedMoveAtNoResource: 'reload',
    isMoveDisabled: (moveId, _resource, opponentResource) => (
      opponentResource === 0 && (moveId === 'duck' || moveId === 'counterstab')
    ),
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot', counterstab: 'shot' },
      stab: { duck: 'stabbed', reload: 'stabbed' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveHitTableTurn({ variant, ...turn }),
  });
}
