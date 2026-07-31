import assert from 'node:assert/strict';
import test from 'node:test';

import { createRankedScreens, getScoreboardVariantScore } from '../src/presentation/rankedScreens.js';

const snapshot = {
  playerKey: 'player2',
  opponentKey: 'player1',
  gameResults: [{ variantId: 'rps', roundWins: { player1: 1, player2: 3 } }],
};

function createScreens() {
  return createRankedScreens({
    app: {},
    variants: [{ id: 'rps', name: 'RPS', buttonDoodle: 'rps-button' }],
    getSnapshot: () => snapshot,
    getDisplayName: () => 'Guest',
    isBanAnimationComplete: () => false,
    markBanAnimationComplete() {},
    escapeHtml: (value) => value,
    getVariant: () => ({ id: 'rps', name: 'RPS', buttonDoodle: 'rps-button' }),
    renderVariantButton: () => '',
    renderOpenCurtainBorder: () => '',
    renderStaticDoodle: (doodle) => `<${doodle}>`,
    getWinCounterDoodle: (_variantId, wins) => `wins-${wins}`,
    renderSheetButton: (action, doodle) => `<button data-action="${action}">${doodle}</button>`,
    mountSpriteRenderers() {},
    mountReadyWaitingOverlays() {},
    mountBanAnimations() {},
    onLeave() {},
    onPickVariant() {},
    onShowVariantDetail() {},
    onContinue() {},
    onMainMenu() {},
  });
}

test('scoreboard scores follow local player perspective', () => {
  assert.deepEqual(getScoreboardVariantScore(snapshot, 'rps'), { p1: 3, p2: 1 });
  assert.deepEqual(getScoreboardVariantScore(snapshot, 'missing'), { p1: 0, p2: 0 });
});

test('scoreboard action reflects next variant, tiebreaker, and game over', () => {
  const screens = createScreens();

  assert.match(screens.renderAction({ pendingNextVariant: true }, false), /next_variant_button/);
  assert.match(screens.renderAction({ pendingTiebreaker: true }, false), /tiebreaker_button/);
  assert.match(screens.renderAction({ phase: 'gameOver' }, false), /main_menu_button/);
  assert.match(screens.renderAction({ pendingNextVariant: true }, true), /scoreboard-ready/);
  assert.equal(screens.renderAction({}, false), '');
});
