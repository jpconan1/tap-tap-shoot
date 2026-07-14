import assert from 'node:assert/strict';
import test from 'node:test';

import { createGuestTokenService, createGuestTokenServiceFromEnv } from '../server/guestToken.js';

const SECRET = 'test-secret-that-is-definitely-longer-than-32-characters';

test('guest token preserves server-issued identity across reconnects', () => {
  let nextId = 0;
  const service = createGuestTokenService({
    secret: SECRET,
    now: () => 1_000,
    createId: () => `guest-${nextId += 1}`,
  });

  const first = service.authenticate(null);
  const reconnect = service.authenticate(first.token);

  assert.equal(first.playerId, 'guest-1');
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
    createId: () => `guest-${nextId += 1}`,
  });
  const first = service.authenticate(null);

  assert.equal(service.authenticate(`${first.token}forged`).playerId, 'guest-2');
  now = 1_101;
  assert.equal(service.authenticate(first.token).playerId, 'guest-3');
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
