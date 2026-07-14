import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerStore } from '../server/index.js';
import { JsonPlayerStore, SupabasePlayerStore } from '../server/playerStore.js';

test('production requires Supabase ranking credentials', () => {
  assert.throws(
    () => createPlayerStore({ env: { NODE_ENV: 'production' }, root: '/tmp' }),
    /SUPABASE_URL and SUPABASE_SECRET_KEY are required/,
  );
});

test('production uses Supabase without local fallback', () => {
  const store = createPlayerStore({
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://database.example',
      SUPABASE_SECRET_KEY: 'secret',
    },
    root: '/tmp',
  });

  assert.equal(store instanceof SupabasePlayerStore, true);
});

test('local development still supports the JSON player store', () => {
  const store = createPlayerStore({ env: { NODE_ENV: 'development' }, root: '/tmp' });
  assert.equal(store instanceof JsonPlayerStore, true);
});
