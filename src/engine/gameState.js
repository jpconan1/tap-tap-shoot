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
    p1Resource: getPlayerResource(state.players.p1),
    p2Resource: getPlayerResource(state.players.p2),
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
        resource: result.p1Resource,
        bullets: result.p1Resource,
        move: p1Move,
        hit: result.p2Hit,
      },
      p2: {
        ...state.players.p2,
        resource: result.p2Resource,
        bullets: result.p2Resource,
        move: p2Move,
        hit: result.p1Hit,
      },
    },
    history: [
      {
        turn: state.turn,
        p1Move,
        p2Move,
        p1ResourceBefore: getPlayerResource(state.players.p1),
        p2ResourceBefore: getPlayerResource(state.players.p2),
        p1ResourceAfter: result.p1Resource,
        p2ResourceAfter: result.p2Resource,
        p1BulletsBefore: getPlayerResource(state.players.p1),
        p2BulletsBefore: getPlayerResource(state.players.p2),
        p1BulletsAfter: result.p1Resource,
        p2BulletsAfter: result.p2Resource,
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
  return getLegalMoves(getPlayerResource(state.players[playerId]), getPlayerResource(state.players[opponentId]), variantId);
}

function createPlayerState(variantId) {
  const resource = getVariantStartResource(variantId);

  return {
    resource,
    bullets: resource,
    move: null,
    hit: null,
  };
}

export function getPlayerResource(player) {
  return player?.resource ?? player?.bullets ?? 0;
}
