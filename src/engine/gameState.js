import { getLegalMoves } from './moves.js';
import { resolveRound } from './resolveRound.js';

export function createGameState() {
  return {
    round: 0,
    status: 'playing',
    players: {
      p1: createPlayerState(),
      p2: createPlayerState(),
    },
    history: [],
  };
}

export function playRound(state, p1Move, p2Move) {
  if (state.status !== 'playing') {
    return {
      ok: false,
      error: 'game is over',
      state,
    };
  }

  const result = resolveRound({
    p1Move,
    p2Move,
    p1Ap: state.players.p1.ap,
    p2Ap: state.players.p2.ap,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.errors.join(', '),
      state,
    };
  }

  const nextState = {
    ...state,
    round: result.isGameOver ? state.round : state.round + 1,
    status: result.isGameOver ? 'finished' : 'playing',
    winner: result.winner ?? state.winner,
    players: {
      p1: {
        ...state.players.p1,
        ap: result.p1Ap,
        move: p1Move,
        hit: result.p2Hit,
      },
      p2: {
        ...state.players.p2,
        ap: result.p2Ap,
        move: p2Move,
        hit: result.p1Hit,
      },
    },
    history: [
      {
        round: state.round,
        p1Move,
        p2Move,
        p1ApBefore: state.players.p1.ap,
        p2ApBefore: state.players.p2.ap,
        p1ApAfter: result.p1Ap,
        p2ApAfter: result.p2Ap,
        winner: result.winner,
        p1Hit: result.p1Hit,
        p2Hit: result.p2Hit,
      },
      ...state.history,
    ],
  };

  return {
    ok: true,
    result,
    state: nextState,
  };
}

export function getPlayerLegalMoves(state, playerId) {
  return getLegalMoves(state.players[playerId].ap);
}

function createPlayerState() {
  return {
    ap: 1,
    move: null,
    hit: null,
  };
}
