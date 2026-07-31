import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { createVariantSelectScreen } from '../src/presentation/variantSelectScreen.js';
import { VARIANT_SELECT_VARIANTS } from '../src/variantSelectConfig.js';

const variants = [
  { id: 'rockPaperScissors', name: 'Rock & Paper', buttonDoodle: 'rps', buttonArt: { file: 'variant_screen/rps.webp', width: 320, height: 192 }, copy: ['First sentence. More words.', 'Second line.'] },
  { id: 'fireballWar', name: 'Fireball War', buttonDoodle: 'fireball', buttonArt: { file: 'variant_screen/fireball.webp', width: 326, height: 80 }, copy: [] },
  { id: 'gunKnifeFist', name: 'Gun Knife Fist', buttonDoodle: 'gkf', buttonArt: { file: 'variant_screen/gkf.webp', width: 196, height: 292 }, copy: [] },
];

function createScreen(overrides = {}) {
  let page = 0;
  let difficulty = 'easy';
  const screen = createVariantSelectScreen({
    app: {},
    variants,
    pageSize: 2,
    getPage: () => page,
    setPage: (value) => { page = value; },
    getDifficulty: () => difficulty,
    setDifficulty: (value) => { difficulty = value; },
    escapeHtml: (value) => String(value).replaceAll('&', '&amp;'),
    mountSpriteRenderers() {},
    requestMusicTrack() {},
    onSelectVariant() {},
    onBack() {},
    onCloseDetail() {},
    ...overrides,
  });
  return { screen, getPage: () => page };
}

test('canonical selection metadata contains nine native three-frame sheets', () => {
  assert.equal(VARIANT_SELECT_VARIANTS.length, 9);
  assert.equal(VARIANT_SELECT_VARIANTS.some(({ id }) => id === 'tapTapShootY'), false);
  for (const variant of VARIANT_SELECT_VARIANTS) {
    assert.match(variant.buttonArt.file, /^variant_screen\/.+_button_sheet\.webp$/);
    assert.equal(existsSync(new URL(`../assets/${variant.buttonArt.file}`, import.meta.url)), true);
    assert.equal(Number.isInteger(variant.buttonArt.width), true);
    assert.equal(Number.isInteger(variant.buttonArt.height), true);
  }
});

test('variant selection calculates stable slots and fallback variants', () => {
  const { screen } = createScreen();

  assert.equal(screen.getSlot('rockPaperScissors'), 1);
  assert.equal(screen.getSlot('gunKnifeFist'), 1);
  assert.equal(screen.getSlot('missing'), 1);
  assert.equal(screen.getVariant('missing'), variants[0]);
});

test('variant buttons omit difficulty for classic RPS', () => {
  const { screen } = createScreen();

  assert.doesNotMatch(screen.renderVariantButton(variants[0], 1), /variant-difficulty-toggle/);
  assert.match(screen.renderVariantButton(variants[1], 2), /easy_hard_toggle-easy/);
  assert.match(screen.renderVariantButton(variants[0], 1), /aria-label="Rock &amp; Paper"/);
});

test('variant buttons use native canvas resolution and half-size CSS art', () => {
  const { screen } = createScreen();
  const markup = screen.renderVariantButton({
    id: 'prototype',
    name: 'Kitchen & Sink!',
    buttonDoodle: 'button_bg_generic2',
    buttonArt: { file: 'variant_screen/kitchen.webp', width: 328, height: 264 },
  }, 1);

  assert.match(markup, /data-doodle-file="variant_screen\/kitchen\.webp"/);
  assert.match(markup, /width="328" height="264"/);
  assert.match(markup, /--variant-art-width:164px;--variant-art-height:132px/);
  assert.match(markup, /aria-label="Kitchen &amp; Sink!"/);
  assert.doesNotMatch(markup, /variant-button-label/);
});

test('variant detail copy emphasizes only the first sentence', () => {
  const { screen } = createScreen();
  const markup = screen.renderDetailCopy(variants[0]);

  assert.match(markup, /<span class="lead-sentence">First sentence\.<\/span> More words\./);
  assert.match(markup, /<p class="">Second line\.<\/p>/);
});

test('variant detail mounts in the dedicated modal layer', () => {
  const mounted = [];
  const detailRoot = { append: (element) => mounted.push(element) };
  const fakeOverlay = {
    className: '',
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => ({
      addEventListener() {},
      focus() {},
    }),
  };
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => fakeOverlay };

  try {
    const { screen } = createScreen({ detailRoot });
    screen.renderDetailOverlay(variants[0], () => {});
  } finally {
    globalThis.document = previousDocument;
  }

  assert.deepEqual(mounted, [fakeOverlay]);
  assert.match(fakeOverlay.innerHTML, /class="alert-box variant-detail-panel"/);
});
