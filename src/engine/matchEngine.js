import { createRoundState, playTurn } from './gameState.js';
import { getVariantTargetRoundWins } from './moves.js';

export function resolveMatchTurn({ roundState, roundWins, p1Move, p2Move, variantId = roundState.variantId }) {
  const turn = playTurn(roundState, p1Move, p2Move, variantId);
  if (!turn.ok) return { ok: false, error: turn.error, turn, roundWins };
  const nextRoundWins = awardRoundWin(roundWins, turn.state.winner);

  return {
    ok: true,
    turn,
    roundWins: nextRoundWins,
    gameWinner: getGameWinner(nextRoundWins, variantId),
  };
}

export function createVariantGame({ variantId, roundWins = { p1: 0, p2: 0 } }) {
  return {
    variantId,
    roundState: createRoundState({ variantId }),
    roundWins: { ...roundWins },
  };
}

export function startNextRound(game) {
  return createVariantGame({ variantId: game.variantId, roundWins: game.roundWins });
}

export function awardRoundWin(roundWins, winner) {
  if (winner !== 'p1' && winner !== 'p2') return roundWins;
  return { ...roundWins, [winner]: roundWins[winner] + 1 };
}

export function getGameWinner(roundWins, variantId) {
  const target = getVariantTargetRoundWins(variantId);
  if (roundWins.p1 >= target) return 'p1';
  if (roundWins.p2 >= target) return 'p2';
  return null;
}

export function isGameOver(roundWins, variantId) {
  return getGameWinner(roundWins, variantId) !== null;
}

export function getResultLevel(roundWins, winner, variantId) {
  return winner && getGameWinner(roundWins, variantId) === winner ? 'game' : 'round';
}

export function getPostTurnAction({ roundFinished, gameFinished, autoAdvanceRound }) {
  if (!roundFinished) return 'continue-turn';
  if (gameFinished) return 'finish-game';
  if (autoAdvanceRound) return 'advance-round';
  return 'await-continue';
}

export function resolveRoundTimeout({ roundState, roundWins, loser, variantId = roundState.variantId }) {
  if (loser !== 'p1' && loser !== 'p2') {
    return { ok: false, error: 'invalid timeout player', roundState, roundWins, winner: null, gameWinner: null };
  }

  const winner = loser === 'p1' ? 'p2' : 'p1';
  const nextRoundWins = awardRoundWin(roundWins, winner);
  return {
    ok: true,
    winner,
    roundState: { ...roundState, status: 'finished', winner },
    roundWins: nextRoundWins,
    gameWinner: getGameWinner(nextRoundWins, variantId),
  };
}
