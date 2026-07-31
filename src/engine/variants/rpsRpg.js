const MOVE_STATS = Object.freeze({ sword: 'str', staff: 'int', bow: 'dex' });

export function createRpsRpgVariant({ id, moves }) {
  const variant = {
    id,
    label: 'RPS RPG',
    isRanked: true,
    targetRoundWins: 4,
    moveIds: Object.freeze(['str', 'int', 'dex', 'sword', 'staff', 'bow']),
    moves,
    resourceMax: 0,
    startResource: 0,
    initialPhase: 'level',
    persistRoundData: Object.freeze(['stats', 'rpgScores']),
    createRoundData: () => ({
      stats: {
        p1: { str: 1, int: 1, dex: 1 },
        p2: { str: 1, int: 1, dex: 1 },
      },
      rpgScores: { p1: 0, p2: 0 },
    }),
    getLegalMovesFromState: (state) => (
      state.phase === 'level' ? ['str', 'int', 'dex'] : ['sword', 'staff', 'bow']
    ),
    getTimeoutState(state, winner) {
      return {
        stats: cloneStats(state.stats),
        rpgScores: { ...state.rpgScores, [winner]: state.rpgScores[winner] + 1 },
      };
    },
  };

  return Object.freeze({
    ...variant,
    resolveTurn: (turn) => resolveRpsRpgTurn({ variant, ...turn }),
  });
}

function resolveRpsRpgTurn({ variant, state, p1Move, p2Move, p1Resource, p2Resource }) {
  const legal = variant.getLegalMovesFromState(state);
  if (!legal.includes(p1Move) || !legal.includes(p2Move)) {
    return { ok: false, errors: ['Illegal RPS RPG move'] };
  }

  if (state.phase === 'level') {
    const stats = cloneStats(state.stats);
    stats.p1[p1Move]++;
    stats.p2[p2Move]++;
    return result({
      variant, p1Move, p2Move, p1Resource, p2Resource,
      nextPhase: 'move',
      nextStateData: { stats, rpgScores: { ...state.rpgScores } },
    });
  }

  let winner = rpsWinner(p1Move, p2Move);
  if (!winner && p1Move === p2Move) {
    const stat = MOVE_STATS[p1Move];
    if (state.stats.p1[stat] !== state.stats.p2[stat]) {
      winner = state.stats.p1[stat] > state.stats.p2[stat] ? 'p1' : 'p2';
    }
  }

  if (!winner) {
    return result({
      variant, p1Move, p2Move, p1Resource, p2Resource,
      nextPhase: 'move',
      nextStateData: { stats: cloneStats(state.stats), rpgScores: { ...state.rpgScores } },
    });
  }

  const scores = { ...state.rpgScores, [winner]: state.rpgScores[winner] + 1 };
  const gameFinished = scores[winner] >= variant.targetRoundWins;
  return result({
    variant, p1Move, p2Move, p1Resource, p2Resource,
    winner,
    isRoundOver: gameFinished,
    gameWinner: gameFinished ? winner : null,
    scoreAwards: { p1: winner === 'p1' ? 1 : 0, p2: winner === 'p2' ? 1 : 0 },
    nextPhase: 'level',
    nextStateData: { stats: cloneStats(state.stats), rpgScores: scores },
  });
}

function result({
  variant, p1Move, p2Move, p1Resource, p2Resource, winner = null,
  isRoundOver = false, gameWinner = null, scoreAwards = { p1: 0, p2: 0 },
  nextPhase, nextStateData,
}) {
  return {
    ok: true,
    variantId: variant.id,
    p1Move,
    p2Move,
    p1Resource,
    p2Resource,
    resources: { p1: p1Resource, p2: p2Resource },
    p1Hit: winner === 'p1' ? 'score' : null,
    p2Hit: winner === 'p2' ? 'score' : null,
    winner,
    isRoundOver,
    isTie: !winner,
    gameWinner,
    scoreAwards,
    nextPhase,
    nextStateData,
  };
}

function cloneStats(stats) {
  return { p1: { ...stats.p1 }, p2: { ...stats.p2 } };
}

function rpsWinner(p1Move, p2Move) {
  if (p1Move === p2Move) return null;
  const beats = { sword: 'staff', staff: 'bow', bow: 'sword' };
  return beats[p1Move] === p2Move ? 'p1' : 'p2';
}
