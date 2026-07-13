const RANKED_PLAYER_ID_KEY = 'tapTapShootX.rankedPlayerId';

export class RankedClient {
  constructor({ onQueue, onSnapshot, onClose, onError = () => {} }) {
    this.onQueue = onQueue;
    this.onSnapshot = onSnapshot;
    this.onClose = onClose;
    this.onError = onError;
    this.socket = null;
    this.playerId = readLocalStorage(RANKED_PLAYER_ID_KEY);
    this.transitionsByRevision = new Map();
  }

  connect(displayName = '', variantId = 'tapTapShootY') {
    this.close();
    this.displayName = displayName;
    this.variantId = variantId;
    this.hasHello = false;
    this.didTryLocalFallback = false;
    this.transitionsByRevision.clear();

    const socketUrl = this.getSocketUrl();
    this.openSocket(socketUrl);
  }

  openSocket(socketUrl) {
    this.debug('connect', { socketUrl, playerId: this.playerId, displayName: this.displayName });
    const socket = new WebSocket(socketUrl);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.debug('open', { socketUrl });
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
      this.onClose();
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

  close() {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    socket.close();
  }

  getSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.protocol === 'file:' ? 'localhost:8787' : window.location.host;
    const url = new URL(`${protocol}//${host}/ws`);

    if (this.playerId) {
      url.searchParams.set('playerId', this.playerId);
    }

    return url.toString();
  }

  getLocalFallbackSocketUrl() {
    const url = new URL('ws://localhost:8787/ws');

    if (this.playerId) {
      url.searchParams.set('playerId', this.playerId);
    }

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

    if (message.type === 'hello') {
      this.hasHello = true;
      this.playerId = message.playerId;
      this.debug('hello', { playerId: this.playerId, rating: message.rating });
      writeLocalStorage(RANKED_PLAYER_ID_KEY, this.playerId);
      this.send({ type: 'joinRanked', displayName: this.displayName, variantId: this.variantId });
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
