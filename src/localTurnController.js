import { lockMove } from './engine/matchCommands.js';

export class LocalTurnController {
  constructor({ setTimer, clearTimer }) {
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.choice = null;
  }

  getOrCreate(key, { computerDelayMs = null, onComputerDue = null } = {}) {
    if (this.choice?.key === key) return this.choice;

    this.clear();
    this.choice = {
      key,
      moves: { p1: null, p2: null },
      phase: 'neutral',
      readyPlayerId: null,
      waitingPlayerId: null,
      splitApplied: false,
      computerTimer: computerDelayMs === null || !onComputerDue
        ? null
        : this.setTimer(onComputerDue, computerDelayMs),
      safeTimer: null,
      timeoutTimer: null,
    };
    return this.choice;
  }

  beginWaiting(readyPlayerId, { safeDurationMs, onSafeElapsed }) {
    const choice = this.choice;
    if (!choice) return null;

    choice.phase = 'safe';
    choice.readyPlayerId = readyPlayerId;
    choice.waitingPlayerId = readyPlayerId === 'p1' ? 'p2' : 'p1';
    choice.safeTimer = this.setTimer(onSafeElapsed, safeDurationMs);
    return choice;
  }

  submitMove(playerId, moveId, legalMoves) {
    if (!this.choice) return { status: 'missing', moves: null };
    const result = lockMove(this.choice.moves, playerId, moveId, legalMoves);
    if (result.moves !== this.choice.moves) this.choice.moves = result.moves;
    return result;
  }

  beginCountdown({ durationMs, onElapsed }) {
    const choice = this.choice;
    if (!choice?.waitingPlayerId || choice.moves[choice.waitingPlayerId]) return null;

    choice.phase = 'countdown';
    choice.timeoutTimer = this.setTimer(() => onElapsed(choice.waitingPlayerId), durationMs);
    return choice;
  }

  clearPhaseTimers() {
    if (!this.choice) return;
    this.#clearTimer('safeTimer');
    this.#clearTimer('timeoutTimer');
  }

  clear() {
    if (!this.choice) return;
    this.#clearTimer('computerTimer');
    this.clearPhaseTimers();
    this.choice = null;
  }

  #clearTimer(key) {
    const timer = this.choice?.[key];
    if (!timer) return;
    this.clearTimer(timer);
    this.choice[key] = null;
  }
}
