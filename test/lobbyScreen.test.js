import assert from 'node:assert/strict';
import test from 'node:test';

import { createLobbyScreen, orderLobbyPlayers } from '../src/presentation/lobbyScreen.js';

const players = [
  { playerId: 'busy', displayName: 'Busy', presence: 'in_ranked_match', rating: 1000 },
  { playerId: 'ready', displayName: 'Ready', presence: 'ready', rating: 1000 },
  { playerId: 'self', displayName: 'Self', presence: 'idle', rating: 1000 },
  { playerId: 'idle', displayName: 'Idle', presence: 'idle', rating: 1000 },
];

function createScreen(state) {
  return createLobbyScreen({
    app: {},
    boardColors: [],
    whiteboard: {},
    getState: () => state,
    setRosterOpen() {},
    escapeHtml: (value) => String(value).replaceAll('<', '&lt;'),
    renderSettingsControls: () => '<settings />',
    installSettingsHandlers() {},
    renderOpenCurtainBorder: () => '',
    mountSpriteRenderers() {},
    stopOnlineStatusPolling() {},
    requestMusicTrack() {},
    onOpenPlayer() {},
    onToggleMatchmaking() {},
    onOpenPractice() {},
    onOpenSettings() {},
    onBack() {},
    onCloseOverlay() {},
    onChallengePlayer() {},
    onSendChat() {},
    onRespondChallenge() {},
    onCancelChallenge() {},
    onCloseChallenge() {},
  });
}

test('lobby roster puts self first, then ready, idle, and busy players', () => {
  assert.deepEqual(orderLobbyPlayers(players, 'self').map((player) => player.playerId), ['self', 'ready', 'idle', 'busy']);
});

test('self lobby overlay embeds shared settings controls', () => {
  const screen = createScreen({ players, self: players[2], selectedPlayerId: 'self', challenge: null });
  assert.match(screen.renderOverlay(screenState(screen, { players, self: players[2], selectedPlayerId: 'self' })), /<settings \/>/);
});

test('idle player overlay offers ranked challenge and escapes names', () => {
  const state = { players: [{ ...players[3], displayName: '<Idle>' }], self: players[2], selectedPlayerId: 'idle', challenge: null };
  const screen = createScreen(state);
  const markup = screen.renderOverlay(state);
  assert.match(markup, /&lt;Idle>/);
  assert.match(markup, /data-action="challenge-player"/);
});

function screenState(_screen, state) {
  return { challenge: null, challengeStatus: null, ...state };
}
