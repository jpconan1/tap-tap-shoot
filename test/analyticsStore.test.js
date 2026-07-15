import assert from 'node:assert/strict';
import test from 'node:test';

import { SupabaseAnalyticsStore } from '../server/analyticsStore.js';

test('SupabaseAnalyticsStore initializes with production credentials', () => {
  const store = new SupabaseAnalyticsStore({
    url: 'https://example.supabase.co',
    secretKey: 'sb_secret_test',
  });

  assert.equal(store.url, 'https://example.supabase.co');
  assert.equal(store.secretKey, 'sb_secret_test');
});
