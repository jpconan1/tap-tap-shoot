import assert from 'node:assert/strict';
import test from 'node:test';

import { createLayoutLoader, normalizeGameLayout } from '../src/layoutLoader.js';

test('layout loader caches requests and falls back to the default variant', async () => {
  const requests = [];
  const loader = createLayoutLoader({
    layoutUrls: { default: '/default.json', alternate: '/alternate.json' },
    defaultVariantId: 'default',
    fetchLayout: async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({ version: 2, variant: url, frame: { width: 960, height: 540 }, states: {} }),
      };
    },
  });

  const first = await loader.load('missing');
  const second = await loader.load('default');

  assert.equal(first, second);
  assert.deepEqual(requests, ['/default.json']);
});

test('stateful layouts inherit slots and may hide inherited slots', () => {
  const layout = normalizeGameLayout({
    version: 2,
    frame: { width: 960, height: 540 },
    states: {
      'playing.default': {
        elements: [
          { key: 'scene', x: 1, y: 2, width: 3, height: 4 },
          { key: 'button', x: 5, y: 6, width: 7, height: 8 },
        ],
      },
      result: {
        extends: 'playing.default',
        elements: [{ key: 'button', hidden: true }],
      },
    },
  });

  assert.deepEqual([...layout.states.get('result').slots.keys()], ['scene']);
  assert.equal(layout.states.get('result').slots.get('scene').x, 1);
});
