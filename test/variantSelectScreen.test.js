import assert from 'node:assert/strict';
import test from 'node:test';

import { createVariantSelectScreen } from '../src/presentation/variantSelectScreen.js';

const variants = [
  { id: 'rockPaperScissors', name: 'Rock & Paper', buttonDoodle: 'rps', copy: ['First sentence. More words.', 'Second line.'] },
  { id: 'fireballWar', name: 'Fireball War', buttonDoodle: 'fireball', copy: [] },
  { id: 'gunKnifeFist', name: 'Gun Knife Fist', buttonDoodle: 'gkf', copy: [] },
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

test('variant detail copy emphasizes only the first sentence', () => {
  const { screen } = createScreen();
  const markup = screen.renderDetailCopy(variants[0]);

  assert.match(markup, /<span class="lead-sentence">First sentence\.<\/span> More words\./);
  assert.match(markup, /<p class="">Second line\.<\/p>/);
});
