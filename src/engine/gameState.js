import { DEFAULT_VARIANT_ID, getLegalMoves, normalizeVariantId } from './moves.js';
import { resolveTurn } from './resolveTurn.js';

export function createRoundState({ variantId = DEFAULT_VARIANT_ID } = {}) {
  return {
    variantId: normalizeVariantId(variantId),
    turn: 0,
    status: 'playing',
    players: {
      p1: createPlayerState(),
      p2: createPlayerState(),
    },
    history: [],
  };
}

export function playTurn(state, p1Move, p2Move, variantId = state.variantId ?? DEFAULT_VARIANT_ID) {
  if (state.status !== 'playing') {
    return {
      ok: false,
      error: 'game is over',
      state,
    };
  }

  const result = resolveTurn({
    p1Move,
    p2Move,
    p1Ap: state.players.p1.ap,
    p2Ap: state.players.p2.ap,
    variantId,
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
    turn: result.isRoundOver ? state.turn : state.turn + 1,
    status: result.isRoundOver ? 'finished' : 'playing',
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
        turn: state.turn,
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

export function getPlayerLegalMoves(state, playerId, variantId = state.variantId ?? DEFAULT_VARIANT_ID) {
  const opponentId = playerId === 'p1' ? 'p2' : 'p1';
  return getLegalMoves(state.players[playerId].ap, state.players[opponentId].ap, variantId);
}

function createPlayerState() {
  return {
    ap: 1,
    move: null,
    hit: null,
  };
}
