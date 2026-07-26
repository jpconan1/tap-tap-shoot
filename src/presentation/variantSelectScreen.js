import { VARIANT_IDS } from '../engine/moves.js';

const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 540;
const TITLE_BUTTON_FRAME_WIDTH = 256;
const TITLE_BUTTON_FRAME_HEIGHT = 128;
const VARIANT_BUTTON_FRAME_WIDTH = 325;
const VARIANT_BUTTON_FRAME_HEIGHT = 128;
const VARIANT_DIFFICULTY_TOGGLE_FRAME_WIDTH = 110;
const VARIANT_DIFFICULTY_TOGGLE_FRAME_HEIGHT = 140;
const PICK_VARIANT_FRAME_WIDTH = 388;
const PICK_VARIANT_FRAME_HEIGHT = 233;

export function createVariantSelectScreen({
  app,
  variants,
  pageSize,
  getPage,
  setPage,
  getDifficulty,
  setDifficulty,
  escapeHtml,
  mountSpriteRenderers,
  requestMusicTrack,
  onSelectVariant,
  onBack,
  onCloseDetail,
}) {
  function getPageCount() {
    return Math.max(1, Math.ceil(variants.length / pageSize));
  }

  function getPageVariants() {
    const page = Math.max(0, Math.min(getPageCount() - 1, getPage()));
    if (page !== getPage()) setPage(page);
    return variants.slice(page * pageSize, (page + 1) * pageSize);
  }

  function getSlot(variantId) {
    const index = variants.findIndex((variant) => variant.id === variantId);
    return index < 0 ? 1 : (index % pageSize) + 1;
  }

  function getVariant(variantId) {
    return variants.find((variant) => variant.id === variantId) ?? variants[0];
  }

  function renderOpenCurtainBorder() {
    return `<canvas class="sprite-canvas curtain-border" data-doodle="curtains/curtains-open" data-frame-width="${FRAME_WIDTH}" data-frame-height="${FRAME_HEIGHT}" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" aria-hidden="true"></canvas>`;
  }

  function renderBackButton() {
    return `<button class="opponent-button back-button" data-action="back-title" aria-label="Back"><canvas class="sprite-canvas opponent-button-art" data-doodle="back_button_w" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>`;
  }

  function getDifficultyDoodle() {
    return getDifficulty() === 'hard' ? 'easy_hard_toggle-hard' : 'easy_hard_toggle-easy';
  }

  function renderVariantButton(variant, slot, {
    className = '',
    dataAttribute = 'data-variant',
    disabled = false,
    content = null,
  } = {}) {
    const difficultyToggle = content ?? (variant.id === VARIANT_IDS.rockPaperScissors ? '' : `
      <span class="variant-difficulty-toggle" data-action="variant-difficulty-toggle">
        <canvas class="sprite-canvas variant-difficulty-toggle-art" data-doodle="${getDifficultyDoodle()}" data-frame-width="${VARIANT_DIFFICULTY_TOGGLE_FRAME_WIDTH}" data-frame-height="${VARIANT_DIFFICULTY_TOGGLE_FRAME_HEIGHT}" width="${VARIANT_DIFFICULTY_TOGGLE_FRAME_WIDTH}" height="${VARIANT_DIFFICULTY_TOGGLE_FRAME_HEIGHT}" aria-hidden="true"></canvas>
      </span>
    `);

    return `
      <button class="variant-button variant-slot-${slot} ${className}" ${dataAttribute}="${variant.id}" data-variant-slot="${slot}" aria-label="${escapeHtml(variant.name)}" ${disabled ? 'disabled' : ''}>
        <canvas class="sprite-canvas variant-button-art" data-doodle="${variant.buttonDoodle}" data-frame-width="${VARIANT_BUTTON_FRAME_WIDTH}" data-frame-height="${VARIANT_BUTTON_FRAME_HEIGHT}" width="${VARIANT_BUTTON_FRAME_WIDTH}" height="${VARIANT_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas>
        ${variant.buttonDoodle.startsWith('button_bg_generic') ? `<span class="variant-button-label">${escapeHtml(variant.name)}</span>` : ''}
        ${difficultyToggle}
      </button>
    `;
  }

  function renderPageControls() {
    if (getPageCount() <= 1) return '';
    return `
      <div class="variant-page-controls">
        <button class="variant-page-button" data-action="variant-page-prev" type="button" aria-label="Previous page"><canvas class="sprite-canvas variant-page-button-art" data-doodle="Prev_slide_button" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
        <button class="variant-page-button" data-action="variant-page-next" type="button" aria-label="Next page"><canvas class="sprite-canvas variant-page-button-art" data-doodle="next_slide_button" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
      </div>
    `;
  }

  function changePage(direction) {
    setPage((getPage() + direction + getPageCount()) % getPageCount());
    render();
  }

  function toggleDifficulty(event) {
    event.preventDefault();
    event.stopPropagation();
    setDifficulty(getDifficulty() === 'hard' ? 'easy' : 'hard');
    app.querySelectorAll('.variant-difficulty-toggle-art').forEach((canvas) => {
      canvas.dataset.doodle = getDifficultyDoodle();
    });
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  }

  function render() {
    requestMusicTrack('title');
    app.innerHTML = `
      <section class="title-screen opponent-select-screen computer-variant-select" aria-label="Choose variant">
        ${renderOpenCurtainBorder()}
        <canvas class="sprite-canvas pick-variant-header" data-doodle-file="pick_variant_sheet.webp" data-frame-width="${PICK_VARIANT_FRAME_WIDTH}" data-frame-height="${PICK_VARIANT_FRAME_HEIGHT}" width="${PICK_VARIANT_FRAME_WIDTH}" height="${PICK_VARIANT_FRAME_HEIGHT}" aria-label="Pick variant"></canvas>
        <div class="variant-actions">${getPageVariants().map((variant, index) => renderVariantButton(variant, index + 1)).join('')}${renderBackButton()}</div>
        ${renderPageControls()}
      </section>
    `;

    app.querySelectorAll('[data-variant]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        if (event.button <= 0) onSelectVariant(button.dataset.variant, button);
      });
      button.addEventListener('click', () => onSelectVariant(button.dataset.variant, button));
    });
    app.querySelectorAll('[data-action="variant-difficulty-toggle"]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.stopPropagation());
      button.addEventListener('click', toggleDifficulty);
    });
    app.querySelector('[data-action="back-title"]').addEventListener('click', onBack);
    app.querySelector('[data-action="variant-page-prev"]')?.addEventListener('click', () => changePage(-1));
    app.querySelector('[data-action="variant-page-next"]')?.addEventListener('click', () => changePage(1));
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
  }

  function promoteButton(button) {
    button.classList.add('variant-button-above-curtain');
    return button;
  }

  function restoreButton(button) {
    app.classList.remove('variant-detail-open');
    button?.classList.remove('variant-button-above-curtain');
  }

  function renderDetailCopy(variant) {
    return (variant.copy ?? []).map((line, index) => {
      if (index !== 0) return `<p class="">${escapeHtml(line)}</p>`;
      const sentenceEnd = String(line).indexOf('.');
      if (sentenceEnd < 0) return `<p class="lead"><span class="lead-sentence">${escapeHtml(line)}</span></p>`;
      const lead = String(line).slice(0, sentenceEnd + 1);
      const followup = String(line).slice(sentenceEnd + 1);
      return `<p class="lead"><span class="lead-sentence">${escapeHtml(lead)}</span>${escapeHtml(followup)}</p>`;
    }).join('');
  }

  function renderDetailOverlay(variant, onPlay, { actionDoodle = 'variant_play_button', slot = getSlot(variant.id) } = {}) {
    const overlay = document.createElement('div');
    overlay.className = `variant-detail-overlay variant-detail-${variant.id} variant-detail-slot-${slot}`;
    overlay.innerHTML = `
      <div class="variant-detail-copy" role="dialog" aria-modal="true" aria-label="${escapeHtml(variant.name)} rules">${renderDetailCopy(variant)}</div>
      <div class="variant-detail-actions">
        <button class="variant-detail-action" data-action="variant-back" type="button" aria-label="Back"><canvas class="sprite-canvas variant-detail-action-art" data-doodle="back_button_w" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
        <button class="variant-detail-action" data-action="variant-play" type="button" aria-label="Play ${escapeHtml(variant.name)}"><canvas class="sprite-canvas variant-detail-action-art" data-doodle="${actionDoodle}" data-frame-width="${TITLE_BUTTON_FRAME_WIDTH}" data-frame-height="${TITLE_BUTTON_FRAME_HEIGHT}" width="${TITLE_BUTTON_FRAME_WIDTH}" height="${TITLE_BUTTON_FRAME_HEIGHT}" aria-hidden="true"></canvas></button>
      </div>
    `;
    app.append(overlay);
    overlay.querySelector('[data-action="variant-play"]').addEventListener('click', () => onPlay(variant.id));
    overlay.querySelector('[data-action="variant-back"]').addEventListener('click', onCloseDetail);
    mountSpriteRenderers(app.querySelectorAll('.sprite-canvas'));
    overlay.querySelector('[data-action="variant-play"]').focus();
    return overlay;
  }

  return { getSlot, getVariant, promoteButton, render, renderDetailCopy, renderDetailOverlay, renderOpenCurtainBorder, renderVariantButton, restoreButton };
}
