import { freezeHitTable, resolveHitTableTurn } from './shared.js';

export function createTapTapShootVariant({ id, moves, maxResource }) {
  const variant = {
    id,
    label: 'Tap Tap Shoot',
    isRanked: true,
    moveIds: Object.freeze(['reload', 'shoot', 'stab', 'duck', 'counterstab']),
    moves,
    resourceMax: maxResource,
    startResource: 1,
    forcedMoveAtNoResource: 'reload',
    hitTable: freezeHitTable({
      shoot: { stab: 'shot', reload: 'shot', counterstab: 'shot' },
      stab: { duck: 'stabbed' },
      counterstab: { stab: 'counterstabbed' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveHitTableTurn({ variant, ...turn }),
  });
}
