import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerStore } from '../server/index.js';
import { FallbackPlayerStore, JsonPlayerStore, SupabasePlayerStore } from '../server/playerStore.js';

test('production requires Supabase ranking credentials', () => {
  assert.throws(
    () => createPlayerStore({ env: { NODE_ENV: 'production' }, root: '/tmp' }),
    /SUPABASE_URL and SUPABASE_SECRET_KEY are required/,
  );
});

test('production falls back locally when Supabase is unavailable', async () => {
  const store = createPlayerStore({
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://database.example',
      SUPABASE_SECRET_KEY: 'secret',
    },
    root: '/tmp',
  });

  assert.equal(store instanceof FallbackPlayerStore, true);
  assert.equal(store.primary instanceof SupabasePlayerStore, true);
  store.primary.fetch = async () => {
    throw new Error('Supabase unavailable');
  };

  const player = await store.getPlayer('offline-player');

  assert.equal(player.id, 'offline-player');
  assert.equal(store.useFallback, true);
});

test('local development still supports the JSON player store', () => {
  const store = createPlayerStore({ env: { NODE_ENV: 'development' }, root: '/tmp' });
  assert.equal(store instanceof JsonPlayerStore, true);
});
