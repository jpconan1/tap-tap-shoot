import assert from 'node:assert/strict';
import test from 'node:test';

import { createGuestTokenService, createGuestTokenServiceFromEnv } from '../server/guestToken.js';

const SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';
const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];

test('guest token preserves server-issued identity across reconnects', () => {
  let nextId = 0;
  const service = createGuestTokenService({
    secret: SECRET,
    now: () => 1_000,
    createId: () => IDS[nextId++],
  });

  const first = service.authenticate(null);
  const reconnect = service.authenticate(first.token);

  assert.equal(first.playerId, IDS[0]);
  assert.equal(reconnect.playerId, first.playerId);
  assert.notEqual(reconnect.token, undefined);
});

test('forged and expired guest tokens receive new identities', () => {
  let now = 1_000;
  let nextId = 0;
  const service = createGuestTokenService({
    secret: SECRET,
    tokenLifetimeMs: 100,
    now: () => now,
    createId: () => IDS[nextId++],
  });
  const first = service.authenticate(null);

  assert.equal(service.authenticate(`${first.token}forged`).playerId, IDS[1]);
  now = 1_101;
  assert.equal(service.authenticate(first.token).playerId, IDS[2]);
});

test('validly signed non-UUID identity is rejected', () => {
  let nextId = 0;
  const service = createGuestTokenService({
    secret: SECRET,
    createId: () => IDS[nextId++],
  });
  const malformed = service.issue('not-a-uuid');

  assert.equal(service.verify(malformed.token), null);
  assert.equal(service.authenticate(malformed.token).playerId, IDS[0]);
});

test('production requires a stable guest token secret', () => {
  assert.throws(
    () => createGuestTokenServiceFromEnv({ NODE_ENV: 'production' }),
    /GUEST_TOKEN_SECRET is required/,
  );
  assert.throws(
    () => createGuestTokenServiceFromEnv({ GUEST_TOKEN_SECRET: 'too-short' }),
    /at least 32 characters/,
  );
});
