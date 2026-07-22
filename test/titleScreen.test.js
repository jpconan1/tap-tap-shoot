import assert from 'node:assert/strict';
import test from 'node:test';

import { createTitleScreen } from '../src/presentation/titleScreen.js';

function createScreen(overrides = {}) {
  return createTitleScreen({
    app: {},
    getState: () => ({
      isSoundEnabled: false,
      isBoilEnabled: true,
      musicVolume: 0.75,
      sfxVolume: 0.25,
      rankedDisplayName: 'Guest',
    }),
    getSharpCanvasContext() {},
    loadImageAsset() {},
    mountSpriteRenderers() {},
    requestMusicTrack() {},
    renderOnlinePlayerCount: () => '',
    startOnlineStatusPolling() {},
    enterLobby() {},
    generateName() {},
    toggleSound() {},
    toggleBoil() {},
    enableAudio() {},
    setVolume() {},
    escapeHtml: (value) => value,
    maxDisplayNameLength: 50,
    ...overrides,
  });
}

test('shared settings markup reflects current audio and animation state', () => {
  const markup = createScreen().renderSettingsControls();

  assert.match(markup, /data-action="toggle-sound"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /data-doodle="title\/boiling_toggle_on"/);
  assert.match(markup, /data-volume-kind="music"[^>]*aria-valuenow="75"/);
  assert.match(markup, /data-volume-kind="sfx"[^>]*aria-valuenow="25"/);
});

test('shared settings handlers delegate state changes to main', () => {
  const listeners = {};
  const buttons = {
    '[data-action="toggle-sound"]': { addEventListener: (_, handler) => { listeners.sound = handler; } },
    '[data-action="toggle-boil"]': { addEventListener: (_, handler) => { listeners.boil = handler; } },
  };
  const changes = [];
  const screen = createScreen({
    toggleSound: (options) => changes.push(['sound', options]),
    toggleBoil: (options) => changes.push(['boil', options]),
  });

  screen.installSettingsHandlers({
    querySelector: (selector) => buttons[selector],
    querySelectorAll: () => [],
  }, () => changes.push(['render']));
  listeners.sound();
  listeners.boil();

  assert.deepEqual(changes, [
    ['sound', { rerender: false }],
    ['render'],
    ['boil', { rerender: false }],
    ['render'],
  ]);
});
