import { createRoundState, playTurn } from './gameState.js';
import { getVariant, getVariantTargetRoundWins } from './moves.js';

export function resolveMatchTurn({ roundState, roundWins, p1Move, p2Move, variantId = roundState.variantId }) {
  const turn = playTurn(roundState, p1Move, p2Move, variantId);
  if (!turn.ok) return { ok: false, error: turn.error, turn, roundWins };
  const nextRoundWins = turn.result.scoreAwards
    ? awardRoundScores(roundWins, turn.result.scoreAwards)
    : awardRoundWin(roundWins, turn.state.winner);
  const reachedMutualTarget = (
    nextRoundWins.p1 >= getVariantTargetRoundWins(variantId)
    && nextRoundWins.p2 >= getVariantTargetRoundWins(variantId)
  );
  if (reachedMutualTarget && !turn.result.gameWinner) {
    turn.state.status = 'playing';
    turn.state.winner = null;
    turn.state.phase = 'suddenDeath';
  }

  return {
    ok: true,
    turn,
    roundWins: nextRoundWins,
    gameWinner: turn.result.gameWinner
      ?? (turn.state.status === 'finished' ? getGameWinner(nextRoundWins, variantId) : null),
  };
}

function awardRoundScores(roundWins, awards) {
  return {
    p1: roundWins.p1 + (awards.p1 ?? 0),
    p2: roundWins.p2 + (awards.p2 ?? 0),
  };
}

export function createVariantGame({ variantId, roundWins = { p1: 0, p2: 0 } }) {
  return {
    variantId,
    roundState: createRoundState({ variantId }),
    roundWins: { ...roundWins },
  };
}

export function startNewGame({ variantId, roundWins = { p1: 0, p2: 0 } }) {
  return createVariantGame({ variantId, roundWins });
}

export function startNextRound(game) {
  const variant = getVariant(game.variantId);
  const resources = variant.persistResourceBetweenRounds
    && game.roundState.variantId === game.variantId ? {
    p1: game.roundState.players.p1.resource,
    p2: game.roundState.players.p2.resource,
  } : null;
  const roundState = createRoundState({ variantId: game.variantId, resources });
  for (const key of variant.persistRoundData ?? []) {
    if (game.roundState[key] !== undefined) roundState[key] = structuredClone(game.roundState[key]);
  }
  return {
    variantId: game.variantId,
    roundState,
    roundWins: { ...game.roundWins },
  };
}

export function awardRoundWin(roundWins, winner) {
  if (winner !== 'p1' && winner !== 'p2') return roundWins;
  return { ...roundWins, [winner]: roundWins[winner] + 1 };
}

export function getGameWinner(roundWins, variantId) {
  const target = getVariantTargetRoundWins(variantId);
  if (roundWins.p1 >= target && roundWins.p2 >= target) {
    if (roundWins.p1 === roundWins.p2) return null;
    return roundWins.p1 > roundWins.p2 ? 'p1' : 'p2';
  }
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
  const timeoutData = getVariant(variantId).getTimeoutState?.(roundState, winner) ?? {};
  return {
    ok: true,
    winner,
    roundState: { ...roundState, ...timeoutData, status: 'finished', winner },
    roundWins: nextRoundWins,
    gameWinner: getGameWinner(nextRoundWins, variantId),
  };
}
