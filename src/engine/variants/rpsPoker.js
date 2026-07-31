import { RPS_POKER_MOVES } from './rpsPokerRules.js';
import {
  createRpsPokerState,
  decideRpsPokerCommand,
  getRpsPokerLegalCommands,
  pokerCommandFromMove,
  pokerMoveFromCommand,
} from './rpsPokerDomain.js';

const RPS = RPS_POKER_MOVES;

export function createRpsPokerVariant({ id, moves }) {
  const variant = {
    id,
    label: 'RPS Poker',
    isRanked: true,
    targetRoundWins: 1,
    moveIds: Object.freeze([...RPS, 'check', 'bet', 'fold', 'call', 'raise']),
    moves,
    resourceMax: 0,
    startResource: 0,
    initialPhase: 'lock',
    createRoundData: ({ random = Math.random } = {}) => createRpsPokerState({ random }),
    getLegalMovesFromState(state, playerId) {
      const commands = getRpsPokerLegalCommands(state, playerId);
      return commands.length ? commands.map(pokerMoveFromCommand) : ['wait'];
    },
  };
  return Object.freeze({ ...variant, resolveTurn: (turn) => resolvePokerTurn({ variant, ...turn }) });
}

function resolvePokerTurn({ variant, state, p1Move, p2Move, p1Resource, p2Resource }) {
  const picks = { p1: p1Move, p2: p2Move };
  for (const player of ['p1', 'p2']) {
    if (!variant.getLegalMovesFromState(state, player).includes(picks[player])) {
      return { ok: false, errors: [`${player} picked illegal poker action: ${picks[player]}`] };
    }
  }

  let next = state;
  const events = [];
  const actors = state.phase === 'lock' ? ['p1', 'p2'] : [state.actor];
  for (const player of actors) {
    const resolved = decideRpsPokerCommand(next, player, pokerCommandFromMove(picks[player]));
    if (!resolved.ok) return { ok: false, errors: [resolved.error] };
    next = resolved.state;
    events.push(...resolved.events);
  }

  const winner = next.winner ?? null;
  const {
    variantId: _variantId,
    turn: _turn,
    status: _status,
    players: _players,
    history: _history,
    pairs: _pairs,
    ...nextStateData
  } = next;
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
    isRoundOver: Boolean(winner),
    isTie: !winner,
    gameWinner: winner,
    scoreAwards: winner ? { p1: winner === 'p1' ? 1 : 0, p2: winner === 'p2' ? 1 : 0 } : { p1: 0, p2: 0 },
    nextPhase: next.phase,
    nextStateData,
    domainEvents: events,
  };
}
