import assert from 'node:assert/strict';
import test from 'node:test';

import { FallbackPlayerStore, MemoryPlayerStore, SupabasePlayerStore } from '../server/playerStore.js';

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
  assert.equal(requests[0].headers.Authorization, 'Bearer sb_secret_test');
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

test('SupabasePlayerStore records both ranked players through one RPC', async () => {
  const requests = [];
  const store = new SupabasePlayerStore({
    url: 'https://example.supabase.co',
    secretKey: 'sb_secret_test',
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options });
      return createJsonResponse({
        winner: { id: 'p1', rating: 1016, wins: 1, losses: 0, last_played: '2026-07-14T12:00:00.000Z' },
        loser: { id: 'p2', rating: 984, wins: 0, losses: 1, last_played: '2026-07-14T12:00:00.000Z' },
      });
    },
  });

  const saved = await store.recordMatchResult({
    matchId: 'match-1',
    winnerId: 'p1',
    loserId: 'p2',
    playedAt: '2026-07-14T12:00:00.000Z',
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/rest/v1/rpc/record_ranked_match');
  assert.deepEqual(JSON.parse(requests[0].body), {
    p_match_id: 'match-1',
    p_winner_id: 'p1',
    p_loser_id: 'p2',
    p_played_at: '2026-07-14T12:00:00.000Z',
  });
  assert.equal(saved.winner.rating, 1016);
  assert.equal(saved.loser.rating, 984);
});

test('MemoryPlayerStore updates both ranked players in one operation', async () => {
  const store = new MemoryPlayerStore();

  const saved = await store.recordMatchResult({
    matchId: 'match-1',
    winnerId: 'p1',
    loserId: 'p2',
    playedAt: '2026-07-14T12:00:00.000Z',
  });

  assert.equal(saved.winner.rating, 1016);
  assert.equal(saved.winner.wins, 1);
  assert.equal(saved.loser.rating, 984);
  assert.equal(saved.loser.losses, 1);
});

test('SupabasePlayerStore reports Supabase errors', async () => {
  const store = new SupabasePlayerStore({
    url: 'https://example.supabase.co',
    secretKey: 'sb_secret_test',
    fetchImpl: async () => createJsonResponse({
      message: 'permission denied for table players',
    }, { ok: false, status: 401 }),
  });

  await assert.rejects(
    () => store.getPlayer('p1'),
    /Could not load player: permission denied for table players/,
  );
});

test('SupabasePlayerStore requires credentials', () => {
  assert.throws(
    () => new SupabasePlayerStore({ url: '', secretKey: '' }),
    /requires a url and secret key/,
  );
});

test('FallbackPlayerStore uses fallback after primary player load fails', async () => {
  const errors = [];
  const primary = {
    async getPlayer() {
      throw new Error('primary down');
    },
    async savePlayer() {
      throw new Error('primary down');
    },
  };
  const store = new FallbackPlayerStore(primary, new MemoryPlayerStore(), {
    onError(error) {
      errors.push(error.message);
    },
  });

  assert.equal((await store.getPlayer('p1')).id, 'p1');
  assert.deepEqual(errors, ['primary down']);
  assert.equal((await store.savePlayer({
    id: 'p1',
    rating: 1016,
    wins: 1,
    losses: 0,
    lastPlayed: null,
  })).rating, 1016);
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

function createJsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return data;
    },
    async text() {
      return JSON.stringify(data);
    },
  };
}
