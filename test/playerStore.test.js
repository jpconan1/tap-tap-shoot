import assert from 'node:assert/strict';
import test from 'node:test';

import { SupabasePlayerStore } from '../server/playerStore.js';

test('SupabasePlayerStore creates missing players', async () => {
  const rows = new Map();
  const store = new SupabasePlayerStore({ client: createFakeSupabaseClient(rows) });

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
});

test('SupabasePlayerStore maps saved player fields to database columns', async () => {
  const rows = new Map();
  const store = new SupabasePlayerStore({ client: createFakeSupabaseClient(rows) });

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

function createFakeSupabaseClient(rows) {
  return {
    from(tableName) {
      assert.equal(tableName, 'players');
      return new FakePlayersQuery(rows);
    },
  };
}

class FakePlayersQuery {
  constructor(rows) {
    this.rows = rows;
    this.pendingRow = null;
    this.filterId = null;
  }

  select() {
    return this;
  }

  eq(column, value) {
    assert.equal(column, 'id');
    this.filterId = value;
    return this;
  }

  maybeSingle() {
    return {
      data: this.rows.get(this.filterId) ?? null,
      error: null,
    };
  }

  upsert(row) {
    this.pendingRow = { ...row };
    return this;
  }

  single() {
    this.rows.set(this.pendingRow.id, this.pendingRow);
    return {
      data: this.pendingRow,
      error: null,
    };
  }
}
