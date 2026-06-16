import assert from 'node:assert/strict';
import test from 'node:test';

import { SupabasePlayerStore } from '../server/playerStore.js';

test('SupabasePlayerStore creates missing players', async () => {
  const rows = new Map();
  const requests = [];
  const store = new SupabasePlayerStore({
    url: 'https://example.supabase.co',
    secretKey: 'sb_secret_test',
    fetchImpl: createFakeSupabaseFetch(rows, requests),
  });

  const player = await store.getPlayer('p1');

  assert.deepEqual(player, {
    id: 'p1',
    rating: 1000,
    wins: 0,
    losses: 0,
    lastPlayed: null,
  });
  assert.deepEqual(rows.get('p1'), {
    id: 'p1',
    rating: 1000,
    wins: 0,
    losses: 0,
    last_played: null,
  });
  assert.equal(requests[0].headers.apikey, 'sb_secret_test');
  assert.equal(requests[0].headers.Authorization, undefined);
});

test('SupabasePlayerStore maps saved player fields to database columns', async () => {
  const rows = new Map();
  const store = new SupabasePlayerStore({
    url: 'https://example.supabase.co',
    secretKey: 'sb_secret_test',
    fetchImpl: createFakeSupabaseFetch(rows),
  });

  const saved = await store.savePlayer({
    id: 'p1',
    rating: 1016,
    wins: 1,
    losses: 0,
    lastPlayed: '2026-06-16T12:00:00.000Z',
  });

  assert.deepEqual(saved, {
    id: 'p1',
    rating: 1016,
    wins: 1,
    losses: 0,
    lastPlayed: '2026-06-16T12:00:00.000Z',
  });
  assert.equal(rows.get('p1').last_played, '2026-06-16T12:00:00.000Z');
});

function createFakeSupabaseFetch(rows, requests = []) {
  return async (url, options = {}) => {
    requests.push({ url, ...options });

    if (options.method === 'POST') {
      const row = JSON.parse(options.body);
      rows.set(row.id, row);
      return createJsonResponse([row]);
    }

    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    const row = rows.get(id);
    return createJsonResponse(row ? [row] : []);
  };
}

function createJsonResponse(data) {
  return {
    ok: true,
    async json() {
      return data;
    },
  };
}
