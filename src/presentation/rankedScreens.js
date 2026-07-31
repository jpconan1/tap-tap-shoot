const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const VARIANT_BUTTON_FRAME_WIDTH = 325;
const VARIANT_BUTTON_FRAME_HEIGHT = 128;

export function getScoreboardVariantScore(snapshot, variantId) {
  const result = snapshot?.gameResults?.find((gameResult) => gameResult.variantId === variantId);
  return {
    p1: result?.roundWins?.[snapshot.playerKey] ?? 0,
    p2: result?.roundWins?.[snapshot.opponentKey] ?? 0,
  };
}

export function createRankedScreens({
  app,
  getSnapshot,
  getDisplayName,
  escapeHtml,
  getVariant,
  renderOpenCurtainBorder,
  renderStaticDoodle,
  getWinCounterDoodle,
  renderSheetButton,
  mountSpriteRenderers,
  mountReadyWaitingOverlays,
  onContinue,
  onMainMenu,
}) {
  function renderWinCounter(variantId, wins) {
    return renderStaticDoodle(getWinCounterDoodle(variantId, wins), 64, 64, 'scoreboard-win-counter');
  }

  function renderTiebreaker(snapshot, result) {
    if (!result) return snapshot?.phase === 'gameOver' ? '' : renderStaticDoodle('tie_breaker_button', 325, 128, 'scoreboard-tiebreaker');
    const variant = getVariant(result.variantId);
    const score = getScoreboardVariantScore(snapshot, result.variantId);
    return `<div class="scoreboard-game-row">${renderWinCounter(result.variantId, score.p1)}${renderStaticDoodle(variant.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}${renderWinCounter(result.variantId, score.p2)}</div>`;
  }

  function renderAction(snapshot, isLocalReady) {
    if (snapshot?.phase === 'gameOver') return `<div class="scoreboard-next-variant-wrap">${renderSheetButton('main-menu', 'main_menu_button', 'Main menu', 'scoreboard-next-variant')}</div>`;
    if (!snapshot?.pendingNextVariant && !snapshot?.pendingTiebreaker) return '';
    const action = isLocalReady
      ? '<canvas class="scoreboard-ready scoreboard-next-ready" width="300" height="256" aria-hidden="true"></canvas>'
      : snapshot.pendingTiebreaker
        ? renderSheetButton('continue', 'tiebreaker_button', 'Tiebreaker', 'scoreboard-next-variant')
        : renderSheetButton('continue', 'next_variant_button', 'Next variant', 'scoreboard-next-variant');
    return `<div class="scoreboard-next-variant-wrap ${isLocalReady ? 'is-ready' : ''}">${action}</div>`;
  }

  function renderScoreboard() {
    const snapshot = getSnapshot();
    const localName = snapshot?.players?.[snapshot.playerKey]?.displayName ?? getDisplayName();
    const opponentName = snapshot?.players?.[snapshot.opponentKey]?.displayName ?? 'Opponent';
    const pickedIds = (snapshot?.variantPickOrder ?? []).map((key) => snapshot?.variantPicks?.[key]).filter(Boolean);
    const completedIds = (snapshot?.gameResults ?? []).map((result) => result.variantId).filter(Boolean);
    const orderedIds = completedIds.length >= 2 ? completedIds : pickedIds;
    const [firstId, secondId] = orderedIds.length >= 2 ? orderedIds : snapshot?.remainingVariants ?? [];
    const first = getVariant(firstId);
    const second = getVariant(secondId);
    const firstScore = getScoreboardVariantScore(snapshot, firstId);
    const secondScore = getScoreboardVariantScore(snapshot, secondId);
    const readyPlayerId = snapshot?.readyPlayerKey === snapshot?.playerKey ? 'p1' : snapshot?.readyPlayerKey === snapshot?.opponentKey ? 'p2' : null;
    const ready = (show) => show ? '<canvas class="scoreboard-ready" width="300" height="256" aria-hidden="true"></canvas>' : '';

    app.innerHTML = `
      <section class="online-interstitial scoreboard-stage" aria-label="Scoreboard">
        ${renderOpenCurtainBorder()}
        <div class="scoreboard-name scoreboard-name-left">${escapeHtml(localName)}</div>
        <div class="scoreboard-name scoreboard-name-right">${escapeHtml(opponentName)}${ready(readyPlayerId === 'p2')}</div>
        ${renderStaticDoodle('header-scoreboard', 1214, 256, 'scoreboard-header')}${renderStaticDoodle('scoreboard', 960, 540, 'scoreboard-board')}
        <div class="scoreboard-games">
          <div class="scoreboard-game-row">${renderWinCounter(firstId, firstScore.p1)}${renderStaticDoodle(first.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}${renderWinCounter(firstId, firstScore.p2)}</div>
          <div class="scoreboard-game-row">${renderWinCounter(secondId, secondScore.p1)}${renderStaticDoodle(second.buttonDoodle, VARIANT_BUTTON_FRAME_WIDTH, VARIANT_BUTTON_FRAME_HEIGHT, 'scoreboard-variant-button')}${renderWinCounter(secondId, secondScore.p2)}</div>
          ${renderTiebreaker(snapshot, snapshot?.gameResults?.[2] ?? null)}
        </div>
        ${renderAction(snapshot, readyPlayerId === 'p1')}
        ${snapshot?.phase !== 'gameOver' && readyPlayerId === 'p1' ? '<div class="scoreboard-waiting-message">Waiting for your opponent</div>' : ''}
      </section>
    `;
    app.querySelector('[data-action="continue"]')?.addEventListener('click', onContinue);
    app.querySelector('[data-action="main-menu"]')?.addEventListener('click', onMainMenu);
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    mountReadyWaitingOverlays(app.querySelectorAll('.scoreboard-ready'));
  }

  return { renderAction, renderScoreboard };
}
