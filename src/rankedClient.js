import { getServerSocketUrl } from './serverUrl.js';

const GUEST_SESSION_TOKEN_KEY = 'tapTapShootX.guestSessionToken';

export class RankedClient {
  constructor({ onQueue = () => {}, onSnapshot, onClose, onError = () => {}, onLobbyState = () => {}, onRoster = () => {}, onChat = () => {}, onBoardOperation = () => {}, onBoardTrim = () => {}, onBoardReset = () => {}, onChallenge = () => {} }) {
    this.onQueue = onQueue;
    this.onSnapshot = onSnapshot;
    this.onClose = onClose;
    this.onError = onError;
    this.onLobbyState = onLobbyState;
    this.onRoster = onRoster;
    this.onChat = onChat;
    this.onBoardOperation = onBoardOperation;
    this.onBoardTrim = onBoardTrim;
    this.onBoardReset = onBoardReset;
    this.onChallenge = onChallenge;
    this.socket = null;
    this.sessionToken = readLocalStorage(GUEST_SESSION_TOKEN_KEY);
    this.transitionsByRevision = new Map();
    this.debugTools = createDisabledDebugTools();
    this.shouldReconnect = false;
    this.reconnectTimer = null;
  }

  connect(displayName = '', variantId = 'tapTapShootY') {
    this.close(false);
    this.displayName = displayName;
    this.variantId = variantId;
    this.hasHello = false;
    this.didTryLocalFallback = false;
    this.transitionsByRevision.clear();
    this.debugTools = createDisabledDebugTools();
    this.shouldReconnect = true;

    const socketUrl = this.getSocketUrl();
    this.openSocket(socketUrl);
  }

  openSocket(socketUrl) {
    this.debug('connect', { socketUrl, displayName: this.displayName });
    const socket = new WebSocket(socketUrl);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.debug('open', { socketUrl });
      socket.send(JSON.stringify({ type: 'authenticateGuest', token: this.sessionToken }));
    });

    socket.addEventListener('message', (event) => {
      this.handleMessage(JSON.parse(event.data));
    });

    socket.addEventListener('error', () => {
      this.debug('error', { socketUrl });
    });

    socket.addEventListener('close', (event) => {
      this.debug('close', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      if (this.socket !== socket) {
        return;
      }

      if (!this.hasHello && this.shouldTryLocalFallback(socketUrl)) {
        this.didTryLocalFallback = true;
        this.openSocket(this.getLocalFallbackSocketUrl());
        return;
      }

      this.socket = null;
      this.onClose({ code: event.code, reason: event.reason });
      if (this.shouldReconnect && event.code !== 4001) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.openSocket(this.getSocketUrl()), 1500);
      }
    });
  }

  submitMove(snapshot, moveId) {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !snapshot ||
      snapshot.phase !== 'choosing' ||
      !snapshot.players[snapshot.playerKey].legalMoves.includes(moveId)
    ) {
      return false;
    }

    this.send({
      type: 'submitMove',
      matchId: snapshot.matchId,
      moveId,
    });
    return true;
  }

  submitVariantPick(snapshot, variantId) {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !snapshot ||
      snapshot.phase !== 'variantSelection' ||
      snapshot.variantPicks?.[snapshot.playerKey] ||
      Object.values(snapshot.variantPicks ?? snapshot.bans ?? {}).includes(variantId) ||
      (snapshot.bannedVariants ?? []).includes(variantId)
    ) {
      return false;
    }

    this.send({
      type: 'submitVariantPick',
      matchId: snapshot.matchId,
      variantId,
    });
    return true;
  }

  submitBan(snapshot, variantId) {
    return this.submitVariantPick(snapshot, variantId);
  }


  submitContinue(snapshot) {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !snapshot ||
      snapshot.phase !== 'roundOver' ||
      !snapshot.players[snapshot.playerKey].canContinue
    ) {
      return false;
    }

    this.send({
      type: 'submitContinue',
      matchId: snapshot.matchId,
    });
    return true;
  }

  debugWinGame(snapshot) {
    if (
      !this.debugTools.winGame ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !snapshot ||
      snapshot.pendingNextVariant ||
      snapshot.pendingTiebreaker ||
      !['choosing', 'revealed', 'roundOver'].includes(snapshot.phase)
    ) {
      return false;
    }

    this.send({ type: 'debugWinGame', matchId: snapshot.matchId });
    return true;
  }

  close(reconnect = false) {
    this.shouldReconnect = reconnect;
    clearTimeout(this.reconnectTimer);
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    socket.close();
  }

  getSocketUrl() {
    return getServerSocketUrl('/ws');
  }

  getLocalFallbackSocketUrl() {
    const url = new URL('ws://localhost:8787/ws');

    return url.toString();
  }

  shouldTryLocalFallback(socketUrl) {
    if (this.didTryLocalFallback || window.location.protocol !== 'http:') {
      return false;
    }

    const pageHost = window.location.hostname;
    const isLocalPage = pageHost === 'localhost'
      || pageHost === '127.0.0.1'
      || pageHost === '::1'
      || pageHost === '[::1]';

    if (!isLocalPage) {
      return false;
    }

    try {
      return new URL(socketUrl).port !== '8787';
    } catch {
      return false;
    }
  }

  handleMessage(message) {
    this.debug('message', { type: message.type, phase: message.phase, matchId: message.matchId });

    if (message.type === 'error') {
      this.onError(message.message || 'server error');
      return;
    }

    if (message.type === 'hello') {
      this.hasHello = true;
      this.playerId = message.playerId;
      this.sessionToken = message.sessionToken;
      this.debugTools = {
        winGame: message.debugTools?.winGame === true,
        revealComputerMove: message.debugTools?.revealComputerMove === true,
        sceneGallery: message.debugTools?.sceneGallery === true,
      };
      this.debug('hello', { playerId: this.playerId, rating: message.rating });
      writeLocalStorage(GUEST_SESSION_TOKEN_KEY, this.sessionToken);
      this.send({ type: 'enterLobby', displayName: this.displayName });
      return;
    }

    if (message.type === 'lobbyState') {
      this.onLobbyState(message);
      return;
    }

    if (message.type === 'rosterUpdated') {
      this.onRoster(message.players ?? []);
      return;
    }

    if (message.type === 'chatMessage') {
      this.onChat(message.message);
      return;
    }

    if (message.type === 'boardOperation') {
      this.onBoardOperation(message.operation);
      return;
    }

    if (message.type === 'boardTrim') {
      this.onBoardTrim(message.top);
      return;
    }

    if (message.type === 'boardReset') {
      this.onBoardReset(message.board);
      return;
    }

    if (message.type === 'challengeReceived' || message.type === 'challengeUpdated') {
      this.onChallenge(message);
      return;
    }

    if (message.type === 'queue') {
      this.onQueue();
      return;
    }

    if (message.type === 'matchTransition') {
      this.transitionsByRevision.set(message.revision, message);
      return;
    }

    if (message.type === 'matchState') {
      const transition = this.transitionsByRevision.get(message.revision) ?? null;
      this.transitionsByRevision.delete(message.revision);
      this.onSnapshot(message, transition);
    }
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.debug('send', { type: message.type, matchId: message.matchId });
      this.socket.send(JSON.stringify(message));
    }
  }

  setReady(ready) { this.send({ type: 'setReady', ready }); }
  setPresence(presence) { this.send({ type: 'setPresence', presence }); }
  setDisplayName(displayName) { this.displayName = displayName; this.send({ type: 'setDisplayName', displayName }); }
  sendChat(text, color = 'black') { this.send({ type: 'sendChat', text, color }); }
  sendBoardStroke(points, color = 'black') { this.send({ type: 'sendBoardStroke', points, color }); }
  sendBoardErase(points) { this.send({ type: 'sendBoardErase', points }); }
  challengePlayer(playerId) { this.send({ type: 'challengePlayer', playerId }); }
  cancelChallenge(challengeId) { this.send({ type: 'cancelChallenge', challengeId }); }
  respondChallenge(challengeId, accept) { this.send({ type: 'respondChallenge', challengeId, accept }); }

  debug(event, payload = {}) {
    console.debug('[ranked]', event, payload);
  }
}

export class RankedUpdateQueue {
  constructor() {
    this.items = [];
    this.latestRevision = 0;
  }

  push(snapshot, transition = null) {
    if (snapshot.revision <= this.latestRevision) {
      return false;
    }
    this.latestRevision = snapshot.revision;
    if (transition) {
      this.items.push({ snapshot, transition });
      return true;
    }

    const last = this.items.at(-1);
    if (last && !last.transition) {
      last.snapshot = snapshot;
      return true;
    }
    this.items.push({ snapshot, transition: null });
    return true;
  }

  shift() {
    return this.items.shift() ?? null;
  }

  clear() {
    this.items.length = 0;
    this.latestRevision = 0;
  }

  get length() {
    return this.items.length;
  }
}

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ranked still works for this tab; it just cannot persist the player id.
  }
}

function createDisabledDebugTools() {
  return {
    winGame: false,
    revealComputerMove: false,
    sceneGallery: false,
  };
}
