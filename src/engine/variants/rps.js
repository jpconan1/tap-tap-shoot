import { freezeHitTable, resolveHitTableTurn } from './shared.js';

export function createRpsVariant({ id, moves }) {
  const variant = {
    id,
    label: 'Rock Paper Scissors',
    isRanked: true,
    moveIds: Object.freeze(['rock', 'paper', 'scissors']),
    moves,
    resourceMax: 0,
    startResource: 0,
    hitTable: freezeHitTable({
      rock: { scissors: 'smashed' },
      paper: { rock: 'covered' },
      scissors: { paper: 'cut' },
    }),
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveHitTableTurn({ variant, ...turn }),
  });
}
