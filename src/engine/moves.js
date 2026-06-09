export const MOVES = Object.freeze({
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
    cost: 1,
    gain: 0,
  }),
  block: Object.freeze({
    id: 'block',
    label: 'Dodge',
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

export function getMove(moveId) {
  return MOVES[moveId] ?? null;
}

export function canAfford(moveId, ap) {
  const move = getMove(moveId);
  return Boolean(move) && ap >= move.cost;
}

export function getLegalMoves(ap) {
  return MOVE_IDS.filter((moveId) => canAfford(moveId, ap));
}
