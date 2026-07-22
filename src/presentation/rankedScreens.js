const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const VARIANT_BUTTON_FRAME_WIDTH = 325;
const VARIANT_BUTTON_FRAME_HEIGHT = 128;
const ONLINE_HEADER_FRAME_WIDTH = 1518;
const ONLINE_HEADER_FRAME_HEIGHT = 512;
const BAN_HEADER_FRAME_WIDTH = 910;
const BAN_HEADER_FRAME_HEIGHT = 512;

export function getScoreboardVariantScore(snapshot, variantId) {
  const result = snapshot?.gameResults?.find((gameResult) => gameResult.variantId === variantId);
  return {
    p1: result?.roundWins?.[snapshot.playerKey] ?? 0,
    p2: result?.roundWins?.[snapshot.opponentKey] ?? 0,
  };
}

export function createRankedScreens({
  app,
  variants,
  getSnapshot,
  getDisplayName,
  isBanAnimationComplete,
  markBanAnimationComplete,
  escapeHtml,
  getVariant,
  renderVariantButton,
  renderOpenCurtainBorder,
  renderStaticDoodle,
  getWinCounterDoodle,
  renderSheetButton,
  mountSpriteRenderers,
  mountReadyWaitingOverlays,
  mountBanAnimations,
  onLeave,
  onPickVariant,
  onShowVariantDetail,
  onContinue,
  onMainMenu,
}) {
  function getRankedVariants(snapshot) {
    return (snapshot?.variants ?? []).map((rankedVariant) => (
      variants.find((variant) => variant.id === rankedVariant.id) ?? {
        id: rankedVariant.id,
        name: rankedVariant.label,
        buttonDoodle: getVariant(rankedVariant.id).buttonDoodle,
      }
    )).filter(Boolean);
  }

  function renderQuitButton() {
    return `<button class="opponent-button back-button" data-action="quit" aria-label="Back"><canvas class="sprite-canvas opponent-button-art" data-doodle="back_button_w" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>`;
  }

  function renderVariantPickButton({ variant, slot, disabled, picked, banned, firstPicked, isTiebreakerBan }) {
    const showSettledBan = isTiebreakerBan && (banned || isBanAnimationComplete(variant.id));
    const showBanAnimation = isTiebreakerBan && picked && !showSettledBan;
    return renderVariantButton(variant, slot, {
      className: `ranked-variant-pick ${picked ? 'picked' : ''} ${banned ? 'banned' : ''} ${isTiebreakerBan ? 'tiebreaker-ban' : ''}`,
      dataAttribute: 'data-pick-variant',
      disabled,
      content: showSettledBan
        ? renderStaticDoodle('ban-animation/x', 300, 256, 'ranked-ban-mark')
        : showBanAnimation
          ? `<canvas class="ranked-ban-animation" data-variant-id="${variant.id}" width="300" height="256" aria-hidden="true"></canvas>`
          : firstPicked ? '<canvas class="ranked-variant-ready" width="300" height="256" aria-hidden="true"></canvas>' : '',
    });
  }

  function renderVariantSelection() {
    const snapshot = getSnapshot();
    const picks = snapshot.variantPicks ?? snapshot.bans ?? {};
    const pickedVariants = new Set(Object.values(picks));
    const bannedVariants = new Set(snapshot.bannedVariants ?? []);
    const playerPick = picks[snapshot.playerKey];
    const isTiebreakerBan = snapshot.variantSelectionRound === 2;
    const firstPickedVariant = picks[snapshot.variantPickOrder?.[0]];
    const headerDoodle = isTiebreakerBan ? 'header-ban-variant_sheet.webp'
      : firstPickedVariant ? 'header-second-variant_sheet.webp' : 'header-first-variant_sheet.webp';
    const headerWidth = isTiebreakerBan ? BAN_HEADER_FRAME_WIDTH : ONLINE_HEADER_FRAME_WIDTH;
    const headerHeight = isTiebreakerBan ? BAN_HEADER_FRAME_HEIGHT : ONLINE_HEADER_FRAME_HEIGHT;

    app.innerHTML = `
      <section class="title-screen opponent-select-screen variant-ban-screen ${isTiebreakerBan ? 'tiebreaker-ban-stage' : ''}" aria-label="${isTiebreakerBan ? 'Ban variant' : 'Pick variant'}">
        ${renderOpenCurtainBorder()}
        <canvas class="sprite-canvas pick-variant-header online-stage-header" data-doodle-file="${headerDoodle}" data-frame-width="${headerWidth}" data-frame-height="${headerHeight}" width="${headerWidth}" height="${headerHeight}" aria-label="${isTiebreakerBan ? 'Ban variant' : 'Pick variant'}"></canvas>
        <div class="variant-actions">
          ${getRankedVariants(snapshot).map((variant, index) => renderVariantPickButton({
            variant,
            slot: index + 1,
            disabled: Boolean(playerPick) || pickedVariants.has(variant.id) || bannedVariants.has(variant.id),
            picked: pickedVariants.has(variant.id),
            banned: bannedVariants.has(variant.id),
            firstPicked: firstPickedVariant === variant.id,
            isTiebreakerBan,
          })).join('')}${renderQuitButton()}
        </div>
        ${isTiebreakerBan && snapshot.variantPickOrder?.[0] === snapshot.playerKey ? '<div class="tiebreaker-ban-waiting">Waiting for your opponent</div>' : ''}
      </section>
    `;
    app.querySelector('[data-action="quit"]')?.addEventListener('click', onLeave);
    app.querySelectorAll('[data-pick-variant]').forEach((button) => button.addEventListener('click', () => {
      if (isTiebreakerBan) onPickVariant(button.dataset.pickVariant);
      else onShowVariantDetail(button.dataset.pickVariant, button);
    }));
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    mountReadyWaitingOverlays(app.querySelectorAll('.ranked-variant-ready'));
    app.querySelectorAll('.ranked-ban-animation').forEach((canvas) => canvas.addEventListener('ban-animation-complete', () => markBanAnimationComplete(canvas.dataset.variantId), { once: true }));
    mountBanAnimations(app.querySelectorAll('.ranked-ban-animation'));
  }

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

  return { getRankedVariants, renderAction, renderScoreboard, renderVariantSelection, renderVariantPickButton };
}
