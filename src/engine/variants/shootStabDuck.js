import { freezeHitTable, resolveHitTableTurn } from './shared.js';

export function createShootStabDuckVariant({ id, moves, maxResource }) {
  const variant = {
    id,
    label: 'Tap Tap Shoot Y',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck']),
    moves,
    resourceMax: maxResource,
    startResource: 1,
    forcedMoveAtNoResource: 'reload',
    isMoveDisabled: (moveId, resource, opponentResource) => (
      (moveId === 'duck' && resource > 0 && opponentResource === 0)
      || (moveId === 'stab' && resource === 0 && opponentResource > 0)
    ),
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot' },
      stab: { duck: 'stabbed' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveHitTableTurn({ variant, ...turn }),
  });
}
