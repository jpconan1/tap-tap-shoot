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

  try {
    await Promise.all([waitForOpen(p1), waitForOpen(p2)]);
    assert.equal((await waitForType(p1, 'hello')).rating, 1000);
    assert.equal((await waitForType(p2, 'hello')).rating, 1000);

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

function createIncrementingId() {
  let next = 0;
  return () => `id-${next += 1}`;
}
