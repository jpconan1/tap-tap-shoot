import { DEFAULT_VARIANT_ID, getLegalMoves, getVariantStartResource, normalizeVariantId } from './moves.js';
import { resolveTurn } from './resolveTurn.js';

export function createRoundState({ variantId = DEFAULT_VARIANT_ID } = {}) {
  const normalizedVariantId = normalizeVariantId(variantId);

  return {
    variantId: normalizedVariantId,
    turn: 0,
    status: 'playing',
    players: {
      p1: createPlayerState(normalizedVariantId),
      p2: createPlayerState(normalizedVariantId),
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
    p1Bullets: state.players.p1.bullets,
    p2Bullets: state.players.p2.bullets,
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
        bullets: result.p1Bullets,
        move: p1Move,
        hit: result.p2Hit,
      },
      p2: {
        ...state.players.p2,
        bullets: result.p2Bullets,
        move: p2Move,
        hit: result.p1Hit,
      },
    },
    history: [
      {
        turn: state.turn,
        p1Move,
        p2Move,
        p1BulletsBefore: state.players.p1.bullets,
        p2BulletsBefore: state.players.p2.bullets,
        p1BulletsAfter: result.p1Bullets,
        p2BulletsAfter: result.p2Bullets,
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
  return getLegalMoves(state.players[playerId].bullets, state.players[opponentId].bullets, variantId);
}

function createPlayerState(variantId) {
  return {
    bullets: getVariantStartResource(variantId),
    move: null,
    hit: null,
  };
}
