export function lockMove(moves, playerId, moveId, legalMoves) {
  if ((playerId !== 'p1' && playerId !== 'p2') || !legalMoves.includes(moveId)) {
    return { status: 'illegal', moves };
  }

  if (moves[playerId]) {
    return { status: 'duplicate', moveId: moves[playerId], moves };
  }

  const nextMoves = { ...moves, [playerId]: moveId };
  const readyPlayerIds = getReadyPlayerIds(nextMoves);
  return {
    status: readyPlayerIds.length === 2 ? 'complete' : 'waiting',
    moveId,
    moves: nextMoves,
    readyPlayerId: readyPlayerIds.length === 1 ? readyPlayerIds[0] : null,
    waitingPlayerId: readyPlayerIds.length === 1 ? getOpponentId(readyPlayerIds[0]) : null,
  };
}

export function getMoveDeadlineOutcome(moves) {
  const readyPlayerIds = getReadyPlayerIds(moves);
  if (readyPlayerIds.length === 0) return { type: 'no-contest' };
  if (readyPlayerIds.length === 1) {
    return {
      type: 'timeout',
      winner: readyPlayerIds[0],
      loser: getOpponentId(readyPlayerIds[0]),
    };
  }
  return { type: 'resolve' };
}

export function createPendingMoves() {
  return { p1: null, p2: null };
}

export function lockContinue(continues, playerId) {
  if (playerId !== 'p1' && playerId !== 'p2') return { status: 'illegal', continues };
  if (continues[playerId]) return { status: 'duplicate', continues };

  const nextContinues = { ...continues, [playerId]: true };
  const complete = nextContinues.p1 && nextContinues.p2;
  return {
    status: complete ? 'complete' : 'waiting',
    continues: nextContinues,
    readyPlayerId: complete ? null : playerId,
    waitingPlayerId: complete ? null : getOpponentId(playerId),
  };
}

export function createPendingContinues() {
  return { p1: false, p2: false };
}

function getReadyPlayerIds(moves) {
  return ['p1', 'p2'].filter((playerId) => Boolean(moves[playerId]));
}

function getOpponentId(playerId) {
  return playerId === 'p1' ? 'p2' : 'p1';
}
