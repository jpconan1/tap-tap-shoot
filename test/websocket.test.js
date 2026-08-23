import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { MemoryPlayerStore } from '../server/playerStore.js';
import { RankedDuelService } from '../server/rankedDuel.js';
import {
  createWebSocketOriginPolicy,
  attachWebSocketServer,
  createIpConnectionLimiter,
  createSlidingWindowLimiter,
  getClientIp,
} from '../server/webSocket.js';
import { attachRankedConnection } from '../server/index.js';
import { createGuestTokenService } from '../server/guestToken.js';

const TOKEN_SECRET = 'websocket-test-secret-that-is-longer-than-32-characters';

test('IP connection limiter caps active sockets and rolling attempts', () => {
  let now = 0;
  const limiter = createIpConnectionLimiter({
    maxActive: 2,
    maxAttempts: 3,
    windowMs: 60_000,
    now: () => now,
  });
  const first = limiter.acquire('203.0.113.1');
  const second = limiter.acquire('203.0.113.1');

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(limiter.acquire('203.0.113.1').reason, 'active');
  first.release();
  assert.equal(limiter.acquire('203.0.113.1').reason, 'attempts');

  now = 60_001;
  assert.equal(limiter.acquire('203.0.113.1').ok, true);
  second.release();
});

test('message limiter permits bursts up to limit then recovers', () => {
  let now = 0;
  const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 1_000, now: () => now });

  assert.equal(limiter.allow(), true);
  assert.equal(limiter.allow(), true);
  assert.equal(limiter.allow(), false);
  now = 1_001;
  assert.equal(limiter.allow(), true);
});

test('proxy IP is trusted only when explicitly enabled', () => {
  const request = {
    headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
  };

  assert.equal(getClientIp(request), '127.0.0.1');
  assert.equal(getClientIp(request, { trustProxy: true }), '198.51.100.4');
});

test('origin report mode observes unknown websites without blocking them', () => {
  const summaries = [];
  const policy = createWebSocketOriginPolicy({
    mode: 'report',
    allowedOrigins: ['https://tap-tap-shoot.onrender.com'],
    onSummary: (summary) => summaries.push(summary),
  });

  assert.deepEqual(policy.check('https://tap-tap-shoot.onrender.com'), {
    ok: true,
    status: 'allowed',
  });
  assert.deepEqual(policy.check('https://evil.example'), {
    ok: true,
    status: 'wouldReject',
  });
  assert.deepEqual(policy.check(undefined), {
    ok: true,
    status: 'missing',
  });

  policy.flushSummary();
  assert.deepEqual(summaries[0], {
    mode: 'report',
    allowed: 1,
    missing: 1,
    wouldReject: 1,
    origins: {
      'https://tap-tap-shoot.onrender.com': 1,
      'https://evil.example': 1,
    },
  });
});

test('origin enforcement rejects unknown websites but permits native clients without Origin', () => {
  const policy = createWebSocketOriginPolicy({
    mode: 'enforce',
    allowedOrigins: ['https://tap-tap-shoot.onrender.com'],
  });

  assert.equal(policy.check('https://evil.example').ok, false);
  assert.equal(policy.check(undefined).ok, true);
});

test('messages sent immediately after hello wait for authentication to finish', async () => {
  let messageListener;
  const received = [];
  const connection = {
    close() {},
    onClose() {},
    onMessage(listener) {
      messageListener = listener;
    },
    send(raw) {
      const message = JSON.parse(raw);
      if (message.type === 'hello') {
        messageListener(JSON.stringify({ type: 'enterLobby', displayName: 'JP' }));
      }
    },
  };
  const rankedDuel = {
    async connect(client, playerId, token) {
      client.send(JSON.stringify({ type: 'hello' }));
      await Promise.resolve();
      return { playerId, token };
    },
    receive(session, message) {
      received.push({ session, message });
    },
  };

  attachRankedConnection(connection, {
    rankedDuel,
    guestTokens: createGuestTokenService({ secret: TOKEN_SECRET }),
  });
  messageListener(JSON.stringify({ type: 'authenticateGuest', token: null }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(received.length, 1);
  assert.equal(received[0].message.type, 'enterLobby');
  assert.equal(received[0].message.displayName, 'JP');
});

test('WebSocket clients can connect, queue, and receive match state', async (t) => {
  const service = new RankedDuelService({
    playerStore: new MemoryPlayerStore(),
    countdownMs: 1000,
    turnMs: 1000,
    revealMs: 1000,
    now: () => 0,
    createId: createIncrementingId(),
  });
  const server = createServer();

  attachWebSocketServer(server, {
    path: '/ws',
    onConnection(connection) {
      attachRankedConnection(connection, {
        rankedDuel: service,
        guestTokens: createGuestTokenService({ secret: TOKEN_SECRET }),
      });
    },
  });

  try {
    await listen(server);
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('sandbox does not allow binding localhost');
      return;
    }

    throw error;
  }
  const { port } = server.address();
  const p1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const p2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const p1Hello = waitForType(p1, 'hello');
  const p2Hello = waitForType(p2, 'hello');

  try {
    await Promise.all([waitForOpen(p1), waitForOpen(p2)]);
    p1.send(JSON.stringify({ type: 'authenticateGuest', token: null }));
    p2.send(JSON.stringify({ type: 'authenticateGuest', token: null }));
    assert.equal((await p1Hello).rating, 1000);
    assert.equal((await p2Hello).rating, 1000);

    p1.send(JSON.stringify({ type: 'joinRanked', displayName: 'JP' }));
    p2.send(JSON.stringify({ type: 'joinRanked', displayName: 'Chatman' }));

    const p1State = await waitForType(p1, 'matchState');
    const p2State = await waitForType(p2, 'matchState');

    assert.equal(p1State.phase, 'countdown');
    assert.equal(p2State.phase, 'countdown');
    assert.notEqual(p1State.playerKey, p2State.playerKey);
    assert.equal(p1State.players[p1State.playerKey].displayName, 'JP');
    assert.equal(p2State.players[p2State.playerKey].displayName, 'Chatman');
  } finally {
    p1.close();
    p2.close();
    await closeServer(server);
  }
});

test('WebSocket closes oversized messages without killing server', async (t) => {
  const service = new RankedDuelService({
    playerStore: new MemoryPlayerStore(),
    now: () => 0,
    createId: createIncrementingId(),
  });
  const server = createServer();

  attachWebSocketServer(server, {
    path: '/ws',
    maxMessageBytes: 512,
    heartbeatMs: 0,
    onConnection(connection) {
      attachRankedConnection(connection, {
        rankedDuel: service,
        guestTokens: createGuestTokenService({ secret: TOKEN_SECRET }),
      });
    },
  });

  try {
    await listen(server);
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('sandbox does not allow binding localhost');
      return;
    }

    throw error;
  }

  const { port } = server.address();
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const hello = waitForType(socket, 'hello');

  try {
    await waitForOpen(socket);
    socket.send(JSON.stringify({ type: 'authenticateGuest', token: null }));
    await hello;
    socket.send(JSON.stringify({
      type: 'joinRanked',
      padding: 'x'.repeat(1024),
    }));
    await waitForClose(socket);

    const nextSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const nextHello = waitForType(nextSocket, 'hello');
    try {
      await waitForOpen(nextSocket);
      nextSocket.send(JSON.stringify({ type: 'authenticateGuest', token: null }));
      assert.equal((await nextHello).rating, 1000);
    } finally {
      nextSocket.close();
    }
  } finally {
    socket.close();
    await closeServer(server);
  }
});

test('WebSocket enforces connection caps', async (t) => {
  const server = createServer();

  attachWebSocketServer(server, {
    path: '/ws',
    maxConnections: 1,
    heartbeatMs: 0,
    onConnection() {},
  });

  try {
    await listen(server);
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('sandbox does not allow binding localhost');
      return;
    }

    throw error;
  }

  const { port } = server.address();
  const first = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const second = new WebSocket(`ws://127.0.0.1:${port}/ws`);

  try {
    await waitForOpen(first);
    await assert.rejects(waitForOpen(second));
  } finally {
    first.close();
    second.close();
    await closeServer(server);
  }
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
}

function waitForType(socket, type) {
  return new Promise((resolve) => {
    socket.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data);

      if (message.type === type) {
        socket.removeEventListener('message', onMessage);
        resolve(message);
      }
    });
  });
}

function waitForClose(socket) {
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    socket.addEventListener('close', resolve, { once: true });
    socket.addEventListener('error', resolve, { once: true });
  });
}

function createIncrementingId() {
  let next = 0;
  return () => `id-${next += 1}`;
}
