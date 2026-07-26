import { invalidResult, turnResult, validateChoice } from './shared.js';

export function createRpsDragonSpearVariant({ id, moves }) {
  const variant = {
    id,
    label: 'RPS Dragon Spear',
    isRanked: false,
    targetRoundWins: 5,
    moveIds: Object.freeze(['dragon', 'rock', 'paper', 'scissors', 'spear']),
    moves,
    resourceMax: 1,
    startResource: 1,
    persistResourceBetweenRounds: true,
    isMoveDisabled: (moveId, resource) => moveId === 'dragon' && resource === 0,
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveRpsDragonSpearTurn({ variant, ...turn }),
  });
}

function resolveRpsDragonSpearTurn({ variant, p1Move, p2Move, p1Resource, p2Resource }) {
  const p1 = validateChoice(variant, 'p1', p1Move, p1Resource, p2Resource);
  const p2 = validateChoice(variant, 'p2', p2Move, p2Resource, p1Resource);
  if (!p1.ok || !p2.ok) return invalidResult(p1.error, p2.error);

  const winner = getWinner(p1Move, p2Move);
  const p1ResourceAfter = winner === 'p2' && p1Move === 'dragon' ? 0 : p1Resource;
  const p2ResourceAfter = winner === 'p1' && p2Move === 'dragon' ? 0 : p2Resource;

  return turnResult({
    variant,
    p1Move,
    p2Move,
    p1Resource: p1ResourceAfter,
    p2Resource: p2ResourceAfter,
    p1Hit: winner === 'p1' ? getHit(p1Move, p2Move) : null,
    p2Hit: winner === 'p2' ? getHit(p2Move, p1Move) : null,
    winner,
  });
}

function getWinner(p1Move, p2Move) {
  if (p1Move === p2Move) return null;
  if (p1Move === 'dragon' || p2Move === 'dragon') {
    if (p1Move === 'spear' || p2Move === 'spear') return p1Move === 'spear' ? 'p1' : 'p2';
    return p1Move === 'dragon' ? 'p1' : 'p2';
  }
  if (p1Move === 'spear' || p2Move === 'spear') return p1Move === 'spear' ? 'p2' : 'p1';

  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[p1Move] === p2Move ? 'p1' : 'p2';
}

function getHit(winnerMove, loserMove) {
  if (winnerMove === 'spear') return 'speared';
  if (winnerMove === 'dragon') return 'dragon';
  if (loserMove === 'spear') return 'deflected';
  return { rock: 'smashed', paper: 'covered', scissors: 'cut' }[winnerMove];
}
