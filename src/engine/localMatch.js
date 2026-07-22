import { getPlayerLegalMoves } from './gameState.js';
import { resolveMatchTurn } from './matchEngine.js';

export function resolveLocalTurn({
  state,
  queuedPlayerMove,
  queuedOpponentMove,
  forcedOpponentMove,
  getForcedOpponentMove,
  chooseOpponentMove,
  roundWins = { p1: 0, p2: 0 },
}) {
  const playerMove = getLegalOrFallbackMove(state, 'p1', queuedPlayerMove);
  const opponentMove = forcedOpponentMove
    ?? getForcedOpponentMove?.(playerMove)
    ?? queuedOpponentMove
    ?? chooseOpponentMove(state);

  return {
    moves: { p1: playerMove, p2: opponentMove },
    ...resolveMatchTurn({
      roundState: state,
      roundWins,
      p1Move: playerMove,
      p2Move: opponentMove,
    }),
  };
}

function getLegalOrFallbackMove(state, playerId, requestedMove) {
  const legalMoves = getPlayerLegalMoves(state, playerId);
  if (legalMoves.includes(requestedMove)) return requestedMove;
  return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
}
