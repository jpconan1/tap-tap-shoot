import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { MemoryPlayerStore } from '../server/playerStore.js';
import { RankedDuelService } from '../server/rankedDuel.js';
import { attachWebSocketServer } from '../server/webSocket.js';

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
    onConnection(connection, request) {
      const params = new URL(request.url, `http://${request.headers.host}`).searchParams;
      service.connect(connection, params.get('playerId')).then((session) => {
        connection.onMessage((raw) => service.receive(session, JSON.parse(raw)));
        connection.onClose(() => service.disconnect(session));
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
  const p1 = new WebSocket(`ws://127.0.0.1:${port}/ws?playerId=p1`);
  const p2 = new WebSocket(`ws://127.0.0.1:${port}/ws?playerId=p2`);
  const p1Hello = waitForType(p1, 'hello');
  const p2Hello = waitForType(p2, 'hello');

  try {
    await Promise.all([waitForOpen(p1), waitForOpen(p2)]);
    assert.equal((await p1Hello).rating, 1000);
    assert.equal((await p2Hello).rating, 1000);

    p1.send(JSON.stringify({ type: 'joinRanked' }));
    p2.send(JSON.stringify({ type: 'joinRanked' }));

    const p1State = await waitForType(p1, 'matchState');
    const p2State = await waitForType(p2, 'matchState');

    assert.equal(p1State.phase, 'countdown');
    assert.equal(p2State.phase, 'countdown');
    assert.notEqual(p1State.playerKey, p2State.playerKey);
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
    maxMessageBytes: 128,
    heartbeatMs: 0,
    onConnection(connection, request) {
      const params = new URL(request.url, `http://${request.headers.host}`).searchParams;
      service.connect(connection, params.get('playerId')).then((session) => {
        connection.onMessage((raw) => service.receive(session, JSON.parse(raw)));
        connection.onClose(() => service.disconnect(session));
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
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?playerId=p1`);
  const hello = waitForType(socket, 'hello');

  try {
    await waitForOpen(socket);
    await hello;
    socket.send(JSON.stringify({
      type: 'joinRanked',
      padding: 'x'.repeat(512),
    }));
    await waitForClose(socket);

    const nextSocket = new WebSocket(`ws://127.0.0.1:${port}/ws?playerId=p2`);
    const nextHello = waitForType(nextSocket, 'hello');
    try {
      await waitForOpen(nextSocket);
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
