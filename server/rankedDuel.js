import { randomUUID } from 'node:crypto';

import { createRoundState, getPlayerLegalMoves, playTurn } from '../src/engine/gameState.js';
import { DEFAULT_VARIANT_ID, VARIANTS, normalizeVariantId } from '../src/engine/moves.js';
import { updateRatings } from './elo.js';
import { MemoryPlayerStore } from './playerStore.js';

const GAME_TARGET_ROUNDS = 5;
const MAX_TIMEOUT_STRIKES = 3;
const DEFAULT_COUNTDOWN_MS = 3000;
const NO_SELECTION_GRACE_MS = 5000;
const NO_CONTEST_WAITING_MS = 3000;
const READY_WAITING_SAFE_MS = (7 * 58) + 750 + (3 * 1000);
const READY_WAITING_COUNTDOWN_MS = 5000;
const DEFAULT_TURN_MS = READY_WAITING_SAFE_MS + READY_WAITING_COUNTDOWN_MS;
const DEFAULT_REVEAL_MS = 2 * 750;
const INITIAL_SEARCH_SPREAD = 100;
const SEARCH_SPREAD_PER_SECOND = 75;
const DEFAULT_DISPLAY_NAME = 'Guest';
const MAX_DISPLAY_NAME_LENGTH = 50;

export class RankedDuelService {
  constructor({
    playerStore = new MemoryPlayerStore(),
    countdownMs = DEFAULT_COUNTDOWN_MS,
    noSelectionGraceMs = NO_SELECTION_GRACE_MS,
    noContestWaitingMs = NO_CONTEST_WAITING_MS,
    noContestCountdownMs = READY_WAITING_COUNTDOWN_MS,
    turnMs = DEFAULT_TURN_MS,
    revealMs = DEFAULT_REVEAL_MS,
    now = () => Date.now(),
    createId = randomUUID,
    onError = () => {},
  } = {}) {
    this.playerStore = playerStore;
    this.countdownMs = countdownMs;
    this.noSelectionGraceMs = noSelectionGraceMs;
    this.noContestWaitingMs = noContestWaitingMs;
    this.noContestCountdownMs = noContestCountdownMs;
    this.turnMs = turnMs;
    this.revealMs = revealMs;
    this.now = now;
    this.createId = createId;
    this.onError = onError;
    this.sessions = new Map();
    this.queue = [];
    this.rooms = new Map();
  }

  async connect(client, requestedPlayerId) {
    const playerId = requestedPlayerId || this.createId();
    const player = await this.playerStore.getPlayer(playerId);
    const session = {
      id: this.createId(),
      player,
      displayName: DEFAULT_DISPLAY_NAME,
      variantId: DEFAULT_VARIANT_ID,
      client,
      roomId: null,
      queuedAt: null,
      closed: false,
    };

    this.sessions.set(session.id, session);
    this.send(session, 'hello', {
      playerId: player.id,
      rating: player.rating,
      wins: player.wins,
      losses: player.losses,
    });

    return session;
  }

  receive(session, message) {
    if (session.closed || !message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'joinRanked') {
      session.displayName = sanitizeDisplayName(message.displayName);
      session.variantId = normalizeVariantId(message.variantId);
      this.joinRanked(session);
      return;
    }

    if (message.type === 'cancelQueue') {
      this.leaveQueue(session);
      return;
    }

    if (message.type === 'submitMove') {
      this.submitMove(session, message.moveId);
      return;
    }

    if (message.type === 'submitContinue') {
      this.submitContinue(session);
    }
  }

  disconnect(session) {
    if (session.closed) {
      return;
    }

    session.closed = true;
    this.leaveQueue(session);
    this.sessions.delete(session.id);

    if (session.roomId) {
      this.forfeitRoom(session.roomId, session);
    }
  }

  joinRanked(session) {
    if (session.roomId) {
      return;
    }

    if (!this.queue.includes(session)) {
      session.queuedAt = this.now();
      this.queue.push(session);
      this.send(session, 'queue', {
        status: 'searching',
        rating: session.player.rating,
        variantId: session.variantId,
      });
    }

    this.tryMatchmaking();
  }

  leaveQueue(session) {
    this.queue = this.queue.filter((queued) => queued !== session);
    session.queuedAt = null;
  }

  tryMatchmaking() {
    this.queue.sort((a, b) => a.queuedAt - b.queuedAt);

    for (let index = 0; index < this.queue.length; index += 1) {
      const first = this.queue[index];
      const opponentIndex = this.findOpponentIndex(first, index + 1);

      if (opponentIndex === -1) {
        continue;
      }

      const [second] = this.queue.splice(opponentIndex, 1);
      this.queue.splice(index, 1);
      first.queuedAt = null;
      second.queuedAt = null;
      this.createRoom(first, second);
      index -= 1;
    }
  }

  findOpponentIndex(session, startIndex) {
    const waitedSeconds = Math.max(0, (this.now() - session.queuedAt) / 1000);
    const spread = INITIAL_SEARCH_SPREAD + waitedSeconds * SEARCH_SPREAD_PER_SECOND;

    for (let index = startIndex; index < this.queue.length; index += 1) {
      const candidate = this.queue[index];

      if (candidate.player.id === session.player.id) {
        continue;
      }

      if (candidate.variantId !== session.variantId) {
        continue;
      }

      const ratingDelta = Math.abs(candidate.player.rating - session.player.rating);

      if (ratingDelta <= spread) {
        return index;
      }
    }

    return -1;
  }

  createRoom(p1Session, p2Session) {
    const room = {
      id: this.createId(),
      phase: 'countdown',
      players: {
        p1: p1Session,
        p2: p2Session,
      },
      roundWins: {
        p1: 0,
        p2: 0,
      },
      timeoutStrikes: {
        p1: 0,
        p2: 0,
      },
      roundState: createRoundState({ variantId: p1Session.variantId }),
      pendingMoves: new Map(),
      pendingContinues: new Set(),
      readyPlayerKey: null,
      waitingPlayerKey: null,
      noContestWaitingAt: null,
      noContestCountdownAt: null,
      noContest: false,
      timer: null,
      deadlineAt: this.now() + this.countdownMs,
      winner: null,
      ratings: null,
      variantId: p1Session.variantId,
    };

    p1Session.roomId = room.id;
    p2Session.roomId = room.id;
    this.rooms.set(room.id, room);
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.beginChoosing(room), this.countdownMs);
    return room;
  }

  beginChoosing(room) {
    if (room.phase === 'gameOver') {
      return;
    }

    room.phase = 'choosing';
    room.pendingMoves.clear();
    room.pendingContinues.clear();
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = this.now() + this.noSelectionGraceMs;
    room.noContestCountdownAt = room.noContestWaitingAt + this.noContestWaitingMs;
    room.deadlineAt = room.noContestCountdownAt + this.noContestCountdownMs;
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.handleChoosingDeadline(room), room.deadlineAt - this.now());
  }

  submitMove(session, moveId) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'choosing') {
      return;
    }

    const playerKey = this.getPlayerKey(room, session);
    const legalMoves = getPlayerLegalMoves(room.roundState, playerKey);

    if (!legalMoves.includes(moveId)) {
      this.send(session, 'error', { message: 'illegal move' });
      return;
    }

    if (room.pendingMoves.has(playerKey)) {
      this.send(session, 'moveAccepted', { moveId: room.pendingMoves.get(playerKey) });
      return;
    }

    room.pendingMoves.set(playerKey, moveId);
    this.send(session, 'moveAccepted', { moveId });

    if (room.pendingMoves.size === 2) {
      this.resolveRoomTurn(room);
      return;
    }

    this.beginReadyWaiting(room, playerKey);
  }

  beginReadyWaiting(room, readyPlayerKey) {
    room.readyPlayerKey = readyPlayerKey;
    room.waitingPlayerKey = readyPlayerKey === 'p1' ? 'p2' : 'p1';
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;
    room.deadlineAt = this.now() + this.turnMs;
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.handleChoosingDeadline(room), this.turnMs);
  }

  handleChoosingDeadline(room) {
    if (room.phase !== 'choosing') {
      return;
    }

    if (room.pendingMoves.size === 0) {
      this.finishRoomByNoContest(room);
      return;
    }

    if (room.pendingMoves.size === 1 && room.waitingPlayerKey) {
      this.finishRoundByTimeout(room, room.waitingPlayerKey);
      return;
    }

    this.resolveRoomTurn(room);
  }

  resolveRoomTurn(room) {
    if (room.phase !== 'choosing') {
      return;
    }

    this.clearRoomTimer(room);
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;

    const p1Move = room.pendingMoves.get('p1') ?? getFallbackMove(room.roundState, 'p1');
    const p2Move = room.pendingMoves.get('p2') ?? getFallbackMove(room.roundState, 'p2');
    const turn = playTurn(room.roundState, p1Move, p2Move, room.variantId);

    if (!turn.ok) {
      throw new Error(turn.error);
    }

    room.roundState = turn.state;
    room.phase = 'revealed';

    if (room.roundState.winner) {
      room.roundWins[room.roundState.winner] += 1;
    }

    this.broadcastRoom(room, { revealedMoves: { p1: p1Move, p2: p2Move } });

    this.setRoomTimer(room, () => {
      if (room.roundState.status !== 'finished') {
        this.beginChoosing(room);
        return;
      }

      if (room.roundWins.p1 >= GAME_TARGET_ROUNDS || room.roundWins.p2 >= GAME_TARGET_ROUNDS) {
        this.finishRoom(room, room.roundWins.p1 >= GAME_TARGET_ROUNDS ? 'p1' : 'p2');
        return;
      }

      this.beginRoundOver(room);
    }, this.revealMs);
  }

  beginRoundOver(room) {
    if (room.phase === 'gameOver') {
      return;
    }

    room.phase = 'roundOver';
    room.pendingContinues.clear();
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.deadlineAt = null;
    this.broadcastRoom(room);
  }

  submitContinue(session) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'roundOver') {
      return;
    }

    const playerKey = this.getPlayerKey(room, session);

    if (room.pendingContinues.has(playerKey)) {
      this.send(session, 'continueAccepted', {});
      return;
    }

    room.pendingContinues.add(playerKey);
    this.send(session, 'continueAccepted', {});

    if (room.pendingContinues.size === 2) {
      this.beginNextRound(room);
      return;
    }

    this.beginContinueReadyWaiting(room, playerKey);
  }

  beginContinueReadyWaiting(room, readyPlayerKey) {
    room.readyPlayerKey = readyPlayerKey;
    room.waitingPlayerKey = readyPlayerKey === 'p1' ? 'p2' : 'p1';
    room.deadlineAt = this.now() + this.turnMs;
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.handleContinueDeadline(room), this.turnMs);
  }

  handleContinueDeadline(room) {
    if (room.phase !== 'roundOver' || !room.waitingPlayerKey) {
      return;
    }

    this.applyTimeoutStrike(room, room.waitingPlayerKey);

    if (room.phase !== 'gameOver') {
      this.beginNextRound(room);
    }
  }

  beginNextRound(room) {
    this.clearRoomTimer(room);
    room.roundState = createRoundState({ variantId: room.variantId });
    this.beginChoosing(room);
  }

  finishRoomByNoContest(room) {
    this.clearRoomTimer(room);
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;
    room.noContest = true;

    if (room.roundWins.p1 === room.roundWins.p2) {
      room.phase = 'gameOver';
      room.winner = null;
      room.ratings = null;
      this.broadcastRoom(room);
      this.releaseRoom(room);
      return;
    }

    this.finishRoom(room, room.roundWins.p1 > room.roundWins.p2 ? 'p1' : 'p2');
  }

  finishRoundByTimeout(room, loserKey) {
    this.clearRoomTimer(room);

    const winnerKey = loserKey === 'p1' ? 'p2' : 'p1';
    this.applyTimeoutStrike(room, loserKey);
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.roundState = {
      ...room.roundState,
      status: 'finished',
      winner: winnerKey,
    };

    if (room.phase === 'gameOver') {
      return;
    }

    room.roundWins[winnerKey] += 1;
    room.phase = 'revealed';
    this.broadcastRoom(room, {
      timeout: {
        loser: loserKey,
        winner: winnerKey,
        strikes: room.timeoutStrikes[loserKey],
      },
    });

    this.setRoomTimer(room, () => {
      if (room.roundWins.p1 >= GAME_TARGET_ROUNDS || room.roundWins.p2 >= GAME_TARGET_ROUNDS) {
        this.finishRoom(room, winnerKey);
        return;
      }

      this.beginRoundOver(room);
    }, this.revealMs);
  }

  applyTimeoutStrike(room, loserKey) {
    const winnerKey = loserKey === 'p1' ? 'p2' : 'p1';
    room.timeoutStrikes[loserKey] += 1;

    if (room.timeoutStrikes[loserKey] >= MAX_TIMEOUT_STRIKES) {
      this.finishRoom(room, winnerKey);
    }
  }

  async finishRoom(room, winnerKey) {
    if (room.phase === 'gameOver') {
      return;
    }

    this.clearRoomTimer(room);
    room.phase = 'gameOver';
    room.winner = winnerKey;

    if (VARIANTS[room.variantId]?.isRanked) {
      try {
        room.ratings = await this.saveMatchResult(room, winnerKey);
      } catch (error) {
        room.ratings = null;
        this.onError(error);
      }
    }

    this.broadcastRoom(room);
    this.releaseRoom(room);
  }

  async saveMatchResult(room, winnerKey) {
    const loserKey = winnerKey === 'p1' ? 'p2' : 'p1';
    const winner = room.players[winnerKey].player;
    const loser = room.players[loserKey].player;
    const nextRatings = updateRatings(winner.rating, loser.rating, true);
    const playedAt = new Date(this.now()).toISOString();

    const savedWinner = {
      ...winner,
      rating: nextRatings.player,
      wins: winner.wins + 1,
      lastPlayed: playedAt,
    };
    const savedLoser = {
      ...loser,
      rating: nextRatings.opponent,
      losses: loser.losses + 1,
      lastPlayed: playedAt,
    };

    room.players[winnerKey].player = await this.playerStore.savePlayer(savedWinner);
    room.players[loserKey].player = await this.playerStore.savePlayer(savedLoser);

    return {
      [winnerKey]: {
        before: winner.rating,
        after: savedWinner.rating,
      },
      [loserKey]: {
        before: loser.rating,
        after: savedLoser.rating,
      },
    };
  }

  forfeitRoom(roomId, forfeitingSession) {
    const room = this.rooms.get(roomId);

    if (!room || room.phase === 'gameOver') {
      return;
    }

    const forfeitingKey = this.getPlayerKey(room, forfeitingSession);
    const winnerKey = forfeitingKey === 'p1' ? 'p2' : 'p1';
    this.finishRoom(room, winnerKey);
  }

  getPlayerKey(room, session) {
    return room.players.p1 === session ? 'p1' : 'p2';
  }

  getOnlinePlayerCount() {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }

  broadcastRoom(room, extra = {}) {
    for (const playerKey of ['p1', 'p2']) {
      this.send(room.players[playerKey], 'matchState', {
        ...this.getPublicRoomState(room, playerKey),
        ...extra,
      });
    }
  }

  getPublicRoomState(room, playerKey) {
    const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
    const isRanked = Boolean(VARIANTS[room.variantId]?.isRanked);

    return {
      matchId: room.id,
      variantId: room.variantId,
      playerKey,
      opponentKey,
      phase: room.phase,
      deadlineAt: room.deadlineAt,
      readyPlayerKey: room.readyPlayerKey,
      waitingPlayerKey: room.waitingPlayerKey,
      noContestWaitingAt: room.noContestWaitingAt,
      noContestCountdownAt: room.noContestCountdownAt,
      noContest: room.noContest,
      roundWins: room.roundWins,
      timeoutStrikes: room.timeoutStrikes,
      winner: room.winner,
      ratings: room.ratings,
      players: {
        p1: {
          displayName: room.players.p1.displayName,
          ap: room.roundState.players.p1.ap,
          legalMoves: room.phase === 'choosing' ? getPlayerLegalMoves(room.roundState, 'p1') : [],
          canContinue: room.phase === 'roundOver' && !room.pendingContinues.has('p1'),
          rating: isRanked ? room.players.p1.player.rating : null,
        },
        p2: {
          displayName: room.players.p2.displayName,
          ap: room.roundState.players.p2.ap,
          legalMoves: room.phase === 'choosing' ? getPlayerLegalMoves(room.roundState, 'p2') : [],
          canContinue: room.phase === 'roundOver' && !room.pendingContinues.has('p2'),
          rating: isRanked ? room.players.p2.player.rating : null,
        },
      },
      round: {
        turn: room.roundState.turn,
        status: room.roundState.status,
        winner: room.roundState.winner,
        lastTurn: room.roundState.history[0] ?? null,
      },
    };
  }

  send(session, type, payload = {}) {
    session.client.send(JSON.stringify({ type, ...payload }));
  }

  setRoomTimer(room, callback, delayMs) {
    this.clearRoomTimer(room);
    room.timer = setTimeout(callback, delayMs);
    room.timer.unref?.();
  }

  clearRoomTimer(room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
  }

  releaseRoom(room) {
    this.clearRoomTimer(room);
    room.players.p1.roomId = null;
    room.players.p2.roomId = null;
    this.rooms.delete(room.id);
  }
}

function getFallbackMove(state, playerKey) {
  const legalMoves = getPlayerLegalMoves(state, playerKey);
  return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
}

export function sanitizeDisplayName(value) {
  if (typeof value !== 'string') {
    return DEFAULT_DISPLAY_NAME;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return DEFAULT_DISPLAY_NAME;
  }

  return Array.from(normalized).slice(0, MAX_DISPLAY_NAME_LENGTH).join('');
}
