const RANKED_PLAYER_ID_KEY = 'tapTapShoot.rankedPlayerId';

export class RankedClient {
  constructor({ onQueue, onSnapshot, onClose }) {
    this.onQueue = onQueue;
    this.onSnapshot = onSnapshot;
    this.onClose = onClose;
    this.socket = null;
    this.playerId = readLocalStorage(RANKED_PLAYER_ID_KEY);
  }

  connect(displayName = '') {
    this.close();
    this.displayName = displayName;

    const socket = new WebSocket(this.getSocketUrl());
    this.socket = socket;

    socket.addEventListener('message', (event) => {
      this.handleMessage(JSON.parse(event.data));
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
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

  handleMessage(message) {
    if (message.type === 'hello') {
      this.playerId = message.playerId;
      writeLocalStorage(RANKED_PLAYER_ID_KEY, this.playerId);
      this.send({ type: 'joinRanked', displayName: this.displayName });
      return;
    }

    if (message.type === 'queue') {
      this.onQueue();
      return;
    }

    if (message.type === 'matchState') {
      this.onSnapshot(message);
    }
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
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
