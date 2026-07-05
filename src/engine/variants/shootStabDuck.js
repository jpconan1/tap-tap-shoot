import { freezeHitTable, resolveHitTableTurn } from './shared.js';

export function createShootStabDuckVariant({ id, moves, maxResource }) {
  const variant = {
    id,
    label: 'Shoot Stab Duck',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck']),
    moves,
    resourceMax: maxResource,
    startResource: 1,
    forcedMoveAtNoResource: 'reload',
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
