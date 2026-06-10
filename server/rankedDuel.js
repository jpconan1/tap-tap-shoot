import { randomUUID } from 'node:crypto';

import { createGameState, getPlayerLegalMoves, playRound } from '../src/engine/gameState.js';
import { updateRatings } from './elo.js';
import { MemoryPlayerStore } from './playerStore.js';

const WIN_TARGET = 3;
const DEFAULT_COUNTDOWN_MS = 3000;
const DEFAULT_TURN_MS = 4500;
const DEFAULT_REVEAL_MS = 1800;
const INITIAL_SEARCH_SPREAD = 100;
const SEARCH_SPREAD_PER_SECOND = 75;

export class RankedDuelService {
  constructor({
    playerStore = new MemoryPlayerStore(),
    countdownMs = DEFAULT_COUNTDOWN_MS,
    turnMs = DEFAULT_TURN_MS,
    revealMs = DEFAULT_REVEAL_MS,
    now = () => Date.now(),
    createId = randomUUID,
  } = {}) {
    this.playerStore = playerStore;
    this.countdownMs = countdownMs;
    this.turnMs = turnMs;
    this.revealMs = revealMs;
    this.now = now;
    this.createId = createId;
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
      this.joinRanked(session);
      return;
    }

    if (message.type === 'cancelQueue') {
      this.leaveQueue(session);
      return;
    }

    if (message.type === 'submitMove') {
      this.submitMove(session, message.moveId);
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
      this.send(session, 'queue', { status: 'searching', rating: session.player.rating });
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
      score: {
        p1: 0,
        p2: 0,
      },
      gameState: createGameState(),
      pendingMoves: new Map(),
      timer: null,
      deadlineAt: this.now() + this.countdownMs,
      winner: null,
      ratings: null,
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
    room.deadlineAt = this.now() + this.turnMs;
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.resolveRoomRound(room), this.turnMs);
  }

  submitMove(session, moveId) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'choosing') {
      return;
    }

    const playerKey = this.getPlayerKey(room, session);
    const legalMoves = getPlayerLegalMoves(room.gameState, playerKey);

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
      this.resolveRoomRound(room);
    }
  }

  resolveRoomRound(room) {
    if (room.phase !== 'choosing') {
      return;
    }

    this.clearRoomTimer(room);

    const p1Move = room.pendingMoves.get('p1') ?? getFallbackMove(room.gameState, 'p1');
    const p2Move = room.pendingMoves.get('p2') ?? getFallbackMove(room.gameState, 'p2');
    const turn = playRound(room.gameState, p1Move, p2Move);

    if (!turn.ok) {
      throw new Error(turn.error);
    }

    room.gameState = turn.state;
    room.phase = 'revealed';

    if (room.gameState.winner) {
      room.score[room.gameState.winner] += 1;
    }

    this.broadcastRoom(room, { revealedMoves: { p1: p1Move, p2: p2Move } });

    if (room.score.p1 >= WIN_TARGET || room.score.p2 >= WIN_TARGET) {
      this.finishRoom(room, room.score.p1 >= WIN_TARGET ? 'p1' : 'p2');
      return;
    }

    this.setRoomTimer(room, () => {
      if (room.gameState.status === 'finished') {
        room.gameState = createGameState();
      }

      this.beginChoosing(room);
    }, this.revealMs);
  }

  async finishRoom(room, winnerKey) {
    if (room.phase === 'gameOver') {
      return;
    }

    this.clearRoomTimer(room);
    room.phase = 'gameOver';
    room.winner = winnerKey;
    room.ratings = await this.saveMatchResult(room, winnerKey);
    this.broadcastRoom(room);
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

    return {
      matchId: room.id,
      playerKey,
      opponentKey,
      phase: room.phase,
      deadlineAt: room.deadlineAt,
      score: room.score,
      winner: room.winner,
      ratings: room.ratings,
      players: {
        p1: {
          ap: room.gameState.players.p1.ap,
          legalMoves: room.phase === 'choosing' ? getPlayerLegalMoves(room.gameState, 'p1') : [],
          rating: room.players.p1.player.rating,
        },
        p2: {
          ap: room.gameState.players.p2.ap,
          legalMoves: room.phase === 'choosing' ? getPlayerLegalMoves(room.gameState, 'p2') : [],
          rating: room.players.p2.player.rating,
        },
      },
      game: {
        round: room.gameState.round,
        status: room.gameState.status,
        winner: room.gameState.winner,
        lastTurn: room.gameState.history[0] ?? null,
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
}

function getFallbackMove(state, playerKey) {
  const legalMoves = getPlayerLegalMoves(state, playerKey);
  return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
}
