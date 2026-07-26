import { invalidResult } from './shared.js';

const PAIRS = Object.freeze({
  rockPaper: Object.freeze(['rock', 'paper']),
  paperScissors: Object.freeze(['paper', 'scissors']),
  scissorsRock: Object.freeze(['scissors', 'rock']),
});

export function createRpsMinusOneVariant({ id, moves }) {
  const variant = {
    id,
    label: 'RPS Minus One',
    isRanked: false,
    targetRoundWins: 6,
    moveIds: Object.freeze([...Object.keys(PAIRS), 'rock', 'paper', 'scissors']),
    moves,
    resourceMax: 0,
    startResource: 0,
    initialPhase: 'choosePair',
    getLegalMovesFromState(state, playerId) {
      if (state.phase === 'keep') return PAIRS[state.pairs?.[playerId]] ?? [];
      if (state.phase === 'suddenDeath') return ['rock', 'paper', 'scissors'];
      return Object.keys(PAIRS);
    },
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveRpsMinusOneTurn({ variant, ...turn }),
  });
}

function resolveRpsMinusOneTurn({ variant, state, p1Move, p2Move, p1Resource, p2Resource }) {
  const p1Legal = variant.getLegalMovesFromState(state, 'p1');
  const p2Legal = variant.getLegalMovesFromState(state, 'p2');
  if (!p1Legal.includes(p1Move) || !p2Legal.includes(p2Move)) {
    return invalidResult(
      p1Legal.includes(p1Move) ? null : `p1 picked illegal move: ${p1Move}`,
      p2Legal.includes(p2Move) ? null : `p2 picked illegal move: ${p2Move}`,
    );
  }

  if (state.phase === 'choosePair' && p1Move !== p2Move) {
    return result({
      variant, p1Move, p2Move, p1Resource, p2Resource,
      nextPhase: 'keep', pairs: { p1: p1Move, p2: p2Move },
    });
  }

  if (state.phase === 'choosePair') {
    return result({
      variant, p1Move, p2Move, p1Resource, p2Resource,
      isRoundOver: true, scoreAwards: { p1: 1, p2: 1 },
    });
  }

  const winner = getRpsWinner(p1Move, p2Move);
  if (state.phase === 'suddenDeath') {
    return result({
      variant, p1Move, p2Move, p1Resource, p2Resource,
      winner, isRoundOver: Boolean(winner), gameWinner: winner,
      scoreAwards: winner ? { p1: winner === 'p1' ? 1 : 0, p2: winner === 'p2' ? 1 : 0 } : { p1: 0, p2: 0 },
      nextPhase: winner ? null : 'suddenDeath',
    });
  }

  return result({
    variant, p1Move, p2Move, p1Resource, p2Resource,
    winner, isRoundOver: true,
    scoreAwards: winner ? { p1: winner === 'p1' ? 2 : 0, p2: winner === 'p2' ? 2 : 0 } : { p1: 1, p2: 1 },
  });
}

function result({
  variant, p1Move, p2Move, p1Resource, p2Resource, winner = null,
  isRoundOver = false, scoreAwards = { p1: 0, p2: 0 }, nextPhase = null,
  pairs = null, gameWinner = null,
}) {
  return {
    ok: true,
    variantId: variant.id,
    p1Move,
    p2Move,
    p1Resource,
    p2Resource,
    resources: { p1: p1Resource, p2: p2Resource },
    p1Hit: winner === 'p1' ? 'won' : null,
    p2Hit: winner === 'p2' ? 'won' : null,
    winner,
    isRoundOver,
    isTie: !winner,
    scoreAwards,
    nextPhase,
    pairs,
    gameWinner,
  };
}

function getRpsWinner(p1Move, p2Move) {
  if (p1Move === p2Move) return null;
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[p1Move] === p2Move ? 'p1' : 'p2';
}
