import { randomUUID } from 'node:crypto';

import { createRoundState, getPlayerLegalMoves, getPlayerResource } from '../src/engine/gameState.js';
import { createVariantGame, getGameWinner, getPostTurnAction, resolveMatchTurn, resolveRoundTimeout, startNextRound } from '../src/engine/matchEngine.js';
import { createPendingContinues, createPendingMoves, getMoveDeadlineOutcome, lockContinue, lockMove } from '../src/engine/matchCommands.js';
import {
  DEFAULT_VARIANT_ID,
  ONLINE_VARIANT_ORDER,
  VARIANTS,
  getVariantLabel,
  getVariantTargetRoundWins,
  normalizeVariantId,
} from '../src/engine/moves.js';
import { shouldAutoAdvanceRound } from '../src/engine/matchRules.js';
import {
  decideRpsPokerCommand,
  getRpsPokerLegalCommands,
  normalizeRpsPokerCommand,
  pokerCommandFromMove,
  pokerMoveFromCommand,
} from '../src/engine/variants/rpsPokerDomain.js';
import { getRpsPokerShowdownWinner } from '../src/engine/variants/rpsPokerRules.js';
import { MemoryPlayerStore } from './playerStore.js';
import { NullAnalyticsStore } from './analyticsStore.js';

const MAX_TIMEOUT_STRIKES = 3;
const DEFAULT_COUNTDOWN_MS = 3000;
const NO_SELECTION_GRACE_MS = 90 * 1000;
const NO_CONTEST_WAITING_MS = 3000;
const READY_WAITING_SAFE_MS = (7 * 58) + 750 + (3 * 1000);
const READY_WAITING_COUNTDOWN_MS = 5000;
const DEFAULT_TURN_MS = 20 * 1000;
const RPS_POKER_TURN_MS = 45 * 1000;
const DEFAULT_REVEAL_MS = 2 * 750;
const INITIAL_SEARCH_SPREAD = 100;
const SEARCH_SPREAD_PER_SECOND = 75;
const DEFAULT_DISPLAY_NAME = 'Guest';
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_CHAT_MESSAGE_LENGTH = 200;
const MAX_CHAT_HISTORY = 100;
const DEFAULT_CHALLENGE_MS = 15 * 1000;
const BOARD_WIDTH = 760;
const BOARD_VIEW_HEIGHT = 450;
const BOARD_MAX_HEIGHT = BOARD_VIEW_HEIGHT * 3.5;
const BOARD_ROW_HEIGHT = 60;
const BOARD_TEXT_COLUMNS = 37;
const BOARD_MAX_OPERATIONS = 800;
const BOARD_MAX_POINTS = 180;
const BOARD_STROKES_PER_SECOND = 12;
const BOARD_COLORS = Object.freeze(['black', 'red', 'blue', 'purple', 'green']);
const TIEBREAKER_BANS_PER_PLAYER = 3;

export class RankedDuelService {
  constructor({
    playerStore = new MemoryPlayerStore(),
    analyticsStore = new NullAnalyticsStore(),
    countdownMs = DEFAULT_COUNTDOWN_MS,
    noSelectionGraceMs = NO_SELECTION_GRACE_MS,
    noContestWaitingMs = NO_CONTEST_WAITING_MS,
    noContestCountdownMs = READY_WAITING_COUNTDOWN_MS,
    turnMs = DEFAULT_TURN_MS,
    revealMs = DEFAULT_REVEAL_MS,
    allowDebugWinGame = false,
    now = () => Date.now(),
    createId = randomUUID,
    challengeMs = DEFAULT_CHALLENGE_MS,
    reconnectGraceMs = 3000,
    onError = () => {},
  } = {}) {
    this.playerStore = playerStore;
    this.analyticsStore = analyticsStore;
    this.analyticsQueue = Promise.resolve();
    this.countdownMs = countdownMs;
    this.noSelectionGraceMs = noSelectionGraceMs;
    this.noContestWaitingMs = noContestWaitingMs;
    this.noContestCountdownMs = noContestCountdownMs;
    this.turnMs = turnMs;
    this.revealMs = revealMs;
    this.allowDebugWinGame = allowDebugWinGame;
    this.now = now;
    this.createId = createId;
    this.challengeMs = challengeMs;
    this.reconnectGraceMs = reconnectGraceMs;
    this.onError = onError;
    this.sessions = new Map();
    this.sessionsByPlayerId = new Map();
    this.disconnectedSessions = new Map();
    this.queue = [];
    this.rooms = new Map();
    this.chatMessages = [];
    this.boardOperations = [];
    this.boardTop = 0;
    this.boardNextY = 68;
    this.challenges = new Map();
  }

  async connect(client, authenticatedPlayerId, sessionToken) {
    const playerId = authenticatedPlayerId || this.createId();
    const reconnectingSession = this.disconnectedSessions.get(playerId);
    if (reconnectingSession && reconnectingSession.roomId && this.rooms.has(reconnectingSession.roomId)) {
      clearTimeout(reconnectingSession.reconnectTimer);
      reconnectingSession.reconnectTimer = null;
      reconnectingSession.client = client;
      reconnectingSession.closed = false;
      this.disconnectedSessions.delete(playerId);
      this.sessions.set(reconnectingSession.id, reconnectingSession);
      this.sessionsByPlayerId.set(playerId, reconnectingSession);
      const room = this.rooms.get(reconnectingSession.roomId);
      room.disconnectedPlayerKey = null;
      if (room.variantId === 'rpsPoker' && room.phase === 'choosing' && room.reconnectRemainingMs !== null) {
        room.deadlineAt = this.now() + room.reconnectRemainingMs;
        this.setRoomTimer(room, () => this.handleChoosingDeadline(room), room.reconnectRemainingMs);
        room.reconnectRemainingMs = null;
      }
      this.sendHello(reconnectingSession, sessionToken);
      this.broadcastRoom(room);
      return reconnectingSession;
    }
    const existingSession = this.sessionsByPlayerId.get(playerId);

    if (existingSession && !existingSession.closed) {
      await this.disconnect(existingSession);
      existingSession.client.close?.(4001, 'guest connected elsewhere');
    }

    const player = await this.playerStore.getPlayer(playerId);
    const session = {
      id: this.createId(),
      player,
      displayName: DEFAULT_DISPLAY_NAME,
      variantId: DEFAULT_VARIANT_ID,
      client,
      roomId: null,
      queuedAt: null,
      presence: 'idle',
      inLobby: false,
      challengeId: null,
      boardStrokeTimes: [],
      closed: false,
    };

    this.sessions.set(session.id, session);
    this.sessionsByPlayerId.set(player.id, session);
    this.sendHello(session, sessionToken);

    return session;
  }

  sendHello(session, sessionToken) {
    this.send(session, 'hello', {
      playerId: session.player.id,
      rating: session.player.rating,
      wins: session.player.wins,
      losses: session.player.losses,
      sessionToken,
      debugTools: {
        winGame: this.allowDebugWinGame,
        revealComputerMove: this.allowDebugWinGame,
        sceneGallery: this.allowDebugWinGame,
      },
    });
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

    if (message.type === 'enterLobby') {
      session.displayName = sanitizeDisplayName(message.displayName);
      session.inLobby = true;
      session.presence = 'idle';
      this.sendLobbyState(session);
      this.broadcastRoster();
      return;
    }

    if (message.type === 'setDisplayName') {
      session.displayName = sanitizeDisplayName(message.displayName);
      this.broadcastRoster();
      return;
    }

    if (message.type === 'setPresence') {
      this.setPresence(session, message.presence);
      return;
    }

    if (message.type === 'setReady') {
      this.setReady(session, message.ready === true);
      return;
    }

    if (message.type === 'sendChat') {
      this.sendChat(session, message.text, message.color);
      return;
    }

    if (message.type === 'sendBoardStroke' || message.type === 'sendBoardErase') {
      this.sendBoardStroke(session, message, message.type === 'sendBoardErase' ? 'erase' : 'stroke');
      return;
    }

    if (message.type === 'challengePlayer') {
      this.challengePlayer(session, message.playerId);
      return;
    }

    if (message.type === 'cancelChallenge') {
      this.resolveChallenge(session, message.challengeId, 'cancelled');
      return;
    }

    if (message.type === 'respondChallenge') {
      this.resolveChallenge(session, message.challengeId, message.accept === true ? 'accepted' : 'declined');
      return;
    }

    if (message.type === 'cancelQueue') {
      this.leaveQueue(session);
      return;
    }

    if (message.type === 'submitMove') {
      this.submitMove(session, message.moveId, message.revision);
      return;
    }

    if (message.type === 'submitPokerCommand') {
      this.submitPokerCommand(session, message.command, message.revision);
      return;
    }

    if (message.type === 'submitBan' || message.type === 'submitVariantPick') {
      this.submitVariantPick(session, message.variantId);
      return;
    }

    if (message.type === 'submitContinue') {
      this.submitContinue(session);
      return;
    }

    if (message.type === 'forfeitMatch') {
      if (session.roomId && session.roomId === message.matchId) this.forfeitRoom(session.roomId, session);
      return;
    }

    if (message.type === 'debugWinGame') {
      this.debugWinGame(session);
    }
  }

  disconnect(session) {
    if (session.closed) {
      return;
    }

    session.closed = true;
    this.resolveSessionChallenge(session, 'cancelled');
    this.leaveQueue(session);
    this.sessions.delete(session.id);

    if (this.sessionsByPlayerId.get(session.player.id) === session) {
      this.sessionsByPlayerId.delete(session.player.id);
    }

    if (session.roomId && this.reconnectGraceMs > 0) {
      const room = this.rooms.get(session.roomId);
      if (room && room.phase !== 'gameOver') {
        room.disconnectedPlayerKey = this.getPlayerKey(room, session);
        if (room.variantId === 'rpsPoker' && room.phase === 'choosing') {
          room.reconnectRemainingMs = Math.max(0, room.deadlineAt - this.now());
          this.clearRoomTimer(room);
        }
        this.disconnectedSessions.set(session.player.id, session);
        this.broadcastRoom(room);
        session.reconnectTimer = setTimeout(() => {
          this.disconnectedSessions.delete(session.player.id);
          this.forfeitRoom(session.roomId, session);
        }, this.reconnectGraceMs);
        session.reconnectTimer.unref?.();
        return;
      }
    }
    if (session.roomId) {
      return this.forfeitRoom(session.roomId, session);
    }
    this.broadcastRoster();
  }

  setPresence(session, presence) {
    if (!session.inLobby || session.roomId || session.challengeId) return;
    if (this.queue.includes(session)) {
      session.presence = 'ready';
      this.broadcastRoster();
      return;
    }
    const normalized = presence === 'playing_computer' ? 'playing_computer' : 'idle';
    this.leaveQueue(session);
    session.presence = normalized;
    this.broadcastRoster();
  }

  setReady(session, ready) {
    if (!session.inLobby || session.roomId || session.challengeId) return;
    if (!ready) {
      this.leaveQueue(session);
      session.presence = 'idle';
      this.broadcastRoster();
      return;
    }
    const wasQueued = this.queue.includes(session);
    session.presence = 'ready';
    if (!wasQueued) this.announceReady(session);
    this.joinRanked(session);
    this.broadcastRoster();
  }

  announceReady(session) {
    const text = `${session.displayName} is ready to play!`;
    const rowSpan = Math.max(1, Math.min(3, Math.ceil(text.length / BOARD_TEXT_COLUMNS)));
    const message = {
      id: this.createId(),
      sentAt: new Date(this.now()).toISOString(),
      playerId: session.player.id,
      displayName: '',
      text,
      color: 'black',
      rowY: this.boardNextY,
      rowSpan,
      system: true,
    };
    this.boardNextY += rowSpan * BOARD_ROW_HEIGHT;
    this.chatMessages.push(message);
    if (this.chatMessages.length > MAX_CHAT_HISTORY) this.chatMessages.shift();
    this.boardOperations.push({ kind: 'text', id: message.id, message });
    this.broadcastLobby('chatMessage', { message });
    this.trimBoard();
    this.enforceBoardOperationLimit();
  }

  sendChat(session, value, requestedColor) {
    if (!session.inLobby) return;
    const text = sanitizeChatMessage(value);
    if (!text) return;
    const color = normalizeBoardColor(requestedColor);
    const rowSpan = Math.max(1, Math.min(3, Math.ceil((session.displayName.length + text.length + 2) / BOARD_TEXT_COLUMNS)));
    const message = {
      id: this.createId(),
      sentAt: new Date(this.now()).toISOString(),
      playerId: session.player.id,
      displayName: session.displayName,
      text,
      color,
      rowY: this.boardNextY,
      rowSpan,
    };
    this.boardNextY += rowSpan * BOARD_ROW_HEIGHT;
    this.chatMessages.push(message);
    if (this.chatMessages.length > MAX_CHAT_HISTORY) this.chatMessages.shift();
    this.boardOperations.push({ kind: 'text', id: message.id, message });
    this.broadcastLobby('chatMessage', { message });
    this.trimBoard();
    this.enforceBoardOperationLimit();
  }

  sendBoardStroke(session, value, tool) {
    if (!session.inLobby || !this.allowBoardStroke(session)) return;
    const points = sanitizeBoardPoints(value.points, this.boardTop, this.boardTop + BOARD_MAX_HEIGHT);
    if (points.length < 2) return;
    const operation = {
      kind: tool,
      id: this.createId(),
      playerId: session.player.id,
      color: tool === 'erase' ? null : normalizeBoardColor(value.color),
      width: tool === 'erase' ? 120 : 5,
      points,
    };
    this.boardOperations.push(operation);
    this.broadcastLobby('boardOperation', { operation });
    this.enforceBoardOperationLimit();
  }

  allowBoardStroke(session) {
    const cutoff = this.now() - 1000;
    session.boardStrokeTimes = session.boardStrokeTimes.filter((time) => time > cutoff);
    if (session.boardStrokeTimes.length >= BOARD_STROKES_PER_SECOND) return false;
    session.boardStrokeTimes.push(this.now());
    return true;
  }

  trimBoard() {
    const overflow = this.boardNextY - this.boardTop - BOARD_MAX_HEIGHT;
    if (overflow <= 0) return;
    const amount = Math.ceil(overflow / BOARD_ROW_HEIGHT) * BOARD_ROW_HEIGHT;
    this.boardTop += amount;
    this.boardOperations = this.boardOperations.filter((operation) => operationTouchesBoard(operation, this.boardTop));
    this.broadcastLobby('boardTrim', { top: this.boardTop });
  }

  enforceBoardOperationLimit() {
    if (this.boardOperations.length <= BOARD_MAX_OPERATIONS) return;
    this.boardOperations = [];
    this.chatMessages = [];
    this.boardTop = 0;
    this.boardNextY = 68;
    this.broadcastLobby('boardReset', { board: this.getBoardSnapshot() });
  }

  getBoardSnapshot() {
    return {
      width: BOARD_WIDTH,
      viewHeight: BOARD_VIEW_HEIGHT,
      maxHeight: BOARD_MAX_HEIGHT,
      rowHeight: BOARD_ROW_HEIGHT,
      top: this.boardTop,
      nextY: this.boardNextY,
      operations: this.boardOperations,
    };
  }

  challengePlayer(challenger, playerId) {
    const challenged = this.sessionsByPlayerId.get(playerId);
    if (!this.isChallengeAvailable(challenger) || !this.isChallengeAvailable(challenged) || challenger === challenged) {
      this.sendLobbyState(challenger);
      return;
    }
    this.leaveQueue(challenger);
    this.leaveQueue(challenged);
    const challenge = {
      id: this.createId(),
      challengerId: challenger.player.id,
      challengedId: challenged.player.id,
      expiresAt: this.now() + this.challengeMs,
      timer: null,
    };
    challenge.timer = setTimeout(() => this.finishChallenge(challenge, 'expired'), this.challengeMs);
    challenge.timer.unref?.();
    this.challenges.set(challenge.id, challenge);
    challenger.challengeId = challenge.id;
    challenged.challengeId = challenge.id;
    challenger.presence = 'idle';
    challenged.presence = 'idle';
    this.send(challenged, 'challengeReceived', { challenge: this.getPublicChallenge(challenge) });
    this.broadcastChallenge(challenge, 'pending');
    this.broadcastRoster();
  }

  resolveChallenge(session, challengeId, resolution) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || session.challengeId !== challenge.id) {
      this.sendLobbyState(session);
      return;
    }
    const isChallenger = session.player.id === challenge.challengerId;
    const isChallenged = session.player.id === challenge.challengedId;
    if ((resolution === 'cancelled' && !isChallenger) || (['accepted', 'declined'].includes(resolution) && !isChallenged)) return;
    this.finishChallenge(challenge, resolution);
  }

  finishChallenge(challenge, resolution) {
    if (!this.challenges.has(challenge.id)) return;
    clearTimeout(challenge.timer);
    this.challenges.delete(challenge.id);
    const challenger = this.sessionsByPlayerId.get(challenge.challengerId);
    const challenged = this.sessionsByPlayerId.get(challenge.challengedId);
    for (const session of [challenger, challenged]) {
      if (session?.challengeId === challenge.id) session.challengeId = null;
    }
    this.broadcastChallenge(challenge, resolution);
    if (resolution === 'accepted' && this.isChallengeAvailable(challenger) && this.isChallengeAvailable(challenged)) {
      this.createRoom(challenger, challenged);
    }
    this.broadcastRoster();
  }

  resolveSessionChallenge(session, resolution) {
    if (session.challengeId) {
      const challenge = this.challenges.get(session.challengeId);
      if (challenge) this.finishChallenge(challenge, resolution);
    }
  }

  isChallengeAvailable(session) {
    return Boolean(session && !session.closed && session.inLobby && !session.roomId && !session.challengeId && session.presence !== 'playing_computer');
  }

  getPublicChallenge(challenge) {
    const challenger = this.sessionsByPlayerId.get(challenge.challengerId);
    const challenged = this.sessionsByPlayerId.get(challenge.challengedId);
    return {
      id: challenge.id,
      challengerId: challenge.challengerId,
      challengedId: challenge.challengedId,
      challengerName: challenger?.displayName ?? 'Guest',
      challengedName: challenged?.displayName ?? 'Guest',
      challengerRating: challenger?.player.rating ?? null,
      challengedRating: challenged?.player.rating ?? null,
      expiresAt: challenge.expiresAt,
    };
  }

  broadcastChallenge(challenge, status) {
    const payload = { challenge: this.getPublicChallenge(challenge), status };
    for (const playerId of [challenge.challengerId, challenge.challengedId]) {
      const session = this.sessionsByPlayerId.get(playerId);
      if (session && !session.closed) this.send(session, 'challengeUpdated', payload);
    }
  }

  sendLobbyState(session) {
    this.send(session, 'lobbyState', {
      self: this.getPublicPlayer(session),
      players: this.getPublicRoster(),
      recentMessages: this.chatMessages,
      board: this.getBoardSnapshot(),
      pendingChallenge: session.challengeId ? this.getPublicChallenge(this.challenges.get(session.challengeId)) : null,
    });
  }

  broadcastRoster() {
    this.broadcastLobby('rosterUpdated', { players: this.getPublicRoster() });
  }

  broadcastLobby(type, payload) {
    for (const session of this.sessions.values()) {
      if (!session.closed && session.inLobby) this.send(session, type, payload);
    }
  }

  getPublicRoster() {
    return [...this.sessions.values()].filter((session) => session.inLobby && !session.closed).map((session) => this.getPublicPlayer(session));
  }

  getPublicPlayer(session) {
    return {
      playerId: session.player.id,
      displayName: session.displayName,
      rating: session.player.rating,
      presence: session.roomId ? 'in_ranked_match' : session.challengeId ? 'idle' : session.presence,
      challengePending: Boolean(session.challengeId),
    };
  }

  joinRanked(session) {
    if (session.roomId) {
      return;
    }

    if (!this.queue.includes(session)) {
      session.queuedAt = this.now();
      session.presence = 'ready';
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

      const ratingDelta = Math.abs(candidate.player.rating - session.player.rating);

      if (ratingDelta <= spread) {
        return index;
      }
    }

    return -1;
  }

  createRoom(p1Session, p2Session) {
    this.resolveSessionChallenge(p1Session, 'cancelled');
    this.resolveSessionChallenge(p2Session, 'cancelled');
    p1Session.presence = 'in_ranked_match';
    p2Session.presence = 'in_ranked_match';
    const startedAt = new Date(this.now()).toISOString();
    const room = {
      id: this.createId(),
      revision: 0,
      phase: 'countdown',
      players: {
        p1: p1Session,
        p2: p2Session,
      },
      variants: ONLINE_VARIANT_ORDER,
      variantPicks: {},
      variantPickOrder: [],
      variantBans: { p1: [], p2: [] },
      variantBanOrder: [],
      bannedVariants: [],
      variantSelectionRound: 1,
      remainingVariants: [],
      currentVariantIndex: 0,
      gameWins: createEmptyScore(),
      gameResults: [],
      roundWins: createEmptyScore(),
      timeoutStrikes: {
        p1: 0,
        p2: 0,
      },
      roundState: createRoundState({ variantId: DEFAULT_VARIANT_ID }),
      pendingMoves: createPendingMoves(),
      pendingContinues: createPendingContinues(),
      pendingNextVariant: false,
      pendingTiebreaker: false,
      readyPlayerKey: null,
      waitingPlayerKey: null,
      noContestWaitingAt: null,
      noContestCountdownAt: null,
      noContest: false,
      reconnectRemainingMs: null,
      timer: null,
      deadlineAt: this.now() + this.countdownMs,
      winner: null,
      ratings: null,
      variantId: DEFAULT_VARIANT_ID,
      startedAt,
      analyticsGameNumber: 1,
      analyticsRoundNumber: 1,
      analyticsTurnCount: 0,
      analyticsRoundTurnNumber: 0,
    };

    p1Session.roomId = room.id;
    p2Session.roomId = room.id;
    this.rooms.set(room.id, room);
    this.track('recordMatchStarted', {
      matchId: room.id,
      startedAt,
      p1Id: p1Session.player.id,
      p2Id: p2Session.player.id,
    });
    this.broadcastRoom(room);
    this.setRoomTimer(room, () => this.beginVariantSelection(room), this.countdownMs);
    this.broadcastRoster();
    return room;
  }

  beginBanning(room) {
    this.beginVariantSelection(room);
  }

  beginVariantSelection(room, { tiebreaker = false } = {}) {
    if (room.phase === 'gameOver') {
      return;
    }

    const previousPhase = room.phase;
    room.phase = 'variantSelection';
    room.variantPicks = {};
    room.variantPickOrder = [];
    room.variantBans = { p1: [], p2: [] };
    room.variantBanOrder = [];
    room.variantSelectionRound = tiebreaker ? 2 : 1;
    room.pendingTiebreaker = false;
    room.deadlineAt = null;
    const transitionId = ['revealed', 'roundOver'].includes(previousPhase)
      ? 'variant-selection-started'
      : null;
    this.broadcastRoom(room, {}, transitionId);
  }

  submitBan(session, variantId) {
    this.submitVariantPick(session, variantId);
  }

  submitVariantPick(session, variantId) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'variantSelection') {
      return;
    }

    const playerKey = this.getPlayerKey(room, session);
    const normalizedVariantId = normalizeVariantId(variantId);

    if (room.variantSelectionRound === 2) {
      this.submitTiebreakerBan(room, session, playerKey, normalizedVariantId);
      return;
    }

    if (
      !room.variants.includes(normalizedVariantId)
      || room.variantPicks[playerKey]
      || room.bannedVariants.includes(normalizedVariantId)
      || Object.values(room.variantPicks).includes(normalizedVariantId)
    ) {
      this.send(session, 'error', { message: 'illegal variant pick' });
      return;
    }

    room.variantPicks = {
      ...room.variantPicks,
      [playerKey]: normalizedVariantId,
    };
    room.variantPickOrder = [...room.variantPickOrder, playerKey];
    this.track('recordVariantPick', {
      matchId: room.id,
      selectionRound: room.variantSelectionRound,
      playerSlot: playerKey,
      variantId: normalizedVariantId,
      pickOrder: room.variantPickOrder.length,
      pickedAt: new Date(this.now()).toISOString(),
    });
    this.send(session, 'variantPickAccepted', { variantId: normalizedVariantId });
    this.broadcastRoom(room);

    if (room.variantPicks.p1 && room.variantPicks.p2) {
      this.beginVariantSet(room);
    }
  }

  submitTiebreakerBan(room, session, playerKey, variantId) {
    const playerBans = room.variantBans[playerKey];
    const acceptedBans = room.variantBanOrder.map((ban) => ban.variantId);

    if (
      !room.variants.includes(variantId)
      || playerBans.length >= TIEBREAKER_BANS_PER_PLAYER
      || room.bannedVariants.includes(variantId)
      || acceptedBans.includes(variantId)
    ) {
      this.send(session, 'error', { message: 'illegal variant ban' });
      return;
    }

    room.variantBans = {
      ...room.variantBans,
      [playerKey]: [...playerBans, variantId],
    };
    room.variantBanOrder = [
      ...room.variantBanOrder,
      { playerKey, variantId },
    ];
    room.bannedVariants = [...room.bannedVariants, variantId];
    this.track('recordVariantPick', {
      matchId: room.id,
      selectionRound: room.variantSelectionRound,
      playerSlot: playerKey,
      variantId,
      pickOrder: room.variantBanOrder.length,
      pickedAt: new Date(this.now()).toISOString(),
    });
    this.send(session, 'variantPickAccepted', { variantId });
    this.broadcastRoom(room);

    if (
      room.variantBans.p1.length === TIEBREAKER_BANS_PER_PLAYER
      && room.variantBans.p2.length === TIEBREAKER_BANS_PER_PLAYER
    ) {
      this.beginTiebreakerVariant(room);
    }
  }

  beginVariantSet(room) {
    if (room.variantSelectionRound === 2) {
      this.beginTiebreakerVariant(room);
      return;
    }

    room.remainingVariants = room.variantPickOrder.map((playerKey) => room.variantPicks[playerKey]);
    room.currentVariantIndex = 0;
    room.gameWins = createEmptyScore();
    room.gameResults = [];
    room.roundWins = createEmptyScore();
    room.analyticsGameNumber = 1;
    room.analyticsRoundNumber = 1;
    room.analyticsTurnCount = 0;
    room.analyticsRoundTurnNumber = 0;
    room.pendingNextVariant = false;
    room.variantId = room.remainingVariants[0] ?? DEFAULT_VARIANT_ID;
    room.roundState = createRoundState({ variantId: room.variantId });
    this.beginChoosing(room);
  }

  beginTiebreakerVariant(room) {
    const availableVariants = room.variants.filter((variantId) => !room.bannedVariants.includes(variantId));
    if (availableVariants.length !== 1) {
      throw new Error(`Expected one tiebreaker variant, found ${availableVariants.length}`);
    }
    const [tiebreakerVariant] = availableVariants;

    room.remainingVariants = [tiebreakerVariant];
    room.currentVariantIndex = 0;
    room.roundWins = createEmptyScore();
    room.analyticsGameNumber = room.gameResults.length + 1;
    room.analyticsRoundNumber = 1;
    room.analyticsTurnCount = 0;
    room.analyticsRoundTurnNumber = 0;
    room.pendingNextVariant = false;
    room.variantId = tiebreakerVariant;
    room.roundState = createRoundState({ variantId: room.variantId });
    this.beginChoosing(room);
  }

  beginChoosing(room) {
    if (room.phase === 'gameOver') {
      return;
    }

    const previousPhase = room.phase;
    room.phase = 'choosing';
    room.pendingMoves = createPendingMoves();
    room.pendingContinues = createPendingContinues();
    room.pendingNextVariant = false;
    room.pokerEvents = [];
    room.pokerTransition = null;
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = this.now() + this.noSelectionGraceMs;
    room.noContestCountdownAt = room.noContestWaitingAt + this.noContestWaitingMs;
    room.deadlineAt = room.variantId === 'rpsPoker'
      ? this.now() + RPS_POKER_TURN_MS
      : room.noContestCountdownAt + this.noContestCountdownMs;
    const transitionId = previousPhase === 'variantSelection'
      ? 'variant-set-started'
      : previousPhase === 'roundOver' ? 'next-turn-started' : null;
    room.decisionRevision = room.revision + 1;
    this.broadcastRoom(room, {}, transitionId);
    this.setRoomTimer(room, () => this.handleChoosingDeadline(room), room.deadlineAt - this.now());
  }

  submitMove(session, moveId, revision = null) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'choosing') {
      return;
    }
    if (room.variantId === 'rpsPoker') {
      this.submitPokerCommand(session, pokerCommandFromMove(moveId), revision);
      return;
    }
    if (revision !== null && revision < (room.decisionRevision ?? room.revision)) {
      this.send(session, 'error', { message: 'stale move' });
      return;
    }

    const playerKey = this.getPlayerKey(room, session);
    const legalMoves = getPlayerLegalMoves(room.roundState, playerKey);
    if (
      room.variantId === 'rpsPoker'
      && room.roundState.phase === 'betting'
      && room.roundState.actor !== playerKey
    ) {
      this.send(session, 'error', { message: 'not your turn' });
      return;
    }

    const command = lockMove(room.pendingMoves, playerKey, moveId, legalMoves);
    if (command.status === 'illegal') {
      this.send(session, 'error', { message: 'illegal move' });
      return;
    }
    if (command.status === 'duplicate') {
      this.send(session, 'moveAccepted', { moveId: command.moveId });
      return;
    }

    room.pendingMoves = command.moves;
    this.send(session, 'moveAccepted', { moveId: command.moveId });

    if (room.variantId === 'rpsPoker' && room.roundState.phase === 'betting') {
      this.resolveRoomTurn(room);
      return;
    }

    if (command.status === 'complete') {
      this.resolveRoomTurn(room);
      return;
    }

    this.beginReadyWaiting(room, command.readyPlayerId);
  }

  submitPokerCommand(session, command, revision = null) {
    const room = this.rooms.get(session.roomId);
    if (!room || room.variantId !== 'rpsPoker' || room.phase !== 'choosing') {
      this.send(session, 'error', { message: 'not an RPS Poker match' });
      return;
    }
    if (revision !== null && revision < (room.decisionRevision ?? room.revision)) {
      this.send(session, 'error', { message: 'stale poker command' });
      return;
    }
    const normalized = normalizeRpsPokerCommand(command);
    if (!normalized) {
      this.send(session, 'error', { message: 'invalid poker command' });
      return;
    }
    const playerKey = this.getPlayerKey(room, session);
    const previousState = structuredClone(room.roundState);
    const resolved = decideRpsPokerCommand(room.roundState, playerKey, normalized);
    if (!resolved.ok) {
      this.send(session, 'error', { message: resolved.error });
      return;
    }

    room.roundState = {
      ...resolved.state,
      status: resolved.state.winner ? 'finished' : 'playing',
      winner: resolved.state.winner ?? null,
    };
    room.pokerEvents = structuredClone(resolved.events);
    this.send(session, 'pokerCommandAccepted', { command: normalized });

    if (previousState.phase === 'lock' && room.roundState.phase === 'lock') {
      this.clearRoomTimer(room);
      room.readyPlayerKey = playerKey;
      room.waitingPlayerKey = playerKey === 'p1' ? 'p2' : 'p1';
      room.noContestWaitingAt = null;
      room.noContestCountdownAt = null;
      room.deadlineAt = this.now() + RPS_POKER_TURN_MS;
      this.broadcastRoom(room);
      this.setRoomTimer(room, () => this.handleChoosingDeadline(room), RPS_POKER_TURN_MS);
      return;
    }

    this.finishPokerCommand(room, previousState, normalized);
  }

  finishPokerCommand(room, previousState, command) {
    this.clearRoomTimer(room);
    const actingPlayer = previousState.phase === 'betting'
      ? previousState.actor
      : Object.keys(room.roundState.locked).find((key) => !previousState.locked[key]);
    const firstLocker = previousState.phase === 'lock'
      ? Object.keys(previousState.locked)[0] ?? null
      : null;
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;
    room.pokerTransition = createPokerTransitionFromEvents(
      previousState,
      room.roundState,
      room.pokerEvents,
      command,
      firstLocker,
    );
    room.phase = 'revealed';
    room.analyticsTurnCount += 1;
    room.analyticsRoundTurnNumber += 1;

    const moveId = pokerMoveFromCommand(command);
    this.track('recordTurn', {
      matchId: room.id,
      variantGameNumber: room.analyticsGameNumber,
      roundNumber: room.analyticsRoundNumber,
      turnNumber: room.analyticsRoundTurnNumber,
      variantId: room.variantId,
      p1Move: actingPlayer === 'p1' ? moveId : null,
      p2Move: actingPlayer === 'p2' ? moveId : null,
      roundWinnerSlot: room.roundState.winner ?? null,
      recordedAt: new Date(this.now()).toISOString(),
    });

    if (room.roundState.winner) {
      room.roundWins = {
        ...room.roundWins,
        [room.roundState.winner]: room.roundWins[room.roundState.winner] + 1,
      };
    }

    this.broadcastRoom(room, {}, 'turn-revealed');
    const revealDelay = getPokerPresentationDelay(room.pokerTransition);
    this.setRoomTimer(room, () => {
      const gameWinnerKey = getGameWinner(room.roundWins, room.variantId);
      if (gameWinnerKey) {
        this.finishVariantGame(room, gameWinnerKey);
        return;
      }
      this.beginChoosing(room);
    }, revealDelay);
  }

  beginReadyWaiting(room, readyPlayerKey) {
    room.readyPlayerKey = readyPlayerKey;
    room.waitingPlayerKey = readyPlayerKey === 'p1' ? 'p2' : 'p1';
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;
    room.deadlineAt = this.now() + (room.variantId === 'rpsPoker' ? RPS_POKER_TURN_MS : this.turnMs);
    this.broadcastRoom(room);
    this.setRoomTimer(
      room,
      () => this.handleChoosingDeadline(room),
      room.variantId === 'rpsPoker' ? RPS_POKER_TURN_MS : this.turnMs,
    );
  }

  handleChoosingDeadline(room) {
    if (room.phase !== 'choosing') {
      return;
    }
    if (room.variantId === 'rpsPoker' && room.roundState.phase === 'betting') {
      this.finishRoundByTimeout(room, room.roundState.actor);
      return;
    }
    if (room.variantId === 'rpsPoker' && room.roundState.phase === 'lock' && room.waitingPlayerKey) {
      this.finishRoundByTimeout(room, room.waitingPlayerKey);
      return;
    }

    const outcome = getMoveDeadlineOutcome(room.pendingMoves);
    if (outcome.type === 'no-contest') {
      this.finishRoomByNoContest(room);
      return;
    }

    if (outcome.type === 'timeout') {
      this.finishRoundByTimeout(room, outcome.loser);
      return;
    }

    this.resolveRoomTurn(room);
  }

  resolveRoomTurn(room) {
    if (room.phase !== 'choosing') {
      return;
    }

    this.clearRoomTimer(room);
    const readyPlayerKey = room.readyPlayerKey;
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;

    const previousPokerState = room.variantId === 'rpsPoker'
      ? structuredClone(room.roundState)
      : null;
    const p1Move = room.pendingMoves.p1 ?? getFallbackMove(room.roundState, 'p1');
    const p2Move = room.pendingMoves.p2 ?? getFallbackMove(room.roundState, 'p2');
    const resolved = resolveMatchTurn({
      roundState: room.roundState,
      roundWins: room.roundWins,
      p1Move,
      p2Move,
      variantId: room.variantId,
    });
    const { turn } = resolved;

    if (!turn.ok) {
      throw new Error(turn.error);
    }

    room.roundState = turn.state;
    room.pokerEvents = room.variantId === 'rpsPoker'
      ? structuredClone(turn.result.domainEvents ?? [])
      : [];
    room.pokerTransition = previousPokerState
      ? createPokerTransition(
        previousPokerState,
        room.roundState,
        { p1: p1Move, p2: p2Move },
        readyPlayerKey,
      )
      : null;
    room.roundWins = resolved.roundWins;
    room.phase = 'revealed';
    room.analyticsTurnCount += 1;
    room.analyticsRoundTurnNumber += 1;

    this.track('recordTurn', {
      matchId: room.id,
      variantGameNumber: room.analyticsGameNumber,
      roundNumber: room.analyticsRoundNumber,
      turnNumber: room.analyticsRoundTurnNumber,
      variantId: room.variantId,
      p1Move,
      p2Move,
      roundWinnerSlot: room.roundState.winner ?? null,
      recordedAt: new Date(this.now()).toISOString(),
    });

    const revealPayload = room.variantId === 'rpsPoker' && previousPokerState?.phase === 'lock'
      ? {}
      : { revealedMoves: { p1: p1Move, p2: p2Move } };
    this.broadcastRoom(room, revealPayload, 'turn-revealed');

    const revealDelay = room.variantId === 'rpsPoker'
      ? getPokerPresentationDelay(room.pokerTransition)
      : shouldAutoAdvanceRound(room.variantId) ? 0 : this.revealMs;
    this.setRoomTimer(room, () => {
      const gameWinnerKey = getGameWinner(room.roundWins, room.variantId);
      const action = getPostTurnAction({
        roundFinished: room.roundState.status === 'finished',
        gameFinished: Boolean(gameWinnerKey),
        autoAdvanceRound: shouldAutoAdvanceRound(room.variantId),
      });
      if (action === 'continue-turn') {
        this.beginChoosing(room);
        return;
      }

      if (action === 'finish-game') {
        this.finishVariantGame(room, gameWinnerKey);
        return;
      }

      if (action === 'advance-round') {
        this.beginNextRound(room);
        return;
      }

      this.beginRoundOver(room);
    }, revealDelay);
  }

  beginRoundOver(room) {
    if (room.phase === 'gameOver') {
      return;
    }

    room.phase = 'roundOver';
    room.pendingContinues = createPendingContinues();
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.deadlineAt = null;
    this.broadcastRoom(room, {}, 'round-ended');
  }

  submitContinue(session) {
    const room = this.rooms.get(session.roomId);

    if (!room || room.phase !== 'roundOver') {
      return;
    }

    const playerKey = this.getPlayerKey(room, session);

    const command = lockContinue(room.pendingContinues, playerKey);
    if (command.status === 'duplicate') {
      this.send(session, 'continueAccepted', {});
      return;
    }
    room.pendingContinues = command.continues;
    this.send(session, 'continueAccepted', {});

    if (command.status === 'complete') {
      this.beginNextRound(room);
      return;
    }

    this.beginContinueReadyWaiting(room, command.readyPlayerId);
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
    room.roundTimeout = null;
    if (room.pendingNextVariant) {
      this.beginNextVariant(room);
      return;
    }

    if (room.pendingTiebreaker) {
      this.beginVariantSelection(room, { tiebreaker: true });
      return;
    }

    const game = startNextRound({
      variantId: room.variantId,
      roundState: room.roundState,
      roundWins: room.roundWins,
    });
    room.roundState = game.roundState;
    room.roundWins = game.roundWins;
    room.analyticsRoundNumber += 1;
    room.analyticsRoundTurnNumber = 0;
    this.beginChoosing(room);
  }

  beginNextVariant(room) {
    room.currentVariantIndex += 1;
    room.variantId = room.remainingVariants[room.currentVariantIndex] ?? room.variantId;
    room.roundWins = createEmptyScore();
    room.analyticsGameNumber = room.gameResults.length + 1;
    room.analyticsRoundNumber = 1;
    room.analyticsTurnCount = 0;
    room.analyticsRoundTurnNumber = 0;
    room.pendingNextVariant = false;
    const game = createVariantGame({ variantId: room.variantId });
    room.roundState = game.roundState;
    room.roundWins = game.roundWins;
    this.beginChoosing(room);
  }

  finishRoomByNoContest(room) {
    this.clearRoomTimer(room);
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.noContestWaitingAt = null;
    room.noContestCountdownAt = null;
    room.noContest = true;

    const leaderKey = getRoomLeader(room);

    if (!leaderKey) {
      room.phase = 'gameOver';
      room.winner = null;
      room.ratings = null;
      this.broadcastRoom(room, {}, 'match-ended');
      this.recordMatchEnd(room, 'no_contest');
      this.releaseRoom(room);
      return;
    }

    this.finishRoom(room, leaderKey);
  }

  finishRoundByTimeout(room, loserKey) {
    this.clearRoomTimer(room);

    const timeout = resolveRoundTimeout({
      roundState: room.roundState,
      roundWins: room.roundWins,
      loser: loserKey,
      variantId: room.variantId,
    });
    const winnerKey = timeout.winner;
    room.roundTimeout = {
      loser: loserKey,
      winner: winnerKey,
      strikes: room.timeoutStrikes[loserKey] + 1,
    };
    this.applyTimeoutStrike(room, loserKey);
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.roundState = timeout.roundState;
    room.roundWins = timeout.roundWins;

    if (room.phase === 'gameOver') {
      return;
    }

    room.phase = 'revealed';
    this.broadcastRoom(room, {
      timeout: {
        loser: loserKey,
        winner: winnerKey,
        strikes: room.timeoutStrikes[loserKey],
      },
    }, 'turn-revealed');

    const revealDelay = shouldAutoAdvanceRound(room.variantId) ? 0 : this.revealMs;
    this.setRoomTimer(room, () => {
      if (getGameWinner(room.roundWins, room.variantId)) {
        this.finishVariantGame(room, winnerKey);
        return;
      }

      if (shouldAutoAdvanceRound(room.variantId)) {
        this.beginNextRound(room);
        return;
      }

      this.beginRoundOver(room);
    }, revealDelay);
  }

  applyTimeoutStrike(room, loserKey) {
    const winnerKey = loserKey === 'p1' ? 'p2' : 'p1';
    room.timeoutStrikes[loserKey] += 1;

    if (room.timeoutStrikes[loserKey] >= MAX_TIMEOUT_STRIKES) {
      this.finishRoom(room, winnerKey);
    }
  }

  finishVariantGame(room, winnerKey) {
    room.gameWins[winnerKey] += 1;
    room.gameResults.push({
      variantId: room.variantId,
      roundWins: { ...room.roundWins },
      winner: winnerKey,
    });
    this.track('recordVariantGame', {
      matchId: room.id,
      gameNumber: room.analyticsGameNumber,
      selectionRound: room.variantSelectionRound,
      variantId: room.variantId,
      winnerSlot: winnerKey,
      roundWins: { ...room.roundWins },
      turnCount: room.analyticsTurnCount,
      endedAt: new Date(this.now()).toISOString(),
    });

    if (room.gameWins[winnerKey] >= 2 || room.variantSelectionRound === 2 || room.remainingVariants.length <= 1) {
      this.finishRoom(room, winnerKey);
      return;
    }

    if (room.currentVariantIndex >= room.remainingVariants.length - 1) {
      room.bannedVariants = [...new Set([
        ...room.bannedVariants,
        ...room.remainingVariants,
      ])];
      room.pendingTiebreaker = true;
      this.beginRoundOver(room);
      return;
    }

    room.pendingNextVariant = true;
    this.beginRoundOver(room);
  }

  debugWinGame(session) {
    if (!this.allowDebugWinGame) {
      return;
    }

    const room = this.rooms.get(session.roomId);

    if (!room || room.pendingNextVariant || room.pendingTiebreaker || !['choosing', 'revealed', 'roundOver'].includes(room.phase)) {
      return;
    }

    this.clearRoomTimer(room);
    room.pendingMoves = createPendingMoves();
    room.pendingContinues = createPendingContinues();
    room.readyPlayerKey = null;
    room.waitingPlayerKey = null;
    room.deadlineAt = null;
    const winnerKey = this.getPlayerKey(room, session);
    room.roundWins[winnerKey] = getVariantTargetRoundWins(room.variantId);
    this.finishVariantGame(room, winnerKey);
  }

  async finishRoom(room, winnerKey) {
    if (room.phase === 'gameOver') {
      return;
    }

    this.clearRoomTimer(room);
    room.phase = 'gameOver';
    room.winner = winnerKey;

    try {
      room.ratings = await this.saveMatchResult(room, winnerKey);
    } catch (error) {
      room.ratings = null;
      this.onError(error);
    }

    this.broadcastRoom(room, {}, 'match-ended');
    this.recordMatchEnd(room, room.noContest ? 'no_contest' : (room.disconnectedPlayerKey ? 'forfeit' : 'completed'));
    this.releaseRoom(room);
  }

  async saveMatchResult(room, winnerKey) {
    const loserKey = winnerKey === 'p1' ? 'p2' : 'p1';
    const winner = room.players[winnerKey].player;
    const loser = room.players[loserKey].player;
    const playedAt = new Date(this.now()).toISOString();
    const saved = await this.playerStore.recordMatchResult({
      matchId: room.id,
      winnerId: winner.id,
      loserId: loser.id,
      playedAt,
    });

    room.players[winnerKey].player = saved.winner;
    room.players[loserKey].player = saved.loser;

    return {
      [winnerKey]: {
        before: winner.rating,
        after: saved.winner.rating,
      },
      [loserKey]: {
        before: loser.rating,
        after: saved.loser.rating,
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
    room.disconnectedPlayerKey = forfeitingKey;

    if (room.remainingVariants.length === 0) {
      this.clearRoomTimer(room);
      room.phase = 'gameOver';
      room.winner = null;
      room.ratings = null;
      room.aborted = true;
      this.broadcastRoom(room);
      this.recordMatchEnd(room, 'aborted');
      this.releaseRoom(room);
      return;
    }

    return this.finishRoom(room, winnerKey);
  }

  getPlayerKey(room, session) {
    return room.players.p1 === session ? 'p1' : 'p2';
  }

  getOnlinePlayerCount() {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }

  broadcastRoom(room, extra = {}, transitionId = null) {
    room.revision += 1;
    for (const playerKey of ['p1', 'p2']) {
      if (transitionId) {
        this.send(room.players[playerKey], 'matchTransition', {
          matchId: room.id,
          revision: room.revision,
          transitionId,
        });
      }
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
      revision: room.revision,
      variantId: room.variantId,
      currentVariantId: room.variantId,
      variants: room.variants.map((variantId) => ({
        id: variantId,
        label: getVariantLabel(variantId),
      })),
      bans: room.variantPicks,
      variantPicks: room.variantPicks,
      variantPickOrder: room.variantPickOrder,
      variantBans: room.variantBans,
      variantBanOrder: room.variantBanOrder,
      variantBanCounts: {
        p1: room.variantBans.p1.length,
        p2: room.variantBans.p2.length,
      },
      variantBanQuota: TIEBREAKER_BANS_PER_PLAYER,
      bannedVariants: room.bannedVariants,
      tiebreakerVariantId: room.variantSelectionRound === 2 && room.remainingVariants.length === 1
        ? room.remainingVariants[0]
        : null,
      variantSelectionRound: room.variantSelectionRound,
      remainingVariants: room.remainingVariants,
      gameWins: room.gameWins,
      gameResults: room.gameResults,
      pendingNextVariant: room.pendingNextVariant,
      pendingTiebreaker: room.pendingTiebreaker,
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
      timeout: room.roundTimeout ?? null,
      variantState: getPublicVariantState(
        room.roundState,
        playerKey,
        room.pokerTransition?.kind === 'showdown' && room.phase === 'revealed',
      ),
      pokerTransition: room.phase === 'revealed' && room.pokerTransition
        ? structuredClone(room.pokerTransition)
        : null,
      pokerEvents: room.variantId === 'rpsPoker'
        ? getPublicPokerEvents(room.pokerEvents, playerKey)
        : [],
      winner: room.winner,
      ratings: room.ratings,
      disconnectedPlayerKey: room.disconnectedPlayerKey ?? null,
      aborted: room.aborted ?? false,
      players: {
        p1: {
          displayName: room.players.p1.displayName,
          resource: getPlayerResource(room.roundState.players.p1),
          bullets: getPlayerResource(room.roundState.players.p1),
          legalMoves: getPublicLegalMoves(room, 'p1'),
          canContinue: room.phase === 'roundOver' && !room.pendingContinues.p1,
          rating: isRanked ? room.players.p1.player.rating : null,
        },
        p2: {
          displayName: room.players.p2.displayName,
          resource: getPlayerResource(room.roundState.players.p2),
          bullets: getPlayerResource(room.roundState.players.p2),
          legalMoves: getPublicLegalMoves(room, 'p2'),
          canContinue: room.phase === 'roundOver' && !room.pendingContinues.p2,
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
    if (session.closed) {
      return;
    }

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
    room.players.p1.presence = 'idle';
    room.players.p2.presence = 'idle';
    this.rooms.delete(room.id);
    this.broadcastRoster();
  }

  recordMatchEnd(room, status) {
    this.track('recordMatchEnded', {
      matchId: room.id,
      endedAt: new Date(this.now()).toISOString(),
      status,
      winnerSlot: room.winner ?? null,
      gameWins: { ...room.gameWins },
      timeoutStrikes: { ...room.timeoutStrikes },
      disconnectedSlot: room.disconnectedPlayerKey ?? null,
    });
  }

  track(method, payload) {
    this.analyticsQueue = this.analyticsQueue
      .then(() => this.analyticsStore[method](payload))
      .catch((error) => this.onError(error));
    return this.analyticsQueue;
  }
}

function getPublicVariantState(roundState, playerKey, revealPokerLocks = false) {
  const {
    variantId,
    turn,
    status,
    winner,
    players,
    history,
    ...variantState
  } = roundState;
  const publicState = structuredClone(variantState);
  if (roundState.variantId === 'rpsPoker' && publicState.locked) {
    const ownLock = publicState.locked[playerKey];
    publicState.locked = ownLock ? { [playerKey]: ownLock } : {};
    if (revealPokerLocks) {
      publicState.locked = structuredClone(variantState.locked);
    }
  }
  return publicState;
}

function getPublicLegalMoves(room, playerKey) {
  if (room.phase !== 'choosing') return [];
  if (room.variantId !== 'rpsPoker') return getPlayerLegalMoves(room.roundState, playerKey);
  return getRpsPokerLegalCommands(room.roundState, playerKey).map(pokerMoveFromCommand);
}

function createPokerTransition(previous, next, moves, readyPlayerKey = null) {
  const actor = previous.phase === 'betting' ? previous.actor : null;
  const encodedAction = actor ? moves[actor] : null;
  const action = encodedAction ? String(encodedAction).split(':')[0] : 'lock';
  const isShowdown = previous.phase === 'betting'
    && (action === 'call' || (action === 'check' && previous.checkedOnce));
  const kind = previous.phase === 'lock'
    ? 'lock-complete'
    : action === 'fold'
      ? 'fold'
      : isShowdown
        ? 'showdown'
        : action;
  return {
    kind,
    actor,
    firstLocker: previous.phase === 'lock' ? readyPlayerKey : null,
    action: encodedAction,
    previous: publicPokerTransitionState(previous),
    next: publicPokerTransitionState(next),
    revealedLocks: isShowdown ? structuredClone(previous.locked) : null,
    payoutWinner: action === 'fold'
      ? (actor === 'p1' ? 'p2' : 'p1')
      : isShowdown ? getRpsPokerShowdownWinner(previous.locked, previous.community) : null,
    community: previous.community ?? next.community ?? null,
    winner: next.winner ?? null,
  };
}

function createPokerTransitionFromEvents(previous, next, events, command, firstLocker = null) {
  const types = new Set(events.map((event) => event.type));
  const kind = types.has('COMMUNITY_REVEALED')
    ? 'lock-complete'
    : types.has('PLAYER_FOLDED')
      ? 'fold'
      : types.has('CARDS_REVEALED')
        ? 'showdown'
        : types.has('BET_RAISED')
          ? 'raise'
          : types.has('BET_PLACED')
            ? 'bet'
            : 'check';
  const payout = events.find((event) => event.type === 'POT_AWARDED');
  const revealed = events.find((event) => event.type === 'CARDS_REVEALED');
  return {
    kind,
    actor: previous.phase === 'betting' ? previous.actor : null,
    firstLocker,
    action: pokerMoveFromCommand(command),
    previous: publicPokerTransitionState(previous),
    next: publicPokerTransitionState(next),
    revealedLocks: revealed?.cards ? structuredClone(revealed.cards) : null,
    payoutWinner: payout?.player ?? null,
    community: previous.community ?? next.community ?? null,
    winner: next.winner ?? null,
  };
}

function getPublicPokerEvents(events, playerKey) {
  return structuredClone(events ?? []).map((event) => {
    if (event.type !== 'CARD_LOCKED') return event;
    return event.player === playerKey ? event : { type: 'OPPONENT_CARD_LOCKED' };
  });
}

function publicPokerTransitionState(state) {
  return {
    stacks: structuredClone(state.stacks),
    committed: structuredClone(state.committed),
    pot: state.pot,
    ante: state.ante,
    hand: state.hand,
    phase: state.phase,
    actor: state.actor,
    firstActor: state.firstActor,
  };
}

function getPokerPresentationDelay(transition) {
  if (!transition) return DEFAULT_REVEAL_MS;
  if (transition.kind === 'lock-complete') return 1500;
  if (transition.kind === 'fold' || transition.kind === 'showdown') {
    return 1800 + Math.min(2000, Math.max(0, transition.previous?.pot ?? 0) * 110);
  }
  return 500;
}

function getFallbackMove(state, playerKey) {
  const legalMoves = getPlayerLegalMoves(state, playerKey);
  return legalMoves.includes('reload') ? 'reload' : legalMoves[0];
}

function createEmptyScore() {
  return {
    p1: 0,
    p2: 0,
  };
}

function getRoomLeader(room) {
  if (room.gameWins.p1 !== room.gameWins.p2) {
    return room.gameWins.p1 > room.gameWins.p2 ? 'p1' : 'p2';
  }

  if (room.roundWins.p1 !== room.roundWins.p2) {
    return room.roundWins.p1 > room.roundWins.p2 ? 'p1' : 'p2';
  }

  return null;
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

export function sanitizeChatMessage(value) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/\s+/g, ' ').trim()).slice(0, MAX_CHAT_MESSAGE_LENGTH).join('');
}

function normalizeBoardColor(value) {
  return BOARD_COLORS.includes(value) ? value : 'black';
}

function sanitizeBoardPoints(value, minY, maxY) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, BOARD_MAX_POINTS).flatMap((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
    return [{
      x: Math.round(Math.max(0, Math.min(BOARD_WIDTH, point.x)) * 10) / 10,
      y: Math.round(Math.max(minY, Math.min(maxY, point.y)) * 10) / 10,
    }];
  });
}

function operationTouchesBoard(operation, top) {
  if (operation.kind === 'text') {
    return operation.message.rowY + (operation.message.rowSpan * BOARD_ROW_HEIGHT) > top;
  }
  return operation.points?.some((point) => point.y >= top);
}
